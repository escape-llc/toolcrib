import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadTestSource } from '../src/lib/testSource.js';
import { buildFakeProject, cleanupFakeProject } from './fixtures.js';

describe('loadTestSource', () => {
  let projectRoot;

  afterEach(() => cleanupFakeProject(projectRoot));

  it('reports not installed when the vendored install never opted into --with-tests', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    const testSource = loadTestSource(built.vendoredRoot);
    expect(testSource.isInstalled).toBe(false);
    expect(testSource.listTestSource()).toEqual([]);
  });

  it('lists every vendored test file, including nested ones, with an inferred component name where applicable', () => {
    const built = buildFakeProject({ withTests: true });
    projectRoot = built.projectRoot;
    const testSource = loadTestSource(built.vendoredRoot);
    expect(testSource.isInstalled).toBe(true);
    expect(testSource.listTestSource()).toEqual(
      expect.arrayContaining([
        { path: 'Button.test.tsx', componentName: 'Button' },
        { path: 'testUtils/axe.ts', componentName: null },
      ])
    );
  });

  it('returns one test file\'s full content by its relative path, or null if unknown', () => {
    const built = buildFakeProject({ withTests: true });
    projectRoot = built.projectRoot;
    const testSource = loadTestSource(built.vendoredRoot);
    expect(testSource.getTestSource('Button.test.tsx')).toContain("import { Button } from '#toolcrib'");
    expect(testSource.getTestSource('nonexistent.test.tsx')).toBe(null);
  });

  it('returns the declared peerDependencies from .toolcrib-tests-config.json', () => {
    const built = buildFakeProject({ withTests: true });
    projectRoot = built.projectRoot;
    const testSource = loadTestSource(built.vendoredRoot);
    expect(testSource.getPeerDependencies()).toEqual({ vitest: '^4.0.0', '@testing-library/react': '^16.0.0' });
  });

  it('returns null peerDependencies when the config file is missing (not installed)', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    const testSource = loadTestSource(built.vendoredRoot);
    expect(testSource.getPeerDependencies()).toBe(null);
  });
});

describe('loadTestSource — computeDevDependenciesPatch', () => {
  let projectRoot;

  afterEach(() => cleanupFakeProject(projectRoot));

  it('computes a real patch proposing the missing peer deps under devDependencies', () => {
    const built = buildFakeProject({ withTests: true });
    projectRoot = built.projectRoot;
    const testSource = loadTestSource(built.vendoredRoot);

    const packageJsonContent = JSON.stringify({ name: 'my-app', dependencies: { react: '^19.0.0' } }, null, 2) + '\n';
    const patch = testSource.computeDevDependenciesPatch(packageJsonContent);

    expect(patch).toContain('+  "devDependencies"');
    expect(patch).toContain('+    "vitest": "^4.0.0"');
    expect(patch).toContain('+    "@testing-library/react": "^16.0.0"');
    // Never applied by this function itself -- just the diff text.
    expect(JSON.parse(packageJsonContent).devDependencies).toBeUndefined();
  });

  it('leaves an already-declared dependency alone rather than overwriting its version', () => {
    const built = buildFakeProject({ withTests: true });
    projectRoot = built.projectRoot;
    const testSource = loadTestSource(built.vendoredRoot);

    const packageJsonContent =
      JSON.stringify({ name: 'my-app', devDependencies: { vitest: '^3.0.0' } }, null, 2) + '\n';
    const patch = testSource.computeDevDependenciesPatch(packageJsonContent);

    // vitest is already declared (even at a different version) -- only the
    // genuinely missing dependency is proposed.
    expect(patch).not.toContain('"vitest": "^4.0.0"');
    expect(patch).toContain('+    "@testing-library/react": "^16.0.0"');
  });

  it('returns null when every declared peer dependency is already present', () => {
    const built = buildFakeProject({ withTests: true });
    projectRoot = built.projectRoot;
    const testSource = loadTestSource(built.vendoredRoot);

    const packageJsonContent =
      JSON.stringify(
        { name: 'my-app', devDependencies: { vitest: '^3.0.0', '@testing-library/react': '^15.0.0' } },
        null,
        2
      ) + '\n';
    expect(testSource.computeDevDependenciesPatch(packageJsonContent)).toBe(null);
  });

  it('returns null when there is no test suite installed at all', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    const testSource = loadTestSource(built.vendoredRoot);
    expect(testSource.computeDevDependenciesPatch('{}')).toBe(null);
  });

  it('returns null rather than throwing on malformed package.json content', () => {
    const built = buildFakeProject({ withTests: true });
    projectRoot = built.projectRoot;
    const testSource = loadTestSource(built.vendoredRoot);
    expect(testSource.computeDevDependenciesPatch('not json')).toBe(null);
  });
});
