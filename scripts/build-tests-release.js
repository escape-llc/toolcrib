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

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist-tests');
const TESTS_DIR = path.join(SRC, '__tests__');

const TEST_PEER_DEP_NAMES = [
  'vitest',
  '@testing-library/react',
  '@testing-library/jest-dom',
  '@testing-library/user-event',
  '@testing-library/dom',
  'jsdom',
];

function loadRootPackageJson() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
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

function listFilesRecursive(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(listFilesRecursive(full, base));
    } else {
      results.push(path.relative(base, full));
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
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const rootPkg = loadRootPackageJson();
  const peerDependencies = buildPeerDependencies(rootPkg);

  const testFiles = listFilesRecursive(TESTS_DIR);
  if (testFiles.length === 0) {
    throw new Error('No files found under src/__tests__ — nothing to package.');
  }

  copyPreservingStructure(testFiles, TESTS_DIR, path.join(DIST, '__tests__'));

  const config = {
    version: rootPkg.version,
    requiresToolkitVersion: rootPkg.version, // built from the same package.json read, so always in lockstep
    generatedAt: new Date().toISOString(),
    peerDependencies,
    files: {
      tests: testFiles.map((f) => `__tests__/${f}`),
    },
  };

  fs.writeFileSync(path.join(DIST, 'toolcrib-tests.config.json'), JSON.stringify(config, null, 2) + '\n');

  console.log(`Built test-suite release v${rootPkg.version}: ${testFiles.length} test file(s)`);
  console.log(`  requiresToolkitVersion: ${config.requiresToolkitVersion}`);
  console.log(`  peerDependencies: ${Object.keys(peerDependencies).join(', ')}`);
}

main();
