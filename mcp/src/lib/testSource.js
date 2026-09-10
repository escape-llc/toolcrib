import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createTwoFilesPatch } from 'diff';

const TESTS_DIRNAME = '__tests__';
const TESTS_CONFIG_FILENAME = '.toolcrib-tests-config.json';

/**
 * Recursively lists every file under `dir`, returning paths relative to it
 * with forward slashes regardless of host OS — matches the convention
 * cli/src/lib/zip.js's listFilesRecursive already established for the
 * identical reason (a relative path here becomes a lookup key a caller
 * might pass verbatim into a patch header or a cross-platform comparison).
 */
function listFilesRecursive(dir, base = dir) {
  let results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(listFilesRecursive(full, base));
    } else {
      results.push(relative(base, full).split('\\').join('/'));
    }
  }
  return results;
}

/**
 * `Button.test.tsx` -> `Button`; a path that doesn't match the
 * `X.test.ts(x)` convention (e.g. `testUtils/axe.ts`, a shared helper, not
 * a per-component test) returns `null` rather than a wrong guess.
 */
function inferComponentName(relPath) {
  const base = relPath.split('/').pop();
  const match = base.match(/^(.+)\.test\.tsx?$/);
  return match ? match[1] : null;
}

/**
 * Loads whatever `toolcrib init --with-tests` (or a later `toolcrib merge`
 * that kept it in sync) vendored under `<vendoredRoot>/__tests__/`, plus
 * the sibling `<vendoredRoot>/.toolcrib-tests-config.json` this server
 * needs to know the test suite's own declared peerDependencies -- neither
 * is present at all on an install that never opted in, which is a normal,
 * expected state (mirrors loadExamples' own missing-directory handling),
 * not an error.
 */
export function loadTestSource(vendoredRoot) {
  const testsDir = join(vendoredRoot, TESTS_DIRNAME);
  let files = [];
  try {
    files = listFilesRecursive(testsDir).filter((f) => statSync(join(testsDir, f)).isFile());
  } catch {
    files = [];
  }

  const configPath = join(vendoredRoot, TESTS_CONFIG_FILENAME);
  let config = null;
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch {
    config = null;
  }

  const entries = new Map(
    files.map((relPath) => [relPath, { path: relPath, componentName: inferComponentName(relPath) }])
  );

  return {
    /** True only when a --with-tests install is actually present. */
    isInstalled: files.length > 0,

    listTestSource() {
      return [...entries.values()];
    },

    getTestSource(relPath) {
      if (!entries.has(relPath)) return null;
      return readFileSync(join(testsDir, relPath), 'utf8');
    },

    /** The test suite's own declared peerDependencies, or null if unavailable. */
    getPeerDependencies() {
      return config?.peerDependencies ?? null;
    },

    /**
     * Computes a real unified diff proposing `peerDependencies` be added
     * to `packageJsonContent`'s `devDependencies` -- never applied by this
     * server itself (it has no write access to the consumer's project at
     * all; every other tool here is read-only too), just returned as data
     * for the calling agent to review and apply however it chooses,
     * mirroring cli/'s own "always propose a patch, never silently write"
     * convention (see cli/src/lib/patches.js's PendingChanges). Existing
     * devDependencies entries are left untouched; a name already present
     * (any range) is left alone rather than overwritten, since this
     * server has no way to know if a consumer deliberately pinned a
     * different compatible version.
     *
     * Returns null if there's nothing to propose (no config loaded, or
     * every declared dependency is already present).
     */
    computeDevDependenciesPatch(packageJsonContent) {
      const peerDependencies = config?.peerDependencies;
      if (!peerDependencies || Object.keys(peerDependencies).length === 0) return null;

      let pkg;
      try {
        pkg = JSON.parse(packageJsonContent);
      } catch {
        return null;
      }

      const existing = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      const toAdd = Object.entries(peerDependencies).filter(([name]) => !existing[name]);
      if (toAdd.length === 0) return null;

      const proposed = structuredClone(pkg);
      proposed.devDependencies ??= {};
      for (const [name, range] of toAdd) {
        proposed.devDependencies[name] = range;
      }
      const proposedContent = JSON.stringify(proposed, null, 2) + '\n';

      return createTwoFilesPatch(
        'a/package.json',
        'b/package.json',
        packageJsonContent,
        proposedContent,
        'package.json (current)',
        'package.json (proposed)'
      );
    },
  };
}
