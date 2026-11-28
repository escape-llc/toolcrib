import crypto from 'node:crypto';
import * as p from '@clack/prompts';
import { assertValidVersion } from './version.js';
import { PROVENANCE_ASSET_NAME, SIGNED_SINCE, isSignedRelease, loadTrustMaterial, verifyProvenance } from './provenance.js';

const REPO = 'escape-llc/toolcrib';
const ASSET_NAME = 'toolcrib.zip';

// Exported so release.js's fetchTestsRelease can request it by name without
// restringing 'toolcrib-tests.zip' a second time — the optional test-suite
// artifact scripts/build-tests-release.js/package-tests-release.js already
// build and release.yml already publishes on every release (see
// toolcrib init --with-tests).
export const TESTS_ASSET_NAME = 'toolcrib-tests.zip';

// Optional overrides for tests/mirrors — unset in normal use, everything
// targets real GitHub. Integration tests point these at a local server
// so the full download/verify/extract pipeline runs for real without
// depending on network access or a published release existing.
const API_BASE = process.env.TOOLCRIB_API_BASE || 'https://api.github.com';
const RELEASES_BASE = process.env.TOOLCRIB_RELEASES_BASE || `https://github.com/${REPO}/releases`;

// GitHub's unauthenticated rate limit (60/hr, shared across every caller on
// the same IP — e.g. a shared CI runner or sandbox) surfaces as a plain 403,
// indistinguishable from a real auth/network failure unless the response
// headers are inspected. Left as a generic error, this sends whoever/
// whatever hits it down a diagnostic path (checking headers, retrying with
// curl, poking at User-Agent) to rediscover a fix (`toolcrib init --version
// <x.y.z>`) that already exists and is documented — see CLI README. Checked
// here so the message states the real cause and the real fix directly,
// instead of a bare status code. Shared by every GitHub API call in this
// file (not just listVersions' original one) since the failure mode and fix
// are identical regardless of which endpoint hit it.
function throwGitHubApiError(res, context) {
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
  throw new Error(`Failed to fetch ${context}: ${res.status} ${res.statusText}`);
}

/**
 * List published (non-draft) releases from the GitHub API, newest first.
 * No auth needed for public repos; subject to the standard 60/hr
 * unauthenticated rate limit, which is fine for occasional CLI use.
 *
 * Only `versionsCommand` (`toolcrib versions`, which prints every release)
 * actually needs this full list — resolving "latest" doesn't, see
 * fetchLatestVersion below.
 */
export async function listVersions() {
  const res = await fetch(`${API_BASE}/repos/${REPO}/releases`, {
    headers: { Accept: 'application/vnd.github+json' },
  });

  if (!res.ok) throwGitHubApiError(res, 'release list');

  const releases = await res.json();

  return releases
    .filter((r) => !r.draft)
    .map((r) => ({
      version: r.tag_name.replace(/^v/, ''),
      publishedAt: r.published_at,
      prerelease: r.prerelease,
    }));
}

/**
 * Resolve "latest" to a concrete version string via GitHub's own dedicated
 * `/releases/latest` endpoint — "the most recent non-prerelease, non-draft
 * release" by GitHub's own definition, matching exactly what resolveVersion
 * used to compute client-side (`listVersions().find(v => !v.prerelease)`)
 * after fetching *every* release's full metadata just to find the first
 * one. Same 60/hr quota cost either way (one request either way), but a
 * much smaller response and the semantically-correct endpoint for this
 * exact question. 404 means no qualifying release exists yet, per GitHub's
 * own documented behavior for this endpoint.
 *
 * Refuses a "latest" older than SIGNED_SINCE (#1016). That release is
 * published, so the newest release can never legitimately be older than it.
 * Accepting one would let anyone able to create a release (a leaked
 * contents:write token) mark a fake, unsigned old tag as latest and get it
 * installed with SHA-256 checking only. An explicit --version still installs
 * an older release, because then the user chose it.
 */
export async function fetchLatestVersion() {
  const res = await fetch(`${API_BASE}/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  });

  if (res.status === 404) throw new Error('No published releases found.');
  if (!res.ok) throwGitHubApiError(res, 'the latest release');

  const release = await res.json();
  const version = assertValidVersion(String(release.tag_name).replace(/^v/, ''), 'GitHub API latest release tag');
  if (!isSignedRelease(version)) {
    throw new Error(
      `GitHub reports v${version} as the latest release, which is older than v${SIGNED_SINCE}, the first signed release. ` +
        `The latest release can't be older than that, so this one is refused. ` +
        `To install an older release on purpose, pass --version <x.y.z>.`
    );
  }
  return version;
}

/**
 * Fetch security-advisories.json fresh from the toolcrib repo's own
 * `main` branch -- never from a consumer's vendored copy, which is a
 * frozen snapshot from whatever version they installed and structurally
 * can't know about anything published after that (see
 * scripts/generate-security-advisories.js for how the file itself is
 * generated, from real CodeQL alert state, never hand-authored).
 *
 * Uses the Contents API's raw media type to get the file's bytes
 * directly rather than base64-decoding the default JSON-wrapped
 * response. A missing file (a fresh main with nothing published yet, or
 * before this file's first commit) is treated as "no advisories," not an
 * error -- unlike every other call in this file, absence here is the
 * normal, expected starting state, not a failure.
 *
 * Public, unauthenticated read (unlike the generator script, which needs
 * a token to read the code-scanning alerts API this file is derived
 * from) -- a consumer's `doctor` run never needs credentials for this.
 */
export async function fetchSecurityAdvisories() {
  const res = await fetch(`${API_BASE}/repos/${REPO}/contents/security-advisories.json?ref=main`, {
    headers: { Accept: 'application/vnd.github.raw+json' },
  });

  if (res.status === 404) return [];
  if (!res.ok) throwGitHubApiError(res, 'security-advisories.json');

  return JSON.parse(await res.text());
}

export function assetUrl(version, assetName) {
  if (version === 'latest') return `${RELEASES_BASE}/latest/download/${assetName}`;
  assertValidVersion(version, 'release download version');
  return `${RELEASES_BASE}/download/v${version}/${assetName}`;
}

/**
 * Resolve "latest" to a concrete version string, so callers (and CLI
 * output) always know exactly what was fetched rather than the moving
 * target name. Always print this — see index.js — so re-running
 * `init latest` after a new release appears is never a silent surprise.
 */
export async function resolveVersion(version) {
  if (version !== 'latest') return assertValidVersion(version, '--version argument');
  return fetchLatestVersion();
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

// One Sigstore bundle per version per process: a version's core and tests
// zips are both attested by the same bundle, and `merge` fetches two
// versions in parallel, so the bundle is fetched and parsed once and every
// asset of that version shares the promise. The "predates signing" note is
// likewise printed once per version, by whichever call created the entry.
const bundleByVersion = new Map();

/** Test seam: forget every cached bundle. */
export function resetBundleCache() {
  bundleByVersion.clear();
}

function getBundle(version) {
  if (!bundleByVersion.has(version)) {
    const url = assetUrl(version, PROVENANCE_ASSET_NAME);
    bundleByVersion.set(
      version,
      // One try/catch around both the fetch and the parse, so a malformed
      // bundle gets the same message and isn't cached either (.then(ok, fail)
      // would let a JSON.parse throw from `ok` skip `fail`).
      (async () => {
        try {
          return JSON.parse(await fetchText(url));
        } catch (err) {
          // Don't cache a failure: a later call in the same process may succeed.
          bundleByVersion.delete(version);
          throw new Error(
            `Failed to fetch the Sigstore provenance bundle for v${version} (${err.message}). ` +
              `Releases since v${SIGNED_SINCE} are signed, so a missing or unreadable bundle is ` +
              `treated as a failed verification. Refusing to install an unverified download.`
          );
        }
      })()
    );
  }
  return bundleByVersion.get(version);
}

/**
 * Download a release zip, verify it, and return `{ zipBuffer, provenance }`.
 * Throws on any verification failure.
 *
 * Two layers, both mandatory where they apply:
 *
 * 1. SHA-256 against the `.sha256` sibling. Catches a corrupted or
 *    truncated download. It does NOT stop a tampered release: the sibling
 *    lives in the same GitHub release as the zip, so whoever can replace the
 *    zip can replace the checksum. Every published release has shipped one,
 *    so a failed fetch of it (missing, network error, or an on-path actor
 *    blocking just that request) is an integrity failure, not an
 *    older-release gap.
 * 2. For versions >= SIGNED_SINCE, the Sigstore bundle
 *    (`toolcrib-release.sigstore.json`) from the same release: proves the
 *    zip was built by this repo's release.yml for this version's own tag
 *    (see lib/provenance.js). A missing or invalid bundle is a hard error.
 *    Older releases predate signing; they're verified by SHA-256 only and
 *    a note says so.
 *
 * `provenance` is 'sigstore' or 'sha256' according to which of those
 * actually verified the download, for callers to record and report.
 *
 * `version` may be 'latest' (resolved here, so the version checked against
 * the signing identity is the concrete one), though every in-repo caller
 * already passes a resolved version.
 *
 * `assetName` defaults to the core toolkit zip; release.js's
 * fetchTestsRelease passes TESTS_ASSET_NAME to fetch the optional
 * test-suite artifact via this exact same verified-download path instead
 * of a parallel one — the checksum sibling is always `${assetName}.sha256`,
 * the one naming convention both assets already share, and both assets are
 * subjects of the same Sigstore bundle.
 */
export async function downloadReleaseZip(requestedVersion, assetName = ASSET_NAME) {
  const version = await resolveVersion(requestedVersion);
  const checksumAssetName = `${assetName}.sha256`;
  const zipUrl = assetUrl(version, assetName);
  const checksumUrl = assetUrl(version, checksumAssetName);

  const [zipBuffer, checksumText] = await Promise.all([
    fetchBuffer(zipUrl),
    fetchText(checksumUrl).catch((err) => {
      throw new Error(
        `Failed to fetch checksum for ${assetName} (${err.message}). ` +
          `Refusing to install an unverified download.`
      );
    }),
  ]);

  const expected = checksumText.trim().split(/\s+/)[0];
  const actual = sha256(zipBuffer);
  if (actual !== expected) {
    throw new Error(
      `Checksum mismatch for ${assetName} (expected ${expected}, got ${actual}). ` +
        `The download may be corrupted or incomplete — try again.`
    );
  }

  if (!isSignedRelease(version)) {
    if (!bundleByVersion.has(version)) {
      bundleByVersion.set(version, Promise.resolve(null));
      p.log.info(`v${version} predates release signing (v${SIGNED_SINCE}); verified by SHA-256 only.`);
    }
    return { zipBuffer, provenance: 'sha256' };
  }

  const bundleJson = await getBundle(version);
  const { trustMaterial, source } = await loadTrustMaterial();
  verifyProvenance({ bundleJson, assetName, digestHex: actual, version, trustMaterial, trustSource: source });

  return { zipBuffer, provenance: 'sigstore' };
}
