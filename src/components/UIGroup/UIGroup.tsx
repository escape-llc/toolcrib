import React, { Children, isValidElement, type ReactNode, useEffect } from 'react';
import { warnIfLegacyStyleProps } from '../../theme/safeProps';
import { injectGlobalStyle } from '../../theme/injectGlobalStyle';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { useNonce } from '../../theme/nonceContext';
import { type SquareCornerOption } from '../Card/Card';
import { UIGroupContext } from './UIGroupContext';

/**
 * Props for the `<UIGroup>` component.
 *
 * Visually groups adjacent elements (e.g. buttons) by merging their borders
 * and removing internal border-radii so they appear as a single compound control.
 *
 * The border-overlap width (see `UIGroupThemeSlice`) is themed globally via
 * `var(--ai-uigroup-overlap, ...)` in the one shared stylesheet this
 * component injects (see `injectUIGroupStyles` below) — not per-instance
 * `overrides`, since that shared, singleton stylesheet has no per-instance
 * scoping to hang a sparse override off of.
 */
export interface UIGroupProps {
  children: ReactNode;
  /**
   * Group layout direction.
   * - `'horizontal'` — Children laid out in a row (default).
   * - `'vertical'` — Children stacked vertically.
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical';
  /** Override border radius for the outer corners. @default 'var(--ai-radius-md, 0.375rem)' */
  borderRadius?: string;
}

// Inject focus/hover stacking + border-merging CSS for UIGroup elements.
// Corner-radius merging is CSS-first, not cloneElement-injected style:
// UIGroup's children are almost always toolcrib components (Button, Input,
// Select) whose own inline `style` attribute — computed internally,
// applied after any {...props} spread — would silently win over an
// injected style prop once those components stopped accepting one, exactly
// the failure mode found and fixed for Splitter.Panel. CSS selectors
// scoped to this wrapper's own children sidestep that entirely: no
// cooperation required from the child's own prop handling, `!important`
// only because it has to outrank each child's inline `borderRadius`.
//
// This CSS only reaches *direct* DOM children, though — and a `Modal`/
// `Popup`/`AlertDialog` passed as a child wraps its own `trigger` in an
// internal `<div>` (for flex-stretch inside a UIGroup row in the first
// place), putting the actual `<button>` two DOM layers below this
// selector's reach. UIGroupContext (below, in the component body) is the
// fix for that case specifically — a squareCorners-aware component
// consults it directly regardless of DOM nesting, since Context
// propagates via the render tree, not the DOM tree. The two mechanisms
// aren't in tension: for a plain direct-child Button/Input, they agree
// (same visual result, computed twice by two independent paths); for a
// wrapped trigger, only the Context path can reach it at all. Found for
// real, not theoretically: a Popup/AlertDialog-triggered button inside a
// UIGroup rendered with its default rounded corners regardless of
// position, undetected until it visually collided with a widened sibling.
const STYLE_ID = 'toolcrib-group-styles';
function injectUIGroupStyles(targetDocument?: Document, nonce?: string) {
  injectGlobalStyle(
    STYLE_ID,
    `
    .toolcrib-group > * {
      position: relative;
      align-self: stretch;
    }
    .toolcrib-group > *:hover {
      z-index: 1;
    }
    .toolcrib-group > *:focus,
    .toolcrib-group > *:focus-within,
    .toolcrib-group > *:active {
      z-index: 2 !important;
    }

    .toolcrib-group[data-orientation="horizontal"] > * {
      border-top-left-radius: 0 !important;
      border-bottom-left-radius: 0 !important;
      border-top-right-radius: 0 !important;
      border-bottom-right-radius: 0 !important;
    }
    .toolcrib-group[data-orientation="horizontal"] > *:first-child {
      border-top-left-radius: var(--toolcrib-group-radius, 0.375rem) !important;
      border-bottom-left-radius: var(--toolcrib-group-radius, 0.375rem) !important;
    }
    .toolcrib-group[data-orientation="horizontal"] > *:last-child {
      border-top-right-radius: var(--toolcrib-group-radius, 0.375rem) !important;
      border-bottom-right-radius: var(--toolcrib-group-radius, 0.375rem) !important;
    }
    .toolcrib-group[data-orientation="horizontal"] > *:not(:first-child) {
      margin-left: var(--ai-uigroup-overlap, -0.0625rem);
    }

    .toolcrib-group[data-orientation="vertical"] {
      flex-direction: column;
    }
    .toolcrib-group[data-orientation="vertical"] > * {
      border-top-left-radius: 0 !important;
      border-top-right-radius: 0 !important;
      border-bottom-left-radius: 0 !important;
      border-bottom-right-radius: 0 !important;
    }
    .toolcrib-group[data-orientation="vertical"] > *:first-child {
      border-top-left-radius: var(--toolcrib-group-radius, 0.375rem) !important;
      border-top-right-radius: var(--toolcrib-group-radius, 0.375rem) !important;
    }
    .toolcrib-group[data-orientation="vertical"] > *:last-child {
      border-bottom-left-radius: var(--toolcrib-group-radius, 0.375rem) !important;
      border-bottom-right-radius: var(--toolcrib-group-radius, 0.375rem) !important;
    }
    .toolcrib-group[data-orientation="vertical"] > *:not(:first-child) {
      margin-top: var(--ai-uigroup-overlap, -0.0625rem);
    }
    `,
    targetDocument,
    nonce
  );
}

/**
 * @manifest Merges adjacent elements into a single visual compound control
 * @manifestCategory Layout Primitives
 */
export const UIGroup: React.FC<UIGroupProps> = ({
  children,
  orientation = 'horizontal',
  borderRadius = 'var(--ai-radius-md, 0.375rem)',
  ...props
}) => {
  warnIfLegacyStyleProps(props, 'UIGroup');
  const targetDocument = useTargetDocument();
  const nonce = useNonce();
  useEffect(() => {
    injectUIGroupStyles(targetDocument, nonce);
  }, [targetDocument, nonce]);

  // React.Children.toArray, not Children.map -- it's the one documented to
  // both filter out non-element children (null/false/undefined from a
  // conditional like `{cond && <Button/>}`) and compact the result, so
  // `index`/`items.length` below reflect real, renderable members only.
  // Mirrors ThemeEditor.tsx's own hand-written version of this exact
  // position → squareCorners mapping for its internal Popup-triggered
  // toolbar buttons (first item squares its trailing edge, last item
  // squares its leading edge, everything between squares both) --
  // generalized here so every UIGroup consumer gets it automatically
  // instead of reimplementing it per call site.
  const items = Children.toArray(children).filter(isValidElement);
  const total = items.length;
  const leadingEdge = orientation === 'horizontal' ? 'right' : 'bottom';
  const trailingEdge = orientation === 'horizontal' ? 'left' : 'top';

  return (
    <div
      className="toolcrib-group"
      data-orientation={orientation}
      role="group"
      style={{
        display: 'inline-flex',
        flexDirection: orientation === 'horizontal' ? 'row' : 'column',
        alignItems: 'stretch',
        ['--toolcrib-group-radius' as string]: borderRadius,
      }}
    >
      {items.map((child, index) => {
        const squareCorners: SquareCornerOption =
          total <= 1 ? 'none' : index === 0 ? leadingEdge : index === total - 1 ? trailingEdge : 'all';
        return (
          <UIGroupContext.Provider value={squareCorners} key={child.key ?? index}>
            {child}
          </UIGroupContext.Provider>
        );
      })}
    </div>
  );
};
