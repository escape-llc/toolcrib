#!/usr/bin/env node
/**
 * Builds the OPTIONAL test-suite release artifact from src/__tests__/,
 * which in this repo is a single flat directory (not colocated per
 * component) — shipped wholesale rather than pattern-matched by filename.
 *
 * No runner-insulation shim exists yet in this repo — the tests import
 * `vitest` and `@testing-library/react` directly. That's fine as-is;
 * this script doesn't require or fabricate a shim, it just packages what
 * actually exists. (A shim was discussed as a future option to insulate
 * against Jest/Vitest API differences — add src/test-utils.ts later and
 * this script can be extended to include it.)
 *
 * peerDependencies here are pulled from devDependencies via an explicit
 * list, since devDependencies also contains build tooling (typescript,
 * vite, @vitejs/plugin-react) that has nothing to do with running tests
 * and must not leak into what a consumer installs for the test artifact.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// True only when this file is run directly (`node scripts/build-tests-release.js`),
// not when imported as a module (build-tests-release.test.js imports
// listFilesRecursive directly to test it in isolation) -- comparing two
// native filesystem paths via fileURLToPath(), not a naive
// `file://${process.argv[1]}` string concatenation, which can mismatch on
// Windows (backslash paths, URL-encoding of special characters) even when
// both sides genuinely refer to the same file.
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

const TEST_PEER_DEP_NAMES = [
  'vitest',
  '@testing-library/react',
  '@testing-library/jest-dom',
  '@testing-library/user-event',
  '@testing-library/dom',
  'jsdom',
];

function loadRootPackageJson(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
}

function buildPeerDependencies(rootPkg) {
  const peerDependencies = {};
  const missing = [];
  for (const name of TEST_PEER_DEP_NAMES) {
    const range = rootPkg.dependencies?.[name] ?? rootPkg.devDependencies?.[name];
    if (!range) {
      missing.push(name);
      continue;
    }
    peerDependencies[name] = range;
  }
  if (missing.length > 0) {
    throw new Error(
      `TEST_PEER_DEP_NAMES lists packages not found in package.json: ${missing.join(', ')}`
    );
  }
  return peerDependencies;
}

// Exported (not just used internally by main() below) so a regression test
// can exercise it directly against a real, if small, on-disk fixture tree --
// see build-tests-release.test.js's own forward-slash assertion for the
// bug this fixes (issue #435).
export function listFilesRecursive(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(listFilesRecursive(full, base));
    } else {
      // Forward-slash unconditionally, regardless of platform -- confirmed
      // real, not hypothetical, by a Gemini codebase audit (issue #435):
      // path.relative() returns backslash-separated paths on Windows, and
      // main()'s own `testFiles.map((f) => \`__tests__/${f}\`)` below
      // writes these relative paths straight into toolcrib-tests.config.json's
      // `files.tests` array with no normalization step of its own. A
      // consumer resolving that array on Linux/Mac would treat a stray
      // backslash as a literal filename character, not a path separator --
      // the exact same class of bug AGENTS.md's "Distribution & path
      // handling" section already documents at length for the CLI's own
      // patch-header paths (see joinPatchPath in cli/src/lib/patches.js).
      results.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return results.sort();
}

function copyPreservingStructure(relPaths, srcBase, destBase) {
  for (const relPath of relPaths) {
    const destPath = path.join(destBase, relPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(path.join(srcBase, relPath), destPath);
  }
}

function main() {
  // Computed here, not at module top-level -- a plain `import` of this
  // file (build-tests-release.test.js imports listFilesRecursive directly)
  // must never evaluate `new URL('..', import.meta.url)` eagerly: under
  // Vitest's Vite-based transform this throws "The URL must be of scheme
  // file" outright, the same documented cross-tool quirk extract.test.js/
  // buildGraph.test.js/toon.test.js already work around for their own
  // ROOT constants. Deferring into main() (only reached on a real
  // `node scripts/build-tests-release.js` invocation, guarded by
  // isMainModule below) sidesteps it structurally instead of adding a
  // workaround to the test file.
  const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
  const src = path.join(root, 'src');
  const dist = path.join(root, 'dist-tests');
  const testsDir = path.join(src, '__tests__');

  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });

  const rootPkg = loadRootPackageJson(root);
  const peerDependencies = buildPeerDependencies(rootPkg);

  const testFiles = listFilesRecursive(testsDir);
  if (testFiles.length === 0) {
    throw new Error('No files found under src/__tests__ — nothing to package.');
  }

  copyPreservingStructure(testFiles, testsDir, path.join(dist, '__tests__'));

  const config = {
    version: rootPkg.version,
    requiresToolkitVersion: rootPkg.version, // built from the same package.json read, so always in lockstep
    generatedAt: new Date().toISOString(),
    peerDependencies,
    files: {
      tests: testFiles.map((f) => `__tests__/${f}`),
    },
  };

  fs.writeFileSync(path.join(dist, 'toolcrib-tests.config.json'), JSON.stringify(config, null, 2) + '\n');

  console.log(`Built test-suite release v${rootPkg.version}: ${testFiles.length} test file(s)`);
  console.log(`  requiresToolkitVersion: ${config.requiresToolkitVersion}`);
  console.log(`  peerDependencies: ${Object.keys(peerDependencies).join(', ')}`);
}

if (isMainModule) main();
