'use client';

import React, { type ReactNode } from 'react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { getSparseVariables } from '../../theme/slice';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { RatingThemeSlice, type RatingSliceState } from './RatingSlice';

/** Props for the `<Rating>` star control. */
export interface RatingProps {
  /** Field name included in emitted `rating:changed` events. */
  name?: string;
  /** Controlled value. */
  value?: number;
  /** Initial value (uncontrolled). @default 0 */
  defaultValue?: number;
  /** Change handler. Receives the newly selected whole-number rating. Not called in `readOnly` mode. */
  onChange?: (value: number) => void;
  /** Number of icons. @default 5 */
  max?: number;
  /** Icon rendered for a filled position. @default a star glyph */
  icon?: ReactNode;
  /**
   * Renders a non-interactive display instead of a collecting control —
   * for showing an existing (possibly fractional, e.g. an average) rating
   * rather than gathering one. `value` may be fractional in this mode; the
   * icon at a fractional position renders partially filled.
   * @default false
   */
  readOnly?: boolean;
  /** Per-instance overrides for icon size and gap. */
  overrides?: Partial<RatingSliceState>;
}

const DEFAULT_ICON = '★';

/**
 * @manifest Star rating control built on Radix RadioGroup, or a read-only fractional-fill display
 * @manifestCategory Form Controls
 * @manifestAntiPatternAvoid Build a row of clickable star `<span>`s with manual hover/click state for a rating input
 * @manifestAntiPatternInstead Use `<Rating>` — built on Radix `RadioGroup`, inherits real keyboard operability and `aria-checked` semantics instead of approximating them
 */
export const Rating: React.FC<RatingProps> = ({
  name,
  value: externalValue,
  defaultValue = 0,
  onChange,
  max = 5,
  icon,
  readOnly = false,
  overrides,
}) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const isControlled = externalValue !== undefined;
  const value = isControlled ? externalValue : internalValue;
  const ratingVars = getSparseVariables(RatingThemeSlice, overrides ?? {});
  useInjectInteractionStyles();

  const handleChange = (val: string) => {
    const numeric = Number(val);
    if (!isControlled) setInternalValue(numeric);
    onChange?.(numeric);
    aiBus.emit('rating:changed', { name, value: numeric });
  };

  const iconStyle: React.CSSProperties = {
    width: 'var(--ai-rating-icon-size, 1.375rem)',
    height: 'var(--ai-rating-icon-size, 1.375rem)',
    fontSize: 'var(--ai-rating-icon-size, 1.375rem)',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (readOnly) {
    return (
      <div
        role="img"
        aria-label={`${value} out of ${max} stars`}
        style={{ display: 'inline-flex', gap: 'var(--ai-rating-gap, 0.125rem)', ...ratingVars }}
      >
        {Array.from({ length: max }, (_, i) => {
          // Position i (0-indexed) is fully filled once `value` reaches
          // i + 1; between i and i + 1 it's partially filled, clipped via
          // an absolutely-positioned overlay rather than a CSS mask, since
          // mask-image support isn't guaranteed for arbitrary custom `icon`
          // content the way clip-path on a wrapping box is.
          const fillFraction = Math.max(0, Math.min(1, value - i));
          return (
            <span key={i} style={{ ...iconStyle, position: 'relative', color: 'var(--ai-border, #d1d5db)' }}>
              <span aria-hidden="true">{icon ?? DEFAULT_ICON}</span>
              {fillFraction > 0 && (
                <span
                  aria-hidden="true"
                  style={{
                    ...iconStyle,
                    position: 'absolute',
                    inset: 0,
                    overflow: 'hidden',
                    width: `${fillFraction * 100}%`,
                    color: 'var(--ai-color-primary, #3b82f6)',
                  }}
                >
                  {icon ?? DEFAULT_ICON}
                </span>
              )}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <RadioGroupPrimitive.Root
      value={String(value)}
      onValueChange={handleChange}
      className="ai-focus-ring"
      aria-label={name ? undefined : 'Rating'}
      style={{ display: 'inline-flex', gap: 'var(--ai-rating-gap, 0.125rem)', outline: 'none', ...ratingVars }}
    >
      {Array.from({ length: max }, (_, i) => {
        const position = i + 1;
        const isFilled = position <= value;
        return (
          <RadioGroupPrimitive.Item
            key={position}
            value={String(position)}
            aria-label={`${position} star${position === 1 ? '' : 's'}`}
            className="ai-focus-ring"
            style={{
              all: 'unset',
              ...iconStyle,
              cursor: 'pointer',
              color: isFilled ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-border, #d1d5db)',
              transition: 'color 0.15s ease',
            }}
          >
            {icon ?? DEFAULT_ICON}
          </RadioGroupPrimitive.Item>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
};
