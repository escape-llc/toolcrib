import React from 'react';
import { type StyleFreeAttributes, warnIfLegacyStyleProps } from '../../theme/safeProps';
import { useResolvedSubtheme } from '../../theme/useSliceOverrides';
import { resolveSubtheme, type SubthemeName } from '../../theme/subtheme';

/** Props for the `<Spinner>` indeterminate loading indicator. */
export interface SpinnerProps extends StyleFreeAttributes<HTMLDivElement> {
  /** Spinner diameter. @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Apply a subtheme colour. Falls back to the nearest `<StyleDomainProvider>`'s if omitted, then the theme's primary colour. */
  subtheme?: SubthemeName;
}

const SIZE_DIAMETER: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: '1rem',
  md: '1.5rem',
  lg: '2.25rem',
};

/**
 * @manifest Indeterminate circular loading indicator, same subtheme colouring as `<Progress>`
 * @manifestCategory Data Display
 */
export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', subtheme: instanceSubtheme, ...props }) => {
  warnIfLegacyStyleProps(props, 'Spinner');
  const subtheme = useResolvedSubtheme(instanceSubtheme);
  const subthemeColors = subtheme ? resolveSubtheme(subtheme) : undefined;
  const diameter = SIZE_DIAMETER[size];

  return (
    <div
      role="status"
      aria-label="Loading"
      {...props}
      style={{
        display: 'inline-block',
        width: diameter,
        height: diameter,
        borderRadius: '999rem',
        border: '0.1875rem solid var(--ai-bg-container, #e5e7eb)',
        borderTopColor: subthemeColors ? subthemeColors.main : 'var(--ai-color-primary, #3b82f6)',
        animation: 'ai-spin 0.8s linear infinite',
      }}
    />
  );
};
