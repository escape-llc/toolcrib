import React from 'react';

/** Props for the internal divider between options of a connected choice strip. */
export interface ChoiceSeparatorProps {
  /**
   * Fades the divider out without unmounting it, so the strip's width never
   * changes (TabStrip hides the one next to its active tab).
   */
  hidden?: boolean;
  /** Horizontal margin on each side of the divider, as a CSS length. @default '0' */
  gap?: string;
}

/**
 * The divider between two options of ToggleGroup or TabStrip. A real element
 * between the options, never a pseudo-element inside one, so an option's
 * selected or hover fill can't paint under it. Decorative: `aria-hidden`, and
 * not focusable, so it is invisible to the composite keyboard list.
 */
export const ChoiceSeparator: React.FC<ChoiceSeparatorProps> = ({ hidden = false, gap = '0' }) => (
  <span
    aria-hidden="true"
    data-ai-choice-separator=""
    style={{
      flex: 'none',
      alignSelf: 'center',
      width: 'var(--ai-choice-separator-width, 0.0625rem)',
      height: '1.125rem',
      margin: `0 ${gap}`,
      // --ai-text-secondary, not --ai-border: at real size a --ai-border
      // divider all but disappears against the surface, and the point of
      // these dividers is that adjacent options read as separate.
      background: 'var(--ai-choice-separator, var(--ai-text-secondary, #6b7280))',
      opacity: hidden ? 0 : 1,
    }}
  />
);
