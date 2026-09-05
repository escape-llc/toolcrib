#!/usr/bin/env node
/**
 * Mirrors package-release.js exactly, pointed at the tests artifact.
 * Kept as its own script (rather than parameterizing one script) since
 * the two artifacts have independent failure modes worth seeing
 * separately in build logs (e.g. "tests packaging failed" shouldn't be
 * conflated with "core toolkit packaging failed"). The actual zip-building
 * logic is shared via scripts/lib/zipPack.js, not duplicated.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { zipDirectoryContents } from './lib/zipPack.js';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = path.join(ROOT, 'dist-tests');
const ZIP_PATH = path.join(ROOT, 'toolcrib-tests.zip');
const CHECKSUM_PATH = path.join(ROOT, 'toolcrib-tests.zip.sha256');

function main() {
  if (!fs.existsSync(path.join(DIST, 'toolcrib-tests.config.json'))) {
    throw new Error('./dist-tests/toolcrib-tests.config.json not found — run build-tests-release.js first.');
  }

  zipDirectoryContents(DIST, ZIP_PATH);

  const zipBuffer = fs.readFileSync(ZIP_PATH);
  const hash = crypto.createHash('sha256').update(zipBuffer).digest('hex');
  fs.writeFileSync(CHECKSUM_PATH, `${hash}  toolcrib-tests.zip\n`);

  console.log(`Packaged ${ZIP_PATH}`);
  console.log(`sha256: ${hash}`);
}

main();
