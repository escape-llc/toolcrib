import React, { type ReactNode } from 'react';

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
  // toolcrib's own (#703), the same box Radix's AspectRatio rendered: an
  // outer box whose height comes from padding-bottom (a percentage of its
  // width), and the content filling it absolutely.
  <div style={{ position: 'relative', width: '100%', paddingBottom: `${100 / ratio}%` }}>
    <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
  </div>
);
