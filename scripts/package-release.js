#!/usr/bin/env node
/**
 * Packages ./dist-release into toolcrib.zip plus a toolcrib.zip.sha256
 * sidecar. The checksum guards against transport corruption (a
 * truncated/flaky download), not a compromised source — see design notes
 * on that distinction. Kept as a separate step from build-release.js so
 * "assemble the release content" and "produce the distributable
 * artifact" stay independently testable.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = path.join(ROOT, 'dist-release');
const ZIP_PATH = path.join(ROOT, 'toolcrib.zip');
const CHECKSUM_PATH = path.join(ROOT, 'toolcrib.zip.sha256');

function main() {
  if (!fs.existsSync(path.join(DIST, 'toolcrib.config.json'))) {
    throw new Error('./dist-release/toolcrib.config.json not found — run build-release.js first.');
  }

  fs.rmSync(ZIP_PATH, { force: true });

  // Zip the *contents* of dist-release/, not the folder itself, so the
  // CLI's extraction lands files at the project root of the archive
  // (matches what src/lib/zip.js + release.js on the CLI side expect).
  execFileSync('zip', ['-r', ZIP_PATH, '.'], { cwd: DIST, stdio: 'inherit' });

  const zipBuffer = fs.readFileSync(ZIP_PATH);
  const hash = crypto.createHash('sha256').update(zipBuffer).digest('hex');
  // Match the common `sha256sum` output shape (hash, then filename) so
  // the file is also usable with standard `sha256sum -c` if anyone wants to.
  fs.writeFileSync(CHECKSUM_PATH, `${hash}  toolcrib.zip\n`);

  console.log(`Packaged ${ZIP_PATH}`);
  console.log(`sha256: ${hash}`);
}

main();
