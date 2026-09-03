import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// Lives here, not at root, for the same reason typescript@6.0.3 (this
// directory's own package.json) does: typescript-eslint hard-fails at
// import time against TS 7 (root's own typescript version) -- confirmed
// directly, not assumed ("typescript-eslint does not support TS 7.0").
//
// Root's own "lint" script invokes this directory's eslint binary
// directly (`node scripts/node_modules/eslint/bin/eslint.js --config
// scripts/eslint.config.js src demo`) with cwd left at root -- NOT via
// `npm --prefix scripts`, and NOT `cd scripts && ...`. Two things had to
// be verified directly (not assumed) to get this right:
//
// 1. ESLint's flat config resolves its "base path" (the directory a
//    target file must be *relative to*, for `files`/`ignores` matching)
//    from `cwd`, not from this config file's own location, whenever
//    `--config <path>` is passed explicitly (confirmed in eslint's own
//    config-loader.js: `basePath = cwd` unconditionally on that code
//    path). Running with cwd = scripts/ made every file resolve as
//    "outside the base path." cwd = root fixes that.
// 2. `@eslint/config-array` matches a target file against `files`
//    patterns by first converting the file's *absolute* path to one
//    *relative to basePath* (confirmed in its own source:
//    `path.relative(basePath, fullPath)`) -- so `files` patterns must
//    themselves be relative-to-basePath strings ('src/**/*.{ts,tsx}'),
//    not absolute paths.
//
// This file's own `import 'typescript-eslint'` is unaffected by any of
// this -- ES module bare-specifier resolution is based on the importing
// file's own disk location (this directory's node_modules), never on
// cwd or basePath.
//
// Deliberately scoped to ONLY eslint-plugin-react-hooks's rules (its
// "Rules of React" set: rules-of-hooks, exhaustive-deps,
// set-state-in-effect/render, purity, immutability, etc.) -- these are
// the actual React anti-patterns this was introduced to catch. NOT
// typescript-eslint's or eslint-plugin-react's own "recommended"
// presets: a first real run with those enabled produced 229 errors,
// almost entirely @typescript-eslint/no-explicit-any (a style opinion,
// not a bug -- and largely already redundant with tsconfig.json's own
// noUnusedLocals/noUnusedParameters for the adjacent no-unused-vars
// case) and react/no-unescaped-entities (a low-value, widely-disabled
// rule that flags ordinary apostrophes in prose-heavy JSX text). Adding
// either back is a real option later, but as a deliberate, separately-
// triaged decision -- not bundled in by a "recommended" preset's own
// scope, which is broader than what this check was actually asked for.
export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'cli/**', 'scripts/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}', 'demo/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Vendored source can't assume @types/node (or any other bundler's
      // ambient types) is present in a consumer project -- a bare
      // `process.env...` reference type-checks fine in this repo's own
      // dev environment (where @types/node happens to be installed) and
      // then fails to compile the moment it's vendored into a fresh
      // consumer scaffold that never opted into it. Use `isDevBuild()`
      // from `theme/safeProps.ts` instead, which reads the same value
      // through a `globalThis` cast specifically so it never needs
      // ambient Node or Vite types to compile. See AGENTS.md.
      'no-restricted-globals': ['error', { name: 'process', message: 'Use isDevBuild() from theme/safeProps.ts instead of accessing process.env directly.' }],
    },
  }
);
