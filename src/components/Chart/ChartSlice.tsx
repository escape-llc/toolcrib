import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    chart: Partial<ChartSliceState>;
  }
}

/** @barrelExport */
export type ChartGridStyle = 'visible' | 'hidden';
export type ChartTooltipShadow = 'subtle' | 'elevated';
export type ChartHoverEmphasis = 'subtle' | 'bold';

export interface ChartSliceState {
  gridStyle: ChartGridStyle;
  tooltipShadow: ChartTooltipShadow;
  hoverEmphasis: ChartHoverEmphasis;
}

export interface ChartCSSVariables extends Record<string, string> {
  '--ai-chart-grid-opacity': string;
  '--ai-chart-tooltip-shadow': string;
  '--ai-chart-hover-brightness': string;
  '--ai-chart-hover-ring-width': string;
}

export const defaultChartState: ChartSliceState = {
  gridStyle: 'visible',
  tooltipShadow: 'subtle',
  hoverEmphasis: 'subtle',
};

const tooltipShadowMap: Record<ChartTooltipShadow, string> = {
  subtle: '0 0.25rem 0.75rem -0.125rem rgba(0, 0, 0, 0.15)',
  elevated: '0 0.75rem 1.5rem -0.25rem rgba(0, 0, 0, 0.28)',
};

const hoverBrightnessMap: Record<ChartHoverEmphasis, string> = {
  subtle: '1.1',
  bold: '1.2',
};

const hoverRingWidthMap: Record<ChartHoverEmphasis, string> = {
  subtle: '0.125rem',
  bold: '0.1875rem',
};

export function getChartVariables(state: ChartSliceState = defaultChartState): ChartCSSVariables {
  return {
    '--ai-chart-grid-opacity': state.gridStyle === 'hidden' ? '0' : '1',
    '--ai-chart-tooltip-shadow': tooltipShadowMap[state.tooltipShadow] || tooltipShadowMap.subtle,
    '--ai-chart-hover-brightness': hoverBrightnessMap[state.hoverEmphasis] || hoverBrightnessMap.subtle,
    '--ai-chart-hover-ring-width': hoverRingWidthMap[state.hoverEmphasis] || hoverRingWidthMap.subtle,
  };
}

export const ChartThemeSlice: ThemeSlice<ChartSliceState, ChartCSSVariables> = {
  id: 'chart',
  name: '📊 Chart Gridlines, Tooltip & Hover',
  category: 'Data Display',
  defaultState: defaultChartState,
  getCSSVariables: getChartVariables,
  renderEditorControl: (state, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Chart Gridlines"
        value={state.gridStyle}
        onChange={val => onChange({ ...state, gridStyle: val as ChartGridStyle })}
        options={[
          { label: 'Visible', value: 'visible' },
          { label: 'Hidden', value: 'hidden' },
        ]}
      />
      <FieldRow
        label="Chart Tooltip Shadow"
        value={state.tooltipShadow}
        onChange={val => onChange({ ...state, tooltipShadow: val as ChartTooltipShadow })}
        options={[
          { label: 'Subtle', value: 'subtle' },
          { label: 'Elevated', value: 'elevated' },
        ]}
      />
      <FieldRow
        label="Chart Hover Emphasis"
        tooltip="How strongly a bar or slice lifts (brightness + ring width) on hover/focus"
        value={state.hoverEmphasis}
        onChange={val => onChange({ ...state, hoverEmphasis: val as ChartHoverEmphasis })}
        options={[
          { label: 'Subtle', value: 'subtle' },
          { label: 'Bold', value: 'bold' },
        ]}
      />
    </div>
  ),
  fieldVars: {
    gridStyle: ['--ai-chart-grid-opacity'],
    tooltipShadow: ['--ai-chart-tooltip-shadow'],
    hoverEmphasis: ['--ai-chart-hover-brightness', '--ai-chart-hover-ring-width'],
  },
};
