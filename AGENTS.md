# Contributing to Toolcrib

This file is for whoever (human or AI) is working **on** this repo — adding components, fixing bugs, extending the CLI. If you're building an app that **uses** toolcrib, this is the wrong file: see `ai-docs/CORE.md` (always) plus `ai-docs/NEW_APP.md` or `ai-docs/REFACTOR_APP.md` (situational) instead — those ship to consumers and are the canonical rule set for using the toolkit, not for building it.

## What this is

`toolcrib` is a React component library designed specifically for AI code generation ("vibe coding") — an AI that's building a UI tends to hand-roll the same popups, slide-outs, and ad-hoc CSS over and over. Toolcrib exists to give it a structural toolkit instead: slot-based components, a strongly-typed event bus for cross-tree actions, an HSV-derived CSS-variable theme system, and a Zod-schema-driven form engine.

The toolkit itself (`src/theme`, `src/eventBus`, `src/observer`, `src/components/**`) is **not distributed as an npm package**. Consumers run `toolcrib init` (via the `toolcrib` CLI on npm, built from `cli/`), which vendors those directories plus `ai-docs/` directly into their own project as reviewable patches, then wires a `#toolcrib` subpath import (`package.json`'s `"imports"` field) to it. `src/` is *only* toolkit source — nothing else lives there.

`demo/` (`App.tsx`, `main.tsx`, `index.css`, `vite-env.d.ts`), the root `index.html`, and this file are this repo's own dev/demo harness and contributor instructions — they are **not** vendored, and never will be just by adding them to a directory that happens to get copied. `demo/` imports the toolkit exclusively via `import { ... } from '#toolcrib'` (the same alias, resolved locally to `./src/index.ts` by root `package.json`'s own `"imports"` field) — never a relative path into `src/`. This is deliberate, not a style preference: a relative import can reach right past the public barrel into an internal file, so the demo would keep working even if `src/index.ts` forgot to re-export something a real consumer needs. Going through `#toolcrib` means the demo breaks the same way a real consumer's build would the moment that happens — see `@barrelExport` below for how `src/index.ts` itself stays honest.

## Generalizing lessons in this file

Every rule below started as one specific bug in one specific file. Whoever adds the next one — human or AI, in this repo or in an external review session — should write it up as the *underlying pattern*, not just the component/prop where it happened to surface, and fold it into an existing entry if one already covers the same root cause rather than appending a disconnected new one. "A trailing `{...props}` spread silently overrides anything set before it" (below) is the model to follow: it was found once, in one place, then found again in a completely different component months later, and because the entry was written at the level of the mechanism rather than the instance, it was fast to recognize the second occurrence as the same rule rather than a new bug needing its own separate write-up. The `typescript` pin at the bottom of this file is another example — it doesn't just say "don't upgrade," it says exactly why, so the next person evaluating an upgrade has the actual constraint instead of a bare prohibition.

This is also the concrete reason external review sessions like the one this file's currently-newest entries came from are worth deferring a release for: nothing in a single generation pass forces a check for "does this new code repeat a mistake already found and written up elsewhere," and nothing in this repo's CI checks that either — it's read-and-recognize, not automated. A session with room to read the whole codebase at once, cross-reference components against each other and against this file, and write actual regression tests catches exactly the class of thing that's invisible from inside any single generation turn. Feed what it finds back into this file at the general level, not the specific one, so the next pass — automated or not — has a better chance of recognizing the pattern before it has to be found a third time.


## Dev machine is Windows — use PowerShell, not Bash

The primary dev machine for this repo runs Windows, and its `Bash` tool is a minimal git-bash without coreutils — `ls`, `grep`, `rm`, `find`, `head`, `tail`, `sleep`, and even `node`/`npm` are missing or unreliable there, confirmed repeatedly by real failures, not assumption. **Run shell commands (`npm`, `node`, `git`, etc.) via the PowerShell tool, not Bash.** Use the dedicated file tools (Read/Write/Edit/Glob/Grep) instead of either shell for file operations wherever possible — they aren't affected by this at all.

PowerShell-specific gotchas hit in practice:
- `Start-Process -FilePath "npm"` fails **silently** (no process, no error) — Windows needs the actual executable name, `npm.cmd`, not the bare command a normal shell would resolve via PATHEXT.
- The console can mangle non-ASCII characters (em dashes, etc.) on read-back even when the file on disk is correct UTF-8 — if a file's content looks corrupted after `Get-Content`, verify with `[System.IO.File]::ReadAllText(path, [System.Text.Encoding]::UTF8)` before assuming the file itself is broken.
- The working directory does not reliably persist between separate tool calls the way a single interactive shell session would — pass an explicit `cd`/path in each command rather than relying on a previous `cd` still being in effect.
- `.gitattributes` (`* text=auto eol=lf`) normalizes line endings repo-wide, but it only affects the *index* going forward — a file already checked out with stale CRLF (from before `.gitattributes` existed, or from `core.autocrlf=true`) stays CRLF on disk indefinitely; `git status`/`git checkout HEAD -- <file>` both silently no-op on it, since autocrlf-aware comparison treats the CRLF working copy and the LF blob as equivalent. Found for real while investigating an unrelated `npm publish` warning about `cli/src/index.js`'s `bin` entry — that warning turned out to be a harmless, unrelated cosmetic path normalization (npm stripping a redundant leading `./`), but the file's shebang line genuinely did still have stale CRLF from before `.gitattributes` existed, which would break real execution on Linux/Mac (`#!/usr/bin/env node\r` resolves to a nonexistent `node\r` interpreter). `git checkout HEAD -- cli/src/index.js` alone did nothing to fix it. The actual fix is deleting the file first so there's nothing to short-circuit against, then re-checking it out: `rm <file> && git checkout HEAD -- <file>`. Verify with a real byte-level check (`buffer.includes(0x0d)` in Node, not `git status`) before trusting it's fixed — and don't assume a CRLF-adjacent error message is actually about CRLF; verify the real cause before "fixing" it.

## Core rules

The actual component/theme/event-bus rules (no prop-drilling, HSV-only color, `rem` units, anti-patterns) live in `ai-docs/CORE.md` — that file is the single source of truth, read by consumers and shipped as-is. Don't duplicate those rules here; if you change one, change it there and keep this file's references in sync.

## Documenting a component for the manifest

`ai-docs/component-manifest.json` is **generated**, not hand-edited — `node scripts/generate-manifest.js --write` (or `npm run generate-manifest`) rebuilds it from JSDoc directly on component source via the TypeScript Compiler API. `npm run check-manifest` validates there's no drift, and CI runs it on every release; a component with missing/wrong tags either doesn't show up at all or fails the build, silently or loudly depending on which mistake you make below.

**A component needs an `@manifest` tag to appear at all.** Put it in a JSDoc block directly above the component's `export const X: React.FC<...> = ...` (or `export function X(...)`) declaration — **not** on the Props interface. Some props interfaces are shared by more than one component (`VStack`/`HStack` both use `StackProps`), and each needs its own description, so description is a property of the component declaration, never of the prop shape:

```tsx
/** @manifest Slot-based container with automatic layout domain corner squaring */
export const Card: React.FC<CardProps> & { Header: ...; Content: ...; } = (...) => { ... };
```

**Props** are read from the interface referenced by the component's `React.FC<...>` type argument (or, for generic function components like `Form`/`DataTable`, the first parameter's type). Per property:
- Plain JSDoc prose above the property becomes its `description`.
- An `@default <value>` tag becomes its `default`.
- No `?` on the property (i.e. required in TypeScript) automatically becomes `"required": true` in the manifest — nothing to tag, just don't mark it optional if it isn't.
- `children` is never listed — implicit on every component, consistent with the manifest's existing style.

```tsx
export interface CardProps {
  /**
   * Layout mode. `'auto'` enables flex fill + corner squaring.
   * @default 'default'
   */
  layout?: 'default' | 'auto';
}
```

**Slots** (`Card.Header`, `Modal.Body`, etc.) are discovered automatically by scanning the component's file for `ComponentName.SlotName = ...` assignments — no tag needed. Standard React statics assigned the same way (`Component.displayName = ...`) are excluded automatically; don't add new ones to that exclusion list casually if you're not sure they aren't a real slot.

**`@manifestCategory <name>` is required, not optional** — one of `Layout Primitives`, `Containers`, `Overlays`, `Data Display`, `Form Controls` (`VALID_CATEGORIES` in `scripts/lib/extract.js`). Generation fails outright (both `--check` and `--write`) if a `@manifest`-tagged component is missing it or uses a value outside that set — it's what groups components into `ai-docs/CORE.md`'s generated Component Reference tables (§4), so an uncategorized component would otherwise fall out of that doc's tables silently.

**Two more tags for facts that aren't mechanically derivable:**
- `@manifestConstraints <text>` — a structural requirement the type system can't express (e.g. Splitter's `@manifestConstraints Requires exactly 2 children`).
- `@manifestChildren <Comma, Separated, Names>` — a curated "commonly used together" list, e.g. Form's child form controls. This is a judgment call about typical usage, not a property of the source, so it has to be authored, not inferred.

**Custom/grouped import lines** (Form's import bundles ten related exports in one statement, not just `Form` itself) aren't derived either — they're a `MANUAL_IMPORT_OVERRIDES` entry at the top of `scripts/generate-manifest.js`. Add an entry there if a new component needs the same treatment; every other component defaults to `import { X } from '#toolcrib'`.

**Event bus channels** are read from the `AIEventMap` interface in `src/eventBus/eventBus.ts` — add a new event there and it appears in the manifest automatically, "payload" being that property's literal TS type. Keep new payload types to one line; a multi-line type with inline comments (like `theme:changed`'s) still works but gets whitespace-collapsed and comment-stripped in the generated output, so writing it compactly to begin with is just less to translate mentally.

**Event bus helper methods** (`aiBus.openModal(...)` etc.) are read from `AIEventBus`'s methods, excluding `on`/`off`/`emit` themselves. "emits" is read from the first `this.emit('event:name', ...)` call in the method body. If a method returns something worth documenting (like `showToast` returning the toast id), add `@manifestReturns <description>` to its JSDoc — otherwise `returns` is simply omitted.

**After any of the above:** run `npm run generate-manifest`, review the diff, commit it alongside your source change. Don't hand-edit `component-manifest.json` directly — the next run will silently overwrite it, and CI will catch the drift anyway.

**`ai-docs/CORE.md` is also generated, not hand-edited** — `node scripts/generate-docs.js --write` (or `npm run generate-docs`) renders `ai-docs/templates/CORE.md.hbs` against the same source-derived data as the manifest (shared via `scripts/lib/extract.js`, so the two can't disagree with each other). This exists because CORE.md's hand-written tables had already drifted before this pipeline did — missing 9 of 32 real event channels and 4 of 20 real components at the time it was built. `npm run check-docs` (or `node scripts/generate-docs.js --check`) validates there's no drift, same contract as `check-manifest`; CI runs both. If a source change should change CORE.md's *generated* sections (Component Reference, Z-Index table, Theme Slices list, Event Bus payload reference), regenerate — don't hand-edit the committed file. If it should change CORE.md's *static* prose (Root Setup, Core Principles, Anti-Patterns, the escape-hatches/overrides sections, code samples), edit `CORE.md.hbs` directly, then regenerate.

## Keeping `src/index.ts` (the public `#toolcrib` barrel) in sync

`src/index.ts` is also generated, not hand-edited — `node scripts/generate-index.js --write` (or `npm run generate-index`) rebuilds it by scanning every file under `src/theme`, `src/eventBus`, `src/observer`, and `src/components/**` for exported declarations tagged `@manifest` or `@barrelExport`, and re-exporting the *whole file* (`export * from './path'`) for any that qualify. `npm run check-index` validates there's no drift; CI runs it alongside `check-manifest`/`check-docs`. This exists because the hand-maintained version drifted for real — an audit while separating the demo app from the toolkit found `Content`, `DataTableSlice`, and `useSliceOverrides` silently missing, each shipped to every consumer as a vendored file but literally unimportable via `#toolcrib`.

**A component's `@manifest` tag already counts** — nothing extra to add. For everything else meant to be public (a hook, a `ThemeSlice` definition, a context's exported types, a shared utility), tag one exported declaration in the file with `@barrelExport`:

```ts
/** @barrelExport */
export interface TableSliceState {
  density: TableDensity;
  ...
}
```

One tagged declaration is enough — the whole file gets re-exported alongside it, so a component's own Props interface doesn't need its own tag once the component itself is tagged. This is opt-in by design, not opt-out: nothing lands in the public API surface without an explicit marker, matching `@manifestCategory`'s own "required, not inferred" philosophy above. If you add a new file under one of the vendored directories and forget to tag anything in it, `check-index` simply won't include it — no error, just silence, so if something you just added isn't reachable via `#toolcrib`, this is the first thing to check.

**After any of the above:** run `npm run generate-index`, review the diff, commit it alongside your source change — same discipline as `generate-manifest`/`generate-docs`.

## Theme overrides — no component accepts `style`/`className`

Every component's Props interface extends `StyleFree<...>` or `StyleFreeAttributes<T>` (`src/theme/safeProps.ts`) instead of a raw `HTMLAttributes<T>`/`ButtonHTMLAttributes<T>`/etc. — extending the raw attributes type silently reintroduces `style`/`className` regardless of whether the interface redeclares them itself, so deleting the interface's own `style?:`/`className?:` lines is not sufficient on its own. If a component genuinely has nothing else to add, `StyleFreeAttributes<HTMLDivElement>` alone is fine.

Per-instance visual control goes through an `overrides` prop instead, resolved via a four-layer hierarchy: global theme → per-component-type `ThemeSlice` default → contextual domain → this specific instance. Concretely:
- A component with a registered `ThemeSlice` (`src/theme/slice.ts` — e.g. `CardSlice.ts`, `TabSlice.ts`) exposes `overrides?: Partial<SliceState> & { subtheme?: SubthemeName }` and calls `useSliceOverrides(TheSlice, overrides)` (`src/theme/useSliceOverrides.ts`) to get back `{ vars, subtheme }` — spread `vars` into the component's own root `style` (after its other properties, so it wins) and pass `subtheme` to `resolveSubtheme()` (`src/theme/subtheme.ts`) if the component has any subtheme-reactive styling.
- A component with no slice but simple subtheme support (e.g. `Button`) calls the lighter `useResolvedSubtheme(instanceValue)` directly instead.
- Add `fieldVars` to a slice (`{ fieldName: ['--css-var-1', '--css-var-2'] }`) whenever you add one — `getSparseVariables()` uses it to emit only the CSS variables a partial override actually touches, so an instance override doesn't shadow the global Theme Editor state for fields it never mentioned. A slice without `fieldVars` still works, just emits its full result (correct, just over-shadowing) — add it when convenient, not as a hard blocker.
- `<StyleDomainProvider subtheme="...">` (`src/theme/StyleDomainContext.tsx`) lets a whole subtree default to a subtheme without passing `overrides.subtheme` on every descendant — the instance's own value still wins if set. It's Context-based, not CSS-variable inheritance, specifically because Modal/Popup/SlideOut all render through a portal, and CSS custom properties only cascade through the real DOM tree, not the React tree.
- `LayoutDomainContext`/`useCornerSquaring` (`src/components/Splitter/LayoutDomainContext.tsx`) is the equivalent mechanism for spatial/containment concerns (which corners a component should square off inside a `<Splitter>`) rather than semantic ones — same shape, different axis.

**General rule: a trailing `{...props}` spread silently overrides anything set before it — including a value you computed on purpose.** This has now bitten the codebase twice, in two structurally identical but superficially different ways, which is exactly why the rule belongs here at the general level rather than as two disconnected bug notes:

- *Instance 1 (the original case this rule was written from):* `Splitter.Panel`, `UIGroup`, and `Popup`'s/`SlideOut`'s trigger cloning used to coordinate corner radius/sizing with a child via a `cloneElement`-injected `style` prop. It silently stopped working once the child's own computed `style` (declared after its own `{...props}` spread) started winning every render — the injected value never had a chance to apply. Prefer, in order: (1) the child consults `useCornerSquaring`/`useStyleDomain` itself if it's a toolcrib component with domain/context access; (2) a small typed prop the child explicitly declares and applies itself, e.g. `Button`'s `squareCorners?: SquareCornerOption` consumed via the shared `resolveSquareCorners()`; (3) for a visual effect that has to apply uniformly to *any* child regardless of type — including a plain DOM element, which can't call hooks — an injected global stylesheet scoped by a wrapper `className`/`data-*` attribute (see `UIGroup`'s corner-merging CSS) is more robust than per-child style injection and doesn't care whether the child accepts a `style` prop at all.
- *Instance 2 (found in an external review session, not caught by any test at the time):* `SubmitButton` computed `disabled={isSubmitting || props.disabled}` and then spread `{...props}` *after* it. Any consumer passing their own `disabled` at all — e.g. the very natural `<SubmitButton disabled={!isValid}>` to gate submission on form validity — had that original value silently re-applied by the trailing spread, discarding the `isSubmitting ||` guard the instant it ran. The button stopped showing disabled during the actual submit, exactly when double-submit protection mattered most. Fix: reorder so `{...props}` comes first and the computed value that must win is applied after it — `<Button type="submit" {...props} disabled={isSubmitting || props.disabled}>`.

**The general check, for any component that both spreads `{...props}` (or `cloneElement`s a child) and computes a value from other props/state/context:** does anything computed need to win over what a consumer might pass under the same prop name? If so, that computed application must come *after* the spread, never before — regardless of whether today's consumer happens to pass that prop. Don't reason about the common case only ("nobody usually passes `disabled` here") — the ordering has to be correct for the case where they do, since that's exactly when it matters.

If a component sets a shorthand CSS property (`borderRadius`) unconditionally and a longhand (`borderBottomLeftRadius`) only *sometimes* (e.g. gated on `squareCorners`), React warns "Removing a style property during rerender ... can lead to styling bugs" whenever that conditional toggles across renders — the fix is emitting all four corner longhands unconditionally (falling back to the shorthand's own value when not overridden) rather than mixing a shorthand with a sometimes-present longhand. See `Button`'s corner-radius computation for the pattern.

## Distribution & path handling

The CLI (`cli/`) generates git patches for a consumer's project via `PendingChanges` (`cli/src/lib/patches.js`). Every relative path that ends up in a patch header **must** be forward-slash, unconditionally — `git apply` rejects backslash-separated paths outright, and this is not hypothetical: an early version of this exact mechanism broke `git apply` for every nested vendored file on Windows, invisibly, because CI only runs on Linux. Use `joinPatchPath()` from `lib/patches.js` for any new relPath construction; never `path.join()` for a string that becomes part of a patch, even if its inputs already look like they use `/` — `path.join()` normalizes to the platform separator regardless. `PendingChanges.propose()` itself also normalizes as a last-mile backstop, but don't rely on that as the only defense.

The same real-Windows-run also found: fence regexes (`cli/src/lib/fences.js`, used for the managed-block system below) must tolerate `\r?\n`, not just `\n` — `git apply` writes CRLF whenever `core.autocrlf=true`, a common Windows Git default. And file reads (`cli/src/lib/project.js`, `release.js`) strip a UTF-8 BOM before use — Node's `fs` never does this itself, and it breaks `JSON.parse()` outright on a BOM'd `package.json`/`tsconfig.json`.

If you touch CLI path-handling or file-reading code, prefer testing it against a real `init`/`apply`/`doctor` run over a dummy project (see `cli/CONTRIBUTING.md`'s integration-test section) — the unit tests cover the pure-logic modules, but this exact class of bug is invisible to them by construction (Linux dev/CI environments don't reproduce it).

### Managed fence blocks

`toolcrib init`/`merge` write ai-docs content into a consumer's own `AGENTS.md` (and detect drift there on `doctor`), wrapped in `<!-- toolcrib:managed:<id>:start version=X.Y.Z -->` / `:end` HTML-comment fences (`cli/src/lib/fences.js`, applied to Markdown via `lib/managedDocs.js` and to `.gitignore` via the `#`-comment style). The same generic primitive supports a `js` (`//`) comment style for a future feature that patches consumer source files directly — nothing uses it yet. Content inside a fence carries an auto-inserted "do not edit by hand" banner and is meant to be regenerated by `toolcrib merge`, not hand-edited — unlike vendored component source, which is explicitly meant to be forked/customized freely.

## Testing

Write tests for anything you add — pure `src/theme`/`src/eventBus` logic and component behavior go in `src/__tests__/`, CLI `lib/` functions go in `cli/test/`. Match the existing file's structure/conventions rather than inventing a new pattern. `npm test` (root) and `cli && npm test` are both required to pass; CI runs both plus `check-manifest`, `check-docs`, and `check-index` before packaging a release.

`cli/` has its own independent `package.json`/`node_modules` — a root-level dependency upgrade doesn't touch it, and vice versa. This is deliberate, not an oversight: `cli/` is a standalone, independently-published npm package, and consolidating `node_modules` via npm/pnpm workspaces would risk a phantom dependency — `cli/` code accidentally resolving something only because it's hoisted from the toolkit's own (much larger, react/vite-heavy) dependency tree, working locally, then breaking for every real `npm install -g toolcrib` user, whose install has no access to this repo's other project at all. There's no automated check guarding against that for `cli/` the way `build-release.js` validates it for the toolkit's own vendored source, so the isolation is standing in for that missing safety net. Considered and rejected for this reason — don't "helpfully" merge them without adding that check first.

## TypeScript

Full TypeScript coverage on everything — this is what keeps an AI consuming the toolkit from hallucinating props or types that don't exist. Run `npx tsc` (root) before considering a change done; it's `noEmit`, just a type-check.

**Root `typescript` is on the `7.x` line; `scripts/` is pinned separately to `6.0.3`, in its own `scripts/package.json`.** These used to be one pin, held back at `6.x` repo-wide, because TypeScript 7's package export is reduced to `{ version, versionMajorMinor }` — `createSourceFile`, `ScriptTarget`, `isVariableStatement`, and the rest of the classic Compiler API that `scripts/lib/extract.js` depends on for manifest/docs generation are simply absent in 7.x, not renamed or deprecated. A whole-repo trial confirmed `extract.js` was the *only* thing that broke; nothing else in `src/`, `demo/`, or `tsc`'s own type-checking needed anything the classic API provided. Splitting `scripts/` into its own `package.json` (with `typescript: 6.0.3` as its sole dependency) let root move to `7.x` for its own build/type-check without waiting on `extract.js`'s narrower requirement — Node resolves `import ts from 'typescript'` starting from the importing file's own directory, so `scripts/generate-manifest.js` always gets `6.0.3` from `scripts/node_modules` regardless of what root has installed, with no workspace tooling or explicit path juggling required. `scripts/` needs its own `npm install` run once, separately from root's — a fresh clone or CI job that only runs root's `npm ci` won't have `scripts/node_modules` populated. If `extract.js` (or anything else under `scripts/`) ever needs a second dependency, add it to `scripts/package.json`, not root's.

Don't bump `scripts/package.json`'s `typescript` past `6.x` without first confirming `extract.js`'s classic-API surface still exists in whatever version you're moving to — the same caution that used to apply repo-wide now applies only there.
