import { describe, it } from 'vitest';
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
/**
 * `expect(() => execSync(...)).not.toThrow()` reports only
 * `Error: Command failed: node scripts/x.js --check` — execSync's own
 * thrown error carries the actually useful part (the generator script's
 * real stdout/stderr: either a drift diff, or a crash) on `.stdout`/
 * `.stderr`, which that bare assertion never surfaces. In CI that means the
 * failure the person is staring at literally cannot tell them what
 * happened. Run the command outside the assertion, catch it, and rethrow
 * with that real output inlined plus the two concrete causes worth
 * checking first.
 */
function runDriftCheck(command: string): void {
  try {
    execSync(command, { stdio: 'pipe' });
  } catch (err: any) {
    const stdout = err.stdout ? err.stdout.toString().trim() : '';
    const stderr = err.stderr ? err.stderr.toString().trim() : '';
    throw new Error(
      `\`${command}\` exited with code ${err.status ?? 'unknown'}.\n` +
      (stdout ? `\n--- stdout ---\n${stdout}\n` : '') +
      (stderr ? `\n--- stderr ---\n${stderr}\n` : '') +
      `\nMost likely one of:\n` +
      `  - Real drift: source changed but the generated file wasn't regenerated. Fix: rerun the same command ` +
      `with --write instead of --check, then commit the result.\n` +
      `  - scripts/node_modules isn't installed (a "Cannot read properties of undefined" TypeScript error, ` +
      `typically mentioning ScriptTarget/createSourceFile, is this case): scripts/lib/extract.js needs the ` +
      `typescript@6.x pinned in scripts/package.json, isolated from root's own typescript version — see ` +
      `AGENTS.md's TypeScript section. Run \`npm install\` inside scripts/ before this test suite, not after.`
    );
  }
}

describe('generated docs stay in sync with source', () => {
  it('component-manifest.json (and its ai-docs/manifest/ category split) has no drift', () => {
    runDriftCheck('node scripts/generate-manifest.js --check');
  });

  it('ai-docs/CORE.md and ai-docs/examples/ have no drift', () => {
    runDriftCheck('node scripts/generate-docs.js --check');
  });

  it('src/index.ts (the #toolcrib barrel) has no drift', () => {
    runDriftCheck('node scripts/generate-index.js --check');
  });
});
