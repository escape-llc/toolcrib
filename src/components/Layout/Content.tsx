import React, { ReactNode, HTMLAttributes } from 'react';
import { MarginMode, resolveMargin } from '../../theme/margin';
import { SquareCornerOption, resolveSquareCorners } from '../Card/Card';

/**
 * Props for `<Content>` — the flex-domain-establishing layout root.
 *
 * Slot sub-component: `Content.Grow`.
 */
export interface ContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /**
   * Gap between children. Named tokens map to theme spacing scale.
   * @default 'md'
   */
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'gap';
  /** Override margin/gap using the theme margin token scale. */
  marginMode?: MarginMode;
  /**
   * Squares off the given corners — accepted (and consumed) so `<Content>`
   * can sit directly inside `<Splitter.Panel squareCorners="...">`, whose
   * corner-squaring only forwards to children it recognizes as components
   * (not plain DOM elements). Meaningless unless `style` also gives this
   * element visible chrome (background/border) of its own.
   */
  squareCorners?: SquareCornerOption;
  style?: React.CSSProperties;
  className?: string;
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
 */
export const Content: React.FC<ContentProps> & {
  Grow: React.FC<ContentGrowProps>;
} = ({ children, gap = 'md', marginMode, squareCorners, style, className, ...props }) => (
  <div
    className={className}
    {...props}
    style={{
      height: '100%',
      width: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      gap: resolveMargin(marginMode, gap),
      ...resolveSquareCorners(squareCorners),
      ...style,
    }}
  >
    {children}
  </div>
);

/** Props for the `<Content.Grow>` slot. */
export interface ContentGrowProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Participates in an already-established flex domain (typically a
 * `<Content>` or `<VStack>` ancestor) and flex-grows to fill whatever
 * space is left over — a sibling with a fixed size (like a `<TabStrip>`)
 * takes what it needs, and this takes the rest. Sets `minHeight: 0` so
 * overflowing content (e.g. `overflowY: 'auto'` via `style`) scrolls
 * inside this box instead of pushing the domain taller than its
 * container — the classic flexbox min-height trap.
 */
Content.Grow = ({ children, style, className, ...props }) => (
  <div
    className={className}
    {...props}
    style={{
      flex: '1 1 0px',
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }}
  >
    {children}
  </div>
);

Content.Grow.displayName = 'Content.Grow';
