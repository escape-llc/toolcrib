import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    carousel: Partial<CarouselSliceState>;
  }
}

/** @barrelExport */
export type CarouselArrowSize = 'sm' | 'md' | 'lg';
export type CarouselDotSize = 'sm' | 'md' | 'lg';
export type CarouselDotSubtheme = 'primary' | 'secondary' | 'success' | 'info';

export interface CarouselSliceState {
  arrowSize: CarouselArrowSize;
  dotSize: CarouselDotSize;
  dotActiveSubtheme: CarouselDotSubtheme;
  slideGap: 'sm' | 'md' | 'lg';
}

export interface CarouselCSSVariables extends Record<string, string> {
  '--ai-carousel-arrow-size': string;
  '--ai-carousel-dot-size': string;
  '--ai-carousel-dot-active-color': string;
  '--ai-carousel-slide-gap': string;
}

export const defaultCarouselState: CarouselSliceState = {
  arrowSize: 'md',
  dotSize: 'md',
  dotActiveSubtheme: 'primary',
  slideGap: 'md',
};

const arrowSizeMap: Record<CarouselArrowSize, string> = {
  sm: '2rem',
  md: '2.75rem',
  lg: '3.5rem',
};

const dotSizeMap: Record<CarouselDotSize, string> = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
};

const slideGapMap: Record<'sm' | 'md' | 'lg', string> = {
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
};

export function getCarouselVariables(state: CarouselSliceState = defaultCarouselState): CarouselCSSVariables {
  let dotActiveColor = 'var(--ai-color-primary, #3b82f6)';
  if (state.dotActiveSubtheme === 'secondary') dotActiveColor = 'var(--ai-color-secondary, #64748b)';
  if (state.dotActiveSubtheme === 'success') dotActiveColor = 'var(--ai-subtheme-success, #10b981)';
  if (state.dotActiveSubtheme === 'info') dotActiveColor = 'var(--ai-subtheme-info, #0284c7)';

  return {
    '--ai-carousel-arrow-size': arrowSizeMap[state.arrowSize] || arrowSizeMap.md,
    '--ai-carousel-dot-size': dotSizeMap[state.dotSize] || dotSizeMap.md,
    '--ai-carousel-dot-active-color': dotActiveColor,
    '--ai-carousel-slide-gap': slideGapMap[state.slideGap] || slideGapMap.md,
  };
}

export const CarouselThemeSlice: ThemeSlice<CarouselSliceState, CarouselCSSVariables> = {
  id: 'carousel',
  name: '🎠 Carousel Arrows, Dots & Slide Gap',
  category: 'Data Display',
  defaultState: defaultCarouselState,
  getCSSVariables: getCarouselVariables,
  renderEditorControl: (state, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Carousel Arrow Size"
        value={state.arrowSize}
        onChange={val => onChange({ ...state, arrowSize: val as CarouselArrowSize })}
        options={[
          { label: 'Small (2rem)', value: 'sm' },
          { label: 'Medium (2.75rem)', value: 'md' },
          { label: 'Large (3.5rem)', value: 'lg' },
        ]}
      />
      <FieldRow
        label="Carousel Dot Size"
        value={state.dotSize}
        onChange={val => onChange({ ...state, dotSize: val as CarouselDotSize })}
        options={[
          { label: 'Small (0.375rem)', value: 'sm' },
          { label: 'Medium (0.5rem)', value: 'md' },
          { label: 'Large (0.75rem)', value: 'lg' },
        ]}
      />
      <FieldRow
        label="Carousel Active Dot Colour"
        value={state.dotActiveSubtheme}
        onChange={val => onChange({ ...state, dotActiveSubtheme: val as CarouselDotSubtheme })}
        options={[
          { label: 'Primary', value: 'primary' },
          { label: 'Secondary', value: 'secondary' },
          { label: 'Success', value: 'success' },
          { label: 'Info', value: 'info' },
        ]}
      />
      <FieldRow
        label="Carousel Slide Gap"
        value={state.slideGap}
        onChange={val => onChange({ ...state, slideGap: val as 'sm' | 'md' | 'lg' })}
        options={[
          { label: 'Small (0.5rem)', value: 'sm' },
          { label: 'Medium (1rem)', value: 'md' },
          { label: 'Large (1.5rem)', value: 'lg' },
        ]}
      />
    </div>
  ),
  fieldVars: {
    arrowSize: ['--ai-carousel-arrow-size'],
    dotSize: ['--ai-carousel-dot-size'],
    dotActiveSubtheme: ['--ai-carousel-dot-active-color'],
    slideGap: ['--ai-carousel-slide-gap'],
  },
};
