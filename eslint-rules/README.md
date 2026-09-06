# Vendored ESLint rules

Toolcrib's own `Z_INDEX` scale (`#toolcrib`'s `Z_INDEX`/`useStackedZIndex`) exists to prevent a chronic bug class confirmed in the real issue tracker of every mainstream competitor checked: your own custom UI silently competing for stacking order against a Toolcrib overlay (`Modal`, `Drawer`, `Toast`, ...), with nothing catching the collision until it's visibly wrong in a browser. A hardcoded z-index in your own code is exactly how that happens.

`no-unexplained-zindex.js` in this same directory is a real, standalone ESLint rule that flags one: a hardcoded `zIndex: <number>` of 3 or higher with no comment explaining it. It's vendored here — not installed automatically, not wired into your config for you — because your ESLint setup (flat config vs. legacy `.eslintrc`, which parser, which other plugins) is yours to own; auto-editing it would be more likely to break something than help.

**This rule has no TypeScript dependency of any kind.** It operates on plain ESTree `Property` nodes — the same AST shape whether your file is `.js`, `.jsx`, `.ts`, or `.tsx`, and regardless of your TypeScript version. Confirmed directly, not assumed: it was run against a bare `eslint` install with zero `typescript`/`typescript-eslint` packages present at all, and it worked identically. The only real requirement is that your own ESLint config already parses JSX for your project — which any React project's config already does, independent of this rule.

## Wiring it in (flat config, `eslint.config.js`)

```js
import { noUnexplainedZindex } from './toolcrib/eslint-rules/no-unexplained-zindex.js';

export default [
  // ...your existing config objects...
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'toolcrib-consumer': { rules: { 'no-unexplained-zindex': noUnexplainedZindex } },
    },
    rules: {
      'toolcrib-consumer/no-unexplained-zindex': 'error',
    },
  },
];
```

`toolcrib init`/`merge` vendor everything (including this directory) under `./toolcrib/` by default — adjust the import path if your project customized that location. If your project isn't ESM (`"type": "module"` in `package.json`), either add that or rename the rule file to `.mjs` — ESLint flat config itself is always loaded as an ES module regardless of your project's own module format.

## Legacy config (`.eslintrc.*`)

Custom rules in legacy config need to be published as a real plugin package (`eslint-plugin-*`) rather than referenced by a bare file path — this rule wasn't built to be published that way. If your project is still on legacy config, either migrate to flat config (ESLint's own current direction) or adapt this rule's logic into a local plugin package of your own; the rule body itself (`create(context)`) copies over unchanged either way.

## What it does and doesn't catch

- **Catches:** `style={{ zIndex: 500 }}` or any object literal `zIndex:` property set to a bare number ≥ 3, anywhere in your own code, with no comment on the same or preceding line.
- **Doesn't catch:** `zIndex` values of 0–2 (the established pattern for ordering elements within your own local `position: relative` stacking context, which never competes with page-level stacking at all — see Toolcrib's own `Carousel.tsx` for an example of this same convention), or a value passed through a variable/import rather than a literal (the rule reads literal numbers, not general data flow).
