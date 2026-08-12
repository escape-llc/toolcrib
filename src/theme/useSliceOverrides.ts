import { ThemeSlice, getSparseVariables } from './slice';
import { useStyleDomain } from './StyleDomainContext';
import { SubthemeName } from './subtheme';

/** @barrelExport */
export interface SliceOverridesResult<TVars extends Record<string, string>> {
  /** Sparse CSS-variable patch — spread into the component's own root `style`. */
  vars: Partial<TVars>;
  /** Resolved subtheme: the override's own `subtheme` if given, else the nearest `<StyleDomainProvider>`'s, else none. */
  subtheme: SubthemeName | undefined;
}

/**
 * Resolves a component's subtheme: its own explicit value if given, else
 * the nearest ancestor `<StyleDomainProvider>`'s, else none. Standalone
 * because not every component that wants subtheme colouring (e.g.
 * `Button`) has — or needs — a full registered `ThemeSlice` for other
 * axes; `useSliceOverrides` below calls this internally for components
 * that have both.
 */
export function useResolvedSubtheme(instanceSubtheme?: SubthemeName): SubthemeName | undefined {
  const domain = useStyleDomain();
  return instanceSubtheme ?? domain?.subtheme ?? undefined;
}

/**
 * Resolves a migrated component's `overrides` prop into (a) the sparse
 * CSS-variable patch for its registered `ThemeSlice`'s own axes (e.g.
 * Card's `padding`/`headerStyle`), via `getSparseVariables`, and (b) the
 * resolved subtheme (instance beats style domain). One hook, reused by
 * every migrated component — not component-specific.
 */
export function useSliceOverrides<TState, TVars extends Record<string, string>>(
  slice: ThemeSlice<TState, TVars>,
  overrides?: Partial<TState> & { subtheme?: SubthemeName }
): SliceOverridesResult<TVars> {
  const { subtheme: instanceSubtheme, ...stateOverrides } = (overrides ?? {}) as Partial<TState> & {
    subtheme?: SubthemeName;
  };
  const subtheme = useResolvedSubtheme(instanceSubtheme);
  const hasStateOverrides = Object.keys(stateOverrides).length > 0;
  const vars = hasStateOverrides ? getSparseVariables(slice, stateOverrides as Partial<TState>) : {};

  return { vars, subtheme };
}
