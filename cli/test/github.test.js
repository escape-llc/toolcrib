import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// github.js reads TOOLCRIB_API_BASE/TOOLCRIB_RELEASES_BASE at import time,
// so set overrides before importing it, keeping these tests fully offline.
process.env.TOOLCRIB_API_BASE = 'http://localhost:9999/api';
process.env.TOOLCRIB_RELEASES_BASE = 'http://localhost:9999/releases';

const { listVersions, resolveVersion, fetchLatestVersion, downloadReleaseZip } = await import('../src/lib/github.js');

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

    const result = await downloadReleaseZip('1.0.0');
    expect(result.equals(content)).toBe(true);
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

    await expect(downloadReleaseZip('1.0.0')).rejects.toThrow(/Checksum mismatch/);
  });

  it('throws when the checksum asset fails to fetch, rather than silently skipping verification', async () => {
    const content = Buffer.from('fake zip contents');

    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith('.sha256')) {
        return { ok: false, status: 404, statusText: 'Not Found' };
      }
      return { ok: true, arrayBuffer: async () => content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) };
    });

    await expect(downloadReleaseZip('1.0.0')).rejects.toThrow(/Failed to fetch checksum/);
  });

  it('throws when the zip asset itself fails to download (distinct from a merely-missing checksum sibling)', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith('.sha256')) {
        return { ok: true, text: async () => 'irrelevant  toolcrib.zip\n' };
      }
      return { ok: false, status: 404, statusText: 'Not Found' };
    });

    await expect(downloadReleaseZip('1.0.0')).rejects.toThrow(/404/);
  });
});
