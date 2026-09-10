/**
 * A vendored, standalone ESLint rule catching a real, previously-shipped
 * class of bug: a JSX prop that follows React's own controlled/uncontrolled
 * naming convention (`value`/`defaultValue`, `checked`/`defaultChecked`,
 * `open`/`defaultOpen`, ...) where the controlled prop's value expression
 * bottoms out -- through a chain of local `const` fallbacks -- at the bare
 * `default<Name>` prop itself, with no `useState`/`useReducer` anywhere in
 * that chain. That shape looks correct (it "just uses the default when
 * nothing else is set") but is a live freeze bug: most controlled-component
 * implementations (React Aria, Radix, and React's own native `<input>`)
 * decide controlled-vs-uncontrolled by whether the prop is non-`undefined`
 * on THIS render, checked fresh every render -- not by whether a parent
 * ever intends to update it. A bare prop reference is non-`undefined` on
 * every render for the component's entire lifetime, so the child looks
 * controlled from the very first paint, and nothing -- no state, no parent
 * re-render -- ever feeds a new value back down after the child's own
 * internal change. The child's own attempted update is silently discarded;
 * the displayed value snaps back to the original default forever.
 *
 * Found live in Toolcrib's own demo app (see `AGENTS.md`): a standalone
 * `<DatePicker defaultValue={...}>` and `<TimeField defaultValue={...}>`
 * (no Form ancestor, no `value` prop) could never be edited via the
 * keyboard at all -- confirmed by a real user screenshot, not a test
 * failure, since the existing tests for both only ever asserted the
 * `onChange` callback fired (which happens regardless of this bug, since
 * the underlying library still computes and reports the attempted change
 * even while discarding it) and never asserted the *displayed* value
 * actually changed. The same repo-wide audit that found and fixed those two
 * found the identical shape twice more, in `<Select>` and `<RadioGroup>`,
 * neither of which had ever been exercised standalone-with-defaultValue by
 * any existing test either -- four independent components, same root
 * cause, none of it caught by any existing check (`tsc`, `vitest`, the
 * other three vendored rules) because the code is perfectly type-correct
 * and syntactically unremarkable; the bug is purely about *reactivity*,
 * invisible to anything that isn't reasoning about render-over-render
 * data flow the way this rule does.
 *
 * This is meaningfully different from `no-computed-prop-before-spread.js`:
 * that rule is pure AST shape-matching (a named attribute positioned before
 * a spread of the same object) with no need to reason about data flow at
 * all. A fully general version of *this* rule -- "does this prop's value
 * ever get updated after mount" -- would need real data-flow analysis and
 * would false-positive constantly on legitimate "prop echoed straight
 * through on purpose" code. This rule stays narrow and mechanical instead:
 * it only fires when the expression chain bottoms out at a bare reference
 * to a prop whose name is *exactly* `default` + the controlled prop's own
 * name, capitalized (React's own well-established naming convention for
 * this exact pair, not a guess) -- the same shape that recurred four times
 * in one real codebase, not a general "flag any prop that looks static"
 * heuristic.
 *
 * Deliberately framework-agnostic: no import of `typescript`,
 * `typescript-eslint`, or any Toolcrib-specific module -- plain ESTree/JSX
 * AST + ESLint's own built-in scope analysis only (the same real dependency
 * `no-missing-use-client.js` already has, for the identical reason: telling
 * a real prop reference apart from a locally-shadowed variable of the same
 * name needs real scope resolution, not a text/name-only guess). This bug
 * shape is exactly as reachable writing a fresh controlled/uncontrolled
 * component in any consumer's own app as it was in Toolcrib's own source,
 * which is why this lives in the consumer-facing `eslint-rules/` directory
 * rather than staying an internal-only check.
 */

const STATE_HOOK_NAMES = new Set(['useState', 'useReducer']);
const MAX_DEPTH = 8;

function capitalize(name) {
  return name.length === 0 ? name : name[0].toUpperCase() + name.slice(1);
}

function calleeName(callee) {
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier') {
    return callee.property.name;
  }
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
export const noFrozenControlledProp = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "A controlled JSX prop (value, checked, open, ...) whose expression bottoms out at the bare default<Name> prop, with no useState/useReducer in between, looks controlled from the first render but nothing ever feeds it an updated value afterward -- the child's own internal changes are silently discarded.",
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    let resolutionMap = null;

    // Built once per file (lazily, on first use), not once per attribute --
    // scope analysis is real work, and most files have many JSX attributes
    // sharing the same scope tree. Maps each reference Identifier node to
    // the Variable it resolves to (or null if unresolved), matching
    // no-missing-use-client.js's own reference-walking approach, just
    // indexed for per-node lookup instead of a global-only filter.
    function getResolutionMap() {
      if (resolutionMap) return resolutionMap;
      resolutionMap = new Map();
      for (const scope of sourceCode.scopeManager.scopes) {
        for (const reference of scope.references) {
          resolutionMap.set(reference.identifier, reference.resolved);
        }
      }
      return resolutionMap;
    }

    // True only for an Identifier reference that resolves to a real,
    // unambiguous component prop of the given name -- a destructured
    // function parameter (`({ defaultValue }) => ...`), not a local
    // variable, import, or anything else that happens to share the name. A
    // renamed destructure (`{ defaultValue: dv }`) binds the name `dv`, not
    // `defaultValue`, so it's correctly not matched here -- same
    // "structural, not semantic" limitation `no-computed-prop-before-
    // spread.js` already documents for its own member-access check.
    function isOwnProp(identifierNode, expectedName) {
      if (identifierNode.name !== expectedName) return false;
      const variable = getResolutionMap().get(identifierNode);
      if (!variable || variable.defs.length !== 1) return false;
      const def = variable.defs[0];
      return def.type === 'Parameter' && def.name && def.name.name === expectedName;
    }

    // Walks an expression looking for a path that bottoms out at a bare
    // reference to the `default<Name>` prop, without ever crossing a
    // useState/useReducer call along the way (crossing one means a real,
    // live, render-over-render-updating value sits between the prop and
    // this attribute -- exactly what fixes the bug, so that path is safe
    // and the walk stops there). Follows local `const` fallbacks
    // (ConditionalExpression, `??`/`||`/`&&`, a plain call's own arguments,
    // a handful of TS wrapper node types) up to MAX_DEPTH hops -- real
    // instances of this bug needed at most 3-4; the ceiling exists only to
    // bound pathological input, not because deeper chains are expected.
    function resolvesToDefaultProp(expr, expectedDefaultName, depth) {
      if (!expr || depth > MAX_DEPTH) return false;

      switch (expr.type) {
        case 'Identifier': {
          if (isOwnProp(expr, expectedDefaultName)) return true;

          const variable = getResolutionMap().get(expr);
          if (!variable || variable.defs.length !== 1) return false;
          const def = variable.defs[0];
          if (def.type !== 'Variable' || !def.node || def.node.type !== 'VariableDeclarator' || !def.node.init) {
            return false;
          }
          return resolvesToDefaultProp(def.node.init, expectedDefaultName, depth + 1);
        }

        case 'ConditionalExpression':
          return (
            resolvesToDefaultProp(expr.consequent, expectedDefaultName, depth + 1) ||
            resolvesToDefaultProp(expr.alternate, expectedDefaultName, depth + 1)
          );

        case 'LogicalExpression':
          return (
            resolvesToDefaultProp(expr.left, expectedDefaultName, depth + 1) ||
            resolvesToDefaultProp(expr.right, expectedDefaultName, depth + 1)
          );

        case 'CallExpression': {
          // A call whose own return value IS the live, updating source --
          // useState(defaultValue)'s returned getter genuinely does get
          // fed back after every change, unlike a bare `defaultValue`
          // reference -- terminates the walk as safe. Deliberately doesn't
          // recurse into ITS arguments (seeding useState from defaultValue
          // is the correct, intended pattern, not the bug).
          const name = calleeName(expr.callee);
          if (STATE_HOOK_NAMES.has(name)) return false;

          // Any other call (String(x), Number(x), a formatting helper, ...)
          // doesn't change whether the underlying value is live -- if its
          // argument is still frozen, wrapping it in a conversion doesn't
          // unfreeze it. Recursing into arguments is what let this rule
          // actually catch RadioGroup's real bug (`String(selectedValue)`
          // sat between the JSX attribute and the frozen chain) -- without
          // this, only the direct-reference shape (DatePicker/TimeField/
          // Select) would be caught.
          return expr.arguments.some(arg => resolvesToDefaultProp(arg, expectedDefaultName, depth + 1));
        }

        // TypeScript wrapper nodes (`x as T`, `x!`, `x satisfies T`) --
        // present only when the file is actually parsed as TS; harmless,
        // unreachable cases on a plain JS/JSX file.
        case 'TSAsExpression':
        case 'TSNonNullExpression':
        case 'TSSatisfiesExpression':
          return resolvesToDefaultProp(expr.expression, expectedDefaultName, depth + 1);

        default:
          return false;
      }
    }

    return {
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier') return;
        const attrName = node.name.name;
        if (!/^[a-zA-Z_$][\w$]*$/.test(attrName)) return; // skip aria-*/data-* and other hyphenated names
        if (!node.value || node.value.type !== 'JSXExpressionContainer') return;

        const expectedDefaultName = 'default' + capitalize(attrName);
        if (resolvesToDefaultProp(node.value.expression, expectedDefaultName, 0)) {
          context.report({
            node,
            message:
              `'${attrName}' is computed from a fallback chain that bottoms out at the raw '${expectedDefaultName}' prop, with no useState/useReducer anywhere in that chain. This looks controlled from this component's very first render (a non-undefined '${attrName}' every render) but nothing ever feeds it an updated value afterward -- the child's own internal change on '${attrName}' is silently discarded, and it stays pinned to the original '${expectedDefaultName}' forever. ` +
              `Either only pass '${attrName}' when there's a genuinely live source (an explicit controlled prop, or real ancestor-owned state) and pass '${expectedDefaultName}' itself to the child otherwise, or track a local useState seeded from '${expectedDefaultName}' and feed that back through '${attrName}' on every render.`,
          });
        }
      },
    };
  },
};
