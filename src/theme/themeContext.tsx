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
import { SlideOutThemeSlice, SlideOutSliceState, defaultSlideOutState } from '../components/Overlay/SlideOutSlice';
import { AccordionThemeSlice, AccordionSliceState, defaultAccordionState } from '../components/Accordion/AccordionSlice';
import { CardThemeSlice, CardSliceState, defaultCardState } from '../components/Card/CardSlice';
import { TooltipThemeSlice, TooltipSliceState, defaultTooltipState } from '../components/Tooltip/TooltipSlice';
import { globalThemeSliceRegistry } from './slice';
import { aiBus } from '../eventBus/eventBus';

// Register standard theme slices
globalThemeSliceRegistry.register(PaddingThemeSlice);
globalThemeSliceRegistry.register(MarginThemeSlice);
globalThemeSliceRegistry.register(RadiusThemeSlice);
globalThemeSliceRegistry.register(ShadowThemeSlice);
globalThemeSliceRegistry.register(DataTableThemeSlice);
globalThemeSliceRegistry.register(AnimationThemeSlice);
globalThemeSliceRegistry.register(TabThemeSlice);
globalThemeSliceRegistry.register(SlideOutThemeSlice);
globalThemeSliceRegistry.register(AccordionThemeSlice);
globalThemeSliceRegistry.register(CardThemeSlice);
globalThemeSliceRegistry.register(TooltipThemeSlice);

export interface ThemeContextType {
  parameters: ThemeParameters & { shadowMode?: ShadowMode };
  tableState: TableSliceState;
  animationState: AnimationSliceState;
  tabState: TabSliceState;
  slideOutState: SlideOutSliceState;
  accordionState: AccordionSliceState;
  cardState: CardSliceState;
  tooltipState: TooltipSliceState;
  palette: GeneratedPalette;
  cssVariables: Record<string, string>;
  setBaseColor: (color: HSVColor) => void;
  setHarmonyMode: (mode: HarmonyMode) => void;
  setHueSpread: (spread: number) => void;
  setDarkenLightenFactor: (factor: number) => void;
  setSaturationFactor: (factor: number) => void;
  setMasterFontSize: (size: number) => void;
  setPaddingMode: (mode: PaddingMode) => void;
  setMarginMode: (mode: MarginMode) => void;
  setCornerRadiusMode: (mode: CornerRadiusMode) => void;
  setShadowMode: (mode: ShadowMode) => void;
  setTableState: (state: Partial<TableSliceState>) => void;
  setAnimationState: (state: Partial<AnimationSliceState>) => void;
  setTabState: (state: Partial<TabSliceState>) => void;
  setSlideOutState: (state: Partial<SlideOutSliceState>) => void;
  setAccordionState: (state: Partial<AccordionSliceState>) => void;
  setCardState: (state: Partial<CardSliceState>) => void;
  setTooltipState: (state: Partial<TooltipSliceState>) => void;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
}

const defaultParameters: ThemeParameters & { shadowMode: ShadowMode } = {
  baseColor: { h: 88, s: 78, v: 85 }, // Lime / Neon Olive Green from reference screenshot
  harmonyMode: 'analogous',
  hueSpread: 30,
  darkenLightenFactor: 1.0,
  saturationFactor: 1.0,
  masterFontSize: 16,
  paddingMode: 'normal',
  marginMode: 'normal',
  cornerRadiusMode: 'rounded',
  shadowMode: 'subtle',
  isDarkMode: true,
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
  initialSlideOutState?: Partial<SlideOutSliceState>;
  initialAccordionState?: Partial<AccordionSliceState>;
  initialCardState?: Partial<CardSliceState>;
  initialTooltipState?: Partial<TooltipSliceState>;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialParameters,
  initialTableState,
  initialAnimationState,
  initialTabState,
  initialSlideOutState,
  initialAccordionState,
  initialCardState,
  initialTooltipState,
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

  const [slideOutState, setSlideOutStateInternal] = useState<SlideOutSliceState>({
    ...defaultSlideOutState,
    ...initialSlideOutState,
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

  const palette = useMemo(() => {
    return generateHarmonyPalette(parameters);
  }, [parameters]);

  const cssVariables = useMemo(() => {
    const baseVars = paletteToCSSVariables(
      palette,
      parameters.masterFontSize,
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
      slideout: slideOutState,
      accordion: accordionState,
      card: cardState,
      tooltip: tooltipState,
    });
    return { ...baseVars, ...sliceVars };
  }, [palette, parameters, tableState, animationState, tabState, slideOutState, accordionState, cardState, tooltipState]);

  // Inject CSS variables into root document element
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(cssVariables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Notify Event Bus of theme change
    aiBus.emit('theme:changed', { parameters, palette, cssVariables });
  }, [cssVariables, parameters, palette]);

  const setBaseColor = (baseColor: HSVColor) => setParameters(p => ({ ...p, baseColor }));
  const setHarmonyMode = (harmonyMode: HarmonyMode) => setParameters(p => ({ ...p, harmonyMode }));
  const setHueSpread = (hueSpread: number) => setParameters(p => ({ ...p, hueSpread }));
  const setDarkenLightenFactor = (darkenLightenFactor: number) => setParameters(p => ({ ...p, darkenLightenFactor }));
  const setSaturationFactor = (saturationFactor: number) => setParameters(p => ({ ...p, saturationFactor }));
  const setMasterFontSize = (masterFontSize: number) => setParameters(p => ({ ...p, masterFontSize }));
  const setPaddingMode = (paddingMode: PaddingMode) => setParameters(p => ({ ...p, paddingMode }));
  const setMarginMode = (marginMode: MarginMode) => setParameters(p => ({ ...p, marginMode }));
  const setCornerRadiusMode = (cornerRadiusMode: CornerRadiusMode) => setParameters(p => ({ ...p, cornerRadiusMode }));
  const setShadowMode = (shadowMode: ShadowMode) => setParameters(p => ({ ...p, shadowMode }));
  const setTableState = (update: Partial<TableSliceState>) => setTableStateInternal(prev => ({ ...prev, ...update }));
  const setAnimationState = (update: Partial<AnimationSliceState>) => setAnimationStateInternal(prev => ({ ...prev, ...update }));
  const setTabState = (update: Partial<TabSliceState>) => setTabStateInternal(prev => ({ ...prev, ...update }));
  const setSlideOutState = (update: Partial<SlideOutSliceState>) => setSlideOutStateInternal(prev => ({ ...prev, ...update }));
  const setAccordionState = (update: Partial<AccordionSliceState>) => setAccordionStateInternal(prev => ({ ...prev, ...update }));
  const setCardState = (update: Partial<CardSliceState>) => setCardStateInternal(prev => ({ ...prev, ...update }));
  const setTooltipState = (update: Partial<TooltipSliceState>) => setTooltipStateInternal(prev => ({ ...prev, ...update }));
  const toggleDarkMode = () => setParameters(p => ({ ...p, isDarkMode: !p.isDarkMode }));
  const setDarkMode = (isDarkMode: boolean) => setParameters(p => ({ ...p, isDarkMode }));

  const value: ThemeContextType = {
    parameters,
    tableState,
    animationState,
    tabState,
    slideOutState,
    accordionState,
    cardState,
    tooltipState,
    palette,
    cssVariables,
    setBaseColor,
    setHarmonyMode,
    setHueSpread,
    setDarkenLightenFactor,
    setSaturationFactor,
    setMasterFontSize,
    setPaddingMode,
    setMarginMode,
    setCornerRadiusMode,
    setShadowMode,
    setTableState,
    setAnimationState,
    setTabState,
    setSlideOutState,
    setAccordionState,
    setCardState,
    setTooltipState,
    toggleDarkMode,
    setDarkMode,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
