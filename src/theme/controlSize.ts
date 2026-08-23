import { resolvePadding } from './padding';

/** @barrelExport */
export type ControlSize = 'sm' | 'md' | 'lg';

/**
 * The standardized fontSize for a given `size`, owned by the Typography
 * theme engine (`--ai-control-font-size-sm/md/lg`, `src/theme/typography.tsx`
 * — ratios of `masterFontSize`, not an independent value) rather than a
 * hardcoded literal here — moving the Theme Editor's Master Font Size
 * slider rescales every sized control's font together. Every sized
 * interactive control (Button, Input, Select, Combobox, ToggleGroup,
 * DatePicker, TimeField, ...) reads from this one table so instances at the
 * same `size` line up height-wise in a `<UIGroup>` row regardless of which
 * component renders each one. Each entry keeps the literal-rem value the
 * ratio resolves to at the default 16px master size as its own CSS
 * `var(..., fallback)` fallback, so `size` still resolves correctly even
 * outside a mounted `ToolcribProvider`.
 * @barrelExport
 */
export const CONTROL_FONT_SIZE_VAR: Record<ControlSize, string> = {
  sm: 'var(--ai-control-font-size-sm, 0.75rem)',
  md: 'var(--ai-control-font-size-md, 0.875rem)',
  lg: 'var(--ai-control-font-size-lg, 1rem)',
};

/**
 * Standardized padding for a control at a given `size`, for a component
 * that ALSO has its own dedicated, historically-tuned default (a
 * `--ai-*-padding` CSS variable via its own `ThemeSlice`) that should keep
 * working unchanged for the common, unsized case. Deliberately asymmetric:
 * `size: 'md'` (the default every existing, not-yet-updated consumer
 * already renders at) defers to that component's own `ownDefault` var
 * reference untouched, so adding `size` never changes anyone's current
 * output; `'sm'`/`'lg'` — new, opt-in — resolve through the same shared
 * global padding scale `<Button>` already used for its own sizing
 * (`resolvePadding`), so a `sm`/`lg` Input, Select, etc. lines up exactly
 * with a `sm`/`lg` Button in the same `<UIGroup>` row, both in the literal
 * rem values and in staying reactive to the same global `PaddingMode`.
 * @barrelExport
 */
export function resolveControlPadding(size: ControlSize, ownDefault: string): string {
  return size === 'md' ? ownDefault : resolvePadding(undefined, size);
}
