import React, { ReactNode, useState, useRef } from 'react';
import { useTheme } from '../../theme/themeContext';
import { HarmonyMode } from '../../theme/harmonies';
import { PaddingMode } from '../../theme/padding';
import { MarginMode } from '../../theme/margin';
import { CornerRadiusMode } from '../../theme/radius';
import { ShadowMode } from '../../theme/shadow';
import { captureThemeSnapshot, applyThemeSnapshot } from '../../theme/themePersistence';
import { presetThemes, PresetTheme } from '../../theme/presetThemes';
import { listSavedThemes, saveThemeToLibrary, deleteThemeFromLibrary, getThemeFromLibrary, SavedTheme } from '../../theme/themeLibrary';
import { downloadThemeSnapshot, readThemeSnapshotFromFile } from '../../theme/themeFileTransfer';
import { Button } from '../Form/FormComponents';
import { Input } from '../Form/FormComponents';
import { Select } from '../Form/Select';
import { Slider } from '../Form/Slider';
import { Accordion } from '../Accordion/Accordion';
import { Tooltip } from '../Tooltip/Tooltip';
import { UIGroup } from '../UIGroup/UIGroup';
import { Popup } from '../Overlay/Popup';
import { SquareCornerOption } from '../Card/Card';
import { Grid } from '../Layout/Grid';

/** Per-command switches for the Save & Load Themes header toolbar — see `ThemeEditorProps.themeManagement`. */
export interface ThemeManagementOptions {
  /** Bundled preset swatches (presetThemes.ts). @default true */
  presets?: boolean;
  /** Save/load/delete themes in this browser's localStorage (themeLibrary.ts) — the "your saved themes" row. @default true */
  library?: boolean;
  /** Download the current theme as a `.json` file. @default true */
  export?: boolean;
  /** Upload a `.json` theme file. @default true */
  import?: boolean;
}

export interface ThemeEditorProps {
  /**
   * Controls which Save & Load Themes commands appear in the header
   * toolbar. Omit (or `true`) for everything enabled — the default. Pass
   * `false` to hide the whole toolbar, or an options object to lock out
   * specific commands individually — e.g. an app author shipping a fixed
   * bundled theme (via `<ThemeProvider initialParameters={...}>`) who
   * doesn't want end users overriding it with an imported file, or
   * persisting their own local variant that outlives an intentional reset.
   * Ignored when `themeManagementSlot` is given — see that prop.
   * @default true
   */
  themeManagement?: boolean | ThemeManagementOptions;
  /**
   * Replaces the entire built-in Save & Load Themes toolbar (presets,
   * save/load library, export/import) with your own UI, in the same
   * header position — for an app that wants different theme-selection/
   * persistence UX than the bundled one (e.g. a picker styled to match a
   * marketing site, or backed by the app's own account system instead of
   * `localStorage`). `themeManagement` is ignored while this is set: you
   * own this area completely, all-or-nothing, rather than mixing built-in
   * and custom pieces.
   *
   * Nothing is threaded through as a render prop — every piece the
   * built-in toolbar itself is built from is already public API your own
   * slot component can call directly: `presetThemes` (`theme/
   * presetThemes.ts`) for the bundled swatches, `useTheme()` plus
   * `captureThemeSnapshot`/`applyThemeSnapshot` (`theme/
   * themePersistence.ts`) to read/write the live theme, and `theme/
   * themeLibrary.ts`/`theme/themeFileTransfer.ts` for the same
   * localStorage save/load and file export/import the default toolbar
   * uses.
   */
  themeManagementSlot?: ReactNode;
}

/** A `label` + `Select` pairing, optionally with an info tooltip — the field-row shape every per-slice control in this editor follows. */
function FieldRow({
  label,
  tooltip,
  value,
  onChange,
  options,
}: {
  label: string;
  tooltip?: string;
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontWeight: 'var(--ai-font-weight-semibold, 600)', fontSize: '0.875rem' }}>{label}</label>
        {tooltip && (
          <Tooltip content={tooltip}>
            <span style={{ fontSize: '0.75rem', cursor: 'pointer' }}>ℹ️</span>
          </Tooltip>
        )}
      </div>
      <Select value={value} onChange={val => onChange(val)} options={options} />
    </div>
  );
}

/**
 * @manifest Real-time HSV theme editor content — no overlay chrome of its own;
 * host it inside a `<Drawer>` (or `<Modal>`/`<Popup>`) of your choosing.
 * @manifestCategory Form Controls
 */
export const ThemeEditor: React.FC<ThemeEditorProps> = ({ themeManagement = true, themeManagementSlot }) => {
  // The whole context object, not just its destructured fields below — the
  // save/load handlers need to hand it as a unit to captureThemeSnapshot/
  // applyThemeSnapshot (see themePersistence.ts), which take the full
  // ThemeContextType rather than one field at a time.
  const theme = useTheme();
  const mgmt: ThemeManagementOptions = themeManagement === false ? {} : themeManagement === true ? {} : themeManagement;
  const allDisabled = themeManagement === false;
  const showPresets = !allDisabled && mgmt.presets !== false;
  const showLibrary = !allDisabled && mgmt.library !== false;
  const showExport = !allDisabled && mgmt.export !== false;
  const showImport = !allDisabled && mgmt.import !== false;
  // `!= null` (not `!== undefined`) so this agrees with the render site's
  // own `themeManagementSlot ?? defaultThemeManagementContent` below — both
  // must treat `null` and `undefined` as "no slot given" the same way, or a
  // consumer passing `themeManagementSlot={condition ? <X/> : null}` (a
  // natural conditional-slot idiom) gets an empty bordered toolbar box: this
  // check would count `null` as "a slot was given" (rendering the wrapper)
  // while the render line's `??` falls through to the built-in toolbar,
  // producing neither the consumer's content nor a hidden toolbar.
  const showThemeToolbar = themeManagementSlot != null || showPresets || showLibrary || showExport || showImport;
  const {
    parameters,
    setBaseColor,
    setHarmonyMode,
    setHueSpread,
    setDarkenLightenFactor,
    setSaturationFactor,
    setPaddingMode,
    setMarginMode,
    setCornerRadiusMode,
    setShadowMode,
    tableState,
    setTableState,
    animationState,
    setAnimationState,
    tabState,
    setTabState,
    drawerState,
    setDrawerState,
    accordionState,
    setAccordionState,
    cardState,
    setCardState,
    tooltipState,
    setTooltipState,
    buttonState,
    setButtonState,
    inputState,
    setInputState,
    toggleControlState,
    setToggleControlState,
    selectState,
    setSelectState,
    radioGroupState,
    setRadioGroupState,
    sliderState,
    setSliderState,
    modalState,
    setModalState,
    alertDialogState,
    setAlertDialogState,
    popupState,
    setPopupState,
    toastState,
    setToastState,
    dropdownMenuState,
    setDropdownMenuState,
    contextMenuState,
    setContextMenuState,
    progressState,
    setProgressState,
    separatorState,
    setSeparatorState,
    avatarState,
    setAvatarState,
    toggleState,
    setToggleState,
    collapsibleState,
    setCollapsibleState,
    uiGroupState,
    setUIGroupState,
    toolbarState,
    setToolbarState,
    appShellState,
    setAppShellState,
    typographyState,
    setTypographyState,
    toggleDarkMode,
  } = useTheme();

  // --- Save & Load Themes (header toolbar, not buried at the bottom) ---
  // Three independent sources feed the same applyThemeSnapshot(theme, ...)
  // call (see themePersistence.ts's own comment on why that separation
  // matters): bundled presetThemes.ts, this browser's localStorage via
  // themeLibrary.ts, and an uploaded/downloaded file via
  // themeFileTransfer.ts. Baked directly into this shipped toolkit
  // component (not demo-only code) — anyone who mounts <ThemeEditor> gets
  // save/load with zero wiring of their own.
  const [themeName, setThemeName] = useState('');
  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>(() => listSavedThemes());
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // "Save current theme" lives in a Popup (name field + OK/Cancel) now, not
  // inline in the toolbar — controlled open state so OK/Cancel can close it
  // programmatically instead of only ever light-dismissing.
  const [isSavePopupOpen, setIsSavePopupOpen] = useState(false);

  const handleSaveCurrentTheme = () => {
    const trimmed = themeName.trim();
    if (!trimmed) return;
    saveThemeToLibrary(trimmed, captureThemeSnapshot(theme, trimmed));
    setThemeName('');
    setSavedThemes(listSavedThemes());
    setIsSavePopupOpen(false);
  };

  const handleCancelSaveTheme = () => {
    setThemeName('');
    setIsSavePopupOpen(false);
  };

  const handleLoadSavedTheme = (id: string) => {
    const entry = getThemeFromLibrary(id);
    if (entry) applyThemeSnapshot(theme, entry.snapshot);
  };

  const handleDeleteSavedTheme = (id: string) => {
    deleteThemeFromLibrary(id);
    setSavedThemes(listSavedThemes());
  };

  const handleLoadPreset = (preset: PresetTheme) => {
    applyThemeSnapshot(theme, preset.snapshot);
  };

  const handleDownloadTheme = () => {
    const trimmed = themeName.trim();
    downloadThemeSnapshot(captureThemeSnapshot(theme, trimmed || undefined), `${trimmed || 'toolcrib-theme'}.json`);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // clears the input so re-selecting the same filename still fires onChange
    if (!file) return;
    try {
      const snapshot = await readThemeSnapshotFromFile(file);
      applyThemeSnapshot(theme, snapshot);
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not import this file.');
    }
  };

  const appearanceContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Light / Dark Mode Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--ai-padding-lg, 0.75rem)', background: 'var(--ai-bg-container, #f9fafb)', borderRadius: 'var(--ai-radius-sm, 0.375rem)' }}>
        <span style={{ fontWeight: 'var(--ai-font-weight-semibold, 600)', fontSize: '0.875rem' }}>Mode Appearance</span>
        <Button size="sm" variant="outline" onClick={toggleDarkMode}>
          {parameters.isDarkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}
        </Button>
      </div>

      {/* Base Color HSV Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontWeight: 'var(--ai-font-weight-semibold, 600)', fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Base Color Swatch (HSV)</span>
          <div
            style={{
              width: '1.5rem',
              height: '1.5rem',
              borderRadius: '50%',
              background: 'var(--ai-color-base)',
              border: '0.125rem solid #ffffff',
              boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.2)',
            }}
          />
        </div>

        {/* Hue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
            <span>Hue (H)</span>
            <span>{Math.round(parameters.baseColor.h)}°</span>
          </div>
          <Slider
            min={0}
            max={360}
            value={parameters.baseColor.h}
            onChange={val => setBaseColor({ ...parameters.baseColor, h: val })}
          />
        </div>

        {/* Saturation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
            <span>Saturation (S)</span>
            <span>{Math.round(parameters.baseColor.s)}%</span>
          </div>
          <Slider
            min={0}
            max={100}
            value={parameters.baseColor.s}
            onChange={val => setBaseColor({ ...parameters.baseColor, s: val })}
          />
        </div>

        {/* Value / Brightness */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
            <span>Brightness (V)</span>
            <span>{Math.round(parameters.baseColor.v)}%</span>
          </div>
          <Slider
            min={0}
            max={100}
            value={parameters.baseColor.v}
            onChange={val => setBaseColor({ ...parameters.baseColor, v: val })}
          />
        </div>

        {/* Darken / Lighten Factor — applied on top of the base HSV Value
            channel during palette generation (see harmonies.ts), distinct
            from the raw Brightness (V) slider above: this scales the whole
            generated palette's lightness, not just the base swatch. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              Darken / Lighten Factor
              <Tooltip content="Scales the generated palette's lightness. 1.0 = default; below 1 darkens, above 1 lightens.">
                <span style={{ cursor: 'pointer' }}>ℹ️</span>
              </Tooltip>
            </span>
            <span>{parameters.darkenLightenFactor.toFixed(2)}x</span>
          </div>
          <Slider
            min={0.5}
            max={1.5}
            step={0.05}
            value={parameters.darkenLightenFactor}
            onChange={val => setDarkenLightenFactor(val)}
          />
        </div>

        {/* Saturation Factor — scales the generated palette's saturation
            (harmonies.ts), distinct from the base swatch's own Saturation
            (S) slider above. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              Saturation Factor
              <Tooltip content="Scales the generated palette's saturation. 1.0 = default; below 1 mutes, above 1 intensifies.">
                <span style={{ cursor: 'pointer' }}>ℹ️</span>
              </Tooltip>
            </span>
            <span>{parameters.saturationFactor.toFixed(2)}x</span>
          </div>
          <Slider
            min={0}
            max={2}
            step={0.05}
            value={parameters.saturationFactor}
            onChange={val => setSaturationFactor(val)}
          />
        </div>
      </div>
    </div>
  );

  const densityContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Global Padding Mode"
        tooltip="Controls internal container padding density across all components"
        value={parameters.paddingMode}
        onChange={val => setPaddingMode(val as PaddingMode)}
        options={[
          { label: 'Compact (Tight rem padding)', value: 'compact' },
          { label: 'Normal (Standard rem padding)', value: 'normal' },
          { label: 'Spacious (Generous rem padding)', value: 'spacious' },
        ]}
      />
      <FieldRow
        label="Global Margin & Element Gaps"
        tooltip="Controls vertical rhythm and gap spacing between UI elements"
        value={parameters.marginMode || 'normal'}
        onChange={val => setMarginMode(val as MarginMode)}
        options={[
          { label: 'Compact (Tight element gaps)', value: 'compact' },
          { label: 'Normal (Standard element gaps)', value: 'normal' },
          { label: 'Spacious (Generous element gaps)', value: 'spacious' },
        ]}
      />
      <FieldRow
        label="Corner Rounding Mode"
        value={parameters.cornerRadiusMode}
        onChange={val => setCornerRadiusMode(val as CornerRadiusMode)}
        options={[
          { label: 'Sharp (0rem Square Corners)', value: 'sharp' },
          { label: 'Subtle (Compact Corner Rounding)', value: 'subtle' },
          { label: 'Rounded (Standard Corner Rounding)', value: 'rounded' },
          { label: 'Pill (Full Rounding)', value: 'pill' },
        ]}
      />
      <FieldRow
        label="Elevation & Shadow Depth"
        value={parameters.shadowMode || 'subtle'}
        onChange={val => setShadowMode(val as ShadowMode)}
        options={[
          { label: 'Flat (No Shadows)', value: 'none' },
          { label: 'Subtle (Soft Elevation)', value: 'subtle' },
          { label: 'Elevated (Deep Elevation)', value: 'elevated' },
          { label: 'Glassmorphism Depth', value: 'glass' },
        ]}
      />
    </div>
  );

  const animationContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Transition Physics Preset"
        tooltip="Configures global easing curves and transition durations across all components"
        value={animationState.preset}
        onChange={val => setAnimationState({ preset: val as any })}
        options={[
          { label: 'Smooth (Standard Easing Curve)', value: 'smooth' },
          { label: 'Spring (Elastic Bouncy Physics)', value: 'spring' },
          { label: 'Snappy (Fast Responsive Curves)', value: 'snappy' },
          { label: 'Subtle (Gentle Slow Fades)', value: 'subtle' },
          { label: 'None (Instant 0s Transitions)', value: 'none' },
        ]}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 'var(--ai-font-weight-semibold, 600)' }}>
          <span>Motion Duration Factor</span>
          <span>{animationState.speed}x</span>
        </div>
        <Slider
          value={Math.round(animationState.speed * 100)}
          min={50}
          max={200}
          step={25}
          onChange={val => setAnimationState({ speed: val / 100 })}
        />
      </div>
    </div>
  );

  const harmonyContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Color Harmony Mode"
        tooltip="Calculates primary, secondary, and accent colors in HSV space"
        value={parameters.harmonyMode}
        onChange={val => setHarmonyMode(val as HarmonyMode)}
        options={[
          { label: 'Monochromatic', value: 'monochromatic' },
          { label: 'Analogous', value: 'analogous' },
          { label: 'Split Complementary', value: 'split-complementary' },
          { label: 'Triadic', value: 'triadic' },
          { label: 'Tetradic', value: 'tetradic' },
        ]}
      />

      {/* Hue Spread */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
          <span>Hue Spread Angle</span>
          <span>{parameters.hueSpread}°</span>
        </div>
        <Slider
          min={10}
          max={90}
          value={parameters.hueSpread}
          onChange={val => setHueSpread(val)}
        />
      </div>
    </div>
  );

  const typographyContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Font Family"
        tooltip="Sets --ai-font-family, consumed anywhere a component uses fontFamily: 'inherit' up to :root"
        value={typographyState.fontFamily}
        onChange={val => setTypographyState({ fontFamily: val as any })}
        options={[
          { label: 'System (Inter / system-ui)', value: 'system' },
          { label: 'Serif (Georgia / Times)', value: 'serif' },
          { label: 'Monospace (SF Mono / Consolas)', value: 'monospace' },
        ]}
      />

      {/* Master Font Size */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
          <span>Master Font Size (rem Base)</span>
          <span>{typographyState.masterFontSize}px</span>
        </div>
        <Slider
          min={12}
          max={24}
          value={typographyState.masterFontSize}
          onChange={val => setTypographyState({ masterFontSize: val })}
          commitOnRelease
        />
      </div>
    </div>
  );

  const subthemeContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--ai-text-secondary, #6b7280)' }}>
        Monochromatic sub-schemes anchored off Red (0°), Green (140°), Amber (38°), and Blue (210°) carrying base SV axes with WCAG contrast ratios.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
        <div style={{ padding: 'var(--ai-padding-md, 0.5rem)', background: 'var(--ai-subtheme-error-bg)', color: 'var(--ai-subtheme-error-text)', border: '0.0625rem solid var(--ai-subtheme-error-border)', borderRadius: 'var(--ai-radius-sm, 0.25rem)', textAlign: 'center', fontSize: '0.75rem', fontWeight: 'var(--ai-font-weight-semibold, 600)' }}>
          Error Subtheme
        </div>
        <div style={{ padding: 'var(--ai-padding-md, 0.5rem)', background: 'var(--ai-subtheme-success-bg)', color: 'var(--ai-subtheme-success-text)', border: '0.0625rem solid var(--ai-subtheme-success-border)', borderRadius: 'var(--ai-radius-sm, 0.25rem)', textAlign: 'center', fontSize: '0.75rem', fontWeight: 'var(--ai-font-weight-semibold, 600)' }}>
          Success Subtheme
        </div>
        <div style={{ padding: 'var(--ai-padding-md, 0.5rem)', background: 'var(--ai-subtheme-warning-bg)', color: 'var(--ai-subtheme-warning-text)', border: '0.0625rem solid var(--ai-subtheme-warning-border)', borderRadius: 'var(--ai-radius-sm, 0.25rem)', textAlign: 'center', fontSize: '0.75rem', fontWeight: 'var(--ai-font-weight-semibold, 600)' }}>
          Warning Subtheme
        </div>
        <div style={{ padding: 'var(--ai-padding-md, 0.5rem)', background: 'var(--ai-subtheme-info-bg)', color: 'var(--ai-subtheme-info-text)', border: '0.0625rem solid var(--ai-subtheme-info-border)', borderRadius: 'var(--ai-radius-sm, 0.25rem)', textAlign: 'center', fontSize: '0.75rem', fontWeight: 'var(--ai-font-weight-semibold, 600)' }}>
          Info Subtheme
        </div>
      </div>
    </div>
  );

  // ---- Layout Primitives ----

  const separatorSectionContent = (
    <FieldRow
      label="Separator Thickness"
      value={separatorState.thickness}
      onChange={val => setSeparatorState({ thickness: val as any })}
      options={[
        { label: 'Thin (0.0625rem)', value: 'thin' },
        { label: 'Normal (0.125rem)', value: 'normal' },
        { label: 'Thick (0.1875rem)', value: 'thick' },
      ]}
    />
  );

  const uiGroupSectionContent = (
    <FieldRow
      label="UIGroup Border Overlap"
      tooltip="Global only — this shared, singleton stylesheet has no per-instance scoping to override"
      value={uiGroupState.overlap}
      onChange={val => setUIGroupState({ overlap: val as any })}
      options={[
        { label: 'Thin (-0.0625rem)', value: 'thin' },
        { label: 'Normal (-0.125rem)', value: 'normal' },
      ]}
    />
  );

  const toolbarSectionContent = (
    <FieldRow
      label="Toolbar Slot Gap"
      value={toolbarState.slotGap}
      onChange={val => setToolbarState({ slotGap: val as any })}
      options={[
        { label: 'Compact (0.25rem)', value: 'compact' },
        { label: 'Normal (0.5rem)', value: 'normal' },
        { label: 'Spacious (0.875rem)', value: 'spacious' },
      ]}
    />
  );

  // ---- Containers ----

  const cardSectionContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Card Padding"
        value={cardState.padding}
        onChange={val => setCardState({ padding: val as any })}
        options={[
          { label: 'Compact (0.75rem 1rem)', value: 'compact' },
          { label: 'Normal (1.25rem 1.5rem)', value: 'normal' },
          { label: 'Spacious (1.75rem 2.25rem)', value: 'spacious' },
        ]}
      />
      <FieldRow
        label="Card Header Style"
        tooltip="Controls the header's background and bottom border across all Card components"
        value={cardState.headerStyle}
        onChange={val => setCardState({ headerStyle: val as any })}
        options={[
          { label: 'Flush (No Border)', value: 'flush' },
          { label: 'Bordered (Bottom Border)', value: 'bordered' },
          { label: 'Subtle Background (Tinted Header)', value: 'subtle-bg' },
        ]}
      />
    </div>
  );

  const collapsibleSectionContent = (
    <FieldRow
      label="Collapsible Header & Content Padding"
      value={collapsibleState.padding}
      onChange={val => setCollapsibleState({ padding: val as any })}
      options={[
        { label: 'Compact', value: 'compact' },
        { label: 'Normal', value: 'normal' },
        { label: 'Spacious', value: 'spacious' },
      ]}
    />
  );

  const appShellSectionContent = (
    <FieldRow
      label="App Shell Header & Main Density"
      tooltip="Since AppShell is meant to render once, this mostly exists for consistency with other components"
      value={appShellState.density}
      onChange={val => setAppShellState({ density: val as any })}
      options={[
        { label: 'Compact', value: 'compact' },
        { label: 'Normal', value: 'normal' },
        { label: 'Spacious', value: 'spacious' },
      ]}
    />
  );

  // ---- Overlays ----

  const drawerContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Drawer Panel Width"
        tooltip="Configures default width for Drawer panels"
        value={drawerState.width}
        onChange={val => setDrawerState({ width: val as any })}
        options={[
          { label: 'Small (20rem / 320px)', value: 'sm' },
          { label: 'Medium (26rem / 416px)', value: 'md' },
          { label: 'Large (36rem / 576px)', value: 'lg' },
          { label: 'Quarter Screen (25vw)', value: '25vw' },
          { label: 'Third Screen (33vw)', value: '33vw' },
          { label: 'Half Screen (50vw)', value: '50vw' },
          { label: 'Three-Quarters (75vw)', value: '75vw' },
          { label: 'Full Screen (100vw)', value: 'full' },
        ]}
      />
      <FieldRow
        label="Drawer Header Margin & Floating Mode"
        value={drawerState.headerMargin}
        onChange={val => setDrawerState({ headerMargin: val as any })}
        options={[
          { label: 'Flush Header (0 Margin)', value: 'none' },
          { label: 'Compact Gap (0.5rem Bottom Margin)', value: 'compact' },
          { label: 'Normal Gap (1.0rem Bottom Margin)', value: 'normal' },
          { label: 'Spacious Gap (1.5rem Bottom Margin)', value: 'spacious' },
          { label: 'Floating Card Header (Detached Margin)', value: 'detached' },
        ]}
      />
      <FieldRow
        label="Backdrop Glassmorphism Blur"
        value={drawerState.backdropBlur}
        onChange={val => setDrawerState({ backdropBlur: val as any })}
        options={[
          { label: 'Subtle Blur (2px)', value: 'subtle' },
          { label: 'Heavy Glass Blur (8px)', value: 'heavy' },
          { label: 'None (Solid Backdrop)', value: 'none' },
        ]}
      />
    </div>
  );

  const tooltipSectionContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Tooltip Colour Theme"
        value={tooltipState.theme}
        onChange={val => setTooltipState({ theme: val as any })}
        options={[
          { label: 'Dark (Default)', value: 'dark' },
          { label: 'Light (Surface Colour)', value: 'light' },
          { label: 'Accent (Primary Colour)', value: 'accent' },
        ]}
      />
      <FieldRow
        label="Tooltip Size"
        value={tooltipState.size}
        onChange={val => setTooltipState({ size: val as any })}
        options={[
          { label: 'Small (Compact Padding & Font)', value: 'sm' },
          { label: 'Medium (Standard Padding & Font)', value: 'md' },
        ]}
      />
    </div>
  );

  const modalSectionContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Modal Backdrop Blur"
        value={modalState.backdropBlur}
        onChange={val => setModalState({ backdropBlur: val as any })}
        options={[
          { label: 'None', value: 'none' },
          { label: 'Subtle (0.1875rem)', value: 'subtle' },
          { label: 'Heavy (0.5rem)', value: 'heavy' },
        ]}
      />
      <FieldRow
        label="Modal Overlay Darkness"
        value={modalState.overlayDarkness}
        onChange={val => setModalState({ overlayDarkness: val as any })}
        options={[
          { label: 'Light (30% Black)', value: 'light' },
          { label: 'Normal (50% Black)', value: 'normal' },
          { label: 'Dark (70% Black)', value: 'dark' },
        ]}
      />
    </div>
  );

  const alertDialogSectionContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Alert Dialog Backdrop Blur"
        value={alertDialogState.backdropBlur}
        onChange={val => setAlertDialogState({ backdropBlur: val as any })}
        options={[
          { label: 'None', value: 'none' },
          { label: 'Subtle (0.1875rem)', value: 'subtle' },
          { label: 'Heavy (0.5rem)', value: 'heavy' },
        ]}
      />
      <FieldRow
        label="Alert Dialog Overlay Darkness"
        value={alertDialogState.overlayDarkness}
        onChange={val => setAlertDialogState({ overlayDarkness: val as any })}
        options={[
          { label: 'Light (30% Black)', value: 'light' },
          { label: 'Normal (50% Black)', value: 'normal' },
          { label: 'Dark (70% Black)', value: 'dark' },
        ]}
      />
    </div>
  );

  const popupSectionContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Popup Shadow Depth"
        value={popupState.shadowDepth}
        onChange={val => setPopupState({ shadowDepth: val as any })}
        options={[
          { label: 'Subtle', value: 'subtle' },
          { label: 'Elevated', value: 'elevated' },
        ]}
      />
      <FieldRow
        label="Popup Border Style"
        value={popupState.borderStyle}
        onChange={val => setPopupState({ borderStyle: val as any })}
        options={[
          { label: 'Bordered', value: 'bordered' },
          { label: 'Borderless', value: 'borderless' },
        ]}
      />
    </div>
  );

  const toastSectionContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Toast Shadow Depth"
        value={toastState.shadowDepth}
        onChange={val => setToastState({ shadowDepth: val as any })}
        options={[
          { label: 'Subtle', value: 'subtle' },
          { label: 'Elevated', value: 'elevated' },
        ]}
      />
      <FieldRow
        label="Toast Accent Style"
        value={toastState.accentStyle}
        onChange={val => setToastState({ accentStyle: val as any })}
        options={[
          { label: 'Stripe (0.3125rem Accent Bar)', value: 'stripe' },
          { label: 'Border Only (No Accent Bar)', value: 'border-only' },
        ]}
      />
    </div>
  );

  const dropdownMenuSectionContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Dropdown Menu Shadow Depth"
        value={dropdownMenuState.shadowDepth}
        onChange={val => setDropdownMenuState({ shadowDepth: val as any })}
        options={[
          { label: 'Subtle', value: 'subtle' },
          { label: 'Elevated', value: 'elevated' },
        ]}
      />
      <FieldRow
        label="Dropdown Menu Item Density"
        value={dropdownMenuState.itemDensity}
        onChange={val => setDropdownMenuState({ itemDensity: val as any })}
        options={[
          { label: 'Compact', value: 'compact' },
          { label: 'Normal', value: 'normal' },
        ]}
      />
    </div>
  );

  const contextMenuSectionContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Context Menu Shadow Depth"
        value={contextMenuState.shadowDepth}
        onChange={val => setContextMenuState({ shadowDepth: val as any })}
        options={[
          { label: 'Subtle', value: 'subtle' },
          { label: 'Elevated', value: 'elevated' },
        ]}
      />
      <FieldRow
        label="Context Menu Item Density"
        value={contextMenuState.itemDensity}
        onChange={val => setContextMenuState({ itemDensity: val as any })}
        options={[
          { label: 'Compact', value: 'compact' },
          { label: 'Normal', value: 'normal' },
        ]}
      />
    </div>
  );

  // ---- Data Display ----

  const tableContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Table Cell Density"
        tooltip="Configures padding and row height across all Data Table instances"
        value={tableState.density}
        onChange={val => setTableState({ density: val as any })}
        options={[
          { label: 'Compact (2.25rem Row Height & Tight Cell Padding)', value: 'compact' },
          { label: 'Normal (2.75rem Row Height & Standard Cell Padding)', value: 'normal' },
          { label: 'Spacious (3.5rem Row Height & Generous Cell Padding)', value: 'spacious' },
        ]}
      />
      <FieldRow
        label="Grid Border Lines"
        value={tableState.borderStyle}
        onChange={val => setTableState({ borderStyle: val as any })}
        options={[
          { label: 'Horizontal Rows Only', value: 'horizontal' },
          { label: 'Full Grid Borders', value: 'grid' },
          { label: 'No Borders (Borderless)', value: 'none' },
        ]}
      />
    </div>
  );

  const tabStripContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Tab Group Variant"
        tooltip="Configures tab trigger visual styling across all TabStrip components"
        value={tabState.variant}
        onChange={val => setTabState({ variant: val as any })}
        options={[
          { label: 'Pills (Rounded Pill Triggers)', value: 'pills' },
          { label: 'Underline (Bottom Active Indicator)', value: 'underline' },
          { label: 'Cards (Folder Tab Header Style)', value: 'cards' },
          { label: 'Segment (Segmented Control)', value: 'segment' },
        ]}
      />
      <FieldRow
        label="Tab Density & Size"
        value={tabState.size}
        onChange={val => setTabState({ size: val as any })}
        options={[
          { label: 'Small (Compact Padding & 12px Font)', value: 'sm' },
          { label: 'Medium (Standard Padding & 14px Font)', value: 'md' },
          { label: 'Large (Spacious Padding & 16px Font)', value: 'lg' },
        ]}
      />
      <FieldRow
        label="Tab Panel Switch Animation"
        value={tabState.panelTransition}
        onChange={val => setTabState({ panelTransition: val as any })}
        options={[
          { label: 'Fade In (Smooth Dissolve Transition)', value: 'fade' },
          { label: 'Scale & Fade (Pop & Scale Transition)', value: 'scale-fade' },
          { label: 'None (Instant Panel Switching)', value: 'none' },
        ]}
      />
    </div>
  );

  const accordionSectionContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Accordion Header Padding"
        value={accordionState.headerPadding}
        onChange={val => setAccordionState({ headerPadding: val as any })}
        options={[
          { label: 'Compact (0.5rem 0.75rem)', value: 'compact' },
          { label: 'Normal (0.875rem 1.125rem)', value: 'normal' },
          { label: 'Spacious (1.25rem 1.5rem)', value: 'spacious' },
        ]}
      />
      <FieldRow
        label="Inter-Header Item Gap Margin"
        value={accordionState.itemGap}
        onChange={val => setAccordionState({ itemGap: val as any })}
        options={[
          { label: 'None (Flush 0px Gap)', value: 'none' },
          { label: 'Compact Gap (0.375rem Gap)', value: 'compact' },
          { label: 'Normal Gap (0.75rem Gap)', value: 'normal' },
          { label: 'Spacious Gap (1.25rem Gap)', value: 'spacious' },
        ]}
      />
      <FieldRow
        label="Panel Transition & Animation Preset"
        value={accordionState.panelAnimation}
        onChange={val => setAccordionState({ panelAnimation: val as any })}
        options={[
          { label: 'Slide & Fade Down (Smooth 0.25s)', value: 'slide-fade' },
          { label: 'Quick Expand (Snappy 0.2s)', value: 'expand' },
          { label: 'Scale & Fade (Pop In)', value: 'scale-fade' },
          { label: 'None (Instant Toggle)', value: 'none' },
        ]}
      />
    </div>
  );

  const progressSectionContent = (
    <FieldRow
      label="Progress Bar Track Shape"
      value={progressState.trackRadius}
      onChange={val => setProgressState({ trackRadius: val as any })}
      options={[
        { label: 'Sharp (0rem)', value: 'sharp' },
        { label: 'Rounded', value: 'rounded' },
        { label: 'Pill (Full Rounding)', value: 'pill' },
      ]}
    />
  );

  const avatarSectionContent = (
    <FieldRow
      label="Avatar Shape"
      value={avatarState.shape}
      onChange={val => setAvatarState({ shape: val as any })}
      options={[
        { label: 'Circle', value: 'circle' },
        { label: 'Rounded Square', value: 'rounded-square' },
        { label: 'Square', value: 'square' },
      ]}
    />
  );

  // ---- Form Controls ----

  const buttonSectionContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Button Font Weight"
        value={buttonState.fontWeight}
        onChange={val => setButtonState({ fontWeight: val as any })}
        options={[
          { label: 'Normal (500)', value: 'normal' },
          { label: 'Semibold (600)', value: 'semibold' },
          { label: 'Bold (700)', value: 'bold' },
        ]}
      />
      <FieldRow
        label="Button Icon Gap"
        value={buttonState.iconGap}
        onChange={val => setButtonState({ iconGap: val as any })}
        options={[
          { label: 'Compact (0.25rem)', value: 'compact' },
          { label: 'Normal (0.5rem)', value: 'normal' },
          { label: 'Spacious (0.75rem)', value: 'spacious' },
        ]}
      />
    </div>
  );

  const inputSectionContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Input & Textarea Padding"
        value={inputState.padding}
        onChange={val => setInputState({ padding: val as any })}
        options={[
          { label: 'Compact', value: 'compact' },
          { label: 'Normal', value: 'normal' },
          { label: 'Spacious', value: 'spacious' },
        ]}
      />
      <FieldRow
        label="Input & Textarea Border Width"
        value={inputState.borderWidth}
        onChange={val => setInputState({ borderWidth: val as any })}
        options={[
          { label: 'Thin (0.0625rem)', value: 'thin' },
          { label: 'Normal (0.125rem)', value: 'normal' },
          { label: 'Thick (0.1875rem)', value: 'thick' },
        ]}
      />
    </div>
  );

  const toggleControlSectionContent = (
    <FieldRow
      label="Checkbox & Switch Size"
      value={toggleControlState.size}
      onChange={val => setToggleControlState({ size: val as any })}
      options={[
        { label: 'Small', value: 'sm' },
        { label: 'Medium', value: 'md' },
        { label: 'Large', value: 'lg' },
      ]}
    />
  );

  const selectSectionContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Select Trigger Padding"
        value={selectState.padding}
        onChange={val => setSelectState({ padding: val as any })}
        options={[
          { label: 'Compact', value: 'compact' },
          { label: 'Normal', value: 'normal' },
          { label: 'Spacious', value: 'spacious' },
        ]}
      />
      <FieldRow
        label="Select Item Density"
        value={selectState.itemDensity}
        onChange={val => setSelectState({ itemDensity: val as any })}
        options={[
          { label: 'Compact', value: 'compact' },
          { label: 'Normal', value: 'normal' },
        ]}
      />
    </div>
  );

  const radioGroupSectionContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Radio Group Gap"
        value={radioGroupState.gap}
        onChange={val => setRadioGroupState({ gap: val as any })}
        options={[
          { label: 'Compact', value: 'compact' },
          { label: 'Normal', value: 'normal' },
          { label: 'Spacious', value: 'spacious' },
        ]}
      />
      <FieldRow
        label="Radio Dot Size"
        value={radioGroupState.dotSize}
        onChange={val => setRadioGroupState({ dotSize: val as any })}
        options={[
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ]}
      />
    </div>
  );

  const sliderSectionContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Slider Track Height"
        value={sliderState.trackHeight}
        onChange={val => setSliderState({ trackHeight: val as any })}
        options={[
          { label: 'Thin (0.25rem)', value: 'thin' },
          { label: 'Normal (0.375rem)', value: 'normal' },
          { label: 'Thick (0.5rem)', value: 'thick' },
        ]}
      />
      <FieldRow
        label="Slider Thumb Size"
        value={sliderState.thumbSize}
        onChange={val => setSliderState({ thumbSize: val as any })}
        options={[
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ]}
      />
    </div>
  );

  const toggleSectionContent = (
    <FieldRow
      label="Toggle & Toggle Group Padding"
      value={toggleState.padding}
      onChange={val => setToggleState({ padding: val as any })}
      options={[
        { label: 'Compact', value: 'compact' },
        { label: 'Normal', value: 'normal' },
        { label: 'Spacious', value: 'spacious' },
      ]}
    />
  );

  // ---- Category groups: each renders its own inner Accordion of sections ----

  const globalGroupContent = (
    <Accordion
      type="single"
      defaultValue="appearance"
      items={[
        { value: 'appearance', title: '🎨 Appearance & Base Color (HSV)', content: appearanceContent },
        { value: 'typography', title: '🔤 Typography (Font Family & Size)', content: typographyContent },
        { value: 'density', title: '📐 Density, Spacing & Elevation', content: densityContent },
        { value: 'animation', title: '✨ Motion, Transitions & Physics', content: animationContent },
        { value: 'harmony', title: '🎼 Color Harmony & Hue Spread', content: harmonyContent },
        { value: 'subthemes', title: '🌈 Monochromatic Subthemes', content: subthemeContent },
      ]}
    />
  );

  const layoutPrimitivesGroupContent = (
    <Accordion
      type="single"
      items={[
        { value: 'separator', title: '➖ Separator', content: separatorSectionContent },
        { value: 'uigroup', title: '🔗 UIGroup', content: uiGroupSectionContent },
        { value: 'toolbar', title: '🧰 Toolbar', content: toolbarSectionContent },
      ]}
    />
  );

  const containersGroupContent = (
    <Accordion
      type="single"
      items={[
        { value: 'card', title: '🃏 Card', content: cardSectionContent },
        { value: 'collapsible', title: '📂 Collapsible', content: collapsibleSectionContent },
        { value: 'appshell', title: '🖥️ App Shell', content: appShellSectionContent },
      ]}
    />
  );

  const overlaysGroupContent = (
    <Accordion
      type="single"
      items={[
        { value: 'drawer', title: '🪟 Drawer', content: drawerContent },
        { value: 'tooltip', title: '💬 Tooltip', content: tooltipSectionContent },
        { value: 'modal', title: '🪧 Modal', content: modalSectionContent },
        { value: 'alertdialog', title: '⚠️ Alert Dialog', content: alertDialogSectionContent },
        { value: 'popup', title: '💬 Popup', content: popupSectionContent },
        { value: 'toast', title: '🔔 Toast', content: toastSectionContent },
        { value: 'dropdownmenu', title: '⚙️ Dropdown Menu', content: dropdownMenuSectionContent },
        { value: 'contextmenu', title: '🖱️ Context Menu', content: contextMenuSectionContent },
      ]}
    />
  );

  const dataDisplayGroupContent = (
    <Accordion
      type="single"
      items={[
        { value: 'table', title: '📊 Data Table', content: tableContent },
        { value: 'tab', title: '📑 Tab Strip', content: tabStripContent },
        { value: 'accordion', title: '🪗 Accordion', content: accordionSectionContent },
        { value: 'progress', title: '📶 Progress Bar', content: progressSectionContent },
        { value: 'avatar', title: '🖼️ Avatar', content: avatarSectionContent },
      ]}
    />
  );

  const formControlsGroupContent = (
    <Accordion
      type="single"
      items={[
        { value: 'button', title: '🔘 Button', content: buttonSectionContent },
        { value: 'input', title: '📝 Input & Textarea', content: inputSectionContent },
        { value: 'togglecontrol', title: '☑️ Checkbox & Switch', content: toggleControlSectionContent },
        { value: 'select', title: '🔽 Select', content: selectSectionContent },
        { value: 'radiogroup', title: '🔘 Radio Group', content: radioGroupSectionContent },
        { value: 'slider', title: '🎚️ Slider', content: sliderSectionContent },
        { value: 'toggle', title: '🔀 Toggle & Toggle Group', content: toggleSectionContent },
      ]}
    />
  );

  // The built-in Save & Load Themes toolbar content — pulled out of the
  // returned JSX below (matching this file's own convention of
  // pre-computing each section as an `xContent` variable) specifically so
  // it's easy to see it's just the `??` fallback for `themeManagementSlot`,
  // not tangled into the header's own wrapper/border chrome.
  // UIGroup's own corner-squaring CSS only reaches its DIRECT children —
  // every item below is wrapped in <Tooltip> (which inserts its own <span>
  // between UIGroup and the real control, for unrelated height-stretch
  // reasons — see Tooltip.tsx's own comment), so that automatic CSS can't
  // reach through to square the actual Input/Button. Same root cause, same
  // established fix, as this file's header trigger button (see its own
  // comment): pass `squareCorners` explicitly instead of relying on the
  // automatic mechanism. Built as a filtered array (not inline JSX) so the
  // first/last position — and therefore which corners to square — is
  // computed correctly regardless of which optional buttons are enabled.
  const toolbarGroupItems: { key: string; node: (squareCorners: SquareCornerOption) => ReactNode }[] = [
    ...(showPresets ? [{
      key: 'presets',
      node: (squareCorners: SquareCornerOption) => (
        <Popup
          trigger={
            <Tooltip content="Theme presets">
              <Button size="sm" variant="outline" squareCorners={squareCorners} aria-label="Theme presets">🎨</Button>
            </Tooltip>
          }
        >
          {/* Grid itself always renders width:'100%' (no style/className
              prop — see AGENTS.md's StyleFree rule) — a plain wrapping div
              is what actually constrains the popup to a compact width. */}
          <div style={{ width: '15rem' }}>
            <Grid columns={3} gap="sm">
              {presetThemes.map(preset => (
                // Emoji + first word only (e.g. "🔷 Tailwind (Default)" ->
                // "🔷 Tailwind") for popup density — every bundled preset's
                // name follows "<emoji> <Name> <descriptor/parenthetical>",
                // so this holds uniformly without needing a separate short-
                // label field. preset.name itself is untouched (still used
                // as the saved/loaded theme's full display name elsewhere),
                // this is purely a rendering choice for this dense grid. No
                // Tooltip here — the shortened label already says almost
                // exactly what the full name would, so a hover tooltip was
                // pure redundant chrome, not genuinely added information.
                <Button key={preset.id} size="sm" variant="outline" onClick={() => handleLoadPreset(preset)}>
                  {preset.name.split(' ').slice(0, 2).join(' ')}
                </Button>
              ))}
            </Grid>
          </div>
        </Popup>
      ),
    }] : []),
    ...(showLibrary ? [{
      key: 'save',
      node: (squareCorners: SquareCornerOption) => (
        <Popup
          isOpen={isSavePopupOpen}
          onOpenChange={open => { setIsSavePopupOpen(open); if (!open) setThemeName(''); }}
          trigger={
            <Tooltip content="Save current theme">
              <Button size="sm" squareCorners={squareCorners} aria-label="Save current theme">💾</Button>
            </Tooltip>
          }
        >
          {/* Fixed 3-item shape (name field, OK, Cancel) every time this
              opens — squareCorners hardcoded to each position rather than
              computed from an array, unlike the outer toolbar group, since
              there's nothing conditional about which of the three appear. */}
          <UIGroup>
            <div style={{ width: '10rem' }}>
              <Input
                placeholder="Theme name..."
                value={themeName}
                onChange={e => setThemeName(e.target.value)}
                squareCorners="right"
                autoFocus
              />
            </div>
            <Tooltip content="Save">
              <Button size="sm" squareCorners="all" aria-label="Save" disabled={!themeName.trim()} onClick={handleSaveCurrentTheme}>
                ✅
              </Button>
            </Tooltip>
            <Tooltip content="Cancel">
              <Button size="sm" variant="outline" squareCorners="left" aria-label="Cancel" onClick={handleCancelSaveTheme}>
                ❌
              </Button>
            </Tooltip>
          </UIGroup>
        </Popup>
      ),
    }] : []),
    ...(showExport ? [{
      key: 'export',
      node: (squareCorners: SquareCornerOption) => (
        <Tooltip content="Export theme">
          <Button size="sm" variant="outline" squareCorners={squareCorners} aria-label="Export theme" onClick={handleDownloadTheme}>
            ⬇️
          </Button>
        </Tooltip>
      ),
    }] : []),
    ...(showImport ? [{
      key: 'import',
      node: (squareCorners: SquareCornerOption) => (
        <>
          <Tooltip content="Import theme">
            <Button size="sm" variant="outline" squareCorners={squareCorners} aria-label="Import theme" onClick={() => fileInputRef.current?.click()}>
              ⬆️
            </Button>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileSelected}
            style={{ display: 'none' }}
          />
        </>
      ),
    }] : []),
  ];

  const defaultThemeManagementContent = (
    <>
      {toolbarGroupItems.length > 0 && (
        // UIGroup itself is inline-flex (shrinks to content) — this wrapper
        // is what actually centers it within the toolbar's full-width row.
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <UIGroup>
            {toolbarGroupItems.map((item, index) => {
              const squareCorners: SquareCornerOption =
                toolbarGroupItems.length === 1 ? 'none' : index === 0 ? 'right' : index === toolbarGroupItems.length - 1 ? 'left' : 'all';
              return <React.Fragment key={item.key}>{item.node(squareCorners)}</React.Fragment>;
            })}
          </UIGroup>
        </div>
      )}

      {showLibrary && savedThemes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--ai-text-secondary, #6b7280)' }}>Saved:</span>
          {savedThemes.map(entry => (
            <UIGroup key={entry.id}>
              <Button size="sm" variant="ghost" onClick={() => handleLoadSavedTheme(entry.id)}>
                {entry.name}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete saved theme ${entry.name}`}
                onClick={() => handleDeleteSavedTheme(entry.id)}
              >
                🗑️
              </Button>
            </UIGroup>
          ))}
        </div>
      )}

      {importError && (
        <span style={{ fontSize: '0.75rem', color: 'var(--ai-subtheme-error, #ef4444)' }}>{importError}</span>
      )}
    </>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontFamily: 'inherit' }}>
      {/* Save & Load Themes — lives in the header, above everything else,
          not buried at the bottom past 6 categories of scrolling. Either
          the built-in toolbar (its four command groups individually
          lockable via `themeManagement` — see its own doc comment, e.g. an
          app author shipping one fixed bundled theme who doesn't want it
          overridable) or, given `themeManagementSlot`, whatever the caller
          hands in instead — see that prop's own doc comment. */}
      {showThemeToolbar && (
        <div
          data-testid="theme-editor-toolbar"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.625rem',
            paddingBottom: '0.875rem',
            borderBottom: '0.0625rem solid var(--ai-border, #e5e7eb)',
          }}
        >
          {themeManagementSlot ?? defaultThemeManagementContent}
        </div>
      )}

      {/* Top-level grouping by ThemeSliceCategory — each group holds its own
          nested Accordion of per-component sections, since a single flat
          list of ~26 sections would be unusably long to scan or scroll. */}
      <Accordion
        type="single"
        defaultValue="global"
        items={[
          { value: 'global', title: '🌐 Global Theme & Color System', content: globalGroupContent },
          { value: 'layout', title: '📐 Layout Primitives', content: layoutPrimitivesGroupContent },
          { value: 'containers', title: '📦 Containers', content: containersGroupContent },
          { value: 'overlays', title: '🪟 Overlays', content: overlaysGroupContent },
          { value: 'datadisplay', title: '📊 Data Display', content: dataDisplayGroupContent },
          { value: 'formcontrols', title: '🎛️ Form Controls', content: formControlsGroupContent },
        ]}
      />
    </div>
  );
};
