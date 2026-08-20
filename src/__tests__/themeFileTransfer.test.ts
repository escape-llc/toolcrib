import { describe, it, expect, vi } from 'vitest';
import { downloadThemeSnapshot, readThemeSnapshotFromFile } from '../theme/themeFileTransfer';
import { type ThemeSnapshot } from '../theme/themePersistence';

const sampleSnapshot: ThemeSnapshot = { schemaVersion: 1, parameters: { baseColor: { h: 10, s: 20, v: 30 } } };

describe('downloadThemeSnapshot', () => {
  it('creates an object URL, clicks a download link, and revokes the URL', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as typeof URL.revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    try {
      downloadThemeSnapshot(sampleSnapshot, 'my-theme.json');

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    } finally {
      clickSpy.mockRestore();
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });
});

describe('readThemeSnapshotFromFile', () => {
  it('parses and validates a well-formed theme file', async () => {
    const file = new File([JSON.stringify(sampleSnapshot)], 'theme.json', { type: 'application/json' });
    const result = await readThemeSnapshotFromFile(file);
    expect(result).toEqual(sampleSnapshot);
  });

  it('rejects invalid JSON with a helpful message', async () => {
    const file = new File(['not json {{'], 'broken.json', { type: 'application/json' });
    await expect(readThemeSnapshotFromFile(file)).rejects.toThrow(/not valid JSON/);
  });

  it('rejects valid JSON that is not a theme snapshot', async () => {
    const file = new File([JSON.stringify({ hello: 'world' })], 'wrong.json', { type: 'application/json' });
    await expect(readThemeSnapshotFromFile(file)).rejects.toThrow(/doesn't look like a toolcrib theme/);
  });
});
