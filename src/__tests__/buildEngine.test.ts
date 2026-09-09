import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

/**
 * A sibling to docsInSync.test.ts, not an addition to it -- that file's
 * job is "does a generated file have drift," this one's job is "does the
 * graph engine's CLI report the right thing," a genuinely separate
 * concern. Same execSync-subprocess pattern for the same reason
 * docsInSync.test.ts already documents: scripts/build-engine.js resolves
 * its dependencies via scripts/lib/buildGraph.js, which uses
 * import.meta.url-based root resolution (via extract.js's own ROOT) --
 * throws under Vitest's Vite-based transform, works correctly under
 * plain `node scripts/x.js` execution, the only way this CLI is actually
 * meant to run.
 */
function run(command: string): string {
  return execSync(command, { encoding: 'utf-8' });
}

describe('scripts/build-engine.js', () => {
  it('list mentions all four graph node ids', () => {
    const output = run('node scripts/build-engine.js list --include-live');
    for (const id of ['manifest', 'docs', 'index', 'security-advisories']) {
      expect(output).toContain(id);
    }
  });

  it('list excludes security-advisories by default (no --include-live)', () => {
    const output = run('node scripts/build-engine.js list');
    expect(output).not.toContain('security-advisories');
  });

  it('affected README.md reports docs, not the other three -- the exact incident this engine exists to catch', () => {
    const output = run('node scripts/build-engine.js affected README.md');
    expect(output).toContain('docs');
    expect(output).not.toContain('manifest');
    expect(output).not.toContain('index');
    expect(output).not.toContain('security-advisories');
  });

  it('affected with an unrelated file reports no affected node', () => {
    const output = run('node scripts/build-engine.js affected scripts/eslint.config.js');
    expect(output).toContain('No graph node is affected');
  });

  it('check <target-name> runs against a clean tree without requiring any file argument', () => {
    // Exercises the direct-target-name path (not the file-based reverse
    // lookup) -- execSync throws on a non-zero exit code, so a clean
    // pass here is itself the assertion.
    const output = run('node scripts/build-engine.js check docs');
    expect(output).toContain('docs: ok');
  });
});
