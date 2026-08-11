import React, { ReactNode } from 'react';
import { resolveMargin, MarginMode } from '../../theme/margin';
import { resolvePadding, PaddingMode } from '../../theme/padding';
import { StyleFreeAttributes, warnIfLegacyStyleProps } from '../../theme/safeProps';

/**
 * Props for the `<Grid>` responsive multi-column layout container.
 *
 * Supports fixed column count or CSS auto-fit/auto-fill for responsive grids.
 */
export interface GridProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
  /**
   * Number of columns, or `'auto-fit'` / `'auto-fill'` for responsive behaviour.
   * When using auto modes, `minColWidth` controls the minimum column width.
   * @default 2
   */
  columns?: number | 'auto-fit' | 'auto-fill';
  /** Minimum column width for auto-fit/auto-fill modes. @default '16rem' */
  minColWidth?: string;
  /** Gap between grid cells. @default 'gap' */
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'gap';
  /** Override margin/gap using the theme margin token scale. */
  marginMode?: MarginMode;
  /** Override padding using the theme padding token scale. */
  paddingMode?: PaddingMode;
}

/**
 * Grid Layout Idiom: Multi-column responsive grid container consuming Theme Margin/Gap tokens.
 * @manifest CSS Grid responsive multi-column layout
 * @manifestCategory Layout Primitives
 */
export const Grid: React.FC<GridProps> = ({
  children,
  columns = 2,
  minColWidth = '16rem',
  gap = 'gap',
  marginMode,
  paddingMode,
  ...props
}) => {
  warnIfLegacyStyleProps(props, 'Grid');
  let gridTemplateColumns: string;

  if (typeof columns === 'number') {
    gridTemplateColumns = `repeat(${columns}, 1fr)`;
  } else {
    gridTemplateColumns = `repeat(${columns}, minmax(${minColWidth}, 1fr))`;
  }

  return (
    <div
      {...props}
      style={{
        display: 'grid',
        gridTemplateColumns,
        gap: resolveMargin(marginMode, gap),
        width: '100%',
        boxSizing: 'border-box',
        padding: paddingMode ? resolvePadding(paddingMode, 'md') : undefined,
      }}
    >
      {children}
    </div>
  );
};
