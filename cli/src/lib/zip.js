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
export async function extractZip(zipBuffer, targetDir) {
  await fsp.mkdir(targetDir, { recursive: true });

  const tmpZipPath = path.join(os.tmpdir(), `toolcrib-${Date.now()}.zip`);
  await fsp.writeFile(tmpZipPath, zipBuffer);

  try {
    if (process.platform === 'win32') {
      // PowerShell's Expand-Archive ships on all modern Windows installs.
      await execFileAsync('powershell', [
        '-NoProfile',
        '-Command',
        `Expand-Archive -Path '${tmpZipPath}' -DestinationPath '${targetDir}' -Force`,
      ]);
    } else {
      await execFileAsync('unzip', ['-o', '-q', tmpZipPath, '-d', targetDir]);
    }
  } finally {
    await fsp.unlink(tmpZipPath).catch(() => {});
  }
}

/** Recursively list files under a directory, returning paths relative to it. */
export function listFilesRecursive(dir, base = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let results = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(listFilesRecursive(full, base));
    } else {
      results.push(path.relative(base, full));
    }
  }
  return results;
}
