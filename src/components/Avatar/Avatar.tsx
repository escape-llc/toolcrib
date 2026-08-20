import React, { type ReactNode } from 'react';
import { Avatar as AvatarPrimitive } from 'radix-ui';
import { getSparseVariables } from '../../theme/slice';
import { AvatarThemeSlice, type AvatarSliceState } from './AvatarSlice';

/** Props for the `<Avatar>` user/entity image with fallback. */
export interface AvatarProps {
  /** Image URL. Falls back to `fallback` if omitted, loading, or failing to load. */
  src?: string;
  /** Accessible alt text for the image. */
  alt?: string;
  /** Content shown while `src` is missing/loading/erroring — typically initials. */
  fallback: ReactNode;
  /** Diameter. @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Delay in milliseconds before the fallback renders while the image is
   * still loading, avoiding a flash of fallback content for a fast-loading
   * image. Omitted by default — Radix's own `AvatarPrimitive.Fallback`
   * renders immediately with no artificial delay unless `delayMs` is
   * explicitly passed (confirmed in `@radix-ui/react-avatar`'s source:
   * its `canRender` state starts `true` only when `delayMs === undefined`),
   * so defaulting this to a nonzero value here would force every avatar
   * with no `src` — the common initials-only case — to sit blank for that
   * long before showing its fallback, for no benefit.
   */
  fallbackDelayMs?: number;
  /** Per-instance override for the avatar's shape. */
  overrides?: Partial<AvatarSliceState>;
}

const SIZE_DIAMETER: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: '1.75rem',
  md: '2.5rem',
  lg: '3.5rem',
};

const SIZE_FONT: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: '0.6875rem',
  md: '0.875rem',
  lg: '1.125rem',
};

/**
 * @manifest User/entity avatar image with automatic initials fallback
 * @manifestCategory Data Display
 */
export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = '',
  fallback,
  size = 'md',
  fallbackDelayMs,
  overrides,
}) => {
  const avatarVars = getSparseVariables(AvatarThemeSlice, overrides ?? {});
  return (
  <AvatarPrimitive.Root
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: SIZE_DIAMETER[size],
      height: SIZE_DIAMETER[size],
      borderRadius: 'var(--ai-avatar-radius, 50%)',
      overflow: 'hidden',
      background: 'var(--ai-bg-container, #f3f4f6)',
      flexShrink: 0,
      userSelect: 'none',
      ...avatarVars,
    }}
  >
    <AvatarPrimitive.Image
      src={src}
      alt={alt}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
    <AvatarPrimitive.Fallback
      delayMs={fallbackDelayMs}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        fontSize: SIZE_FONT[size],
        fontWeight: 'var(--ai-font-weight-bold, 700)',
        color: 'var(--ai-text-secondary, #6b7280)',
        background: 'var(--ai-bg-container, #f3f4f6)',
      }}
    >
      {fallback}
    </AvatarPrimitive.Fallback>
  </AvatarPrimitive.Root>
  );
};
