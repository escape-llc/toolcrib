import React, { ReactNode } from 'react';
import { AspectRatio as AspectRatioPrimitive } from 'radix-ui';

/** Props for `<AspectRatio>`. */
export interface AspectRatioProps {
  /** Width-to-height ratio, e.g. `16 / 9` or `1`. @default 1 */
  ratio?: number;
  /** Usually a single filling element — an image, video, or iframe embed. */
  children: ReactNode;
}

/**
 * Constrains its content to a fixed width-to-height ratio regardless of the
 * content's own intrinsic size — for a thumbnail, video, or iframe embed
 * inside a `<Card>`/`<DataTable>` cell that would otherwise distort the
 * layout while loading, or overflow it once loaded.
 * @manifest Constrains content to a fixed width-to-height ratio
 * @manifestCategory Layout Primitives
 */
export const AspectRatio: React.FC<AspectRatioProps> = ({ ratio = 1, children }) => (
  <AspectRatioPrimitive.Root ratio={ratio}>{children}</AspectRatioPrimitive.Root>
);
