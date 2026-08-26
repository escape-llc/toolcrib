import React, { type ReactNode, useEffect } from 'react';
import { warnIfLegacyStyleProps } from '../../theme/safeProps';
import { injectGlobalStyle } from '../../theme/injectGlobalStyle';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { useNonce } from '../../theme/nonceContext';

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
// Corner-radius merging is deliberately pure CSS, not cloneElement-injected
// style: UIGroup's children are almost always toolcrib components (Button,
// Input, Select) whose own inline `style` attribute — computed internally,
// applied after any {...props} spread — would silently win over an
// injected style prop once those components stopped accepting one, exactly
// the failure mode found and fixed for Splitter.Panel. CSS selectors
// scoped to this wrapper's own children sidestep that entirely: no
// cooperation required from the child's own prop handling, `!important`
// only because it has to outrank each child's inline `borderRadius`.
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
      {children}
    </div>
  );
};
