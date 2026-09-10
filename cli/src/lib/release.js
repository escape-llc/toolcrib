import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { downloadReleaseZip, resolveVersion, TESTS_ASSET_NAME } from './github.js';
import { extractZip, listFilesRecursive } from './zip.js';

// See the matching stripBOM in lib/project.js for why this exists — Node's
// fs never strips a UTF-8 BOM from a 'utf-8' read, and it breaks
// JSON.parse() outright. Duplicated rather than imported: it's a one-line
// helper and this module has no other reason to depend on project.js.
function stripBOM(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

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
  const config = JSON.parse(stripBOM(fs.readFileSync(configPath, 'utf-8')));

  return {
    version: resolvedVersion,
    config,
    tempDir,
    readFile: (relPath) => stripBOM(fs.readFileSync(path.join(tempDir, relPath), 'utf-8')),
    allFiles: () => listFilesRecursive(tempDir).filter((f) => f !== 'toolcrib.config.json'),
    cleanup: () => fsp.rm(tempDir, { recursive: true, force: true }),
  };
}

/**
 * Same shape as fetchRelease, pointed at the optional test-suite artifact
 * (toolcrib-tests.zip / toolcrib-tests.config.json) instead of the core
 * toolkit one — kept as its own function rather than a mode flag on
 * fetchRelease, mirroring scripts/package-tests-release.js's own stated
 * reasoning ("the two artifacts have independent failure modes worth
 * seeing separately"). Every file this returns via allFiles()/readFile()
 * is already `__tests__/`-prefixed, per build-tests-release.js's own
 * output layout — callers propose them straight into TOOLKIT_DIR the same
 * way core files are, landing at ./toolcrib/__tests__/...
 *
 * `version` must already be a concrete version string, not 'latest' —
 * callers that need both a core and a tests release for the same install
 * (init --with-tests, merge) must resolve 'latest' exactly once
 * themselves (see github.js's resolveVersion) and pass the same resolved
 * string to both fetchRelease and this function. Calling resolveVersion
 * independently a second time here would re-hit GitHub's /releases/latest
 * endpoint a moment later — a real, if narrow, race: a new release
 * publishing in between could pair a core zip from one version with a
 * tests zip from another.
 */
export async function fetchTestsRelease(version) {
  const zipBuffer = await downloadReleaseZip(version, TESTS_ASSET_NAME);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'toolcrib-tests-release-'));
  await extractZip(zipBuffer, tempDir);

  const configPath = path.join(tempDir, 'toolcrib-tests.config.json');
  const config = JSON.parse(stripBOM(fs.readFileSync(configPath, 'utf-8')));

  return {
    version,
    config,
    tempDir,
    readFile: (relPath) => stripBOM(fs.readFileSync(path.join(tempDir, relPath), 'utf-8')),
    allFiles: () => listFilesRecursive(tempDir).filter((f) => f !== 'toolcrib-tests.config.json'),
    cleanup: () => fsp.rm(tempDir, { recursive: true, force: true }),
  };
}
