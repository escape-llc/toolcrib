/**
 * A vendored, standalone ESLint rule flagging a file that calls a React
 * hook, calls `createContext`, references a browser-only global, or
 * defines a class component — without `'use client'` as its literal first
 * line. Next.js App Router refuses to build any such file into a Server
 * Component's module graph at all; this is the automated version of a
 * real, previously-manual audit (see Toolcrib's own `AGENTS.md`, the
 * `'use client'` section) that found 79 files needing the directive across
 * two separate real `next build` failures — the first pass, tracing one
 * import by hand, undercounted at 51; a follow-up whole-tree text scan
 * closed most of the gap but still missed custom hooks matched only by
 * name, and separately produced a false positive on a hook name mentioned
 * inside a JSDoc comment, not a real call.
 *
 * That JSDoc false positive is structurally impossible here, not just less
 * likely: this rule walks the real AST via ESLint's own visitor/scope
 * machinery, and a comment is never part of that tree at all — there is no
 * text-matching step for a comment to fool.
 *
 * Detects four independent reasons a file might need the directive:
 * 1. A hook call — any `use[A-Z]...(...)`, built-in or custom, bare or as
 *    `X.useSomething(...)`. Matches by name only, the same general pattern
 *    that closed the original enumerated-hook-name undercount — a
 *    coincidentally `use`-prefixed non-hook function still triggers this,
 *    inherited from that same heuristic, not a new risk.
 * 2. A `createContext`/`X.createContext(...)` call. A generic type
 *    argument (`createContext<T>(...)`) needs no special handling — TS's
 *    own CallExpression node keeps `callee` and `typeArguments` separate,
 *    unlike a raw text/regex scan, which is exactly the shape of gap that
 *    missed `FieldContext.ts`'s `createContext<FieldContextValue>(...)`
 *    during this rule's own design.
 * 3. A real reference to a browser-only global (`document`, `window`,
 *    `ResizeObserver`, `IntersectionObserver`, `MutationObserver`,
 *    `matchMedia`, `localStorage`, `sessionStorage`, `navigator`),
 *    resolved via ESLint's own scope analysis against the global scope's
 *    tracked `Variable.references` — a locally-shadowed variable of the
 *    same name is correctly left alone (it never resolves to the global
 *    Variable at all), and a guarded/isomorphic reference like
 *    `typeof document === 'undefined' ? undefined : document` is
 *    correctly *still* flagged, since it's a real reference to the actual
 *    global, just conditionally used. That specific shape exists live in
 *    Toolcrib's own `src/theme/injectGlobalStyle.ts` today (no directive,
 *    by design — it degrades safely on the server) — the fix for a
 *    confirmed-safe case like that is a scoped `eslint-disable-next-line`
 *    with a comment explaining why, this repo's own already-established
 *    escape hatch (see `AGENTS.md`'s Linting section), not a rule-level
 *    carve-out that would blind the rule to a real unguarded reference
 *    somewhere else.
 * 4. A class component (`extends Component`/`PureComponent`/
 *    `React.Component`/`React.PureComponent`) — needed for class-lifecycle
 *    reasons unrelated to hooks/context/browser-globals (class components
 *    aren't usable in a Server Component), a real 4th category the
 *    original 3-reason rule was missing, found via
 *    `src/components/ErrorBoundary/AIErrorBoundary.tsx` while designing
 *    this rule. Matches by superclass name only — an unrelated class from
 *    a different library sharing that name would false-positive, the same
 *    structural-not-semantic bar `no-unexplained-zindex.js`/
 *    `no-computed-prop-before-spread.js` already hold themselves to.
 *
 * Only flags a *missing* directive when one of the above is present —
 * never flags an already-present directive on a file that doesn't
 * strictly need it (a bundle-size nit, not a build-breaker).
 *
 * Deliberately same-file-only: it cannot see that file A needs the
 * directive because it imports file B, which does. No reusable transitive-
 * import resolver exists in Toolcrib as of this rule's own design, and the
 * two real historical incidents behind the original fix were both
 * same-file detection gaps, not genuine cross-file transitivity failures —
 * a real Next.js build (`nextjs-fixture` in `ci.yml`) stays the
 * authoritative backstop for anything this static, same-file check can't
 * see, the same "additive, not a replacement" relationship Toolcrib's own
 * `build-graph.json` already documents for itself relative to its four
 * generators' own content-diff `--check` commands.
 *
 * Two more real, accepted blind spots, named directly rather than left
 * implicit: a bracket-notation call (`obj['useFoo']()`) or a
 * `globalThis.document`/`self.document` form isn't caught by an
 * Identifier/`X.member` match — the same "differently-named alias" class
 * of gap `no-computed-prop-before-spread.js` already documents for its own
 * spread-argument check.
 *
 * Deliberately framework-agnostic: no import of `typescript`,
 * `typescript-eslint`, or any Toolcrib-specific module — plain ESTree/JSX
 * AST + ESLint's own built-in scope analysis only, present identically
 * regardless of file extension or TypeScript version. A missing
 * `'use client'` on a hook-using file is a universal Next.js App Router
 * footgun, not a Toolcrib-specific bug shape that happens to be
 * AST-general — reachable writing fresh code in any consumer's own app
 * exactly as it is here, which is why this lives in the consumer-facing
 * `eslint-rules/` directory rather than staying an internal-only check.
 */

const HOOK_NAME = /^use[A-Z]/;
const BROWSER_GLOBALS = [
  'document',
  'window',
  'ResizeObserver',
  'IntersectionObserver',
  'MutationObserver',
  'matchMedia',
  'localStorage',
  'sessionStorage',
  'navigator',
];
const CLASS_COMPONENT_NAMES = new Set(['Component', 'PureComponent']);

function calleeName(callee) {
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier') {
    return callee.property.name;
  }
  return null;
}

function superClassName(superClass) {
  if (!superClass) return null;
  if (superClass.type === 'Identifier') return superClass.name;
  if (superClass.type === 'MemberExpression' && !superClass.computed && superClass.property.type === 'Identifier') {
    return superClass.property.name;
  }
  return null;
}

function hasUseClientDirective(programNode) {
  const first = programNode.body[0];
  return (
    first != null &&
    first.type === 'ExpressionStatement' &&
    first.expression.type === 'Literal' &&
    first.expression.value === 'use client'
  );
}

const MISSING_DIRECTIVE_HINT =
  "Add 'use client'; as the literal first line of the file (before any imports -- a leading comment block before it is fine).";

/** @type {import('eslint').Rule.RuleModule} */
export const noMissingUseClient = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "A file that calls a React hook, calls createContext, references a browser-only global, or defines a class component needs 'use client' as its literal first line, or a Next.js App Router build fails outright.",
    },
    schema: [],
  },
  create(context) {
    let hasDirective = false;

    return {
      Program(node) {
        hasDirective = hasUseClientDirective(node);
      },

      CallExpression(node) {
        if (hasDirective) return;
        const name = calleeName(node.callee);
        if (name == null) return;

        if (HOOK_NAME.test(name)) {
          context.report({
            node,
            message: `This file calls the hook '${name}' but is missing the 'use client' directive. ${MISSING_DIRECTIVE_HINT}`,
          });
          return;
        }
        if (name === 'createContext') {
          context.report({
            node,
            message: `This file calls createContext but is missing the 'use client' directive. ${MISSING_DIRECTIVE_HINT}`,
          });
        }
      },

      'ClassDeclaration, ClassExpression'(node) {
        if (hasDirective) return;
        const name = superClassName(node.superClass);
        if (name == null || !CLASS_COMPONENT_NAMES.has(name)) return;

        context.report({
          node,
          message: `This file defines a class component (extends ${name}) but is missing the 'use client' directive -- class components aren't usable in a Server Component. ${MISSING_DIRECTIVE_HINT}`,
        });
      },

      'Program:exit'() {
        if (hasDirective) return;
        const scopeManager = context.sourceCode.scopeManager;
        const globalScope = scopeManager.globalScope;
        if (!globalScope) return;

        // Deliberately not "is this name declared in languageOptions.globals" --
        // that would silently stop working the moment a consumer's own
        // ESLint config doesn't happen to configure these 9 names as
        // globals (this repo's own eslint.config.js does, via
        // globals.browser, but that shouldn't be load-bearing for a rule
        // meant to work in any consumer's config). Walking every scope's
        // own references and checking each candidate's resolution instead:
        // a reference genuinely correctly resolves to `resolved === null`
        // (nothing declares this name anywhere -- always the case for an
        // unconfigured global) or to a Variable that itself lives in the
        // global scope with zero real declarations (`defs.length === 0` --
        // a "configured global" added via languageOptions.globals, not a
        // real `var`/`let`/`const` at module scope). Either way, that's a
        // real reference to the actual browser global; a local shadow
        // (`const document = ...` inside a function) resolves to that
        // local Variable instead (real defs, not the global scope) and is
        // correctly left alone.
        for (const scope of scopeManager.scopes) {
          for (const reference of scope.references) {
            const name = reference.identifier.name;
            if (!BROWSER_GLOBALS.includes(name)) continue;

            const resolved = reference.resolved;
            const isRealGlobal = resolved == null || (resolved.scope === globalScope && resolved.defs.length === 0);
            if (!isRealGlobal) continue;

            context.report({
              node: reference.identifier,
              message: `This file references the browser-only global '${name}' but is missing the 'use client' directive. ${MISSING_DIRECTIVE_HINT}`,
            });
          }
        }
      },
    };
  },
};
