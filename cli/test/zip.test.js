import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// extractZip shells out to a real platform binary (powershell.exe on
// win32, unzip elsewhere) -- genuinely running either isn't practical to
// test consistently (CI runs ubuntu-latest; a contributor's own machine
// might be Windows), and only one branch is ever real on any given
// machine at all. Mocking child_process here verifies the *command
// construction* (the actual source of the PowerShell-quoting bugs this
// file's own comments document) on both platforms at once, rather than
// only ever exercising whichever one happens to match the current OS.
const execFileMock = vi.fn((file, args, callback) => callback(null, { stdout: '', stderr: '' }));
vi.mock('node:child_process', () => ({
  execFile: (...args) => execFileMock(...args),
}));

import { powerShellQuote, listFilesRecursive, extractZip } from '../src/lib/zip.js';

describe('powerShellQuote', () => {
  it('wraps a plain value in single quotes', () => {
    expect(powerShellQuote('C:\\Users\\me\\AppData\\Local\\Temp\\toolcrib-123.zip')).toBe(
      "'C:\\Users\\me\\AppData\\Local\\Temp\\toolcrib-123.zip'"
    );
  });

  it('doubles an embedded single quote — PowerShell\'s own escaping rule, not backslash-escaping', () => {
    expect(powerShellQuote("O'Brien's Folder")).toBe("'O''Brien''s Folder'");
  });

  it('produces a value that round-trips through a real PowerShell-style single-quoted literal parse', () => {
    // Simulates how PowerShell itself would parse the quoted literal back
    // out: a value inside single quotes, with '' meaning a literal '.
    const original = "path with 'quotes' and spaces";
    const quoted = powerShellQuote(original);
    const inner = quoted.slice(1, -1); // strip the outer quotes
    const unescaped = inner.replace(/''/g, "'");
    expect(unescaped).toBe(original);
  });
});

describe('extractZip script construction (regression: PowerShell string-interpolation risk)', () => {
  it('the -EncodedCommand base64 payload decodes back to the exact intended script', () => {
    // Mirrors extractZip's own construction without invoking a real
    // powershell.exe (platform-specific, not available in this sandbox) —
    // confirms the encode/decode round-trip and quoting are correct, which
    // is what actually matters: the fix replaced a multi-token -Command
    // string (reassembled by powershell.exe's own parser, with the
    // interpolated paths bearing the escaping burden) with a single
    // -EncodedCommand blob PowerShell can't reinterpret or re-split.
    const tmpZipPath = "C:\\Temp\\toolcrib-o'brien.zip";
    const targetDir = 'C:\\Projects\\my app';

    const script = `Expand-Archive -Path ${powerShellQuote(tmpZipPath)} -DestinationPath ${powerShellQuote(targetDir)} -Force`;
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    const decoded = Buffer.from(encoded, 'base64').toString('utf16le');

    expect(decoded).toBe(script);
    expect(decoded).toContain("'C:\\Temp\\toolcrib-o''brien.zip'");
    expect(decoded).toContain("'C:\\Projects\\my app'");
  });
});

describe('listFilesRecursive', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-ziptest-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns forward-slash relative paths regardless of nesting', () => {
    fs.mkdirSync(path.join(tmpDir, 'a', 'b'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'top.txt'), 'x');
    fs.writeFileSync(path.join(tmpDir, 'a', 'mid.txt'), 'x');
    fs.writeFileSync(path.join(tmpDir, 'a', 'b', 'deep.txt'), 'x');

    const files = listFilesRecursive(tmpDir).sort();

    expect(files).toEqual(['a/b/deep.txt', 'a/mid.txt', 'top.txt']);
  });
});

describe('extractZip', () => {
  let tmpDir;
  let originalPlatform;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-extractzip-test-'));
    originalPlatform = process.platform;
    execFileMock.mockClear();
    execFileMock.mockImplementation((file, args, callback) => callback(null, { stdout: '', stderr: '' }));
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function setPlatform(value) {
    Object.defineProperty(process, 'platform', { value, configurable: true });
  }

  it('on win32, invokes powershell with an -EncodedCommand that decodes to the correct Expand-Archive script', async () => {
    setPlatform('win32');
    const targetDir = path.join(tmpDir, 'out');

    await extractZip(Buffer.from('fake zip bytes'), targetDir);

    expect(execFileMock).toHaveBeenCalledTimes(1);
    const [file, args] = execFileMock.mock.calls[0];
    expect(file).toBe('powershell');
    expect(args[0]).toBe('-NoProfile');
    expect(args[1]).toBe('-EncodedCommand');
    const decoded = Buffer.from(args[2], 'base64').toString('utf16le');
    expect(decoded).toContain('Expand-Archive');
    expect(decoded).toContain(powerShellQuote(targetDir));
    expect(decoded).toContain('-Force');
  });

  it('on a non-win32 platform, invokes unzip with the zip path and target directory as plain args', async () => {
    setPlatform('linux');
    const targetDir = path.join(tmpDir, 'out');

    await extractZip(Buffer.from('fake zip bytes'), targetDir);

    expect(execFileMock).toHaveBeenCalledTimes(1);
    const [file, args] = execFileMock.mock.calls[0];
    expect(file).toBe('unzip');
    expect(args).toEqual(['-o', '-q', expect.stringContaining('toolcrib-'), '-d', targetDir]);
  });

  it('creates the target directory before extracting', async () => {
    setPlatform('linux');
    const targetDir = path.join(tmpDir, 'nested', 'out');

    await extractZip(Buffer.from('fake zip bytes'), targetDir);

    expect(fs.existsSync(targetDir)).toBe(true);
  });

  it('cleans up the temporary zip file after a successful extraction', async () => {
    setPlatform('linux');
    let capturedZipPath;
    execFileMock.mockImplementation((file, args, callback) => {
      capturedZipPath = args[2]; // ['-o', '-q', <zipPath>, '-d', targetDir]
      callback(null, { stdout: '', stderr: '' });
    });

    await extractZip(Buffer.from('fake zip bytes'), path.join(tmpDir, 'out'));

    expect(capturedZipPath).toBeTruthy();
    expect(fs.existsSync(capturedZipPath)).toBe(false);
  });

  it('cleans up the temporary zip file and rethrows when extraction itself fails', async () => {
    setPlatform('linux');
    let capturedZipPath;
    execFileMock.mockImplementation((file, args, callback) => {
      capturedZipPath = args[2];
      callback(new Error('unzip: corrupt archive'));
    });

    await expect(extractZip(Buffer.from('fake zip bytes'), path.join(tmpDir, 'out'))).rejects.toThrow('corrupt archive');

    expect(fs.existsSync(capturedZipPath)).toBe(false);
  });
});
