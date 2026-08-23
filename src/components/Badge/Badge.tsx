import React, { type ReactNode } from 'react';
import { type StyleFreeAttributes } from '../../theme/safeProps';
import { useResolvedSubtheme } from '../../theme/useSliceOverrides';
import { type SubthemeName } from '../../theme/subtheme';
import { resolveColorVariant, type ColorVariant, type Appearance } from '../../theme/colorVariant';
import { ICON_WRAPPER_STYLE } from '../../theme/iconWrapperStyle';

/**
 * Props for the `<Badge>` label.
 *
 * Purely presentational — no internal state, no event bus emission.
 */
export interface BadgeProps extends StyleFreeAttributes<HTMLSpanElement> {
  /** Apply a subtheme colour (one of the 4 fixed status colors). Falls back to the nearest `<StyleDomainProvider>`'s if omitted, then a neutral grey. Wins over `variant` if both are set. */
  subtheme?: SubthemeName;
  /** Identity color from the harmony palette (`primary`/`secondary`) — for a branded/labeled badge that isn't a status indicator. Ignored if `subtheme` is set. */
  variant?: ColorVariant;
  /** Visual treatment for whichever color `subtheme`/`variant` resolves to. `'outline'` is the hollow style. @default 'soft' */
  appearance?: Appearance;
  /** Badge size, controlling padding and font-size. @default 'md' */
  size?: 'sm' | 'md';
  /** Icon rendered before the label text. */
  icon?: ReactNode;
}

const SIZE_STYLES: Record<'sm' | 'md', React.CSSProperties> = {
  sm: { padding: '0.0625rem 0.375rem', fontSize: '0.6875rem', gap: '0.25rem' },
  md: { padding: '0.1875rem 0.5rem', fontSize: '0.75rem', gap: '0.3125rem' },
};

/**
 * @manifest Small status/label pill with the same four semantic subthemes as `<Toast>`/`<DataTable rowSubtheme>`, plus identity-color `variant`s and `soft`/`solid`/`outline` appearances
 * @manifestCategory Data Display
 */
export const Badge: React.FC<BadgeProps> = ({ subtheme: instanceSubtheme, variant, appearance = 'soft', size = 'md', icon, children, ...props }) => {
  const subtheme = useResolvedSubtheme(instanceSubtheme);
  const colors = resolveColorVariant({ variant, appearance, subtheme });

  return (
    <span
      {...props}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        ...SIZE_STYLES[size],
        borderRadius: 'var(--ai-radius-full, 999rem)',
        fontWeight: 'var(--ai-font-weight-semibold, 600)',
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        background: colors?.background ?? 'var(--ai-bg-container, #f3f4f6)',
        border: `0.0625rem solid ${colors?.border ?? 'var(--ai-border, #e5e7eb)'}`,
        color: colors?.color ?? 'var(--ai-text-secondary, #4b5563)',
      }}
    >
      {icon && <span style={ICON_WRAPPER_STYLE}>{icon}</span>}
      {children}
    </span>
  );
};
