# Vendored ESLint rules

This directory ships two independent, standalone rules. Each is vendored here — not installed automatically, not wired into your config for you — because your ESLint setup (flat config vs. legacy `.eslintrc`, which parser, which other plugins) is yours to own; auto-editing it would be more likely to break something than help.

## `no-unexplained-zindex.js`

Toolcrib's own `Z_INDEX` scale (`#toolcrib`'s `Z_INDEX`/`useStackedZIndex`) exists to prevent a chronic bug class confirmed in the real issue tracker of every mainstream competitor checked: your own custom UI silently competing for stacking order against a Toolcrib overlay (`Modal`, `Drawer`, `Toast`, ...), with nothing catching the collision until it's visibly wrong in a browser. A hardcoded z-index in your own code is exactly how that happens.

This rule flags one: a hardcoded `zIndex: <number>` of 3 or higher with no comment explaining it.

**This rule has no TypeScript dependency of any kind.** It operates on plain ESTree `Property` nodes — the same AST shape whether your file is `.js`, `.jsx`, `.ts`, or `.tsx`, and regardless of your TypeScript version. Confirmed directly, not assumed: it was run against a bare `eslint` install with zero `typescript`/`typescript-eslint` packages present at all, and it worked identically. The only real requirement is that your own ESLint config already parses JSX for your project — which any React project's config already does, independent of this rule.

### What it does and doesn't catch

- **Catches:** `style={{ zIndex: 500 }}` or any object literal `zIndex:` property set to a bare number ≥ 3, anywhere in your own code, with no comment on the same or preceding line.
- **Doesn't catch:** `zIndex` values of 0–2 (the established pattern for ordering elements within your own local `position: relative` stacking context, which never competes with page-level stacking at all — see Toolcrib's own `Carousel.tsx` for an example of this same convention), or a value passed through a variable/import rather than a literal (the rule reads literal numbers, not general data flow).

## `no-computed-prop-before-spread.js`

JSX/`Object.assign` semantics mean a later `{...spread}` always wins over an earlier named attribute for any key it also defines. That's usually exactly what you want (a default before the spread, letting a caller override it) — but it's a real, shipped bug the instant the *earlier* attribute is itself computed from a member of the object you're about to spread, e.g. `disabled={isSubmitting || props.disabled} {...props}`: the spread silently re-applies the original `props.disabled` and throws away the computed value the moment a caller passes that same prop at all. This is exactly the shape of a real bug found in Toolcrib's own `SubmitButton` (see Toolcrib's `AGENTS.md`, "a trailing `{...props}` spread silently overrides anything set before it") — and it's just as reachable writing fresh code in your own app as it was there, which is why this rule ships to consumers rather than staying an internal-only check.

This rule flags one: a named JSX attribute, positioned before a spread of an identifier (`{...props}`), whose value expression contains a `<thatIdentifier>.<sameAttributeName>` member access anywhere inside it.

**This rule has no TypeScript dependency of any kind**, for the same reason `no-unexplained-zindex.js` doesn't — plain ESTree/JSX AST nodes only.

### What it does and doesn't catch

- **Catches:** `disabled={isSubmitting || props.disabled} {...props}`, `className={cx('foo', props.className)} {...props}` — any attribute computed from the very object it precedes in the spread.
- **Doesn't catch (correctly left alone):** a static default placed before a spread on purpose so a caller *can* override it (`<div tabIndex={0} {...props} />` — nothing here reads `props.tabIndex`, so there's no computed value to lose); a prop already destructured out before spreading the rest (`({ disabled, ...rest }) => <Button disabled={isSubmitting || disabled} {...rest} />` — `rest` no longer has a `disabled` key, so the spread can't collide); a spread argument that isn't a plain identifier (`{...getExtraProps()}`); or a collision that goes through a differently-named alias of the same object.

## Wiring both in (flat config, `eslint.config.js`)

```js
import { noUnexplainedZindex } from './toolcrib/eslint-rules/no-unexplained-zindex.js';
import { noComputedPropBeforeSpread } from './toolcrib/eslint-rules/no-computed-prop-before-spread.js';

export default [
  // ...your existing config objects...
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'toolcrib-consumer': {
        rules: {
          'no-unexplained-zindex': noUnexplainedZindex,
          'no-computed-prop-before-spread': noComputedPropBeforeSpread,
        },
      },
    },
    rules: {
      'toolcrib-consumer/no-unexplained-zindex': 'error',
      'toolcrib-consumer/no-computed-prop-before-spread': 'error',
    },
  },
];
```

`toolcrib init`/`merge` vendor everything (including this directory) under `./toolcrib/` by default — adjust the import path if your project customized that location. If your project isn't ESM (`"type": "module"` in `package.json`), either add that or rename the rule files to `.mjs` — ESLint flat config itself is always loaded as an ES module regardless of your project's own module format.

## Legacy config (`.eslintrc.*`)

Custom rules in legacy config need to be published as a real plugin package (`eslint-plugin-*`) rather than referenced by a bare file path — neither rule was built to be published that way. If your project is still on legacy config, either migrate to flat config (ESLint's own current direction) or adapt the rule logic into a local plugin package of your own; each rule's own `create(context)` body copies over unchanged either way.
