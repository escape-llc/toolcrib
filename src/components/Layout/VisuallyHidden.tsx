import React, { type ReactNode } from 'react';
import { VisuallyHidden as VisuallyHiddenPrimitive } from 'radix-ui';

/** Props for `<VisuallyHidden>`. */
export interface VisuallyHiddenProps {
  children: ReactNode;
}

/**
 * Renders content that's removed from the visual flow but still announced
 * by screen readers — the correct alternative to an ad-hoc `sr-only` CSS
 * class for things like an icon-only button's accessible name or an
 * `<AccessibleIcon>`'s label (which renders one of these internally).
 * @manifest Hides content visually while keeping it announced to screen readers
 * @manifestCategory Layout Primitives
 */
export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({ children }) => (
  <VisuallyHiddenPrimitive.Root>{children}</VisuallyHiddenPrimitive.Root>
);
