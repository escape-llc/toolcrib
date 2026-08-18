import type { ThemeContextType } from './themeContext';

/**
 * The one shared type + the only two functions that touch `ThemeContextType`
 * directly — `captureThemeSnapshot` (theme -> snapshot) and
 * `applyThemeSnapshot` (snapshot -> theme). Deliberately the *only* file
 * that knows about `ThemeContextType`'s setters.
 *
 * Every source of a `ThemeSnapshot` (a bundled preset in presetThemes.ts, a
 * saved entry in themeLibrary.ts's localStorage, an uploaded/downloaded
 * file in themeFileTransfer.ts) only ever produces or stores this same
 * plain-data shape — none of them import from this file's apply/capture
 * side, or from themeContext.tsx at all. The caller (ThemeEditor's UI) is
 * the one place that takes a snapshot from whichever source the user picked
 * and hands it to `applyThemeSnapshot` — so adding a new source later (e.g.
 * a remote URL) never needs to touch this file, and this file never needs
 * to know where a snapshot came from.
 */

type SnapshotStateKeys =
  | 'parameters'
  | 'tableState'
  | 'animationState'
  | 'tabState'
  | 'drawerState'
  | 'accordionState'
  | 'cardState'
  | 'tooltipState'
  | 'buttonState'
  | 'inputState'
  | 'toggleControlState'
  | 'selectState'
  | 'radioGroupState'
  | 'sliderState'
  | 'modalState'
  | 'alertDialogState'
  | 'popupState'
  | 'toastState'
  | 'dropdownMenuState'
  | 'contextMenuState'
  | 'progressState'
  | 'separatorState'
  | 'avatarState'
  | 'toggleState'
  | 'collapsibleState'
  | 'uiGroupState'
  | 'toolbarState'
  | 'appShellState'
  | 'typographyState';

// Each field optional (a preset may only care about `parameters`) AND its
// own value type partial (a preset may only care about `baseColor` within
// `parameters`) — plain `Partial<Pick<...>>` only achieves the former.
type DeepPartialPick<T, K extends keyof T> = {
  [P in K]?: Partial<T[P]>;
};

/** @barrelExport */
export interface ThemeSnapshot extends DeepPartialPick<ThemeContextType, SnapshotStateKeys> {
  /** Bumped only if this shape ever changes incompatibly — lets `isThemeSnapshotLike` reject snapshots from a future/unknown format instead of silently half-applying them. */
  schemaVersion: 1;
  /** Display name, set when saved into the theme library (themeLibrary.ts) or exported to a file. */
  name?: string;
  /** ISO timestamp, set when captured. */
  savedAt?: string;
}

const SLICE_KEYS: Exclude<SnapshotStateKeys, 'parameters'>[] = [
  'tableState', 'animationState', 'tabState', 'drawerState', 'accordionState',
  'cardState', 'tooltipState', 'buttonState', 'inputState', 'toggleControlState',
  'selectState', 'radioGroupState', 'sliderState', 'modalState', 'alertDialogState',
  'popupState', 'toastState', 'dropdownMenuState', 'contextMenuState', 'progressState',
  'separatorState', 'avatarState', 'toggleState', 'collapsibleState', 'uiGroupState',
  'toolbarState', 'appShellState', 'typographyState',
];

/**
 * Structural check only — not a deep, field-by-field schema. Every value
 * this toolkit reads eventually resolves through a `var(--x, fallback)` CSS
 * custom property, so a malformed or unrecognized field inside an
 * otherwise-valid slice object degrades to that fallback harmlessly rather
 * than crashing anything; the actual risk worth guarding against is "this
 * isn't a theme snapshot at all" (wrong file, corrupted JSON, a future
 * incompatible schemaVersion), which this does catch.
 */
export function isThemeSnapshotLike(data: unknown): data is ThemeSnapshot {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.schemaVersion !== 1) return false;
  if (d.parameters !== undefined && (typeof d.parameters !== 'object' || d.parameters === null)) return false;
  for (const key of SLICE_KEYS) {
    if (d[key] !== undefined && (typeof d[key] !== 'object' || d[key] === null)) return false;
  }
  return true;
}

/** Captures the theme's current live state (every field, not a partial) into a snapshot — the source for "save"/"export". */
export function captureThemeSnapshot(theme: ThemeContextType, name?: string): ThemeSnapshot {
  return {
    schemaVersion: 1,
    name,
    savedAt: new Date().toISOString(),
    parameters: theme.parameters,
    tableState: theme.tableState,
    animationState: theme.animationState,
    tabState: theme.tabState,
    drawerState: theme.drawerState,
    accordionState: theme.accordionState,
    cardState: theme.cardState,
    tooltipState: theme.tooltipState,
    buttonState: theme.buttonState,
    inputState: theme.inputState,
    toggleControlState: theme.toggleControlState,
    selectState: theme.selectState,
    radioGroupState: theme.radioGroupState,
    sliderState: theme.sliderState,
    modalState: theme.modalState,
    alertDialogState: theme.alertDialogState,
    popupState: theme.popupState,
    toastState: theme.toastState,
    dropdownMenuState: theme.dropdownMenuState,
    contextMenuState: theme.contextMenuState,
    progressState: theme.progressState,
    separatorState: theme.separatorState,
    avatarState: theme.avatarState,
    toggleState: theme.toggleState,
    collapsibleState: theme.collapsibleState,
    uiGroupState: theme.uiGroupState,
    toolbarState: theme.toolbarState,
    appShellState: theme.appShellState,
    typographyState: theme.typographyState,
  };
}

/**
 * Applies a snapshot from *any* source uniformly, field by field — only
 * ever calling this toolkit's own already-public setters (never reaching
 * into ThemeProvider's internals), and only for fields the snapshot
 * actually specifies, so a partial snapshot (e.g. a preset with only
 * `parameters.baseColor`) leaves everything else at its current value
 * instead of resetting it.
 */
export function applyThemeSnapshot(theme: ThemeContextType, snapshot: ThemeSnapshot): void {
  const p = snapshot.parameters;
  if (p) {
    if (p.baseColor) theme.setBaseColor(p.baseColor);
    if (p.harmonyMode) theme.setHarmonyMode(p.harmonyMode);
    if (typeof p.hueSpread === 'number') theme.setHueSpread(p.hueSpread);
    if (typeof p.darkenLightenFactor === 'number') theme.setDarkenLightenFactor(p.darkenLightenFactor);
    if (typeof p.saturationFactor === 'number') theme.setSaturationFactor(p.saturationFactor);
    if (p.paddingMode) theme.setPaddingMode(p.paddingMode);
    if (p.marginMode) theme.setMarginMode(p.marginMode);
    if (p.cornerRadiusMode) theme.setCornerRadiusMode(p.cornerRadiusMode);
    if (p.shadowMode) theme.setShadowMode(p.shadowMode);
    if (typeof p.isDarkMode === 'boolean') theme.setDarkMode(p.isDarkMode);
  }
  if (snapshot.tableState) theme.setTableState(snapshot.tableState);
  if (snapshot.animationState) theme.setAnimationState(snapshot.animationState);
  if (snapshot.tabState) theme.setTabState(snapshot.tabState);
  if (snapshot.drawerState) theme.setDrawerState(snapshot.drawerState);
  if (snapshot.accordionState) theme.setAccordionState(snapshot.accordionState);
  if (snapshot.cardState) theme.setCardState(snapshot.cardState);
  if (snapshot.tooltipState) theme.setTooltipState(snapshot.tooltipState);
  if (snapshot.buttonState) theme.setButtonState(snapshot.buttonState);
  if (snapshot.inputState) theme.setInputState(snapshot.inputState);
  if (snapshot.toggleControlState) theme.setToggleControlState(snapshot.toggleControlState);
  if (snapshot.selectState) theme.setSelectState(snapshot.selectState);
  if (snapshot.radioGroupState) theme.setRadioGroupState(snapshot.radioGroupState);
  if (snapshot.sliderState) theme.setSliderState(snapshot.sliderState);
  if (snapshot.modalState) theme.setModalState(snapshot.modalState);
  if (snapshot.alertDialogState) theme.setAlertDialogState(snapshot.alertDialogState);
  if (snapshot.popupState) theme.setPopupState(snapshot.popupState);
  if (snapshot.toastState) theme.setToastState(snapshot.toastState);
  if (snapshot.dropdownMenuState) theme.setDropdownMenuState(snapshot.dropdownMenuState);
  if (snapshot.contextMenuState) theme.setContextMenuState(snapshot.contextMenuState);
  if (snapshot.progressState) theme.setProgressState(snapshot.progressState);
  if (snapshot.separatorState) theme.setSeparatorState(snapshot.separatorState);
  if (snapshot.avatarState) theme.setAvatarState(snapshot.avatarState);
  if (snapshot.toggleState) theme.setToggleState(snapshot.toggleState);
  if (snapshot.collapsibleState) theme.setCollapsibleState(snapshot.collapsibleState);
  if (snapshot.uiGroupState) theme.setUIGroupState(snapshot.uiGroupState);
  if (snapshot.toolbarState) theme.setToolbarState(snapshot.toolbarState);
  if (snapshot.appShellState) theme.setAppShellState(snapshot.appShellState);
  if (snapshot.typographyState) theme.setTypographyState(snapshot.typographyState);
}
