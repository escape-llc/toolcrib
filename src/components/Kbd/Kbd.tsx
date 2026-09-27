'use client';

import React, { type AriaAttributes, type CSSProperties, type ReactNode } from 'react';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { TEXT_MONO_FALLBACK } from '../Text/TextSlice';
import { KbdThemeSlice, type KbdSliceState } from './KbdSlice';

/** @barrelExport */
export type KbdSize = 'sm' | 'md';

/**
 * Props for `<Kbd>`. A fixed shape like `<Text>`'s: no `style`/`className`,
 * no event handlers -- a key hint is display-only.
 */
export interface KbdProps extends AriaAttributes {
  /** A single key (`'Esc'`, `'⌘S'`). Ignored when `keys` is set. */
  children?: ReactNode;
  /**
   * A key combination, rendered as one key cap per entry joined by `+`
   * (`['Ctrl', 'K']` -> Ctrl + K), using the HTML spec's nested-`<kbd>`
   * form for a combination.
   */
  keys?: string[];
  /** @default 'md' */
  size?: KbdSize;
  /** Per-instance override for the key-cap appearance (`raised`/`flat`). */
  overrides?: Partial<KbdSliceState>;
  id?: string;
  title?: string;
}

const FONT_SIZE: Record<KbdSize, string> = {
  sm: 'var(--ai-text-size-xs, 0.75rem)',
  md: 'var(--ai-text-size-sm, 0.8125rem)',
};

function keyCapStyle(size: KbdSize): CSSProperties {
  return {
    display: 'inline-block',
    boxSizing: 'border-box',
    minWidth: '1.6em',
    padding: '0.0625rem 0.375rem',
    fontFamily: `var(--ai-text-font-mono, ${TEXT_MONO_FALLBACK})`,
    fontSize: FONT_SIZE[size],
    lineHeight: 1.4,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    color: 'var(--ai-text-primary, #111827)',
    background: 'var(--ai-bg-container, #f3f4f6)',
    borderStyle: 'solid',
    borderColor: 'var(--ai-border, #e5e7eb)',
    borderWidth: '0.0625rem 0.0625rem var(--ai-kbd-border-bottom-width, 0.125rem)',
    borderRadius: 'var(--ai-radius-sm, 0.25rem)',
  };
}

/**
 * @manifest Keyboard key or shortcut hint (`Esc`, `Ctrl` + `K`) as a themed key cap on a semantic `<kbd>`
 * @manifestCategory Data Display
 * @manifestAntiPatternAvoid A hand-styled `<kbd>` or `<span>` per call site for a shortcut hint
 * @manifestAntiPatternInstead `<Kbd>Esc</Kbd>`, or `<Kbd keys={['Ctrl', 'K']} />` for a combination
 */
export const Kbd: React.FC<KbdProps> = ({ children, keys, size = 'md', overrides, ...props }) => {
  const { vars } = useSliceOverrides(KbdThemeSlice, overrides);

  if (keys && keys.length > 0) {
    // Outer <kbd> = the combination; each inner <kbd> = one key. Only the
    // inner ones are drawn as caps.
    return (
      <kbd {...props} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', font: 'inherit', ...vars }}>
        {keys.map((k, i) => (
          <React.Fragment key={`${k}-${i}`}>
            {i > 0 && <span style={{ color: 'var(--ai-text-secondary, #6b7280)', fontSize: FONT_SIZE[size] }}>+</span>}
            <kbd style={keyCapStyle(size)}>{k}</kbd>
          </React.Fragment>
        ))}
      </kbd>
    );
  }

  return (
    <kbd {...props} style={{ ...keyCapStyle(size), ...vars }}>
      {children}
    </kbd>
  );
};

Kbd.displayName = 'Kbd';
