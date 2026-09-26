'use client';

import React, { type AriaAttributes, type ReactNode } from 'react';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { type SubthemeName } from '../../theme/subtheme';
import { resolveColorVariant, type ColorVariant } from '../../theme/colorVariant';
import { TextThemeSlice, TEXT_SIZE_FALLBACK, TEXT_MONO_FALLBACK, type TextSize, type TextSliceState } from './TextSlice';

/**
 * The elements `<Text>` can render. Deliberately closed: text-level
 * elements only, so `as` can never smuggle in a container, control or
 * link. Labels belong to `<Label>`/`<FormField>`, links to `<Link>`,
 * containers to `<Block>`. Adding an element is a deliberate change with a
 * stated reason, not a widened type.
 * @barrelExport
 */
export type TextElement = 'p' | 'span';

/** @barrelExport */
export type TextTone = 'default' | 'secondary';
/** @barrelExport */
export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold';

/**
 * Props for `<Text>`. A fixed shape: `as` changes the tag, never the
 * accepted props, so it can't unlock `href`, `onClick` or `htmlFor`. No
 * `style`/`className`, like every toolcrib component.
 */
export interface TextProps extends AriaAttributes {
  /** Element to render: `'p'` for a paragraph, `'span'` for inline text. @default 'p' */
  as?: TextElement;
  /** Step on the theme's text size ramp (`--ai-text-size-*`). Inherits the surrounding size when omitted. */
  size?: TextSize;
  /** `'default'` is the theme's main text color; `'secondary'` its muted one. Inherits the surrounding color when omitted, so text inside a filled Button or an Alert keeps their color. */
  tone?: TextTone;
  /** Font weight token. Inherits when omitted. */
  weight?: TextWeight;
  /** Monospace family, for codes and identifiers. */
  mono?: boolean;
  /** Status color for the text. Falls back to the nearest `<StyleDomainProvider>`'s. Wins over `tone` and `variant`. */
  subtheme?: SubthemeName;
  /** Identity color (`primary`/`secondary`) for the text. Ignored if a subtheme resolves; wins over `tone`. */
  variant?: ColorVariant;
  /** Per-instance override for the size ramp (`scale`). */
  overrides?: Partial<TextSliceState>;
  id?: string;
  title?: string;
  lang?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  children?: ReactNode;
}

const WEIGHT_VAR: Record<TextWeight, string> = {
  normal: 'var(--ai-font-weight-normal, 400)',
  medium: 'var(--ai-font-weight-medium, 500)',
  semibold: 'var(--ai-font-weight-semibold, 600)',
  bold: 'var(--ai-font-weight-bold, 700)',
};

const TONE_VAR: Record<TextTone, string> = {
  default: 'var(--ai-text-primary, #111827)',
  secondary: 'var(--ai-text-secondary, #6b7280)',
};

/**
 * @manifest Themed paragraph or inline text: size, tone, weight and status color from theme tokens, never literal styles
 * @manifestConstraints `as` is `'p'` or `'span'` only. Sets no margin; space paragraphs with `<VStack gap>`. Headings, labels and links have their own components
 * @manifestCategory Layout Primitives
 * @manifestAntiPatternAvoid A raw `<p style={{ fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>` or a styled `<span>` for secondary text
 * @manifestAntiPatternInstead `<Text size="sm" tone="secondary">`, or `<Text as="span" ...>` inline
 */
export const Text: React.FC<TextProps> = ({
  as: Element = 'p',
  size,
  tone,
  weight,
  mono = false,
  subtheme: instanceSubtheme,
  variant,
  overrides,
  children,
  ...props
}) => {
  const { vars, subtheme } = useSliceOverrides(TextThemeSlice, { ...overrides, subtheme: instanceSubtheme });
  // 'outline' is the appearance whose text color reads on the page's own
  // surface: the contrast-checked `--ai-subtheme-*-text` / `-readable` tokens.
  const colored = subtheme || variant ? resolveColorVariant({ subtheme, variant, appearance: 'outline' }) : null;
  const color = colored?.color ?? (tone ? TONE_VAR[tone] : undefined);

  return (
    <Element
      {...props}
      style={{
        margin: 0,
        ...(size ? { fontSize: `var(--ai-text-size-${size}, ${TEXT_SIZE_FALLBACK[size]})` } : {}),
        ...(color ? { color } : {}),
        ...(weight ? { fontWeight: WEIGHT_VAR[weight] } : {}),
        ...(mono ? { fontFamily: `var(--ai-text-font-mono, ${TEXT_MONO_FALLBACK})` } : {}),
        ...vars,
      }}
    >
      {children}
    </Element>
  );
};

Text.displayName = 'Text';
