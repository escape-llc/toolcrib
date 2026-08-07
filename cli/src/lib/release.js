import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { downloadReleaseZip, resolveVersion } from './github.js';
import { extractZip, listFilesRecursive } from './zip.js';

/**
 * Download + extract + resolve a release into a working temp directory,
 * returning the resolved config plus a reader for actual file contents.
 * Nothing here is cached or persisted between runs — every operation
 * re-fetches and re-derives from the immutable release artifact, which
 * is what makes `init`/`merge`/`doctor` idempotent and drift-proof (see
 * design notes on why a persistent hash lockfile was dropped).
 */
export async function fetchRelease(version) {
  const resolvedVersion = await resolveVersion(version);
  const zipBuffer = await downloadReleaseZip(resolvedVersion);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'toolcrib-release-'));
  await extractZip(zipBuffer, tempDir);

  const configPath = path.join(tempDir, 'toolcrib.config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  return {
    version: resolvedVersion,
    config,
    tempDir,
    readFile: (relPath) => fs.readFileSync(path.join(tempDir, relPath), 'utf-8'),
    allFiles: () => listFilesRecursive(tempDir).filter((f) => f !== 'toolcrib.config.json'),
    cleanup: () => fsp.rm(tempDir, { recursive: true, force: true }),
  };
}
