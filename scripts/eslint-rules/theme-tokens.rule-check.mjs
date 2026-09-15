// Table-driven tests for ./theme-tokens.js, using ESLint's own built-in
// RuleTester -- same convention as no-frozen-controlled-prop.rule-check.mjs
// / no-missing-use-client.rule-check.mjs (plain `node`, not Vitest;
// `.rule-check.mjs`, not `.test.mjs`, to avoid Vitest's own include glob
// picking it up a second, accidental way).
//
// Both fixes here address a real Gemini codebase audit finding (issue
// #435), not a synthetic worry -- see theme-tokens.js's own comments at
// each fix site for the full account.

import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { themeTokensPlugin, CSS_VARIABLE_KEY_PATTERN } from './theme-tokens.js';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const noUnscaledBoxshadow = themeTokensPlugin.rules['no-unscaled-boxshadow'];

// '--ai-table-row-height' is a REAL variable defined in
// src/components/DataTable/DataTableSlice.tsx -- getDefinedCSSVariables()
// walks the real src/components/**/*Slice.tsx + src/theme/**/*.ts(x) tree,
// so this test exercises the rule against real project data rather than an
// injected fixture (there's no dependency-injection seam to fake that walk
// without a bigger refactor than either fix here warrants).
const REAL_DEFINED_VAR = '--ai-table-row-height';

ruleTester.run('no-unscaled-boxshadow', noUnscaledBoxshadow, {
  valid: [
    // Baseline: the global elevation scale alone is always valid.
    `const style = { boxShadow: 'var(--ai-shadow-md, 0 1px 2px black)' };`,

    // Regression for issue #435's real, confirmed false-positive: the
    // FIRST layer's own variable is unscaled/undefined, but a LATER layer
    // references a real, defined per-component Slice variable. The
    // previous single, non-global `.match()` only ever inspected the first
    // layer, so this exact shape used to be wrongly flagged.
    `const style = { boxShadow: '0 1px 2px var(--ai-totally-made-up-var), 0 2px 4px var(${REAL_DEFINED_VAR})' };`,

    // The mirror case (valid first layer, arbitrary later one) was already
    // correctly left unflagged before the fix too -- the rule's own bar is
    // "at least one defined/scaled reference," not "every layer must be."
    // Included so a future change to that bar doesn't silently regress
    // this case without a test noticing.
    `const style = { boxShadow: '0 1px 2px var(${REAL_DEFINED_VAR}), 0 2px 4px var(--ai-totally-made-up-var)' };`,
  ],
  invalid: [
    {
      code: `const style = { boxShadow: '0 1px 2px rgba(0,0,0,0.2)' };`,
      errors: [/references neither var\(--ai-shadow-sm\|md\|lg\) nor a real, defined/],
    },
    {
      // Multi-layer, but EVERY layer is unscaled/undefined -- still
      // correctly flagged; the fix only changes behavior when at least one
      // layer is genuinely valid.
      code: `const style = { boxShadow: '0 1px 2px var(--ai-made-up-one), 0 2px 4px var(--ai-made-up-two)' };`,
      errors: [/references neither var\(--ai-shadow-sm\|md\|lg\) nor a real, defined/],
    },
  ],
});

// CSS_VARIABLE_KEY_PATTERN's own matching behavior, tested directly against
// plain strings -- getDefinedCSSVariables() (the function that actually
// uses this pattern) walks real project files with no dependency-injection
// seam, so this is the practical way to regression-test the quote-style
// fix in isolation.
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const singleQuoted = [...`'${REAL_DEFINED_VAR}': cellPadding,`.matchAll(CSS_VARIABLE_KEY_PATTERN)].map((m) => m[1]);
assert(
  singleQuoted.length === 1 && singleQuoted[0] === REAL_DEFINED_VAR,
  `CSS_VARIABLE_KEY_PATTERN should match a single-quoted key, got: ${JSON.stringify(singleQuoted)}`
);

// The actual issue #435 finding: a double-quoted key (nothing in this
// codebase currently writes one, but a future autoformatter or a different
// contributor's editor settings could) used to be silently invisible to
// this scan entirely.
const doubleQuoted = [...`"${REAL_DEFINED_VAR}": cellPadding,`.matchAll(CSS_VARIABLE_KEY_PATTERN)].map((m) => m[1]);
assert(
  doubleQuoted.length === 1 && doubleQuoted[0] === REAL_DEFINED_VAR,
  `CSS_VARIABLE_KEY_PATTERN should match a double-quoted key too, got: ${JSON.stringify(doubleQuoted)}`
);

console.log('theme-tokens.rule-check.mjs: all checks passed');
