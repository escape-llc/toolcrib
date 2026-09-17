import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { listFilesRecursive, TEST_PEER_DEP_NAMES, isVendorableTestFile } from './build-tests-release.js';

// Regression test for a real, Gemini-caught defect (issue #435): on
// Windows, path.relative() returns backslash-separated paths, and these
// used to be written straight into toolcrib-tests.config.json's own
// files.tests array with no normalization -- a consumer resolving that
// array on Linux/Mac would treat a stray backslash as a literal filename
// character, not a path separator. Uses a real temp directory tree (not a
// mocked fs) so this exercises the real path.relative()/path.sep behavior
// of whatever OS the test actually runs on, not an assumption about it.

describe('listFilesRecursive (build-tests-release.js internal, issue #435)', () => {
  let tempDir;

  afterEach(() => {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns forward-slash-separated relative paths for nested files, on any platform', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-list-files-'));
    fs.mkdirSync(path.join(tempDir, 'nested', 'deeper'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'top.txt'), '');
    fs.writeFileSync(path.join(tempDir, 'nested', 'mid.txt'), '');
    fs.writeFileSync(path.join(tempDir, 'nested', 'deeper', 'bottom.txt'), '');

    const files = listFilesRecursive(tempDir);

    expect(files).toEqual(['nested/deeper/bottom.txt', 'nested/mid.txt', 'top.txt']);
    for (const f of files) {
      expect(f).not.toContain('\\');
    }
  });

  it('returns an empty array for a directory that does not exist', () => {
    expect(listFilesRecursive(path.join(os.tmpdir(), 'toolcrib-does-not-exist-xyz'))).toEqual([]);
  });
});

// Regression test for a real, found-by-provisioning-test defect: two real
// packages imported directly by vendored test files (vitest-axe, imported
// by setup.ts -- the shared setupFiles entry, so this broke every one of
// the 106 vendored test files at once; fast-check, imported by the 2
// property-test files) were missing from TEST_PEER_DEP_NAMES, so a fresh
// `toolcrib init --with-tests` install never got them added to
// devDependencies and `npm test` failed outright with "Failed to resolve
// import" -- confirmed live, not hypothetical, running a real from-scratch
// provisioning test against a real built v0.15.0 release before tagging.
// TEST_PEER_DEP_NAMES is hand-maintained (see its own comment for why: it
// must exclude devDependencies-only build tooling that has nothing to do
// with running tests), so unlike listFilesRecursive above, nothing forces
// it to stay in sync with source by construction -- this test is that
// sync check, scanning the real files under src/__tests__/ the same way
// build-tests-release.js itself does, rather than a fixture.
describe('TEST_PEER_DEP_NAMES stays in sync with src/__tests__/\'s real imports', () => {
  // process.cwd(), not an import.meta.url-based ROOT -- the latter throws
  // under Vitest's Vite-based transform ("The URL must be of scheme
  // file"), the same cross-tool quirk build-tests-release.js's own main()
  // comment and buildGraph.test.js/extract.test.js already document and
  // work around. npm test/vitest run always run from the repo root.
  const root = process.cwd();
  const testsDir = path.join(root, 'src', '__tests__');

  // A bare-specifier static import's package name -- the scoped
  // (@scope/pkg) or unscoped (pkg) leading segment, with any deeper
  // subpath (e.g. 'vitest-axe/matchers') stripped, since npm/devDependencies
  // are always declared at the package root regardless of which subpath
  // gets imported. `import type { X } from '...'` is deliberately excluded
  // here -- it's erased entirely at runtime (esbuild/tsc strip type-only
  // imports), so it never needs its own peer-dep entry; its type
  // declarations resolve transitively through whatever real
  // TEST_PEER_DEP_NAMES package actually depends on it (e.g. axe-core's
  // types arrive via vitest-axe's own real dependency on axe-core once
  // that's installed) -- confirmed for real, not assumed: testUtils/axe.ts's
  // `import type {...} from 'axe-core'` is exactly this shape, and
  // axe-core is vitest-axe's own declared dependency.
  //
  // `//` line comments are stripped first -- caught in review (Gemini, PR
  // #492): a commented-out import (left in for reference, never executed)
  // would otherwise be parsed as a real one and could fail this test for a
  // package that was never actually a live dependency.
  function importedPackageNames(fileContent) {
    const withoutLineComments = fileContent.replace(/\/\/.*$/gm, '');
    const names = new Set();
    const importRe = /import\s+(type\s+)?[\s\S]*?\bfrom\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRe.exec(withoutLineComments))) {
      const isTypeOnly = Boolean(match[1]);
      const specifier = match[2];
      if (isTypeOnly) continue;
      if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('node:')) continue;
      const segments = specifier.split('/');
      const pkgName = specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
      names.add(pkgName);
    }
    return names;
  }

  it('every real npm package imported under src/__tests__/ is covered by TEST_PEER_DEP_NAMES or the toolkit\'s own base peer deps', () => {
    const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
    // A --with-tests consumer already has the base toolkit installed --
    // its own peerDependencies (react, zod, @internationalized/date, etc.)
    // are guaranteed separately by build-release.js, not this script's
    // job to also declare. 'vitest' itself is the one runner both this
    // script's own peer-dep list and every test file assume is present.
    const coveredByBaseToolkit = new Set(Object.keys(rootPkg.dependencies ?? {}));
    const covered = new Set([...TEST_PEER_DEP_NAMES, ...coveredByBaseToolkit]);

    const uncovered = new Set();
    for (const relPath of listFilesRecursive(testsDir)) {
      if (!relPath.endsWith('.ts') && !relPath.endsWith('.tsx')) continue;
      const content = fs.readFileSync(path.join(testsDir, relPath), 'utf-8');
      for (const pkgName of importedPackageNames(content)) {
        if (!covered.has(pkgName)) uncovered.add(pkgName);
      }
    }

    expect([...uncovered]).toEqual([]);
  });
});

// Regression test for a real defect found running a provisioning test
// before v0.15.0: src/__tests__/ mixes real, vendorable component/theme/
// eventBus/observer tests together with a handful of meta-tests that
// exercise this repo's own scripts/*.js build tooling (never vendored) --
// buildEngine.test.ts, docsInSync.test.ts, securityAdvisories.test.ts all
// failed outright the first time anyone actually ran a fresh
// `--with-tests` install against real npm-resolved node_modules ("Cannot
// find module '...\scripts\build-engine.js'"). Vendored tests must be
// confined to the vendored toolkit surface only.
describe('isVendorableTestFile', () => {
  it('excludes a file that imports from ../../scripts/', () => {
    expect(isVendorableTestFile("import { x } from '../../scripts/lib/securityAdvisories.js';")).toBe(false);
  });

  it('excludes a file that shells out to a scripts/*.js tool', () => {
    expect(isVendorableTestFile("run('node scripts/build-engine.js list')")).toBe(false);
  });

  it('includes an ordinary component test with no scripts/ reference', () => {
    expect(isVendorableTestFile("import { render } from '@testing-library/react';\nimport { Button } from '../components/Button';")).toBe(true);
  });

  // Regression coverage for Gemini's PR #492 review findings against the
  // original bare-substring version of this check.
  it('does not false-positive on a comment merely mentioning "scripts/"', () => {
    expect(isVendorableTestFile("// These tests run scripts/commands under the hood\nimport { render } from '@testing-library/react';")).toBe(true);
  });

  it('does not false-positive on an unrelated path segment like "typescripts/"', () => {
    expect(isVendorableTestFile("import { x } from '../typescripts/thing';")).toBe(true);
  });

  it('excludes a Windows-backslash shell-out the same as a forward-slash one', () => {
    expect(isVendorableTestFile("run('node scripts\\\\build-engine.js list')")).toBe(false);
  });

  it('ignores a commented-out reference that is never actually executed', () => {
    expect(isVendorableTestFile("// import { x } from '../../scripts/lib/securityAdvisories.js';\nimport { render } from '@testing-library/react';")).toBe(true);
  });

  it('against the real src/__tests__/ tree, excludes exactly the known repo-internal meta-tests and nothing else', () => {
    const root = process.cwd();
    const testsDir = path.join(root, 'src', '__tests__');
    const excluded = listFilesRecursive(testsDir)
      .filter((relPath) => (relPath.endsWith('.ts') || relPath.endsWith('.tsx')))
      .filter((relPath) => !isVendorableTestFile(fs.readFileSync(path.join(testsDir, relPath), 'utf-8')));

    expect(excluded.sort()).toEqual(['buildEngine.test.ts', 'docsInSync.test.ts', 'securityAdvisories.test.ts']);
  });
});
