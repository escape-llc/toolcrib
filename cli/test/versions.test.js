import { describe, it, expect, vi, beforeEach } from 'vitest';

// versionsCommand's own job is formatting/reporting a list -- how the list
// is actually fetched (real GitHub API, rate-limit handling) is
// lib/github.js's own concern and network-dependent, same reason
// merge.test.js mocks lib/release.js instead of hitting the network here.
vi.mock('../src/lib/github.js', () => ({
  listVersions: vi.fn(),
}));

import { listVersions } from '../src/lib/github.js';
import { versionsCommand } from '../src/commands/versions.js';

describe('versionsCommand', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fetches and completes without throwing when releases are returned', async () => {
    listVersions.mockResolvedValue([
      { version: '2.0.0', publishedAt: '2026-01-15T00:00:00Z', prerelease: false },
      { version: '1.5.0', publishedAt: '2025-11-01T00:00:00Z', prerelease: false },
      { version: '1.6.0-beta.1', publishedAt: '2025-12-01T00:00:00Z', prerelease: true },
    ]);

    await expect(versionsCommand()).resolves.not.toThrow();
    expect(listVersions).toHaveBeenCalledTimes(1);
  });

  it('completes without throwing when there are no releases at all', async () => {
    listVersions.mockResolvedValue([]);

    await expect(versionsCommand()).resolves.not.toThrow();
  });

  it('propagates a real fetch failure (e.g. rate limit) rather than swallowing it', async () => {
    listVersions.mockRejectedValue(new Error('GitHub API rate limit exhausted'));

    await expect(versionsCommand()).rejects.toThrow('rate limit exhausted');
  });
});
