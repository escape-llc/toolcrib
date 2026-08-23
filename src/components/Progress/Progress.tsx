import React, { useEffect } from 'react';
import { Progress as ProgressPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { useResolvedSubtheme } from '../../theme/useSliceOverrides';
import { getSparseVariables } from '../../theme/slice';
import { resolveSubtheme, type SubthemeName } from '../../theme/subtheme';
import { ProgressThemeSlice, type ProgressSliceState } from './ProgressSlice';

/**
 * Props for the `<Progress>` bar.
 *
 * Purely controlled by `value` — there's no internal state to drive it, so
 * it emits `progress:changed` whenever `value`/`max` change rather than in
 * response to any user interaction of its own.
 */
export interface ProgressProps {
  /** Unique identifier included in emitted `progress:changed` events. */
  id?: string;
  /** Current progress value, between 0 and `max`. */
  value: number;
  /** Value representing 100% completion. @default 100 */
  max?: number;
  /** Bar thickness. @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Apply a subtheme colour. Falls back to the nearest `<StyleDomainProvider>`'s if omitted. */
  subtheme?: SubthemeName;
  /** Per-instance override for the track's corner shape. */
  overrides?: Partial<ProgressSliceState>;
}

const SIZE_HEIGHT: Record<NonNullable<ProgressProps['size']>, string> = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
};

/**
 * @manifest Determinate progress bar
 * @manifestCategory Data Display
 */
export const Progress: React.FC<ProgressProps> = ({
  id,
  value,
  max = 100,
  size = 'md',
  subtheme: instanceSubtheme,
  overrides,
}) => {
  const subtheme = useResolvedSubtheme(instanceSubtheme);
  const subthemeColors = subtheme ? resolveSubtheme(subtheme) : undefined;
  const progressVars = getSparseVariables(ProgressThemeSlice, overrides ?? {});
  const clampedValue = Math.min(Math.max(value, 0), max);
  const percentage = max > 0 ? (clampedValue / max) * 100 : 0;

  useEffect(() => {
    aiBus.emit('progress:changed', { id, value: clampedValue, max });
  }, [id, clampedValue, max]);

  return (
    <ProgressPrimitive.Root
      value={clampedValue}
      max={max}
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        height: SIZE_HEIGHT[size],
        borderRadius: 'var(--ai-progress-radius, 0.625rem)',
        background: 'var(--ai-bg-container, #f3f4f6)',
        ...progressVars,
      }}
    >
      <ProgressPrimitive.Indicator
        style={{
          width: '100%',
          height: '100%',
          background: subthemeColors ? subthemeColors.main : 'var(--ai-color-primary, #3b82f6)',
          borderRadius: 'inherit',
          transform: `translateX(-${100 - percentage}%)`,
          // The var alone, not `transform ${var}` -- see Sidebar.tsx's
          // own comment on why prepending a property name in front of
          // --ai-transition-normal (which already resolves to a complete
          // `all <duration> <easing>` shorthand) produces invalid,
          // silently-dropped CSS once a real ThemeProvider is mounted.
          transition: 'var(--ai-transition-normal, all 0.3s cubic-bezier(0.4, 0, 0.2, 1))',
        }}
      />
    </ProgressPrimitive.Root>
  );
};
