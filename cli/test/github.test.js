import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import * as p from '@clack/prompts';

// Real cryptographic verification is covered against a real bundle in
// provenance.test.js. Here only the seam is stubbed, so github.js's own
// orchestration (which versions get verified, bundle fetching/caching,
// error handling) can be tested with fake zip contents, fully offline.
vi.mock('../src/lib/provenance.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadTrustMaterial: vi.fn(),
  verifyProvenance: vi.fn(),
}));

// github.js reads TOOLCRIB_API_BASE/TOOLCRIB_RELEASES_BASE at import time,
// so set overrides before importing it, keeping these tests fully offline.
process.env.TOOLCRIB_API_BASE = 'http://localhost:9999/api';
process.env.TOOLCRIB_RELEASES_BASE = 'http://localhost:9999/releases';

const { listVersions, resolveVersion, fetchLatestVersion, downloadReleaseZip, fetchSecurityAdvisories, resetBundleCache } =
  await import('../src/lib/github.js');
const { loadTrustMaterial, verifyProvenance } = await import('../src/lib/provenance.js');

describe('listVersions', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('filters out draft releases and strips the leading v from tag names', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        { tag_name: 'v1.5.0', published_at: '2026-06-01T00:00:00Z', prerelease: false, draft: false },
        { tag_name: 'v1.6.0-beta', published_at: '2026-07-01T00:00:00Z', prerelease: true, draft: false },
        { tag_name: 'v1.4.0', published_at: '2026-05-01T00:00:00Z', prerelease: false, draft: true },
      ],
    });

    const versions = await listVersions();
    expect(versions).toEqual([
      { version: '1.5.0', publishedAt: '2026-06-01T00:00:00Z', prerelease: false },
      { version: '1.6.0-beta', publishedAt: '2026-07-01T00:00:00Z', prerelease: true },
    ]);
  });

  it('throws a clear error when the GitHub API responds with an error status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });
    await expect(listVersions()).rejects.toThrow(/404/);
  });

  it('gives a specific, actionable message when the unauthenticated rate limit is exhausted', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers: {
        get: (name) => ({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1780000000' })[name] ?? null,
      },
    });
    await expect(listVersions()).rejects.toThrow(/rate limit/i);
    await expect(listVersions()).rejects.toThrow(/--version/);
  });

  it('falls back to the generic message for a 403 that is not a rate-limit exhaustion', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers: { get: () => null },
    });
    await expect(listVersions()).rejects.toThrow(/403/);
    await expect(listVersions()).rejects.not.toThrow(/rate limit/i);
  });

  it('does not throw a TypeError when the response has no headers object at all', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' });
    await expect(listVersions()).rejects.toThrow(/403/);
  });
});

describe('fetchLatestVersion', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('resolves via the dedicated /releases/latest endpoint and strips the leading v', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ tag_name: 'v1.9.0', published_at: '2026-07-01T00:00:00Z', prerelease: false, draft: false }),
    });
    const result = await fetchLatestVersion();
    expect(result).toBe('1.9.0');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/releases/latest'), expect.any(Object));
  });

  it('throws a clear error when no qualifying release exists (GitHub 404s /releases/latest in that case)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });
    await expect(fetchLatestVersion()).rejects.toThrow('No published releases found.');
  });

  it('gives the same specific, actionable message when the unauthenticated rate limit is exhausted', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers: {
        get: (name) => ({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1780000000' })[name] ?? null,
      },
    });
    await expect(fetchLatestVersion()).rejects.toThrow(/rate limit/i);
    await expect(fetchLatestVersion()).rejects.toThrow(/--version/);
  });
});

describe('fetchSecurityAdvisories', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('fetches security-advisories.json off main and parses it', async () => {
    const advisories = [{ alertNumber: 5, fixedIn: '0.14.0', severity: 'high', summary: 'x', url: 'https://x' }];
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify(advisories) });

    const result = await fetchSecurityAdvisories();
    expect(result).toEqual(advisories);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/contents/security-advisories.json?ref=main'),
      expect.objectContaining({ headers: { Accept: 'application/vnd.github.raw+json' } })
    );
  });

  it('treats a missing file (404) as no advisories, not an error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });
    const result = await fetchSecurityAdvisories();
    expect(result).toEqual([]);
  });

  it('throws a clear error on a real API failure', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });
    await expect(fetchSecurityAdvisories()).rejects.toThrow(/500/);
  });
});

describe('resolveVersion', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('passes an explicit version straight through without calling the API', async () => {
    const result = await resolveVersion('1.2.0');
    expect(result).toBe('1.2.0');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves "latest" via fetchLatestVersion (the dedicated /releases/latest endpoint)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ tag_name: 'v1.9.0', published_at: '2026-07-01T00:00:00Z', prerelease: false, draft: false }),
    });
    const result = await resolveVersion('latest');
    expect(result).toBe('1.9.0');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/releases/latest'), expect.any(Object));
  });

  it('throws a clear error when no qualifying release exists to resolve "latest" to', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });
    await expect(resolveVersion('latest')).rejects.toThrow('No published releases found.');
  });
});

describe('downloadReleaseZip checksum verification', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('succeeds when the downloaded content matches the published checksum', async () => {
    const content = Buffer.from('fake zip contents');
    // sha256 of "fake zip contents"
    const crypto = await import('node:crypto');
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith('.sha256')) {
        return { ok: true, text: async () => `${hash}  toolcrib.zip\n` };
      }
      return { ok: true, arrayBuffer: async () => content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) };
    });

    const result = await downloadReleaseZip('0.16.0');
    expect(result.zipBuffer.equals(content)).toBe(true);
    expect(result.provenance).toBe('sha256');
  });

  it('throws when the downloaded content does not match the published checksum', async () => {
    const content = Buffer.from('fake zip contents');
    const wrongHash = 'a'.repeat(64);

    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith('.sha256')) {
        return { ok: true, text: async () => `${wrongHash}  toolcrib.zip\n` };
      }
      return { ok: true, arrayBuffer: async () => content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) };
    });

    await expect(downloadReleaseZip('0.16.0')).rejects.toThrow(/Checksum mismatch/);
  });

  it('throws when the checksum asset fails to fetch, rather than silently skipping verification', async () => {
    const content = Buffer.from('fake zip contents');

    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith('.sha256')) {
        return { ok: false, status: 404, statusText: 'Not Found' };
      }
      return { ok: true, arrayBuffer: async () => content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) };
    });

    await expect(downloadReleaseZip('0.16.0')).rejects.toThrow(/Failed to fetch checksum/);
  });

  it('throws when the zip asset itself fails to download (distinct from a merely-missing checksum sibling)', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith('.sha256')) {
        return { ok: true, text: async () => 'irrelevant  toolcrib.zip\n' };
      }
      return { ok: false, status: 404, statusText: 'Not Found' };
    });

    await expect(downloadReleaseZip('0.16.0')).rejects.toThrow(/404/);
  });

  it('requests a non-default asset name (and its own .sha256 sibling) when one is passed — used by fetchTestsRelease', async () => {
    const content = Buffer.from('fake tests zip contents');
    const crypto = await import('node:crypto');
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    const requestedUrls = [];
    fetchMock.mockImplementation(async (url) => {
      requestedUrls.push(String(url));
      if (String(url).endsWith('.sha256')) {
        return { ok: true, text: async () => `${hash}  toolcrib-tests.zip\n` };
      }
      return { ok: true, arrayBuffer: async () => content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) };
    });

    const result = await downloadReleaseZip('0.16.0', 'toolcrib-tests.zip');
    expect(result.zipBuffer.equals(content)).toBe(true);
    expect(requestedUrls.some((u) => u.endsWith('/toolcrib-tests.zip'))).toBe(true);
    expect(requestedUrls.some((u) => u.endsWith('/toolcrib-tests.zip.sha256'))).toBe(true);
    // Never requests the core asset's own checksum when a different name was passed.
    expect(requestedUrls.some((u) => u.endsWith('/toolcrib.zip.sha256'))).toBe(false);
  });

  it('a checksum mismatch is still detected for a non-default asset name', async () => {
    const content = Buffer.from('fake tests zip contents');
    const wrongHash = 'b'.repeat(64);

    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith('.sha256')) {
        return { ok: true, text: async () => `${wrongHash}  toolcrib-tests.zip\n` };
      }
      return { ok: true, arrayBuffer: async () => content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) };
    });

    await expect(downloadReleaseZip('0.16.0', 'toolcrib-tests.zip')).rejects.toThrow(/Checksum mismatch/);
  });
});

describe('downloadReleaseZip provenance', () => {
  let fetchMock;
  let infoSpy;
  const content = Buffer.from('fake zip contents');
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  const bundle = { mediaType: 'fake-bundle' };

  /** Serves a zip, any asset's .sha256, and (unless `bundleStatus` is 404) the bundle. */
  function serve({ bundleStatus = 200 } = {}) {
    fetchMock.mockImplementation(async (url) => {
      const u = String(url);
      if (u.endsWith('.sha256')) return { ok: true, text: async () => `${hash}  x\n` };
      if (u.endsWith('.sigstore.json')) {
        return bundleStatus === 200
          ? { ok: true, text: async () => JSON.stringify(bundle) }
          : { ok: false, status: bundleStatus, statusText: 'Not Found' };
      }
      return { ok: true, arrayBuffer: async () => content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) };
    });
  }

  const bundleFetches = () => fetchMock.mock.calls.filter(([u]) => String(u).endsWith('.sigstore.json'));

  beforeEach(() => {
    resetBundleCache();
    fetchMock = vi.spyOn(globalThis, 'fetch');
    infoSpy = vi.spyOn(p.log, 'info').mockImplementation(() => {});
    loadTrustMaterial.mockReset().mockResolvedValue({ trustMaterial: { fake: true }, source: 'tuf' });
    verifyProvenance.mockReset();
  });

  afterEach(() => {
    fetchMock.mockRestore();
    infoSpy.mockRestore();
  });

  it('verifies the bundle for a release since 0.17.0 and reports provenance "sigstore"', async () => {
    serve();
    const result = await downloadReleaseZip('0.17.0');
    expect(result.provenance).toBe('sigstore');
    expect(verifyProvenance).toHaveBeenCalledWith({
      bundleJson: bundle,
      assetName: 'toolcrib.zip',
      digestHex: hash,
      version: '0.17.0',
      trustMaterial: { fake: true },
      trustSource: 'tuf',
    });
    expect(bundleFetches()[0][0]).toBe('http://localhost:9999/releases/download/v0.17.0/toolcrib-release.sigstore.json');
  });

  it('throws when the bundle cannot be fetched, rather than falling back to SHA-256 only', async () => {
    serve({ bundleStatus: 404 });
    await expect(downloadReleaseZip('0.17.0')).rejects.toThrow(/provenance bundle.*404.*Refusing to install/s);
    expect(verifyProvenance).not.toHaveBeenCalled();
  });

  it('does not cache a failed bundle fetch', async () => {
    serve({ bundleStatus: 404 });
    await expect(downloadReleaseZip('0.17.0')).rejects.toThrow();
    serve();
    await expect(downloadReleaseZip('0.17.0')).resolves.toMatchObject({ provenance: 'sigstore' });
  });

  it('propagates a verification failure', async () => {
    serve();
    verifyProvenance.mockImplementation(() => {
      throw new Error('bad signature');
    });
    await expect(downloadReleaseZip('0.17.0')).rejects.toThrow('bad signature');
  });

  it('fetches the bundle once when two assets of the same version are downloaded in parallel', async () => {
    serve();
    await Promise.all([downloadReleaseZip('0.17.0'), downloadReleaseZip('0.17.0', 'toolcrib-tests.zip')]);
    expect(bundleFetches()).toHaveLength(1);
    expect(verifyProvenance.mock.calls.map(([a]) => a.assetName).sort()).toEqual(['toolcrib-tests.zip', 'toolcrib.zip']);
  });

  it('fetches a separate bundle per version', async () => {
    serve();
    await Promise.all([downloadReleaseZip('0.17.0'), downloadReleaseZip('0.18.0')]);
    expect(bundleFetches()).toHaveLength(2);
  });

  it('skips the bundle for a release before 0.17.0, with a note, once per version', async () => {
    serve({ bundleStatus: 404 });
    const [a, b] = await Promise.all([downloadReleaseZip('0.16.9'), downloadReleaseZip('0.16.9', 'toolcrib-tests.zip')]);
    expect(a.provenance).toBe('sha256');
    expect(b.provenance).toBe('sha256');
    expect(bundleFetches()).toHaveLength(0);
    expect(verifyProvenance).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0][0]).toMatch(/v0\.16\.9 predates release signing.*SHA-256 only/);
  });

  it('resolves "latest" to a concrete version before choosing how to verify', async () => {
    fetchMock.mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/api/repos/')) return { ok: true, json: async () => ({ tag_name: 'v0.16.0' }) };
      if (u.endsWith('.sha256')) return { ok: true, text: async () => `${hash}  x\n` };
      return { ok: true, arrayBuffer: async () => content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) };
    });
    const result = await downloadReleaseZip('latest');
    expect(result.provenance).toBe('sha256');
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/download/v0.16.0/toolcrib.zip'))).toBe(true);
  });
});
