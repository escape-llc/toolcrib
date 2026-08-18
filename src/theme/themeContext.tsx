import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { HSVColor } from './hsv';
import {
  HarmonyMode,
  ThemeParameters,
  GeneratedPalette,
  generateHarmonyPalette,
  paletteToCSSVariables,
} from './harmonies';
import { PaddingMode, PaddingThemeSlice } from './padding';
import { MarginMode, MarginThemeSlice } from './margin';
import { CornerRadiusMode, RadiusThemeSlice } from './radius';
import { ShadowMode, ShadowThemeSlice } from './shadow';
import { DataTableThemeSlice, TableSliceState } from '../components/DataTable/DataTableSlice';
import { AnimationThemeSlice, AnimationSliceState, defaultAnimationState } from './animation';
import { TabThemeSlice, TabSliceState, defaultTabState } from '../components/TabStrip/TabSlice';
import { DrawerThemeSlice, DrawerSliceState, defaultDrawerState } from '../components/Overlay/DrawerSlice';
import { AccordionThemeSlice, AccordionSliceState, defaultAccordionState } from '../components/Accordion/AccordionSlice';
import { CardThemeSlice, CardSliceState, defaultCardState } from '../components/Card/CardSlice';
import { TooltipThemeSlice, TooltipSliceState, defaultTooltipState } from '../components/Tooltip/TooltipSlice';
import { ButtonThemeSlice, ButtonSliceState, defaultButtonState } from '../components/Form/ButtonSlice';
import { InputThemeSlice, InputSliceState, defaultInputState } from '../components/Form/InputSlice';
import { ToggleControlThemeSlice, ToggleControlSliceState, defaultToggleControlState } from '../components/Form/ToggleControlSlice';
import { SelectThemeSlice, SelectSliceState, defaultSelectState } from '../components/Form/SelectSlice';
import { RadioGroupThemeSlice, RadioGroupSliceState, defaultRadioGroupState } from '../components/Form/RadioGroupSlice';
import { SliderThemeSlice, SliderSliceState, defaultSliderState } from '../components/Form/SliderSlice';
import { ModalThemeSlice, ModalSliceState, defaultModalState } from '../components/Overlay/ModalSlice';
import { AlertDialogThemeSlice, AlertDialogSliceState, defaultAlertDialogState } from '../components/AlertDialog/AlertDialogSlice';
import { PopupThemeSlice, PopupSliceState, defaultPopupState } from '../components/Overlay/PopupSlice';
import { ToastThemeSlice, ToastSliceState, defaultToastState } from '../components/Toast/ToastSlice';
import { DropdownMenuThemeSlice, DropdownMenuSliceState, defaultDropdownMenuState } from '../components/DropdownMenu/DropdownMenuSlice';
import { ContextMenuThemeSlice, ContextMenuSliceState, defaultContextMenuState } from '../components/ContextMenu/ContextMenuSlice';
import { ProgressThemeSlice, ProgressSliceState, defaultProgressState } from '../components/Progress/ProgressSlice';
import { SeparatorThemeSlice, SeparatorSliceState, defaultSeparatorState } from '../components/Separator/SeparatorSlice';
import { AvatarThemeSlice, AvatarSliceState, defaultAvatarState } from '../components/Avatar/AvatarSlice';
import { ToggleThemeSlice, ToggleSliceState, defaultToggleState } from '../components/ToggleGroup/ToggleSlice';
import { CollapsibleThemeSlice, CollapsibleSliceState, defaultCollapsibleState } from '../components/Collapsible/CollapsibleSlice';
import { UIGroupThemeSlice, UIGroupSliceState, defaultUIGroupState } from '../components/UIGroup/UIGroupSlice';
import { ToolbarThemeSlice, ToolbarSliceState, defaultToolbarState } from '../components/Toolbar/ToolbarSlice';
import { AppShellThemeSlice, AppShellSliceState, defaultAppShellState } from '../components/AppShell/AppShellSlice';
import { TypographyThemeSlice, TypographySliceState, defaultTypographyState } from './typography';
import { globalThemeSliceRegistry } from './slice';
import { aiBus } from '../eventBus/eventBus';
import { injectGlobalStyle } from './injectGlobalStyle';
import { injectSharedAnimationKeyframes } from './animationKeyframes';
import { TargetDocumentContext } from './targetDocumentContext';

// Register standard theme slices
globalThemeSliceRegistry.register(PaddingThemeSlice);
globalThemeSliceRegistry.register(MarginThemeSlice);
globalThemeSliceRegistry.register(RadiusThemeSlice);
globalThemeSliceRegistry.register(ShadowThemeSlice);
globalThemeSliceRegistry.register(DataTableThemeSlice);
globalThemeSliceRegistry.register(AnimationThemeSlice);
globalThemeSliceRegistry.register(TabThemeSlice);
globalThemeSliceRegistry.register(DrawerThemeSlice);
globalThemeSliceRegistry.register(AccordionThemeSlice);
globalThemeSliceRegistry.register(CardThemeSlice);
globalThemeSliceRegistry.register(TooltipThemeSlice);
globalThemeSliceRegistry.register(ButtonThemeSlice);
globalThemeSliceRegistry.register(InputThemeSlice);
globalThemeSliceRegistry.register(ToggleControlThemeSlice);
globalThemeSliceRegistry.register(SelectThemeSlice);
globalThemeSliceRegistry.register(RadioGroupThemeSlice);
globalThemeSliceRegistry.register(SliderThemeSlice);
globalThemeSliceRegistry.register(ModalThemeSlice);
globalThemeSliceRegistry.register(AlertDialogThemeSlice);
globalThemeSliceRegistry.register(PopupThemeSlice);
globalThemeSliceRegistry.register(ToastThemeSlice);
globalThemeSliceRegistry.register(DropdownMenuThemeSlice);
globalThemeSliceRegistry.register(ContextMenuThemeSlice);
globalThemeSliceRegistry.register(ProgressThemeSlice);
globalThemeSliceRegistry.register(SeparatorThemeSlice);
globalThemeSliceRegistry.register(AvatarThemeSlice);
globalThemeSliceRegistry.register(ToggleThemeSlice);
globalThemeSliceRegistry.register(CollapsibleThemeSlice);
globalThemeSliceRegistry.register(UIGroupThemeSlice);
globalThemeSliceRegistry.register(ToolbarThemeSlice);
globalThemeSliceRegistry.register(AppShellThemeSlice);
globalThemeSliceRegistry.register(TypographyThemeSlice);

/** @barrelExport */
export interface ThemeContextType {
  parameters: ThemeParameters & { shadowMode?: ShadowMode };
  tableState: TableSliceState;
  animationState: AnimationSliceState;
  tabState: TabSliceState;
  drawerState: DrawerSliceState;
  accordionState: AccordionSliceState;
  cardState: CardSliceState;
  tooltipState: TooltipSliceState;
  buttonState: ButtonSliceState;
  inputState: InputSliceState;
  toggleControlState: ToggleControlSliceState;
  selectState: SelectSliceState;
  radioGroupState: RadioGroupSliceState;
  sliderState: SliderSliceState;
  modalState: ModalSliceState;
  alertDialogState: AlertDialogSliceState;
  popupState: PopupSliceState;
  toastState: ToastSliceState;
  dropdownMenuState: DropdownMenuSliceState;
  contextMenuState: ContextMenuSliceState;
  progressState: ProgressSliceState;
  separatorState: SeparatorSliceState;
  avatarState: AvatarSliceState;
  toggleState: ToggleSliceState;
  collapsibleState: CollapsibleSliceState;
  uiGroupState: UIGroupSliceState;
  toolbarState: ToolbarSliceState;
  appShellState: AppShellSliceState;
  typographyState: TypographySliceState;
  palette: GeneratedPalette;
  cssVariables: Record<string, string>;
  setBaseColor: (color: HSVColor) => void;
  setHarmonyMode: (mode: HarmonyMode) => void;
  setHueSpread: (spread: number) => void;
  setDarkenLightenFactor: (factor: number) => void;
  setSaturationFactor: (factor: number) => void;
  setPaddingMode: (mode: PaddingMode) => void;
  setMarginMode: (mode: MarginMode) => void;
  setCornerRadiusMode: (mode: CornerRadiusMode) => void;
  setShadowMode: (mode: ShadowMode) => void;
  setTableState: (state: Partial<TableSliceState>) => void;
  setAnimationState: (state: Partial<AnimationSliceState>) => void;
  setTabState: (state: Partial<TabSliceState>) => void;
  setDrawerState: (state: Partial<DrawerSliceState>) => void;
  setAccordionState: (state: Partial<AccordionSliceState>) => void;
  setCardState: (state: Partial<CardSliceState>) => void;
  setTooltipState: (state: Partial<TooltipSliceState>) => void;
  setButtonState: (state: Partial<ButtonSliceState>) => void;
  setInputState: (state: Partial<InputSliceState>) => void;
  setToggleControlState: (state: Partial<ToggleControlSliceState>) => void;
  setSelectState: (state: Partial<SelectSliceState>) => void;
  setRadioGroupState: (state: Partial<RadioGroupSliceState>) => void;
  setSliderState: (state: Partial<SliderSliceState>) => void;
  setModalState: (state: Partial<ModalSliceState>) => void;
  setAlertDialogState: (state: Partial<AlertDialogSliceState>) => void;
  setPopupState: (state: Partial<PopupSliceState>) => void;
  setToastState: (state: Partial<ToastSliceState>) => void;
  setDropdownMenuState: (state: Partial<DropdownMenuSliceState>) => void;
  setContextMenuState: (state: Partial<ContextMenuSliceState>) => void;
  setProgressState: (state: Partial<ProgressSliceState>) => void;
  setSeparatorState: (state: Partial<SeparatorSliceState>) => void;
  setAvatarState: (state: Partial<AvatarSliceState>) => void;
  setToggleState: (state: Partial<ToggleSliceState>) => void;
  setCollapsibleState: (state: Partial<CollapsibleSliceState>) => void;
  setUIGroupState: (state: Partial<UIGroupSliceState>) => void;
  setToolbarState: (state: Partial<ToolbarSliceState>) => void;
  setAppShellState: (state: Partial<AppShellSliceState>) => void;
  setTypographyState: (state: Partial<TypographySliceState>) => void;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
}

const defaultParameters: ThemeParameters & { shadowMode: ShadowMode } = {
  // Matches presetThemes.ts's 'tailwind' preset — Tailwind CSS's blue-500
  // (#3b82f6) converted to HSV, light mode. Not derived from that preset
  // programmatically (see presetThemes.ts's header comment: presets are
  // pure bundled data with no dependency on this file); kept in sync by
  // hand, same as every preset here always has been.
  baseColor: { h: 217, s: 76, v: 96 },
  harmonyMode: 'analogous',
  hueSpread: 30,
  darkenLightenFactor: 1.0,
  saturationFactor: 1.0,
  paddingMode: 'normal',
  marginMode: 'normal',
  cornerRadiusMode: 'rounded',
  shadowMode: 'subtle',
  isDarkMode: false,
};

const defaultTableState: TableSliceState = {
  density: 'normal',
  borderStyle: 'horizontal',
  striped: true,
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export interface ThemeProviderProps {
  children: ReactNode;
  initialParameters?: Partial<ThemeParameters & { shadowMode?: ShadowMode }>;
  initialTableState?: Partial<TableSliceState>;
  initialAnimationState?: Partial<AnimationSliceState>;
  initialTabState?: Partial<TabSliceState>;
  initialDrawerState?: Partial<DrawerSliceState>;
  initialAccordionState?: Partial<AccordionSliceState>;
  initialCardState?: Partial<CardSliceState>;
  initialTooltipState?: Partial<TooltipSliceState>;
  initialButtonState?: Partial<ButtonSliceState>;
  initialInputState?: Partial<InputSliceState>;
  initialToggleControlState?: Partial<ToggleControlSliceState>;
  initialSelectState?: Partial<SelectSliceState>;
  initialRadioGroupState?: Partial<RadioGroupSliceState>;
  initialSliderState?: Partial<SliderSliceState>;
  initialModalState?: Partial<ModalSliceState>;
  initialAlertDialogState?: Partial<AlertDialogSliceState>;
  initialPopupState?: Partial<PopupSliceState>;
  initialToastState?: Partial<ToastSliceState>;
  initialDropdownMenuState?: Partial<DropdownMenuSliceState>;
  initialContextMenuState?: Partial<ContextMenuSliceState>;
  initialProgressState?: Partial<ProgressSliceState>;
  initialSeparatorState?: Partial<SeparatorSliceState>;
  initialAvatarState?: Partial<AvatarSliceState>;
  initialToggleState?: Partial<ToggleSliceState>;
  initialCollapsibleState?: Partial<CollapsibleSliceState>;
  initialUIGroupState?: Partial<UIGroupSliceState>;
  initialToolbarState?: Partial<ToolbarSliceState>;
  initialAppShellState?: Partial<AppShellSliceState>;
  initialTypographyState?: Partial<TypographySliceState>;
  /**
   * The `Document` whose `<html>` element gets this provider's CSS custom
   * properties. Defaults to the global `document` — correct for the
   * overwhelmingly common case of one `ThemeProvider` at the root of an
   * app. Pass a different `Document` explicitly (e.g. an `<iframe>`'s own
   * `contentDocument`) when portaling a second, independent
   * `ThemeProvider` instance into a different document's DOM — using the
   * default here would inject that instance's variables onto the
   * *outer* page's `<html>` instead of the iframe's own `:root`, silently
   * fighting with (and corrupting) whichever `ThemeProvider` owns the
   * outer page, since `document` always resolves to it regardless of
   * where the component instance actually renders.
   */
  targetDocument?: Document;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialParameters,
  initialTableState,
  initialAnimationState,
  initialTabState,
  initialDrawerState,
  initialAccordionState,
  initialCardState,
  initialTooltipState,
  initialButtonState,
  initialInputState,
  initialToggleControlState,
  initialSelectState,
  initialRadioGroupState,
  initialSliderState,
  initialModalState,
  initialAlertDialogState,
  initialPopupState,
  initialToastState,
  initialDropdownMenuState,
  initialContextMenuState,
  initialProgressState,
  initialSeparatorState,
  initialAvatarState,
  initialToggleState,
  initialCollapsibleState,
  initialUIGroupState,
  initialToolbarState,
  initialAppShellState,
  initialTypographyState,
  targetDocument,
}) => {
  const [parameters, setParameters] = useState<ThemeParameters & { shadowMode?: ShadowMode }>({
    ...defaultParameters,
    ...initialParameters,
  });

  const [tableState, setTableStateInternal] = useState<TableSliceState>({
    ...defaultTableState,
    ...initialTableState,
  });

  const [animationState, setAnimationStateInternal] = useState<AnimationSliceState>({
    ...defaultAnimationState,
    ...initialAnimationState,
  });

  const [tabState, setTabStateInternal] = useState<TabSliceState>({
    ...defaultTabState,
    ...initialTabState,
  });

  const [drawerState, setDrawerStateInternal] = useState<DrawerSliceState>({
    ...defaultDrawerState,
    ...initialDrawerState,
  });

  const [accordionState, setAccordionStateInternal] = useState<AccordionSliceState>({
    ...defaultAccordionState,
    ...initialAccordionState,
  });

  const [cardState, setCardStateInternal] = useState<CardSliceState>({
    ...defaultCardState,
    ...initialCardState,
  });

  const [tooltipState, setTooltipStateInternal] = useState<TooltipSliceState>({
    ...defaultTooltipState,
    ...initialTooltipState,
  });

  const [buttonState, setButtonStateInternal] = useState<ButtonSliceState>({
    ...defaultButtonState,
    ...initialButtonState,
  });

  const [inputState, setInputStateInternal] = useState<InputSliceState>({
    ...defaultInputState,
    ...initialInputState,
  });

  const [toggleControlState, setToggleControlStateInternal] = useState<ToggleControlSliceState>({
    ...defaultToggleControlState,
    ...initialToggleControlState,
  });

  const [selectState, setSelectStateInternal] = useState<SelectSliceState>({
    ...defaultSelectState,
    ...initialSelectState,
  });

  const [radioGroupState, setRadioGroupStateInternal] = useState<RadioGroupSliceState>({
    ...defaultRadioGroupState,
    ...initialRadioGroupState,
  });

  const [sliderState, setSliderStateInternal] = useState<SliderSliceState>({
    ...defaultSliderState,
    ...initialSliderState,
  });

  const [modalState, setModalStateInternal] = useState<ModalSliceState>({
    ...defaultModalState,
    ...initialModalState,
  });

  const [alertDialogState, setAlertDialogStateInternal] = useState<AlertDialogSliceState>({
    ...defaultAlertDialogState,
    ...initialAlertDialogState,
  });

  const [popupState, setPopupStateInternal] = useState<PopupSliceState>({
    ...defaultPopupState,
    ...initialPopupState,
  });

  const [toastState, setToastStateInternal] = useState<ToastSliceState>({
    ...defaultToastState,
    ...initialToastState,
  });

  const [dropdownMenuState, setDropdownMenuStateInternal] = useState<DropdownMenuSliceState>({
    ...defaultDropdownMenuState,
    ...initialDropdownMenuState,
  });

  const [contextMenuState, setContextMenuStateInternal] = useState<ContextMenuSliceState>({
    ...defaultContextMenuState,
    ...initialContextMenuState,
  });

  const [progressState, setProgressStateInternal] = useState<ProgressSliceState>({
    ...defaultProgressState,
    ...initialProgressState,
  });

  const [separatorState, setSeparatorStateInternal] = useState<SeparatorSliceState>({
    ...defaultSeparatorState,
    ...initialSeparatorState,
  });

  const [avatarState, setAvatarStateInternal] = useState<AvatarSliceState>({
    ...defaultAvatarState,
    ...initialAvatarState,
  });

  const [toggleState, setToggleStateInternal] = useState<ToggleSliceState>({
    ...defaultToggleState,
    ...initialToggleState,
  });

  const [collapsibleState, setCollapsibleStateInternal] = useState<CollapsibleSliceState>({
    ...defaultCollapsibleState,
    ...initialCollapsibleState,
  });

  const [uiGroupState, setUIGroupStateInternal] = useState<UIGroupSliceState>({
    ...defaultUIGroupState,
    ...initialUIGroupState,
  });

  const [toolbarState, setToolbarStateInternal] = useState<ToolbarSliceState>({
    ...defaultToolbarState,
    ...initialToolbarState,
  });

  const [appShellState, setAppShellStateInternal] = useState<AppShellSliceState>({
    ...defaultAppShellState,
    ...initialAppShellState,
  });

  const [typographyState, setTypographyStateInternal] = useState<TypographySliceState>({
    ...defaultTypographyState,
    ...initialTypographyState,
  });

  const palette = useMemo(() => {
    return generateHarmonyPalette(parameters);
  }, [parameters]);

  const cssVariables = useMemo(() => {
    const baseVars = paletteToCSSVariables(
      palette,
      parameters.paddingMode,
      parameters.cornerRadiusMode,
      parameters.marginMode || 'normal'
    );
    const sliceVars = globalThemeSliceRegistry.computeAllVariables({
      padding: parameters.paddingMode,
      margin: parameters.marginMode,
      radius: parameters.cornerRadiusMode,
      shadow: parameters.shadowMode,
      table: tableState,
      animation: animationState,
      tab: tabState,
      drawer: drawerState,
      accordion: accordionState,
      card: cardState,
      tooltip: tooltipState,
      button: buttonState,
      input: inputState,
      togglecontrol: toggleControlState,
      select: selectState,
      radiogroup: radioGroupState,
      slider: sliderState,
      modal: modalState,
      alertdialog: alertDialogState,
      popup: popupState,
      toast: toastState,
      dropdownmenu: dropdownMenuState,
      contextmenu: contextMenuState,
      progress: progressState,
      separator: separatorState,
      avatar: avatarState,
      toggle: toggleState,
      collapsible: collapsibleState,
      uigroup: uiGroupState,
      toolbar: toolbarState,
      appshell: appShellState,
      typography: typographyState,
    });
    return { ...baseVars, ...sliceVars };
  }, [
    palette,
    parameters,
    tableState,
    animationState,
    tabState,
    drawerState,
    accordionState,
    cardState,
    tooltipState,
    buttonState,
    inputState,
    toggleControlState,
    selectState,
    radioGroupState,
    sliderState,
    modalState,
    alertDialogState,
    popupState,
    toastState,
    dropdownMenuState,
    contextMenuState,
    progressState,
    separatorState,
    avatarState,
    toggleState,
    collapsibleState,
    uiGroupState,
    toolbarState,
    appShellState,
    typographyState,
  ]);

  // Inject CSS variables into root document element
  useEffect(() => {
    const root = (targetDocument ?? document).documentElement;
    Object.entries(cssVariables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Notify Event Bus of theme change
    aiBus.emit('theme:changed', { parameters, palette, cssVariables });
  }, [cssVariables, parameters, palette, targetDocument]);

  // `--ai-font-family`/`--ai-master-font-size` above are written as CSS
  // custom properties on :root, but a custom property alone does nothing
  // — nothing actually *uses* `var(--ai-font-family)`/
  // `var(--ai-master-font-size)` as a real `font-family`/`font-size`
  // unless some rule references it. That rule used to live only in the
  // demo app's own index.css; a real consumer got the variables updating
  // correctly (visible via devtools) with zero visual effect anywhere,
  // including on this toolkit's own `rem`-based sizing throughout every
  // component, which can only ever scale via :root's actual resolved
  // font-size (that's inherent to what `rem` means — no scoped rule can
  // substitute for it). One rule, injected once per target document
  // (typically once total — the common case is a single ThemeProvider).
  useEffect(() => {
    injectGlobalStyle(
      'toolcrib-typography-base',
      `:root { font-family: var(--ai-font-family, Inter, system-ui, Avenir, Helvetica, Arial, sans-serif); font-size: var(--ai-master-font-size, 16px); }`,
      targetDocument
    );
  }, [targetDocument]);

  // injectSharedAnimationKeyframes() (animationKeyframes.ts) already runs
  // eagerly, once, the moment the package is first imported — but that
  // call happens before any component (including this one) has rendered,
  // so it has no way to know about a `targetDocument` and only ever
  // reaches the global `document`. That's the right default (Modal/
  // Drawer/etc.'s entrance animations work with zero ThemeProvider
  // involvement), but it means the one case this component *does* know
  // about — a `targetDocument` pointing somewhere else entirely, e.g. an
  // <iframe>'s own document via ReactDOM.createPortal — would otherwise
  // never get its own copy of these keyframes, silently. Calling it again
  // here is a harmless no-op for the common case (idempotent, guarded by
  // injectGlobalStyle's per-document getElementById check) and the actual
  // fix for the portaled one.
  useEffect(() => {
    injectSharedAnimationKeyframes(targetDocument);
  }, [targetDocument]);

  const setBaseColor = (baseColor: HSVColor) => setParameters(p => ({ ...p, baseColor }));
  const setHarmonyMode = (harmonyMode: HarmonyMode) => setParameters(p => ({ ...p, harmonyMode }));
  const setHueSpread = (hueSpread: number) => setParameters(p => ({ ...p, hueSpread }));
  const setDarkenLightenFactor = (darkenLightenFactor: number) => setParameters(p => ({ ...p, darkenLightenFactor }));
  const setSaturationFactor = (saturationFactor: number) => setParameters(p => ({ ...p, saturationFactor }));
  const setPaddingMode = (paddingMode: PaddingMode) => setParameters(p => ({ ...p, paddingMode }));
  const setMarginMode = (marginMode: MarginMode) => setParameters(p => ({ ...p, marginMode }));
  const setCornerRadiusMode = (cornerRadiusMode: CornerRadiusMode) => setParameters(p => ({ ...p, cornerRadiusMode }));
  const setShadowMode = (shadowMode: ShadowMode) => setParameters(p => ({ ...p, shadowMode }));
  const setTableState = (update: Partial<TableSliceState>) => setTableStateInternal(prev => ({ ...prev, ...update }));
  const setAnimationState = (update: Partial<AnimationSliceState>) => setAnimationStateInternal(prev => ({ ...prev, ...update }));
  const setTabState = (update: Partial<TabSliceState>) => setTabStateInternal(prev => ({ ...prev, ...update }));
  const setDrawerState = (update: Partial<DrawerSliceState>) => setDrawerStateInternal(prev => ({ ...prev, ...update }));
  const setAccordionState = (update: Partial<AccordionSliceState>) => setAccordionStateInternal(prev => ({ ...prev, ...update }));
  const setCardState = (update: Partial<CardSliceState>) => setCardStateInternal(prev => ({ ...prev, ...update }));
  const setTooltipState = (update: Partial<TooltipSliceState>) => setTooltipStateInternal(prev => ({ ...prev, ...update }));
  const setButtonState = (update: Partial<ButtonSliceState>) => setButtonStateInternal(prev => ({ ...prev, ...update }));
  const setInputState = (update: Partial<InputSliceState>) => setInputStateInternal(prev => ({ ...prev, ...update }));
  const setToggleControlState = (update: Partial<ToggleControlSliceState>) => setToggleControlStateInternal(prev => ({ ...prev, ...update }));
  const setSelectState = (update: Partial<SelectSliceState>) => setSelectStateInternal(prev => ({ ...prev, ...update }));
  const setRadioGroupState = (update: Partial<RadioGroupSliceState>) => setRadioGroupStateInternal(prev => ({ ...prev, ...update }));
  const setSliderState = (update: Partial<SliderSliceState>) => setSliderStateInternal(prev => ({ ...prev, ...update }));
  const setModalState = (update: Partial<ModalSliceState>) => setModalStateInternal(prev => ({ ...prev, ...update }));
  const setAlertDialogState = (update: Partial<AlertDialogSliceState>) => setAlertDialogStateInternal(prev => ({ ...prev, ...update }));
  const setPopupState = (update: Partial<PopupSliceState>) => setPopupStateInternal(prev => ({ ...prev, ...update }));
  const setToastState = (update: Partial<ToastSliceState>) => setToastStateInternal(prev => ({ ...prev, ...update }));
  const setDropdownMenuState = (update: Partial<DropdownMenuSliceState>) => setDropdownMenuStateInternal(prev => ({ ...prev, ...update }));
  const setContextMenuState = (update: Partial<ContextMenuSliceState>) => setContextMenuStateInternal(prev => ({ ...prev, ...update }));
  const setProgressState = (update: Partial<ProgressSliceState>) => setProgressStateInternal(prev => ({ ...prev, ...update }));
  const setSeparatorState = (update: Partial<SeparatorSliceState>) => setSeparatorStateInternal(prev => ({ ...prev, ...update }));
  const setAvatarState = (update: Partial<AvatarSliceState>) => setAvatarStateInternal(prev => ({ ...prev, ...update }));
  const setToggleState = (update: Partial<ToggleSliceState>) => setToggleStateInternal(prev => ({ ...prev, ...update }));
  const setCollapsibleState = (update: Partial<CollapsibleSliceState>) => setCollapsibleStateInternal(prev => ({ ...prev, ...update }));
  const setUIGroupState = (update: Partial<UIGroupSliceState>) => setUIGroupStateInternal(prev => ({ ...prev, ...update }));
  const setToolbarState = (update: Partial<ToolbarSliceState>) => setToolbarStateInternal(prev => ({ ...prev, ...update }));
  const setAppShellState = (update: Partial<AppShellSliceState>) => setAppShellStateInternal(prev => ({ ...prev, ...update }));
  const setTypographyState = (update: Partial<TypographySliceState>) => setTypographyStateInternal(prev => ({ ...prev, ...update }));
  const toggleDarkMode = () => setParameters(p => ({ ...p, isDarkMode: !p.isDarkMode }));
  const setDarkMode = (isDarkMode: boolean) => setParameters(p => ({ ...p, isDarkMode }));

  const value: ThemeContextType = {
    parameters,
    tableState,
    animationState,
    tabState,
    drawerState,
    accordionState,
    cardState,
    tooltipState,
    buttonState,
    inputState,
    toggleControlState,
    selectState,
    radioGroupState,
    sliderState,
    modalState,
    alertDialogState,
    popupState,
    toastState,
    dropdownMenuState,
    contextMenuState,
    progressState,
    separatorState,
    avatarState,
    toggleState,
    collapsibleState,
    uiGroupState,
    toolbarState,
    appShellState,
    typographyState,
    palette,
    cssVariables,
    setBaseColor,
    setHarmonyMode,
    setHueSpread,
    setDarkenLightenFactor,
    setSaturationFactor,
    setPaddingMode,
    setMarginMode,
    setCornerRadiusMode,
    setShadowMode,
    setTableState,
    setAnimationState,
    setTabState,
    setDrawerState,
    setAccordionState,
    setCardState,
    setTooltipState,
    setButtonState,
    setInputState,
    setToggleControlState,
    setSelectState,
    setRadioGroupState,
    setSliderState,
    setModalState,
    setAlertDialogState,
    setPopupState,
    setToastState,
    setDropdownMenuState,
    setContextMenuState,
    setProgressState,
    setSeparatorState,
    setAvatarState,
    setToggleState,
    setCollapsibleState,
    setUIGroupState,
    setToolbarState,
    setAppShellState,
    setTypographyState,
    toggleDarkMode,
    setDarkMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      <TargetDocumentContext.Provider value={targetDocument}>{children}</TargetDocumentContext.Provider>
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
