import React, { useState, useEffect } from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { getSparseVariables } from '../../theme/slice';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { SliderThemeSlice, type SliderSliceState } from './SliderSlice';

/**
 * Props for the `<Slider>` range input control.
 *
 * Emits `slider:changed` events on the event bus.
 */
export interface SliderProps {
  /** Field name. Used in event bus payloads. */
  name?: string;
  /** Controlled current value. */
  value?: number;
  /** Initial value (uncontrolled). @default 50 */
  defaultValue?: number;
  /** Minimum value. @default 0 */
  min?: number;
  /** Maximum value. @default 100 */
  max?: number;
  /** Step increment. @default 1 */
  step?: number;
  /** Change handler. Receives the new numeric value. */
  onChange?: (value: number) => void;
  /** If true, the slider is non-interactive. @default false */
  disabled?: boolean;
  /**
   * If true, `onChange`/`slider:changed` only fire once, when the drag
   * ends (or on a discrete keyboard step) — not continuously on every
   * tick while dragging. The thumb still tracks the pointer smoothly
   * either way (an internal buffer drives its visual position); this only
   * changes when the *consumer* is notified. Opt-in, not the default —
   * live per-tick updates are the right choice for most sliders (e.g. a
   * real-time value preview), including most of the Theme Designer's own
   * (color/timing values, which don't feed back into layout). It matters
   * for a specific narrower case: a slider whose value feeds back into
   * the page's own layout — the Theme Designer's Master Font Size above
   * all, since every `rem` value in the whole UI derives from it —  where
   * recalculating on every tick can resize or reposition the very slider
   * being dragged out from under the pointer mid-gesture, not just waste
   * a render. Deferring to release keeps the drag itself trackable
   * regardless of what the eventual committed value ends up changing.
   * @default false
   */
  commitOnRelease?: boolean;
  /** Per-instance overrides for track height and thumb size. */
  overrides?: Partial<SliderSliceState>;
}

/**
 * @manifest Range input control built on Radix Slider
 * @manifestCategory Form Controls
 */
export const Slider: React.FC<SliderProps> = ({
  name,
  value,
  defaultValue = 50,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  disabled = false,
  commitOnRelease = false,
  overrides,
}) => {
  // A local buffer, not just `value ?? defaultValue` read directly, is
  // what lets the thumb keep tracking the pointer smoothly during a drag
  // in commitOnRelease mode: the *external* `value` prop only advances
  // once the consumer's onChange fires (i.e. on release), so rendering
  // straight from it would freeze the thumb at the pre-drag position for
  // the whole gesture. Synced back to the external value below whenever
  // it changes from outside (e.g. a programmatic reset), just not on
  // every internal drag tick.
  const [localValue, setLocalValue] = useState(value !== undefined ? value : defaultValue);
  useEffect(() => {
    if (value !== undefined) setLocalValue(value);
  }, [value]);

  const currentVal = commitOnRelease ? localValue : (value !== undefined ? value : defaultValue);
  const sliderVars = getSparseVariables(SliderThemeSlice, overrides ?? {});
  useInjectInteractionStyles();

  const commitValue = (newVal: number) => {
    if (onChange) onChange(newVal);
    aiBus.emit('slider:changed', { name, value: newVal });
  };

  return (
    <SliderPrimitive.Root
      value={[currentVal]}
      onValueChange={(vals) => {
        if (commitOnRelease) {
          setLocalValue(vals[0]);
        } else {
          commitValue(vals[0]);
        }
      }}
      onValueCommit={commitOnRelease ? (vals) => commitValue(vals[0]) : undefined}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        userSelect: 'none',
        touchAction: 'none',
        width: '100%',
        height: '1.25rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        ...sliderVars,
      }}
    >
      <SliderPrimitive.Track
        style={{
          background: 'var(--ai-border, #d1d5db)',
          position: 'relative',
          flexGrow: 1,
          borderRadius: 'var(--ai-radius-lg, 0.625rem)',
          height: 'var(--ai-slider-track-height, 0.375rem)',
        }}
      >
        <SliderPrimitive.Range
          style={{
            position: 'absolute',
            background: 'var(--ai-color-primary, #3b82f6)',
            borderRadius: 'var(--ai-radius-lg, 0.625rem)',
            height: '100%',
          }}
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className="ai-focus-ring"
        style={{
          display: 'block',
          width: 'var(--ai-slider-thumb-size, 1.125rem)',
          height: 'var(--ai-slider-thumb-size, 1.125rem)',
          background: 'var(--ai-bg-surface, #ffffff)',
          border: '0.125rem solid var(--ai-color-primary, #3b82f6)',
          borderRadius: '50%',
          boxShadow: '0 0.0625rem 0.25rem rgba(0,0,0,0.2)',
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      />
    </SliderPrimitive.Root>
  );
};
