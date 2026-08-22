import React, { type ReactNode } from 'react';
import { type StyleFreeAttributes } from '../../theme/safeProps';
import { useResolvedSubtheme } from '../../theme/useSliceOverrides';
import { resolveSubtheme, type SubthemeName } from '../../theme/subtheme';

/**
 * Props for the `<Badge>` label.
 *
 * Purely presentational — no internal state, no event bus emission.
 */
export interface BadgeProps extends StyleFreeAttributes<HTMLSpanElement> {
  /** Apply a subtheme colour. Falls back to the nearest `<StyleDomainProvider>`'s if omitted, then a neutral grey. */
  subtheme?: SubthemeName;
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
 * @manifest Small status/label pill with the same four semantic subthemes as `<Toast>`/`<DataTable rowSubtheme>`
 * @manifestCategory Data Display
 */
export const Badge: React.FC<BadgeProps> = ({ subtheme: instanceSubtheme, size = 'md', icon, children, ...props }) => {
  const subtheme = useResolvedSubtheme(instanceSubtheme);
  const colors = subtheme ? resolveSubtheme(subtheme) : undefined;

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
      {icon && (
        // Same normalization Button's own icon slot already applies: a bare
        // icon child (especially a symbol/emoji character, which often
        // falls back to a different font with taller ascent/descent metrics
        // than the surrounding text) can stretch this flex container's
        // cross-axis size beyond what the badge's own font-size/padding
        // would otherwise produce — reported directly ("Verified" badge
        // taller than its size="md" siblings despite using size="sm").
        // lineHeight: 1 clips the icon's own box to its content instead.
        <span style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>{icon}</span>
      )}
      {children}
    </span>
  );
};
