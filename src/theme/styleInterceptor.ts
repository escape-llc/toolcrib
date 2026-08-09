import React from 'react';
import { PaddingMode, resolvePadding } from './padding';
import { MarginMode, resolveMargin } from './margin';
import { CornerRadiusMode, resolveRadius } from './radius';

export interface AIStyleProps {
  paddingMode?: PaddingMode;
  marginMode?: MarginMode;
  cornerRadiusMode?: CornerRadiusMode;
  subtheme?: 'error' | 'success' | 'warning' | 'info';
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Intercepts component styles for Toolcrib:
 * 1. Takes over component className & style attributes.
 * 2. Merges standardized Toolcrib CSS variables for padding, margin, radius, and subthemes.
 * 3. Filters out ad-hoc inline padding/margin noise when theme props are explicitly set.
 */
export function resolveAIStyle(props: AIStyleProps): React.CSSProperties {
  const { paddingMode, marginMode, cornerRadiusMode, subtheme, style = {} } = props;

  const baseStyle: React.CSSProperties = { ...style };

  // If paddingMode is specified, override inline padding with theme token
  if (paddingMode) {
    delete baseStyle.padding;
    delete baseStyle.paddingTop;
    delete baseStyle.paddingRight;
    delete baseStyle.paddingBottom;
    delete baseStyle.paddingLeft;
    baseStyle.padding = resolvePadding(paddingMode);
  }

  // If marginMode is specified, override inline margin with theme token
  if (marginMode) {
    delete baseStyle.margin;
    delete baseStyle.marginTop;
    delete baseStyle.marginRight;
    delete baseStyle.marginBottom;
    delete baseStyle.marginLeft;
    baseStyle.marginBottom = resolveMargin(marginMode, 'gap');
  }

  // If cornerRadiusMode is specified, apply theme radius token
  if (cornerRadiusMode) {
    baseStyle.borderRadius = resolveRadius(cornerRadiusMode);
  }

  // If subtheme is specified, apply subtheme colors
  if (subtheme) {
    baseStyle.color = `var(--ai-subtheme-${subtheme}-text)`;
    baseStyle.backgroundColor = `var(--ai-subtheme-${subtheme}-bg)`;
    baseStyle.borderColor = `var(--ai-subtheme-${subtheme}-border)`;
  }

  return baseStyle;
}
