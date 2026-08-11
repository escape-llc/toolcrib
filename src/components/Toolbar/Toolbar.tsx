import React, { ReactNode } from 'react';
import { PaddingMode, resolvePadding } from '../../theme/padding';
import { MarginMode } from '../../theme/margin';
import { CornerRadiusMode, resolveRadius } from '../../theme/radius';
import { StyleFreeAttributes, warnIfLegacyStyleProps } from '../../theme/safeProps';

/**
 * Props for the `<Toolbar>` horizontal container.
 *
 * Slot sub-components: `Toolbar.Left`, `Toolbar.Center`, `Toolbar.Right`.
 */
export interface ToolbarProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Override padding using the theme padding token scale. */
  paddingMode?: PaddingMode;
  /** Override margin using the theme margin token scale (unused, reserved). */
  marginMode?: MarginMode;
  /** Override corner radius using the theme radius token scale. */
  cornerRadiusMode?: CornerRadiusMode;
}

/** Props for Toolbar slot sub-components (`Toolbar.Left`, `Toolbar.Center`, `Toolbar.Right`). */
export interface ToolbarSlotProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * @manifest Horizontal action bar with left/center/right slot areas
 * @manifestCategory Layout Primitives
 */
export const Toolbar: React.FC<ToolbarProps> & {
  Left: React.FC<ToolbarSlotProps>;
  Center: React.FC<ToolbarSlotProps>;
  Right: React.FC<ToolbarSlotProps>;
} = ({ children, paddingMode, marginMode, cornerRadiusMode, ...props }) => {
  warnIfLegacyStyleProps(props, 'Toolbar');
  return (
    <div
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
      }}
    >
      {children}
    </div>
  );
};

Toolbar.Left = ({ children, ...props }) => {
  warnIfLegacyStyleProps(props, 'Toolbar.Left');
  return (
    <div
      {...props}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        justifyContent: 'flex-start',
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
};

Toolbar.Center = ({ children, ...props }) => {
  warnIfLegacyStyleProps(props, 'Toolbar.Center');
  return (
    <div
      {...props}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        justifyContent: 'center',
        flex: 1,
      }}
    >
      {children}
    </div>
  );
};

Toolbar.Right = ({ children, ...props }) => {
  warnIfLegacyStyleProps(props, 'Toolbar.Right');
  return (
    <div
      {...props}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        justifyContent: 'flex-end',
        flexShrink: 0,
        marginLeft: 'auto',
      }}
    >
      {children}
    </div>
  );
};

Toolbar.Left.displayName = 'Toolbar.Left';
Toolbar.Center.displayName = 'Toolbar.Center';
Toolbar.Right.displayName = 'Toolbar.Right';
