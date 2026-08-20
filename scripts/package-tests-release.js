#!/usr/bin/env node
/**
 * Mirrors package-release.js exactly, pointed at the tests artifact.
 * Kept as its own script (rather than parameterizing one script) since
 * the two artifacts have independent failure modes worth seeing
 * separately in build logs (e.g. "tests packaging failed" shouldn't be
 * conflated with "core toolkit packaging failed").
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = path.join(ROOT, 'dist-tests');
const ZIP_PATH = path.join(ROOT, 'toolcrib-tests.zip');
const CHECKSUM_PATH = path.join(ROOT, 'toolcrib-tests.zip.sha256');

function main() {
  if (!fs.existsSync(path.join(DIST, 'toolcrib-tests.config.json'))) {
    throw new Error('./dist-tests/toolcrib-tests.config.json not found — run build-tests-release.js first.');
  }

  fs.rmSync(ZIP_PATH, { force: true });
  try {
    execFileSync('zip', ['-r', ZIP_PATH, '.'], { cwd: DIST, stdio: 'inherit' });
  } catch (err) {
    // See package-release.js's matching guard for the full rationale — a
    // missing `zip` binary otherwise surfaces as a bare "spawnSync zip
    // ENOENT" with no indication of the actual cause or fix.
    if (err.code === 'ENOENT') {
      throw new Error(
        `'zip' command not found on PATH. Install it and re-run — e.g. ` +
          `\`apt-get install -y zip\` (Debian/Ubuntu), \`apk add zip\` (Alpine), ` +
          `or \`brew install zip\` (macOS).`
      );
    }
    throw err;
  }

  const zipBuffer = fs.readFileSync(ZIP_PATH);
  const hash = crypto.createHash('sha256').update(zipBuffer).digest('hex');
  fs.writeFileSync(CHECKSUM_PATH, `${hash}  toolcrib-tests.zip\n`);

  console.log(`Packaged ${ZIP_PATH}`);
  console.log(`sha256: ${hash}`);
}

main();
