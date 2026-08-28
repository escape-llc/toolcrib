import { describe, it, expect, vi, afterEach } from 'vitest';

// A dedicated file specifically so TOOLCRIB_API_BASE/TOOLCRIB_RELEASES_BASE
// are genuinely unset before github.js's module-level `||` fallback reads
// them -- github.test.js (the main suite) deliberately sets both before
// its own dynamic import, for good reason (keeps every other test there
// fully offline against a fake local base), but that means the *default*
// side of that fallback (real api.github.com / github.com) never gets
// exercised there at all.
describe('github.js default API/releases base (no override env vars set)', () => {
  afterEach(() => {
    delete process.env.TOOLCRIB_API_BASE;
    delete process.env.TOOLCRIB_RELEASES_BASE;
    vi.restoreAllMocks();
  });

  it('falls back to the real api.github.com host when TOOLCRIB_API_BASE is unset', async () => {
    delete process.env.TOOLCRIB_API_BASE;
    delete process.env.TOOLCRIB_RELEASES_BASE;
    const { listVersions } = await import('../src/lib/github.js');

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => [] });

    await listVersions();

    expect(fetchMock).toHaveBeenCalledWith('https://api.github.com/repos/escape-llc/toolcrib/releases', expect.anything());
  });
});
