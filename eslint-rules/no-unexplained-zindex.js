/**
 * A vendored, standalone ESLint rule flagging a hardcoded z-index literal
 * (3 or higher) with no comment explaining it. Zero imports of its own —
 * fully self-contained, nothing else required. This is the single
 * canonical implementation, used two ways: Toolcrib's own repo imports it
 * from `scripts/eslint-rules/theme-tokens.js` to check its own component
 * source (that file lives under `scripts/`, which is contributor-only
 * tooling and is never vendored — only this file, the one it imports, is),
 * and it's also vendored as-is to consumers (this whole `eslint-rules/`
 * directory ships in every release, the same way `ai-docs/` does) so real
 * apps can catch the identical bug shape in their own code, with no
 * dependency on anything from `scripts/` either way. One rule, not two
 * hand-maintained copies that could drift out of sync with each other.
 *
 * The bug it catches is the same chronic class confirmed in the real
 * issue tracker of every mainstream competitor checked
 * (shadcn/ui's "Toast renders behind Dialog backdrop", MUI's "Drawer
 * z-index mismatch with theme.zIndex.drawer", etc.): a consumer's own
 * custom UI competing for stacking order against Toolcrib's overlays
 * (Modal, Drawer, Toast, ...) with nothing catching the collision until
 * it's visibly wrong in a browser. Values of 0–2 are left alone — the
 * established, legitimate pattern for ordering sibling elements within a
 * component's own local `position: relative` stacking context, which
 * never competes with page-level stacking order at all.
 *
 * Deliberately framework-agnostic: no import of `typescript`,
 * `typescript-eslint`, or any Toolcrib-specific module. It operates on
 * plain ESTree `Property` nodes, which exist identically whether the file
 * is plain JavaScript or TypeScript, and regardless of TypeScript version
 * — confirmed directly (not assumed) by running this exact rule against a
 * bare `eslint` install with zero TypeScript tooling present at all. The
 * only real requirement is that your own ESLint config already parses
 * JSX/TSX for your project, which any React project's config already does
 * independent of this rule.
 *
 * Wiring this in is your choice, not something Toolcrib's CLI does for
 * you automatically — every consumer's ESLint setup (flat config vs.
 * legacy .eslintrc, which parser, which other plugins) is different
 * enough that auto-editing your config would be more likely to break it
 * than help. See README.md in this same directory for a real, minimal
 * flat-config wiring example.
 */

/** @type {import('eslint').Rule.RuleModule} */
export const noUnexplainedZindex = {
  meta: {
    type: 'problem',
    docs: {
      description: "A z-index literal of 3 or higher needs a comment explaining it -- either it competes at the page level against Toolcrib overlays (use Toolcrib's Z_INDEX scale, or useStackedZIndex for auto-incrementing nested/simultaneous instances) or it is scoped to a local stacking context (say so).",
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    return {
      Property(node) {
        const keyName = node.key.type === 'Identifier' ? node.key.name : null;
        if (keyName !== 'zIndex') return;
        if (node.value.type !== 'Literal' || typeof node.value.value !== 'number') return;
        if (node.value.value < 3) return;

        const commentsBefore = sourceCode.getCommentsBefore(node);
        const line = node.loc.start.line;
        const trailingOnSameLine = sourceCode.getCommentsAfter(node.value).some((c) => c.loc.start.line === line);
        const hasExplanation = commentsBefore.length > 0 || trailingOnSameLine;

        if (!hasExplanation) {
          context.report({
            node,
            message:
              `zIndex: ${node.value.value} has no comment explaining it. If this needs to compete at the page level against Toolcrib's own overlays, use Toolcrib's Z_INDEX scale (or useStackedZIndex) instead of a bare number. ` +
              `If it's scoped to this element's own local stacking context, add a comment saying so.`,
          });
        }
      },
    };
  },
};
