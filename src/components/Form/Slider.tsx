import React from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { getSparseVariables } from '../../theme/slice';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { SliderThemeSlice, SliderSliceState } from './SliderSlice';

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
  overrides,
}) => {
  const currentVal = value !== undefined ? value : defaultValue;
  const sliderVars = getSparseVariables(SliderThemeSlice, overrides ?? {});
  useInjectInteractionStyles();

  return (
    <SliderPrimitive.Root
      value={[currentVal]}
      onValueChange={(vals) => {
        const newVal = vals[0];
        if (onChange) onChange(newVal);
        aiBus.emit('slider:changed', { name, value: newVal });
      }}
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
