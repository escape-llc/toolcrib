import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Extract a zip buffer into a target directory.
 *
 * Node has no built-in zip reader, and adding a full unzip *library*
 * pulls in native bindings or a nontrivial pure-JS implementation for
 * something the OS/toolchain almost always already provides. Since this
 * is CLI-only code (never vendored to the consumer's project — see the
 * CLI-vs-vendored dependency boundary discussed in design), shelling out
 * to a platform unzip tool is a reasonable, low-dependency choice here.
 * If you'd rather have zero external-binary reliance, swap this for the
 * `unzipper` or `yauzl` npm package — either is fine for CLI-only code.
 */
/**
 * Escape a value for embedding inside a PowerShell single-quoted string
 * literal. PowerShell's escape rule for a single quote inside a
 * single-quoted string is to double it (`''`), not backslash-escape it —
 * this is PowerShell's own rule, unrelated to Node/shell escaping.
 */
export function powerShellQuote(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

export async function extractZip(zipBuffer, targetDir) {
  await fsp.mkdir(targetDir, { recursive: true });

  const tmpZipPath = path.join(os.tmpdir(), `toolcrib-${Date.now()}.zip`);
  await fsp.writeFile(tmpZipPath, zipBuffer);

  try {
    if (process.platform === 'win32') {
      // PowerShell's Expand-Archive ships on all modern Windows installs.
      //
      // The script text is passed via -EncodedCommand (a base64-encoded
      // UTF-16LE string) rather than as a plain -Command string built by
      // interpolating paths directly into single-quoted PowerShell literals.
      // execFile doesn't invoke a shell, so Node itself never reinterprets
      // these arguments — but powershell.exe's own argument handling for a
      // multi-token -Command re-joins everything after it into one script
      // line, which put the actual escaping burden on this string being
      // built correctly to begin with. -EncodedCommand takes exactly one
      // argument (the encoded blob) with nothing left for powershell.exe's
      // own parser to re-split or reinterpret, and powerShellQuote() above
      // still applies PowerShell's real single-quote escaping rule to each
      // value, so a path containing a literal `'` (however unlikely from
      // os.tmpdir()/mkdtemp() in practice) is handled correctly rather than
      // relying on that never happening.
      const script = `Expand-Archive -Path ${powerShellQuote(tmpZipPath)} -DestinationPath ${powerShellQuote(targetDir)} -Force`;
      const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
      await execFileAsync('powershell', ['-NoProfile', '-EncodedCommand', encodedScript]);
    } else {
      await execFileAsync('unzip', ['-o', '-q', tmpZipPath, '-d', targetDir]);
    }
  } finally {
    await fsp.unlink(tmpZipPath).catch(() => {});
  }
}

/**
 * Recursively list files under a directory, returning paths relative to it.
 * Always forward-slash, regardless of host OS: these relPaths become git
 * patch header paths downstream (see commands/init.js, merge.js), and git
 * apply rejects backslash-separated paths outright. path.relative() returns
 * backslash-separated paths on win32 — confirmed via a real end-to-end run
 * on Windows that every nested vendored file failed to apply until this
 * was normalized here, at the source, rather than at each call site.
 */
export function listFilesRecursive(dir, base = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let results = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(listFilesRecursive(full, base));
    } else {
      results.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return results;
}
