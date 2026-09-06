/**
 * A vendored, standalone ESLint rule catching a JSX prop-spread ordering
 * bug: a named attribute computed from a member of the same object you're
 * about to spread (`disabled={isSubmitting || props.disabled} {...props}`),
 * positioned BEFORE that spread. JSX/`Object.assign` semantics mean the
 * later spread always wins for any key it also defines — so the computed
 * value silently gets thrown away and replaced by the original, un-computed
 * one the instant a caller passes that same prop at all. The fix is always
 * the same: move the computed attribute after the spread (`{...props}
 * disabled={isSubmitting || props.disabled}`), or destructure the
 * colliding name out of the object before spreading the rest.
 *
 * This is the automated version of the audit Toolcrib's own AGENTS.md
 * documents as a one-time manual pass ("Mandatory: a co-located test for
 * any component whose spread ordering matters") after a real, shipped bug:
 * `SubmitButton` computed `disabled={isSubmitting || props.disabled}` and
 * originally spread `{...props}` *after* it, so any caller passing their
 * own `disabled` (a very natural way to gate submission on form validity)
 * silently discarded the `isSubmitting ||` guard the instant the trailing
 * spread ran — the button stopped showing disabled during the actual
 * submit, exactly when double-submit protection mattered most. That
 * write-up's own closing line is the reason this exists as a rule rather
 * than staying prose: "a documented anti-pattern only helps once someone
 * is already looking for it by name at the moment new code could repeat
 * it" — nothing about writing the rule down forces the next occurrence to
 * be recognized, in this codebase or anyone else's. The same shape is
 * exactly as reachable by an AI (or human) writing fresh code in any
 * consumer app as it was here, which is why this lives in the
 * consumer-facing `eslint-rules/` directory rather than staying an
 * internal-only check.
 *
 * Deliberately framework-agnostic: no import of `typescript`,
 * `typescript-eslint`, or any Toolcrib-specific module — plain ESTree/JSX
 * AST nodes only, present identically regardless of file extension or
 * TypeScript version. The only real requirement is that your own ESLint
 * config already parses JSX for your project, same as `no-unexplained-zindex.js`
 * in this same directory.
 *
 * What it does and doesn't catch (see this directory's README.md for the
 * full account): it only fires when the computed attribute's expression
 * contains a literal `<spreadIdentifier>.<sameAttributeName>` member
 * access — a static default placed before a spread on purpose (so a
 * caller CAN override it, e.g. `<div tabIndex={0} {...props}>`) is
 * correctly left alone, since nothing there references the spread object
 * at all. It also can't reason about a spread argument that isn't a plain
 * identifier (`{...getExtraProps()}`), or about a collision that goes
 * through a differently-named alias of the same object — same class of
 * limitation `no-unexplained-zindex.js` documents for its own literal-value
 * requirement.
 */

/** @type {import('eslint').Rule.RuleModule} */
export const noComputedPropBeforeSpread = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "A JSX attribute computed from a member of the same object you spread on this element must be set AFTER the spread, not before -- otherwise the spread silently re-applies the original value and discards whatever you just computed.",
    },
    schema: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const attrs = node.attributes;

        const spreads = [];
        attrs.forEach((attr, index) => {
          if (attr.type === 'JSXSpreadAttribute' && attr.argument.type === 'Identifier') {
            spreads.push({ index, name: attr.argument.name });
          }
        });
        if (spreads.length === 0) return;

        attrs.forEach((attr, index) => {
          if (attr.type !== 'JSXAttribute') return;
          if (attr.name.type !== 'JSXIdentifier') return;
          if (!attr.value || attr.value.type !== 'JSXExpressionContainer') return;

          const attrName = attr.name.name;

          for (const spread of spreads) {
            if (index >= spread.index) continue;
            if (referencesMember(attr.value.expression, spread.name, attrName)) {
              context.report({
                node: attr,
                message:
                  `'${attrName}' is computed from '${spread.name}.${attrName}' but set before {...${spread.name}} on this element -- the spread will silently re-apply the original ${spread.name}.${attrName} and discard this computed value the moment a caller passes their own ${attrName}. ` +
                  `Move this attribute after the spread ({...${spread.name}} ${attrName}={...}), or destructure ${attrName} out of ${spread.name} before spreading the rest.`,
              });
              break;
            }
          }
        });
      },
    };
  },
};

function referencesMember(expr, objectName, propName) {
  let found = false;
  (function visit(n) {
    if (!n || typeof n.type !== 'string' || found) return;
    if (
      n.type === 'MemberExpression' &&
      !n.computed &&
      n.object?.type === 'Identifier' &&
      n.object.name === objectName &&
      n.property?.type === 'Identifier' &&
      n.property.name === propName
    ) {
      found = true;
      return;
    }
    for (const key in n) {
      if (key === 'parent') continue;
      const child = n[key];
      if (Array.isArray(child)) {
        child.forEach(visit);
      } else if (child && typeof child.type === 'string') {
        visit(child);
      }
    }
  })(expr);
  return found;
}
