/** Semantic status colouring available on components that opt into it via `subtheme`. */
/** @barrelExport */
export type SubthemeName = 'error' | 'success' | 'warning' | 'info';

export interface SubthemeColors {
  /** The subtheme's accent colour — `var(--ai-subtheme-{name})`. */
  main: string;
  /** Background tint — `var(--ai-subtheme-{name}-bg)`. */
  background: string;
  /** Border colour — `var(--ai-subtheme-{name}-border)`. */
  border: string;
  /** Text colour for themed text on a neutral surface — `var(--ai-subtheme-{name}-text)`. */
  color: string;
  /** Readable text/icon colour for content filled directly on top of `main` (e.g. a solid badge/button) — `var(--ai-subtheme-{name}-on-main)`. Distinct from `color`, which targets a neutral surface, not `main` itself. */
  onMain: string;
}

/**
 * Resolves a `SubthemeName` to its CSS variable references. Every name has
 * a full `main`/`-bg`/`-border`/`-text` variable family generated globally
 * by `theme/harmonies.ts`'s `paletteToCSSVariables` — this is the single
 * place that knows the naming convention, replacing the hand-rolled
 * `` var(--ai-subtheme-${subtheme}) `` string interpolation previously
 * duplicated per-component (e.g. Button in `Form/FormComponents.tsx`).
 */
export function resolveSubtheme(subtheme: SubthemeName): SubthemeColors {
  return {
    main: `var(--ai-subtheme-${subtheme})`,
    background: `var(--ai-subtheme-${subtheme}-bg)`,
    border: `var(--ai-subtheme-${subtheme}-border)`,
    color: `var(--ai-subtheme-${subtheme}-text)`,
    onMain: `var(--ai-subtheme-${subtheme}-on-main)`,
  };
}
