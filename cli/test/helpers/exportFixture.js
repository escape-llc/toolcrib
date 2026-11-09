/**
 * A small fake toolkit release plus a consumer's edited copy of it, shaped
 * like the real repo (a slice registry, an event map, editor controls) so the
 * export-patches tests exercise the real attribution rules. relPaths are
 * relative to the toolkit root, like release.allFiles().
 */

export function releaseFixture() {
  return {
    'components/Card/Card.tsx': `'use client';
import React from 'react';
import { useSliceOverrides } from '../../theme/slice';
import { padUnit } from '../../theme/padding';

export interface CardProps extends StyleFree<HTMLDivElement> {
  layout?: string;
}

/**
 * @manifest A card
 * @manifestCategory Containers
 */
export const Card: React.FC<CardProps> = (props) => {
  useSliceOverrides();
  return padUnit(1) as never;
};
`,
    'components/Card/CardSlice.ts': `import type { ThemeSlice } from '../../theme/slice';

export interface CardSliceState {
  radius: number;
}

export const CardThemeSlice: ThemeSlice<CardSliceState> = { id: 'card' };
`,
    'components/Overlay/Modal.tsx': `'use client';
import React from 'react';
import { aiBus } from '../../eventBus/eventBus';

/**
 * @manifest A modal
 * @manifestCategory Overlays
 */
export const Modal: React.FC = () => {
  aiBus.emit('modal:open', { id: 'm' });
  return null;
};
`,
    'components/ThemeEditor/sliceEditorControls.tsx': `import { type CardSliceState } from '../Card/CardSlice';
import { FieldRow } from './FieldRow';

export const SLICE_EDITOR_CONTROLS = {
  card: (state: CardSliceState) => FieldRow(state),
  modal: (state: unknown) => FieldRow(state),
};
`,
    'eventBus/eventBus.ts': `export interface AIEventMap {
  'modal:open': { id: string };
  'card:x': { id: string };
  'modal:close': { id: string };
  'toast:show': { id: string };
}

export const aiBus = { emit(_name: string, _payload: unknown) {} };
`,
    'theme/slice.ts': `export interface ThemeSlice<T> {
  id: string;
  defaultState?: T;
}
export const globalThemeSliceRegistry = { register(_slice: unknown) {} };
export function useSliceOverrides() {
  return null;
}
`,
    'theme/registerThemeSlices.ts': `import { CardThemeSlice } from '../components/Card/CardSlice';
import { globalThemeSliceRegistry } from './slice';

globalThemeSliceRegistry.register(CardThemeSlice);
// end of registrations
`,
    'theme/padding.ts': `export const padUnit = (n: number) => n * 4;
`,
    'observer/useThing.ts': `import { useState } from 'react';
export function useThing() {
  return useState(0);
}
`,
    'index.ts': `export * from './components/Card/Card';
`,
    'ai-docs/CORE.md': `# Core
`,
  };
}

/** The consumer's edits on top of the release. */
export function localFixture() {
  const files = releaseFixture();

  // Card edited.
  files['components/Card/Card.tsx'] = files['components/Card/Card.tsx'].replace('layout?: string;', 'layout?: string;\n  dense?: boolean;');

  // A new Gauge component with its own slice and a new theme math helper.
  files['components/Gauge/Gauge.tsx'] = `'use client';
import React, { useState } from 'react';
import { clampGauge } from '../../theme/gaugeMath';
import { aiBus } from '../../eventBus/eventBus';
import { GaugeThemeSlice } from './GaugeSlice';

export interface GaugeProps extends StyleFree<HTMLDivElement> {
  value: number;
}

/**
 * @manifest A gauge
 * @manifestCategory Data Display
 */
export const Gauge: React.FC<GaugeProps> = (props) => {
  const [v] = useState(clampGauge(props.value));
  aiBus.emit('gauge:changed', { v, slice: GaugeThemeSlice.id });
  return null;
};
`;
  files['components/Gauge/GaugeSlice.ts'] = `import type { ThemeSlice } from '../../theme/slice';

export interface GaugeSliceState {
  size: number;
}

export const GaugeThemeSlice: ThemeSlice<GaugeSliceState> = { id: 'gauge' };
`;
  files['theme/gaugeMath.ts'] = `export const clampGauge = (n: number) => Math.min(100, Math.max(0, n));
`;
  files['__tests__/Gauge.test.tsx'] = `// gauge tests
`;

  // A new observer nobody imports.
  files['observer/useRetry.ts'] = `import { useState } from 'react';
export function useRetry() {
  return useState(0);
}
`;

  // eventBus: Gauge's own channel, an app-specific one, and one ambiguous hunk.
  files['eventBus/eventBus.ts'] = `export interface AIEventMap {
  'modal:open': { id: string };
  'gauge:changed': { v: number };
  'card:x': { id: string };
  'modal:close': { id: string };
  'myapp:thing': { id: string };
  'toast:show': { id: string };
  'gauge:reset': { v: number };
  'card:y': { id: string };
}

export const aiBus = { emit(_name: string, _payload: unknown) {} };
`;

  files['theme/registerThemeSlices.ts'] = `import { CardThemeSlice } from '../components/Card/CardSlice';
import { GaugeThemeSlice } from '../components/Gauge/GaugeSlice';
import { globalThemeSliceRegistry } from './slice';

globalThemeSliceRegistry.register(CardThemeSlice);
globalThemeSliceRegistry.register(GaugeThemeSlice);
// end of registrations
`;

  files['components/ThemeEditor/sliceEditorControls.tsx'] = `import { type CardSliceState } from '../Card/CardSlice';
import { type GaugeSliceState } from '../Gauge/GaugeSlice';
import { FieldRow } from './FieldRow';

export const SLICE_EDITOR_CONTROLS = {
  card: (state: CardSliceState) => FieldRow(state),
  gauge: (state: GaugeSliceState) => FieldRow(state),
  modal: (state: unknown) => FieldRow(state),
};
`;

  files['index.ts'] += `export * from './components/Gauge/Gauge';\n`;
  files['ai-docs/CORE.md'] = '# Core\nedited\n';
  return files;
}

export const toMap = (obj) => new Map(Object.entries(obj));
