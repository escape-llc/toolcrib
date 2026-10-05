/**
 * className for a React Aria part that should draw the toolkit's focus ring.
 * A plain `className="ai-focus-ring"` would replace the part's own default
 * class (`react-aria-Group`, `react-aria-CalendarCell`, ...), which React Aria's
 * docs and this repo's tests key on; a function receives it and keeps it.
 */
export const focusRingClassName = ({ defaultClassName }: { defaultClassName?: string }): string =>
  defaultClassName ? `${defaultClassName} ai-focus-ring` : 'ai-focus-ring';
