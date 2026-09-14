import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * `--ai-transition-normal`/`--ai-transition-fast` resolve to a COMPLETE CSS
 * `transition` shorthand value (e.g. `"all 0.2s cubic-bezier(0.4, 0, 0.2,
 * 1)"`, see animation.tsx's getAnimationVariables()) — not a duration/easing
 * fragment meant to be combined with anything else. A `transition:` value
 * that prepends any text in front of `var(--ai-transition-...)` (e.g. the
 * historical `'width var(--ai-transition-normal, ...)'`) produces an
 * invalid CSS declaration the browser silently drops, which the previous
 * property (or none at all) then never actually animates.
 *
 * This exact typo has independently bitten two different components
 * (Sidebar.tsx and Progress.tsx, per commit 1ac3431) — jsdom can't catch it
 * because it has no real CSS parser to reject the invalid string, and
 * nothing short of a real browser render would ever notice the transition
 * silently not firing. This test closes the gap mechanically: it can't be
 * skipped by forgetting AGENTS.md's own write-up of the rule exists, the
 * way both real instances were.
 *
 * `animation:`/`transition-delay:` are unaffected and deliberately excluded
 * — `--ai-transition-duration-*`/`--ai-transition-easing` fragments (a
 * different pair of variables) are *meant* to be combined with a leading
 * keyframe name for `animation:`, so a prefix there is correct, not a bug.
 */

const COMPONENTS_ROOT = path.join(__dirname, '..', 'components');

function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      files.push(fullPath);
    }
  }
  return files;
}

// Matches a `transition:` (not `transition-delay:`/`transition-duration:`,
// via the negative lookbehind, and not `animation:`) property's string
// value in an inline style object or CSS-in-JS template literal.
const TRANSITION_VALUE_RE = /(?<![\w-])transition\s*:\s*(['"`])((?:(?!\1)[\s\S])*?)\1/g;

// Only the three COMPOSITE tokens (a complete shorthand value, e.g. "all
// 0.2s cubic-bezier(...)") are unsafe to prefix -- matched by exact name,
// not by the shared "--ai-transition-" prefix every variable in this
// family happens to start with. A plain `value.includes('var(--ai-transition-')`
// substring check (the original version of this test) also matched
// `--ai-transition-duration-fast`/`--ai-transition-easing` -- the DIFFERENT,
// fragment pair this test's own doc comment above already says is fine to
// prefix -- producing 8 false-positive failures the moment real code
// started using that established, correct pattern (issue #411). `(?=[,)])`
// confirms the match ends exactly at the composite token's own name, not
// partway into a longer variable that happens to share the same start.
const COMPOSITE_TOKEN_RE = /var\(--ai-transition-(?:normal|fast|slow)(?=[,)])/;

describe('CSS `transition:` values referencing --ai-transition-normal/-fast must not be prefixed', () => {
  const files = collectSourceFiles(COMPONENTS_ROOT);
  expect(files.length).toBeGreaterThan(0);

  for (const file of files) {
    const relPath = path.relative(path.join(__dirname, '..', '..'), file);
    it(`${relPath} has no prefixed --ai-transition-normal/-fast usage`, () => {
      const source = fs.readFileSync(file, 'utf8');
      const violations: string[] = [];
      let match: RegExpExecArray | null;
      TRANSITION_VALUE_RE.lastIndex = 0;
      while ((match = TRANSITION_VALUE_RE.exec(source)) !== null) {
        const value = match[2].trim();
        if (COMPOSITE_TOKEN_RE.test(value) && !value.startsWith('var(--ai-transition-')) {
          violations.push(value);
        }
      }
      expect(violations, `Found prefixed --ai-transition-* usage in ${relPath}:\n${violations.join('\n')}`).toEqual([]);
    });
  }
});
