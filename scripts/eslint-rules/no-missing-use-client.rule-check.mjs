// Table-driven tests for ../../eslint-rules/no-missing-use-client.js, using
// ESLint's own built-in RuleTester (no new dependency -- `eslint` already
// lives here, per scripts/package.json's own isolated-from-root reasoning;
// see AGENTS.md's TypeScript section). Run as a plain `node` script, not
// through Vitest: root's own package.json has no `eslint` dependency at all
// (deliberately isolated to this directory), so a src/__tests__/ test file
// couldn't import RuleTester without adding a new root devDependency purely
// for this one file. RuleTester needs no test framework to function --
// with no describe/it globals present, it calls each case directly and lets
// a real assertion failure throw, which is exactly what a plain `node`
// invocation (and this repo's own CI) needs: a non-zero exit on failure.
//
// Named `.rule-check.mjs`, not `.test.mjs`, on purpose: Vitest's default
// include glob (`**/*.{test,spec}.?(c|m)[jt]s?(x)`) picks up any `.test.mjs`
// file under scripts/ too (the established, deliberate reason
// scripts/lib/extract.test.js and buildGraph.test.js already run under
// root's own `npm test` -- vite.config.ts's exclude list only excludes
// cli/**, mcp/**, e2e/**, not scripts/**). This file isn't one of those --
// it's a top-level-executing RuleTester script with its own dedicated
// invocation (`npm run test-eslint-rules`, and its own ci.yml step), not a
// Vitest describe/it suite. It happens to still work if Vitest picks it up
// incidentally (Node module resolution for an import is based on the
// importing file's own location regardless of which process loads it), but
// running it a second, accidental way isn't something to rely on -- this
// name avoids the glob match so there's exactly one clear invocation path.
//
// Uses typescript-eslint's parser (already a scripts/ dependency) for every
// case, not just the ones that need real TS syntax -- it parses plain JS
// fine too, and keeping one parser for the whole file is simpler than
// switching per case.
//
// Skipping this rule's tests wouldn't match the precedent the other two
// vendored rules set (neither has a test file) -- this rule carries real,
// new complexity those two never did (4 independent detection categories
// plus scope-resolution logic), and its failure mode is asymmetric: a false
// negative here doesn't surface as a lint nit, it silently ships a real
// build-breaking bug that only turns up at nextjs-fixture (or a consumer's
// own build). A clean `npm run lint` against the current corpus only proves
// zero false positives on already-correct code -- it says nothing about
// whether the detection logic actually fires on a true positive.

import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { noMissingUseClient } from '../../eslint-rules/no-missing-use-client.js';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

const HINT = "Add 'use client'; as the literal first line of the file (before any imports -- a leading comment block before it is fine).";

ruleTester.run('no-missing-use-client', noMissingUseClient, {
  valid: [
    // Category 1: hook call, directive present.
    `'use client';\nfunction useFoo() { return useState(0); }`,

    // Category 1: a leading comment block before the directive is fine --
    // directive-prologue recognition ignores comments (Program.body[0] is
    // still the directive; the comment is never a body statement at all).
    `// a leading comment\n'use client';\nfunction useFoo() { return useState(0); }`,

    // Category 2: createContext call, directive present.
    `'use client';\nconst Ctx = createContext(null);`,

    // Category 4: class component, directive present.
    `'use client';\nclass Boundary extends Component {}`,

    // No detection category trips at all -- a plain helper with no hook/
    // context/browser-global/class-component shape needs no directive.
    `function helper() { return 1; }`,

    // A locally-shadowed variable named 'document' is correctly left
    // alone -- it never resolves to the real global at all, so this isn't
    // a real browser-global reference regardless of the missing directive.
    `function helper() { const document = { id: 1 }; return document; }`,

    // Regression lock for the exact historical false positive this AST
    // approach structurally can't repeat: a hook name mentioned only
    // inside a JSDoc comment, never actually called.
    `/**\n * Calls useSomething() internally -- see useSomething's own file.\n */\nfunction helper() { return 1; }`,

    // An unrelated class sharing no name with Component/PureComponent
    // isn't flagged.
    `class Widget extends SomethingElse {}`,
  ],

  invalid: [
    // Category 1: hook call, missing directive.
    {
      code: `function useFoo() { return useState(0); }`,
      errors: [{ message: `This file calls the hook 'useState' but is missing the 'use client' directive. ${HINT}` }],
    },

    // Category 1: a member-expression hook call (X.useSomething(...)) is
    // caught the same way as a bare identifier call.
    {
      code: `function useFoo() { return React.useEffect(() => {}, []); }`,
      errors: [{ message: `This file calls the hook 'useEffect' but is missing the 'use client' directive. ${HINT}` }],
    },

    // Category 2: createContext call, missing directive.
    {
      code: `const Ctx = createContext(null);`,
      errors: [{ message: `This file calls createContext but is missing the 'use client' directive. ${HINT}` }],
    },

    // Category 2: a generic type argument between the identifier and the
    // call parens (createContext<T>(...)) needs no special handling under
    // a real AST -- callee and typeArguments are separate node fields.
    // This exact shape (FieldContext.ts) was a false negative under the
    // original text-regex scan during this rule's own design.
    {
      code: `interface CtxValue { id: string }\nconst Ctx = createContext<CtxValue>(null);`,
      errors: [{ message: `This file calls createContext but is missing the 'use client' directive. ${HINT}` }],
    },

    // Category 3: a guarded/isomorphic reference (typeof document ===
    // 'undefined' ? ... : document) is a deliberate false positive, not a
    // bug -- it's still a real reference to the actual global, just
    // conditionally used. Locks in the design choice, not just prose about
    // it. Two references on the one line (the typeof check, the fallback
    // value), so two reports.
    {
      code: `function helper() { return typeof document === 'undefined' ? undefined : document; }`,
      errors: [
        { message: `This file references the browser-only global 'document' but is missing the 'use client' directive. ${HINT}` },
        { message: `This file references the browser-only global 'document' but is missing the 'use client' directive. ${HINT}` },
      ],
    },

    // Category 3: a different browser global, unguarded.
    {
      code: `function helper() { return window.innerWidth; }`,
      errors: [{ message: `This file references the browser-only global 'window' but is missing the 'use client' directive. ${HINT}` }],
    },

    // Category 4: class component, missing directive.
    {
      code: `class Boundary extends Component {}`,
      errors: [{ message: `This file defines a class component (extends Component) but is missing the 'use client' directive -- class components aren't usable in a Server Component. ${HINT}` }],
    },

    // Category 4: React.PureComponent form.
    {
      code: `class Boundary extends React.PureComponent {}`,
      errors: [{ message: `This file defines a class component (extends PureComponent) but is missing the 'use client' directive -- class components aren't usable in a Server Component. ${HINT}` }],
    },

    // The directive is present but isn't the file's first statement (an
    // import precedes it) -- Program.body[0] is the import, not the
    // directive, so this is correctly still flagged.
    {
      code: `import { foo } from 'bar';\n'use client';\nfunction useFoo() { return useState(0); }\nfoo();`,
      errors: [{ message: `This file calls the hook 'useState' but is missing the 'use client' directive. ${HINT}` }],
    },
  ],
});

console.log('no-missing-use-client: all RuleTester cases passed.');
