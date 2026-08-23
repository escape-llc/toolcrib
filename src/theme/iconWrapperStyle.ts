import { type CSSProperties } from 'react';

/**
 * Normalizes a bare icon child so it can't stretch the flex container
 * around it taller than an icon-less sibling — a symbol/emoji glyph often
 * falls back to a different font with taller ascent/descent metrics than
 * the surrounding label text, and `lineHeight: 1` clips the icon's own
 * box down to its content instead of that fallback font's full line box.
 * Spread this as the base of an icon slot's own `style`, adding whatever
 * else that slot needs on top (`fontSize`, `justifyContent`, ...) — see
 * `Badge` and `Button` (`FormComponents.tsx`) for the two call sites this
 * was extracted from.
 * @barrelExport
 */
export const ICON_WRAPPER_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  lineHeight: 1,
};
