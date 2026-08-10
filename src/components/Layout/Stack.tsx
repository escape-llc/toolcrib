import React, { ReactNode, HTMLAttributes } from 'react';
import { PaddingMode, resolvePadding } from '../../theme/padding';
import { MarginMode, resolveMargin } from '../../theme/margin';
import { CornerRadiusMode, resolveRadius } from '../../theme/radius';

/**
 * Props shared by `<VStack>` and `<HStack>` layout containers.
 *
 * These are the primary layout primitives. Use `<VStack>` for vertical stacking
 * and `<HStack>` for horizontal row layout.
 */
export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /**
   * Gap between children. Named tokens map to theme spacing scale.
   * `'gap'` uses the global `--ai-margin-gap` variable.
   * @default 'gap'
   */
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'gap';
  /** Cross-axis alignment. @default 'stretch' (VStack) or 'center' (HStack) */
  align?: 'start' | 'center' | 'end' | 'stretch';
  /** Main-axis distribution. @default 'start' */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  /** Override padding using the theme padding token scale. */
  paddingMode?: PaddingMode;
  /** Override margin using the theme margin token scale (affects gap sizing). */
  marginMode?: MarginMode;
  /** Override corner radius using the theme radius token scale. */
  cornerRadiusMode?: CornerRadiusMode;
  /** Allow children to wrap onto multiple lines instead of overflowing/shrinking. @default false */
  wrap?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

const alignMap = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

const justifyMap = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
};

/**
 * VStack Layout Idiom: Vertical stack container automatically applying Theme Margin/Gap tokens.
 * @manifest Vertical flex column layout primitive
 */
export const VStack: React.FC<StackProps> = ({
  children,
  gap = 'gap',
  align = 'stretch',
  justify = 'start',
  paddingMode,
  marginMode,
  cornerRadiusMode,
  wrap = false,
  style,
  className,
  ...props
}) => (
  <div
    className={className}
    {...props}
    style={{
      display: 'flex',
      flexDirection: 'column',
      flexWrap: wrap ? 'wrap' : undefined,
      gap: resolveMargin(marginMode, gap),
      alignItems: alignMap[align],
      justifyContent: justifyMap[justify],
      width: '100%',
      boxSizing: 'border-box',
      padding: paddingMode ? resolvePadding(paddingMode, 'md') : undefined,
      borderRadius: cornerRadiusMode ? resolveRadius(cornerRadiusMode) : undefined,
      ...style,
    }}
  >
    {children}
  </div>
);

/**
 * HStack Layout Idiom: Horizontal stack container automatically applying Theme Margin/Gap tokens.
 * @manifest Horizontal flex row layout primitive
 */
export const HStack: React.FC<StackProps> = ({
  children,
  gap = 'gap',
  align = 'center',
  justify = 'start',
  paddingMode,
  marginMode,
  cornerRadiusMode,
  wrap = false,
  style,
  className,
  ...props
}) => (
  <div
    className={className}
    {...props}
    style={{
      display: 'flex',
      flexDirection: 'row',
      flexWrap: wrap ? 'wrap' : undefined,
      gap: resolveMargin(marginMode, gap),
      alignItems: alignMap[align],
      justifyContent: justifyMap[justify],
      boxSizing: 'border-box',
      padding: paddingMode ? resolvePadding(paddingMode, 'md') : undefined,
      borderRadius: cornerRadiusMode ? resolveRadius(cornerRadiusMode) : undefined,
      ...style,
    }}
  >
    {children}
  </div>
);
