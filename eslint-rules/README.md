# Vendored ESLint rules

This directory ships four independent, standalone rules. Each is vendored here — not installed automatically, not wired into your config for you — because your ESLint setup (flat config vs. legacy `.eslintrc`, which parser, which other plugins) is yours to own; auto-editing it would be more likely to break something than help.

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

## `no-missing-use-client.js`

Every file that calls a React hook, calls `createContext`, references a browser-only global, or defines a class component needs `'use client'` as its literal first line, or a Next.js App Router build fails outright refusing to include that file in a Server Component's module graph at all. This is a universal Next.js concern, not a Toolcrib-specific bug shape — it's exactly as reachable writing fresh code in your own app's `components/` or `hooks/` directory as it was in Toolcrib's own source (see Toolcrib's `AGENTS.md`, the `'use client'` section, for the real incident this automates: a 51→79-file undercount found across two separate real `next build` failures).

This rule flags one: a file where a hook call, `createContext` call, browser-global reference, or class-component definition is present, but `'use client'` isn't the file's literal first statement.

**This rule has real, scoped dependencies unlike the other two** — it needs ESLint's own built-in scope analysis (no extra package; every modern ESLint ships it) to correctly distinguish a real reference to a browser global from a locally-shadowed variable of the same name. Still zero dependency on `typescript`/`typescript-eslint`/anything Toolcrib-specific.

### What it does and doesn't catch

- **Catches:** any `use[A-Z]...(...)` call (built-in or custom hook, bare or as `X.useSomething(...)`); `createContext(...)`/`X.createContext(...)` (a generic type argument like `createContext<T>(...)` needs no special handling); a real reference to `document`, `window`, `ResizeObserver`, `IntersectionObserver`, `MutationObserver`, `matchMedia`, `localStorage`, `sessionStorage`, or `navigator`, resolved via real scope analysis so a locally-shadowed variable of the same name is correctly left alone; a class extending `Component`/`PureComponent`/`React.Component`/`React.PureComponent`.
- **Deliberately still flags a guarded/isomorphic reference** (`typeof document === 'undefined' ? undefined : document`) even though it's SSR-safe — it's still a real reference to the actual global, just conditionally used, and the rule has no way to know a given guard is actually safe. Fix a confirmed-safe case with a scoped `eslint-disable-next-line` and a comment explaining why, not by disabling the rule broadly.
- **Doesn't catch (real, accepted limitations):** a coincidentally `use`-prefixed non-hook function (`useCase()`, some unrelated `useEffectiveWidth()` helper) still triggers — inherited from the general hook-naming pattern this rule intentionally uses instead of an enumerated list (the same pattern that closed Toolcrib's own original undercount); a bracket-notation call (`obj['useFoo']()`) or a `globalThis.document`/`self.document` form isn't caught (Identifier/`X.member` match only, the same "differently-named alias" class of gap `no-computed-prop-before-spread.js` already documents for its own spread-argument check); the class-component check matches by superclass *name* only, not real inheritance — an unrelated class from a different library sharing the name `Component` would false-positive; **same-file only** — it cannot see that a file needs the directive because it imports another file that does. A real Next.js build remains the only way to catch that class of gap.

## `no-frozen-controlled-prop.js`

React's controlled/uncontrolled prop convention (`value`/`defaultValue`, `checked`/`defaultChecked`, `open`/`defaultOpen`, ...) decides controlled-vs-uncontrolled by whether the controlled prop is non-`undefined` *on this render*, checked fresh every render — not by whether anything ever intends to update it. Folding `defaultValue` into the same expression that feeds `value` (`value={external !== undefined ? external : defaultValue}`) makes the prop look controlled from the very first render, since a bare prop reference is non-`undefined` for the component's entire lifetime — but nothing ever feeds a new value back down after the child's own internal change, so the child's attempted update is silently discarded and it stays pinned to the original default forever.

This is exactly what happened, live, in Toolcrib's own `DatePicker`/`TimeField`/`Select`/`RadioGroup` (see Toolcrib's `AGENTS.md`) — four independent components, same root cause, found only after a real user reported a standalone date field that couldn't be edited via the keyboard at all. None of it was caught by type-checking or existing tests, because the code is perfectly type-correct and syntactically unremarkable; the bug is purely about render-over-render reactivity.

This rule flags one: a JSX attribute (`value`, `checked`, `open`, or any name following the same convention) whose expression — after following local `const` fallbacks, ternaries, `??`/`||`/`&&`, and a wrapping call's own arguments — bottoms out at a bare reference to this component's own `default<Name>` prop, with no `useState`/`useReducer` anywhere in that chain.

**This rule has real, scoped dependencies, same as `no-missing-use-client.js`** — it needs ESLint's own built-in scope analysis to tell a real reference to a component's own prop apart from a locally-shadowed variable of the same name. Still zero dependency on `typescript`/`typescript-eslint`/anything Toolcrib-specific.

### What it does and doesn't catch

- **Catches:** `value={external !== undefined ? external : defaultValue}`; the same shape after one or more local `const` indirections (`const resolved = ...defaultValue; ...value={resolved}`); a chain that passes through a wrapping call (`value={x !== undefined ? x : String(y)}` where `y` itself bottoms out at `defaultValue`); the same pattern on any other controlled/uncontrolled pair (`open`/`defaultOpen`, `checked`/`defaultChecked`, `selected`/`defaultSelected`, ...) — the rule derives the expected default-prop name from the attribute name itself (`'default' + capitalize(attrName)`), not a hardcoded pair list.
- **Doesn't catch (correctly left alone):** a chain that passes through a `useState`/`useReducer` call seeded from `defaultValue` (the correct, intended use of the prop — the returned getter genuinely is live and gets fed back after every change, e.g. `ToggleGroup`'s own fix); a renamed destructure (`{ defaultValue: dv }` binds the name `dv`, not `defaultValue` — same "structural, not semantic" limitation `no-computed-prop-before-spread.js` already documents for its own member-access check); a locally-shadowed variable that happens to be named `defaultValue` but isn't actually this component's own prop; a collision that goes through a differently-named alias, or a chain wrapped in something other than a plain call/ternary/logical expression (e.g. buried inside a member access or a function you'd need real data-flow analysis to see through).

## Wiring all four in (flat config, `eslint.config.js`)

```js
import { noUnexplainedZindex } from './toolcrib/eslint-rules/no-unexplained-zindex.js';
import { noComputedPropBeforeSpread } from './toolcrib/eslint-rules/no-computed-prop-before-spread.js';
import { noMissingUseClient } from './toolcrib/eslint-rules/no-missing-use-client.js';
import { noFrozenControlledProp } from './toolcrib/eslint-rules/no-frozen-controlled-prop.js';

export default [
  // ...your existing config objects...
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'toolcrib-consumer': {
        rules: {
          'no-unexplained-zindex': noUnexplainedZindex,
          'no-computed-prop-before-spread': noComputedPropBeforeSpread,
          'no-missing-use-client': noMissingUseClient,
          'no-frozen-controlled-prop': noFrozenControlledProp,
        },
      },
    },
    rules: {
      'toolcrib-consumer/no-unexplained-zindex': 'error',
      'toolcrib-consumer/no-computed-prop-before-spread': 'error',
      'toolcrib-consumer/no-missing-use-client': 'error',
      'toolcrib-consumer/no-frozen-controlled-prop': 'error',
    },
  },
];
```

`toolcrib init`/`merge` vendor everything (including this directory) under `./toolcrib/` by default — adjust the import path if your project customized that location. If your project isn't ESM (`"type": "module"` in `package.json`), either add that or rename the rule files to `.mjs` — ESLint flat config itself is always loaded as an ES module regardless of your project's own module format.

## Legacy config (`.eslintrc.*`)

Custom rules in legacy config need to be published as a real plugin package (`eslint-plugin-*`) rather than referenced by a bare file path — none of these rules were built to be published that way. If your project is still on legacy config, either migrate to flat config (ESLint's own current direction) or adapt the rule logic into a local plugin package of your own; each rule's own `create(context)` body copies over unchanged either way.
