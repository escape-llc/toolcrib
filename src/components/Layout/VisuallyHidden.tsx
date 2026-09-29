import React, { type CSSProperties, type ReactNode } from 'react';

/** Props for `<VisuallyHidden>`. */
export interface VisuallyHiddenProps {
  children: ReactNode;
}

// The standard screen-reader-only box (#703: toolcrib's own, replacing
// Radix's VisuallyHidden, which rendered exactly this). Clipped to nothing
// and taken out of flow, but still in the accessibility tree -- unlike
// display:none or visibility:hidden, which remove it from both.
const VISUALLY_HIDDEN_STYLE: CSSProperties = {
  position: 'absolute',
  border: 0,
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  wordWrap: 'normal',
};

/**
 * Renders content that's removed from the visual flow but still announced
 * by screen readers — the correct alternative to an ad-hoc `sr-only` CSS
 * class for things like an icon-only button's accessible name or an
 * `<AccessibleIcon>`'s label (which renders one of these internally).
 * @manifest Hides content visually while keeping it announced to screen readers
 * @manifestCategory Layout Primitives
 */
export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({ children }) => (
  <span style={VISUALLY_HIDDEN_STYLE}>{children}</span>
);
