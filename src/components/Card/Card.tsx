import React, { ReactNode } from 'react';
import { PaddingMode, resolvePadding } from '../../theme/padding';
import { useCornerSquaring } from '../Splitter/LayoutDomainContext';
import { StyleFreeAttributes, warnIfLegacyStyleProps } from '../../theme/safeProps';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { resolveSubtheme, SubthemeName } from '../../theme/subtheme';
import { CardThemeSlice, CardSliceState } from './CardSlice';

/**
 * Controls which corners of a Card are squared off (border-radius: 0).
 * - `'auto'` — Automatically determined by layout domain context (e.g. inside a Splitter).
 * - `'top'` / `'bottom'` / `'left'` / `'right'` — Square the two corners on that edge.
 * - `'all'` — Square all four corners.
 * - `'none'` — No squaring (use theme radius). This is the default.
 * - `string[]` — Fine-grained array, e.g. `['top-left', 'bottom-right']`.
 */
export type SquareCornerOption =
  | 'auto'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'all'
  | 'none'
  | ('top-left' | 'top-right' | 'bottom-left' | 'bottom-right')[];

export function resolveSquareCorners(squareCorners?: SquareCornerOption): React.CSSProperties {
  if (!squareCorners || squareCorners === 'none' || squareCorners === 'auto') return {};
  if (squareCorners === 'all') {
    return {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    };
  }
  if (squareCorners === 'top') {
    return { borderTopLeftRadius: 0, borderTopRightRadius: 0 };
  }
  if (squareCorners === 'bottom') {
    return { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 };
  }
  if (squareCorners === 'left') {
    return { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 };
  }
  if (squareCorners === 'right') {
    return { borderTopRightRadius: 0, borderBottomRightRadius: 0 };
  }
  if (Array.isArray(squareCorners)) {
    const res: React.CSSProperties = {};
    if (squareCorners.includes('top-left')) res.borderTopLeftRadius = 0;
    if (squareCorners.includes('top-right')) res.borderTopRightRadius = 0;
    if (squareCorners.includes('bottom-left')) res.borderBottomLeftRadius = 0;
    if (squareCorners.includes('bottom-right')) res.borderBottomRightRadius = 0;
    return res;
  }
  return {};
}

/**
 * Per-instance override for a `<Card>`'s theme-driven values — a sparse
 * patch applied as CSS variables on this Card's own root node only (see
 * `theme/useSliceOverrides.ts`), so it never affects any other Card and
 * never shadows the global Theme Editor state for fields it doesn't
 * mention. `subtheme` is resolved instance-first, falling back to the
 * nearest `<StyleDomainProvider>` if this Card doesn't set one itself.
 */
export interface CardOverrides extends Partial<CardSliceState> {
  subtheme?: SubthemeName;
}

/**
 * Props for the root `<Card>` container.
 *
 * Slot sub-components: `Card.Header`, `Card.Content`, `Card.Footer`, `Card.Actions`.
 */
export interface CardProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
  /**
   * Layout mode. `'auto'` enables flex filling (height:100%, flex:1) and activates
   * automatic corner-squaring via layout domain context (e.g. inside a Splitter).
   * @default 'default'
   */
  layout?: 'default' | 'auto';
  /**
   * Override which corners are squared off. `'auto'` defers to layout domain context.
   * @default undefined (no squaring)
   */
  squareCorners?: SquareCornerOption;
  /** Per-instance theme overrides (padding, header style, subtheme). */
  overrides?: CardOverrides;
}

/** Props for the `<Card.Header>` slot. Renders with bottom border, bold text. */
export interface CardHeaderProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Overrides the default padding using the theme padding token scale. */
  paddingMode?: PaddingMode;
}

/** Props for the `<Card.Content>` slot. Main body area of the card. */
export interface CardContentProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Overrides the default padding using the theme padding token scale. */
  paddingMode?: PaddingMode;
  /**
   * `'auto'` enables flex column layout with overflow hidden and minHeight: 0,
   * useful for embedding scrollable or virtualized content.
   * @default 'default'
   */
  layout?: 'default' | 'auto';
}

/** Props for the `<Card.Footer>` slot. Renders with top border and container background. */
export interface CardFooterProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Overrides the default padding using the theme padding token scale. */
  paddingMode?: PaddingMode;
}

/** Props for the `<Card.Actions>` slot. Flex row aligned to the end, typically used inside Footer. */
export interface CardActionsProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * @manifest Slot-based container with automatic layout domain corner squaring
 * @manifestCategory Containers
 */
export const Card: React.FC<CardProps> & {
  Header: React.FC<CardHeaderProps>;
  Content: React.FC<CardContentProps>;
  Footer: React.FC<CardFooterProps>;
  Actions: React.FC<CardActionsProps>;
} = ({ children, layout = 'default', squareCorners, overrides, ...props }) => {
  warnIfLegacyStyleProps(props, 'Card');
  const isAuto = layout === 'auto' || squareCorners === 'auto';
  const { style: domainCornerStyle } = useCornerSquaring(isAuto);
  const { vars, subtheme } = useSliceOverrides(CardThemeSlice, overrides);
  const subthemeColors = subtheme ? resolveSubtheme(subtheme) : undefined;

  return (
    <div
      data-ai-layout-auto={isAuto ? 'true' : 'false'}
      {...props}
      style={{
        background: 'var(--ai-bg-surface, #ffffff)',
        borderRadius: 'var(--ai-radius-lg, 0.75rem)',
        border: `0.0625rem solid ${subthemeColors ? subthemeColors.border : 'var(--ai-border, #e5e7eb)'}`,
        boxShadow: '0 0.25rem 0.375rem -0.0625rem rgba(0, 0, 0, 0.05)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...(isAuto ? {
          height: '100%',
          width: '100%',
          flex: '1 1 0px',
          minHeight: 0,
          boxSizing: 'border-box',
        } : {}),
        ...domainCornerStyle,
        ...vars,
        ...resolveSquareCorners(squareCorners),
      }}
    >
      {children}
    </div>
  );
};

Card.Header = ({ children, paddingMode, ...props }) => {
  warnIfLegacyStyleProps(props, 'Card.Header');
  return (
    <div
      {...props}
      style={{
        padding: paddingMode ? resolvePadding(paddingMode, 'lg') : 'var(--ai-card-header-padding, 1.25rem 1.5rem)',
        background: 'var(--ai-card-header-bg, transparent)',
        borderBottom: 'var(--ai-card-header-border, 0.0625rem solid var(--ai-border, #e5e7eb))',
        fontWeight: 700,
        fontSize: '1.125rem',
        color: 'var(--ai-text-primary, #111827)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {children}
    </div>
  );
};

Card.Content = ({ children, paddingMode, layout = 'default', ...props }) => {
  warnIfLegacyStyleProps(props, 'Card.Content');
  const isAuto = layout === 'auto';
  return (
    <div
      {...props}
      style={{
        padding: paddingMode ? resolvePadding(paddingMode, 'lg') : 'var(--ai-card-padding, 1.25rem 1.5rem)',
        color: 'var(--ai-text-primary, #111827)',
        fontSize: '0.875rem',
        lineHeight: '1.6',
        flex: 1,
        ...(isAuto ? {
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        } : {}),
      }}
    >
      {children}
    </div>
  );
};

Card.Footer = ({ children, paddingMode, ...props }) => {
  warnIfLegacyStyleProps(props, 'Card.Footer');
  return (
    <div
      {...props}
      style={{
        padding: resolvePadding(paddingMode, 'md'),
        borderTop: '0.0625rem solid var(--ai-border, #e5e7eb)',
        background: 'var(--ai-bg-container, #f9fafb)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.875rem',
      }}
    >
      {children}
    </div>
  );
};

Card.Actions = ({ children, ...props }) => {
  warnIfLegacyStyleProps(props, 'Card.Actions');
  return (
    <div
      {...props}
      style={{
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      {children}
    </div>
  );
};

Card.Header.displayName = 'Card.Header';
Card.Content.displayName = 'Card.Content';
Card.Footer.displayName = 'Card.Footer';
Card.Actions.displayName = 'Card.Actions';
