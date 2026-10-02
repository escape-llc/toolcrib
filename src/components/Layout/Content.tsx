'use client';

import React, { useEffect, type ReactNode } from 'react';
import { type MarginMode, resolveMargin } from '../../theme/margin';
import { injectGlobalStyle } from '../../theme/injectGlobalStyle';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { useNonce } from '../../theme/nonceContext';
import { type SquareCornerOption, resolveSquareCorners } from '../Card/Card';
import { useCornerSquaring } from '../Splitter/LayoutDomainContext';
import { useUIGroupSquareCorners } from '../UIGroup/UIGroupContext';
import { type StyleFreeAttributes } from '../../theme/safeProps';

/**
 * Props for `<Content>` — the flex-domain-establishing layout root.
 *
 * Slot sub-component: `Content.Grow`.
 */
export interface ContentProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
  /**
   * Gap between children. Named tokens map to theme spacing scale.
   * @default 'md'
   */
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'gap';
  /** Override margin/gap using the theme margin token scale. */
  marginMode?: MarginMode;
  /**
   * Explicit corner-squaring override. `<Content>` always establishes a
   * layout domain (equivalent to `<Card layout="auto">`), so it already
   * consults the nearest ancestor `<Splitter>`'s layout domain via
   * `useCornerSquaring` automatically — set this only to override that
   * with a specific edge instead of deferring to the domain.
   */
  squareCorners?: SquareCornerOption;
}

/**
 * Fills whatever container it's placed in (`height: 100%`, `width: 100%`)
 * and establishes a new flex-column domain for its children — the layout
 * root for a screen region, e.g. the direct child of a `<Splitter.Panel>`
 * or `<AppShell.Main>`. Pair with `<Content.Grow>` for a child that should
 * flex-grow to fill whatever space is left over inside that domain (a
 * scrollable body below a fixed-height header, for example) rather than
 * establish a domain of its own.
 * @manifest Fills its container and establishes a flex-column layout domain for its children
 * @manifestCategory Layout Primitives
 */
export const Content: React.FC<ContentProps> & {
  Grow: React.FC<ContentGrowProps>;
} = ({ children, gap = 'md', marginMode, squareCorners, ...props }) => {
  // Gated like Splitter.Panel's: an explicit squareCorners is an override,
  // and resolveSquareCorners('none') returns {}, which can't undo domain
  // squaring already spread in ahead of it (issue #690).
  const { style: domainCornerStyle } = useCornerSquaring(squareCorners === undefined || squareCorners === 'auto');
  const uiGroupSquareCorners = useUIGroupSquareCorners();

  return (
    <div
      {...props}
      style={{
        height: '100%',
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        gap: resolveMargin(marginMode, gap),
        ...domainCornerStyle,
        ...resolveSquareCorners(squareCorners ?? uiGroupSquareCorners),
      }}
    >
      {children}
    </div>
  );
};

/** Props for the `<Content.Grow>` slot. */
export interface ContentGrowProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
}

const CONTENT_GROW_STYLE_ID = 'toolcrib-content-grow-styles';

// Same fix as TabStrip.Panel's (see injectTabPanelStyles there): this box
// scrolls its overflow, but its direct children default to flex-shrink:1,
// so taller-than-available content gets crushed to fit instead of
// overflowing into the scroll (issue #690). A child that sets its own
// inline `flex` (Card layout="auto", TabStrip.Panel) still wins over this
// stylesheet rule, so fill-the-region children keep working.
function injectContentGrowStyles(targetDocument?: Document, nonce?: string): void {
  injectGlobalStyle(
    CONTENT_GROW_STYLE_ID,
    `.ai-content-grow > * { flex-shrink: 0; }`,
    targetDocument,
    nonce
  );
}

/**
 * Participates in an already-established flex domain (typically a
 * `<Content>` or `<VStack>` ancestor) and flex-grows to fill whatever
 * space is left over — a sibling with a fixed size (like a `<TabStrip>`)
 * takes what it needs, and this takes the rest. Sets `minHeight: 0` so
 * overflowing content scrolls inside this box instead of pushing the
 * domain taller than its container — the classic flexbox min-height trap
 * — and defaults `overflowY: 'auto'` to make that scrolling actually
 * happen, matching its stated purpose (a scrollable body below a
 * fixed-height header).
 */
const ContentGrow: React.FC<ContentGrowProps> = ({ children, ...props }) => {
  const targetDocument = useTargetDocument();
  const nonce = useNonce();
  useEffect(() => {
    injectContentGrowStyles(targetDocument, nonce);
  }, [targetDocument, nonce]);

  return (
    <div
      // Focusable by default so a keyboard-only user can actually reach and
      // scroll this region (axe: scrollable-region-focusable) -- the
      // unconditional `overflowY: 'auto'` above means this box is
      // scrollable whether or not its content happens to contain another
      // focusable element. Before `{...props}` so an explicit `tabIndex`
      // a consumer passes still wins.
      tabIndex={0}
      {...props}
      className="ai-content-grow"
      style={{
        flex: '1 1 0px',
        minHeight: 0,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </div>
  );
};

Content.Grow = ContentGrow;
Content.Grow.displayName = 'Content.Grow';
