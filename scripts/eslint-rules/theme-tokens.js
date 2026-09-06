// Real, AST-based ESLint rules replacing scripts/check-theme-tokens.js's
// regex-based version -- same three defect shapes, found by a real
// self-audit of Toolcrib's own components against ai-docs/CORE.md §3 (see
// .plans/toolcrib-gap-closure-plan.md §6b). Wired into scripts/eslint.config.js
// as a local, inline plugin (no npm package needed) so `npm run lint`
// catches these in-editor, not just at CI/pre-commit time -- the standalone
// script duplicated this logic and is retired now that these exist.
//
// no-unexplained-zindex is imported from ../../eslint-rules/, not
// reimplemented here -- that directory is the single canonical
// implementation, vendored as-is to consumers (the same way ai-docs/ is)
// so real apps can catch the identical bug shape in their own code. This
// repo runs the exact same rule against its own source rather than a
// hand-maintained duplicate that could drift out of sync with it.
// no-unscaled-boxshadow and no-unscaled-pill-radius stay here: both need
// cross-file awareness of Toolcrib's own *Slice.tsx files, which has no
// consumer-facing equivalent.
import { noUnexplainedZindex } from '../../eslint-rules/no-unexplained-zindex.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMPONENTS_DIR = join(ROOT, 'src', 'components');
const THEME_DIR = join(ROOT, 'src', 'theme');

function walk(dir, predicate, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, predicate, files);
    } else if (predicate(entry)) {
      files.push(full);
    }
  }
  return files;
}

// Computed once per lint run (module-level cache), not once per file --
// scanning the whole tree per file would make a large lint run needlessly
// slow. Rule `create()` functions are called once per file, but this
// module itself is only imported/evaluated once for the whole run.
let cachedDefinedVars = null;
function getDefinedCSSVariables() {
  if (cachedDefinedVars) return cachedDefinedVars;
  cachedDefinedVars = new Set();
  const sliceFiles = walk(COMPONENTS_DIR, (name) => name.endsWith('Slice.tsx'));
  const themeFiles = walk(THEME_DIR, (name) => name.endsWith('.ts') || name.endsWith('.tsx'));
  for (const file of [...sliceFiles, ...themeFiles]) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/'(--ai-[\w-]+)':/g)) {
      cachedDefinedVars.add(m[1]);
    }
  }
  return cachedDefinedVars;
}

function isStringLiteral(node) {
  return node && node.type === 'Literal' && typeof node.value === 'string';
}

/** @type {import('eslint').Rule.RuleModule} */
const noUnscaledBoxshadow = {
  meta: {
    type: 'problem',
    docs: {
      description: 'boxShadow must reference the real elevation scale (var(--ai-shadow-sm|md|lg)) or a defined per-component Slice shadow variable, not a bare literal.',
    },
    schema: [],
  },
  create(context) {
    return {
      Property(node) {
        if (node.key.type !== 'Identifier' || node.key.name !== 'boxShadow') return;
        if (!isStringLiteral(node.value)) return;

        const value = node.value.value;
        const usesGlobalScale = /var\(--ai-shadow-(sm|md|lg)\b/.test(value);
        const referencedVar = value.match(/var\((--ai-[\w-]+)/);
        const usesDefinedSliceVar = referencedVar && getDefinedCSSVariables().has(referencedVar[1]);

        if (!usesGlobalScale && !usesDefinedSliceVar) {
          context.report({
            node,
            message:
              `boxShadow value '${value}' references neither var(--ai-shadow-sm|md|lg) nor a real, defined per-component Slice shadow variable -- nothing in the theme system can change this element's shadow. ` +
              `Either wrap it as a global-scale fallback (var(--ai-shadow-<sm|md|lg>, ${value})) or add a shadowDepth field to this component's own *Slice.tsx, matching Popup/Toast/DropdownMenu's pattern.`,
          });
        }
      },
    };
  },
};

/** @type {import('eslint').Rule.RuleModule} */
const noUnscaledPillRadius = {
  meta: {
    type: 'problem',
    docs: {
      description: "A bare large-px borderRadius (the 'guaranteed fully round' trick) should reference var(--ai-radius-xl) so it responds to the user's chosen cornerRadiusMode.",
    },
    schema: [],
  },
  create(context) {
    return {
      Property(node) {
        if (node.key.type !== 'Identifier' || node.key.name !== 'borderRadius') return;
        if (!isStringLiteral(node.value)) return;

        const match = node.value.value.match(/^(\d{3,}px)$/);
        if (match) {
          context.report({
            node,
            message: `borderRadius: '${match[1]}' doesn't reference var(--ai-radius-xl) -- this element won't respond to the user's chosen cornerRadiusMode. Use: var(--ai-radius-xl, ${match[1]})`,
          });
        }
      },
    };
  },
};

export const themeTokensPlugin = {
  rules: {
    'no-unscaled-boxshadow': noUnscaledBoxshadow,
    'no-unexplained-zindex': noUnexplainedZindex,
    'no-unscaled-pill-radius': noUnscaledPillRadius,
  },
};
