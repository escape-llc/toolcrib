import React, { ReactNode, HTMLAttributes } from 'react';
import { PaddingMode, resolvePadding } from '../../theme/padding';
import { MarginMode } from '../../theme/margin';
import { CornerRadiusMode, resolveRadius } from '../../theme/radius';

/**
 * Props for the `<Toolbar>` horizontal container.
 *
 * Slot sub-components: `Toolbar.Left`, `Toolbar.Center`, `Toolbar.Right`.
 */
export interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Override padding using the theme padding token scale. */
  paddingMode?: PaddingMode;
  /** Override margin using the theme margin token scale (unused, reserved). */
  marginMode?: MarginMode;
  /** Override corner radius using the theme radius token scale. */
  cornerRadiusMode?: CornerRadiusMode;
  style?: React.CSSProperties;
  className?: string;
}

/** Props for Toolbar slot sub-components (`Toolbar.Left`, `Toolbar.Center`, `Toolbar.Right`). */
export interface ToolbarSlotProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

/** @manifest Horizontal action bar with left/center/right slot areas */
export const Toolbar: React.FC<ToolbarProps> & {
  Left: React.FC<ToolbarSlotProps>;
  Center: React.FC<ToolbarSlotProps>;
  Right: React.FC<ToolbarSlotProps>;
} = ({ children, paddingMode, marginMode, cornerRadiusMode, style, className, ...props }) => {
  return (
    <div
      className={className}
      {...props}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        boxSizing: 'border-box',
        gap: 'var(--ai-margin-gap, 0.875rem)',
        padding: paddingMode ? resolvePadding(paddingMode, 'sm') : undefined,
        borderRadius: cornerRadiusMode ? resolveRadius(cornerRadiusMode) : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

Toolbar.Left = ({ children, style, className, ...props }) => (
  <div
    className={className}
    {...props}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      justifyContent: 'flex-start',
      flexShrink: 0,
      ...style,
    }}
  >
    {children}
  </div>
);

Toolbar.Center = ({ children, style, className, ...props }) => (
  <div
    className={className}
    {...props}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      justifyContent: 'center',
      flex: 1,
      ...style,
    }}
  >
    {children}
  </div>
);

Toolbar.Right = ({ children, style, className, ...props }) => (
  <div
    className={className}
    {...props}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      justifyContent: 'flex-end',
      flexShrink: 0,
      marginLeft: 'auto',
      ...style,
    }}
  >
    {children}
  </div>
);

Toolbar.Left.displayName = 'Toolbar.Left';
Toolbar.Center.displayName = 'Toolbar.Center';
Toolbar.Right.displayName = 'Toolbar.Right';
