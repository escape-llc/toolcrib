import crypto from 'node:crypto';

const REPO = 'escape-llc/toolcrib';
const ASSET_NAME = 'toolcrib.zip';
const CHECKSUM_ASSET_NAME = 'toolcrib.zip.sha256';

// Optional overrides for tests/mirrors — unset in normal use, everything
// targets real GitHub. Integration tests point these at a local server
// so the full download/verify/extract pipeline runs for real without
// depending on network access or a published release existing.
const API_BASE = process.env.TOOLCRIB_API_BASE || 'https://api.github.com';
const RELEASES_BASE = process.env.TOOLCRIB_RELEASES_BASE || `https://github.com/${REPO}/releases`;

/**
 * List published (non-draft) releases from the GitHub API, newest first.
 * No auth needed for public repos; subject to the standard 60/hr
 * unauthenticated rate limit, which is fine for occasional CLI use.
 */
export async function listVersions() {
  const res = await fetch(`${API_BASE}/repos/${REPO}/releases`, {
    headers: { Accept: 'application/vnd.github+json' },
  });

  if (!res.ok) {
    // GitHub's unauthenticated rate limit (60/hr, shared across every caller
    // on the same IP — e.g. a shared CI runner or sandbox) surfaces as a
    // plain 403, indistinguishable from a real auth/network failure unless
    // the response headers are inspected. Left as a generic error, this
    // sends whoever/whatever hits it down a diagnostic path (checking
    // headers, retrying with curl, poking at User-Agent) to rediscover a
    // fix (`toolcrib init --version <x.y.z>`) that already exists and is
    // documented — see CLI README. Checked here so the message states the
    // real cause and the real fix directly, instead of a bare status code.
    const remaining = res.status === 403 ? res.headers?.get?.('x-ratelimit-remaining') : null;
    if (res.status === 403 && remaining === '0') {
      const resetHeader = res.headers?.get?.('x-ratelimit-reset');
      const resetAt = resetHeader ? new Date(Number(resetHeader) * 1000).toLocaleTimeString() : 'unknown';
      throw new Error(
        `GitHub's unauthenticated API rate limit (60 requests/hour, shared by IP) is exhausted — ` +
          `resets around ${resetAt}. This only affects version *discovery* ("latest" resolution); it ` +
          `does not affect release downloads themselves. Fix: run \`toolcrib init --version <x.y.z>\` ` +
          `(or \`apply\`/\`merge\` with an explicit version) with a version you already know, which skips ` +
          `this call entirely.`
      );
    }
    throw new Error(`Failed to fetch release list: ${res.status} ${res.statusText}`);
  }

  const releases = await res.json();

  return releases
    .filter((r) => !r.draft)
    .map((r) => ({
      version: r.tag_name.replace(/^v/, ''),
      publishedAt: r.published_at,
      prerelease: r.prerelease,
    }));
}

function assetUrl(version, assetName) {
  return version === 'latest'
    ? `${RELEASES_BASE}/latest/download/${assetName}`
    : `${RELEASES_BASE}/download/v${version}/${assetName}`;
}

/**
 * Resolve "latest" to a concrete version string, so callers (and CLI
 * output) always know exactly what was fetched rather than the moving
 * target name. Always print this — see index.js — so re-running
 * `init latest` after a new release appears is never a silent surprise.
 */
export async function resolveVersion(version) {
  if (version !== 'latest') return version;
  const versions = await listVersions();
  const newest = versions.find((v) => !v.prerelease);
  if (!newest) throw new Error('No published releases found.');
  return newest.version;
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  return res.text();
}

async function fetchBuffer(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Download a release zip + its checksum sibling, verify integrity,
 * and return the raw buffer. Throws on mismatch (corrupted/truncated
 * download, or a tampered file at rest — see design notes on what a
 * checksum does and doesn't guarantee against a compromised source).
 */
export async function downloadReleaseZip(version) {
  const zipUrl = assetUrl(version, ASSET_NAME);
  const checksumUrl = assetUrl(version, CHECKSUM_ASSET_NAME);

  const [zipBuffer, checksumText] = await Promise.all([
    fetchBuffer(zipUrl),
    fetchText(checksumUrl).catch(() => null), // tolerate older releases with no checksum asset
  ]);

  if (checksumText) {
    const expected = checksumText.trim().split(/\s+/)[0];
    const actual = sha256(zipBuffer);
    if (actual !== expected) {
      throw new Error(
        `Checksum mismatch for ${ASSET_NAME} (expected ${expected}, got ${actual}). ` +
          `The download may be corrupted or incomplete — try again.`
      );
    }
  }

  return zipBuffer;
}
