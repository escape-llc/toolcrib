import React, { type ReactElement } from 'react';
import { VisuallyHidden } from './VisuallyHidden';

/** Props for `<AccessibleIcon>`. */
export interface AccessibleIconProps {
  /** The single icon element (e.g. an inline SVG) to label. Marked `aria-hidden` internally. */
  children: ReactElement;
  /** Accessible name announced to screen readers, the way `alt` works for `<img>`. */
  label: string;
}

/**
 * Wraps a decorative icon element with a screen-reader-only label instead
 * of leaving an icon-only button/element with no accessible name — a
 * common gap in hand-rolled icon buttons. Marks the icon itself
 * `aria-hidden`/`focusable="false"` and renders the label via
 * `<VisuallyHidden>` alongside it.
 * @manifest Adds a screen-reader-only accessible name to a decorative icon element
 * @manifestCategory Layout Primitives
 */
export const AccessibleIcon: React.FC<AccessibleIconProps> = ({ children, label }) => (
  // toolcrib's own (#703): `focusable` is
  // for legacy IE/Edge SVGs that were otherwise Tab stops.
  <>
    {React.cloneElement(children as ReactElement<Record<string, unknown>>, { 'aria-hidden': 'true', focusable: 'false' })}
    <VisuallyHidden>{label}</VisuallyHidden>
  </>
);
