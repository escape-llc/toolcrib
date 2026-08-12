import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

/**
 * Catches manifest/CORE.md/index.ts drift locally, in the same `npm test`
 * run every other check goes through — not just at release time via
 * .github/workflows/release.yml. Each check is spawned as a real `node`
 * subprocess (not imported into Vitest's own module graph): the
 * generator scripts resolve their project root via
 * `import.meta.url`-based `URL` construction, which throws under
 * Vitest's Vite-based transform ("The URL must be of scheme file") but
 * works correctly under plain `node scripts/x.js` execution — the only
 * way these scripts are actually meant to run.
 */
describe('generated docs stay in sync with source', () => {
  it('component-manifest.json has no drift', () => {
    expect(() => execSync('node scripts/generate-manifest.js --check', { stdio: 'pipe' })).not.toThrow();
  });

  it('ai-docs/CORE.md has no drift', () => {
    expect(() => execSync('node scripts/generate-docs.js --check', { stdio: 'pipe' })).not.toThrow();
  });

  it('src/index.ts (the #toolcrib barrel) has no drift', () => {
    expect(() => execSync('node scripts/generate-index.js --check', { stdio: 'pipe' })).not.toThrow();
  });
});
