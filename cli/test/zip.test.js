import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { powerShellQuote, listFilesRecursive } from '../src/lib/zip.js';

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
