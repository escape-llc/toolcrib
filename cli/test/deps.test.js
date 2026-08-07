import { describe, it, expect } from 'vitest';
import { resolveDependencyDecisions, buildProposedPackageJson } from '../src/lib/deps.js';

describe('resolveDependencyDecisions', () => {
  it('classifies a missing dependency as toAdd', () => {
    const userPkg = { dependencies: {} };
    const result = resolveDependencyDecisions(userPkg, { zod: '^4.0.0' });
    expect(result.toAdd).toEqual([{ name: 'zod', range: '^4.0.0' }]);
    expect(result.conflicts).toEqual([]);
  });

  it('classifies an overlapping range as compatible, not toAdd', () => {
    const userPkg = { dependencies: { react: '^18.2.0' } };
    const result = resolveDependencyDecisions(userPkg, { react: '^18.0.0' });
    expect(result.compatible).toHaveLength(1);
    expect(result.toAdd).toEqual([]);
  });

  it('classifies a non-overlapping major version as a conflict', () => {
    const userPkg = { dependencies: { zod: '^3.0.0' } };
    const result = resolveDependencyDecisions(userPkg, { zod: '^4.0.0' });
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({ name: 'zod', userRange: '^3.0.0', requiredRange: '^4.0.0' });
  });

  it('checks devDependencies as well as dependencies for existing entries', () => {
    const userPkg = { dependencies: {}, devDependencies: { typescript: '^5.0.0' } };
    const result = resolveDependencyDecisions(userPkg, { typescript: '^5.0.0' });
    expect(result.compatible).toHaveLength(1);
  });

  it('flags an unrecognized version specifier (e.g. workspace protocol) as a conflict, not silently compatible', () => {
    const userPkg = { dependencies: { 'internal-pkg': 'workspace:*' } };
    const result = resolveDependencyDecisions(userPkg, { 'internal-pkg': '^1.0.0' });
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].reason).toMatch(/unrecognized/);
  });

  it('handles a mix of all three buckets in one call', () => {
    const userPkg = {
      dependencies: {
        react: '^18.0.0',      // compatible
        zod: '^3.0.0',         // conflict
      },
    };
    const result = resolveDependencyDecisions(userPkg, {
      react: '^18.0.0',
      zod: '^4.0.0',
      '@radix-ui/react-dialog': '^1.1.0', // toAdd
    });
    expect(result.compatible.map((c) => c.name)).toEqual(['react']);
    expect(result.conflicts.map((c) => c.name)).toEqual(['zod']);
    expect(result.toAdd.map((c) => c.name)).toEqual(['@radix-ui/react-dialog']);
  });
});

describe('buildProposedPackageJson', () => {
  it('adds new dependencies without touching existing unrelated fields', () => {
    const userPkg = { name: 'my-app', version: '1.0.0', dependencies: { react: '^18.0.0' } };
    const proposed = buildProposedPackageJson(userPkg, [{ name: 'zod', range: '^4.0.0' }]);
    expect(proposed.name).toBe('my-app');
    expect(proposed.dependencies).toEqual({ react: '^18.0.0', zod: '^4.0.0' });
  });

  it('does not mutate the original package.json object', () => {
    const userPkg = { dependencies: { react: '^18.0.0' } };
    buildProposedPackageJson(userPkg, [{ name: 'zod', range: '^4.0.0' }]);
    expect(userPkg.dependencies).toEqual({ react: '^18.0.0' }); // untouched
  });

  it('creates a dependencies object if none existed', () => {
    const userPkg = { name: 'my-app' };
    const proposed = buildProposedPackageJson(userPkg, [{ name: 'zod', range: '^4.0.0' }]);
    expect(proposed.dependencies).toEqual({ zod: '^4.0.0' });
  });
});
