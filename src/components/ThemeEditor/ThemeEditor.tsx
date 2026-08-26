import React, { type ReactNode, useMemo, useState, useRef } from 'react';
import { useTheme } from '../../theme/themeContext';
import { type HarmonyMode } from '../../theme/harmonies';
import { type PaddingMode } from '../../theme/padding';
import { type MarginMode } from '../../theme/margin';
import { type CornerRadiusMode } from '../../theme/radius';
import { type ShadowMode } from '../../theme/shadow';
import { isResponsiveConfig, resolveBaseMode } from '../../theme/responsive';
import { AnimationThemeSlice } from '../../theme/animation';
import { TypographyThemeSlice } from '../../theme/typography';
import { globalThemeSliceRegistry, type ThemeSlice, type ThemeSliceCategory } from '../../theme/slice';
import { type ToolcribSliceStateMap } from '../../theme/sliceStateMap';
import { captureThemeSnapshot, applyThemeSnapshot } from '../../theme/themePersistence';
import { presetThemes, type PresetTheme } from '../../theme/presetThemes';
import { listSavedThemes, saveThemeToLibrary, deleteThemeFromLibrary, getThemeFromLibrary, type SavedTheme } from '../../theme/themeLibrary';
import { downloadThemeSnapshot, readThemeSnapshotFromFile } from '../../theme/themeFileTransfer';
import { Button } from '../Form/FormComponents';
import { Input } from '../Form/FormComponents';
import { Slider } from '../Form/Slider';
import { Accordion } from '../Accordion/Accordion';
import { Tooltip } from '../Tooltip/Tooltip';
import { UIGroup } from '../UIGroup/UIGroup';
import { Popup } from '../Overlay/Popup';
import { type SquareCornerOption } from '../Card/Card';
import { Grid } from '../Layout/Grid';
import { FieldRow } from './ThemeEditorFieldRow';

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

// Slice ids handled entirely by hand-written JSX in the "Global" category
// below, never entered into the generic per-category loop further down:
//  - padding/margin/radius/shadow: structurally different from every other
//    registered slice (defaultState is a bare string like 'normal', not an
//    object) and wired to ThemeParameters/setPaddingMode etc., never
//    migrated to sliceStates/setSliceState — see
//    .plans/toolcrib-theme-slice-consolidation-handoff.md's own Phase 1
//    carve-out for why these were never part of the 29-slice problem this
//    whole effort addresses.
//  - animation/typography: real sliceStates slices (and each has a real
//    renderEditorControl on its own slice object, same as everything else),
//    kept in their current curated position inside "Global" for UX rather
//    than reshuffled into "Layout Primitives" (their own declared
//    category) — the Global section just calls their renderEditorControl
//    directly instead of re-inlining the JSX, so there's no duplication.
const GLOBAL_ONLY_SLICE_IDS = new Set(['padding', 'margin', 'radius', 'shadow', 'animation', 'typography']);

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
    sliceStates,
    setSliceState,
    toggleDarkMode,
  } = useTheme();

  // Every registered slice except the 6 handled by hand-written JSX in the
  // Global section above, grouped by category and sorted alphabetically by
  // name within each — fully self-registering: a new component's own slice
  // file is the only thing that needs touching (its own
  // `renderEditorControl` + declaration-merge registration), never this
  // file. Recomputed only when the registry's contents change, which is
  // never during a single session (every slice registers once, at module
  // load, in themeContext.tsx) — but the registry itself isn't a stable
  // reference react can key off, so this intentionally has no dependency
  // array beyond mount.
  const slicesByCategory = useMemo(() => {
    const grouped: Record<ThemeSliceCategory, ThemeSlice[]> = {
      'Layout Primitives': [],
      'Containers': [],
      'Overlays': [],
      'Data Display': [],
      'Form Controls': [],
    };
    for (const slice of globalThemeSliceRegistry.getAll()) {
      if (GLOBAL_ONLY_SLICE_IDS.has(slice.id) || !slice.renderEditorControl) continue;
      grouped[slice.category].push(slice);
    }
    for (const category of Object.keys(grouped) as ThemeSliceCategory[]) {
      grouped[category].sort((a, b) => a.name.localeCompare(b.name));
    }
    return grouped;
  }, []);

  // Renders one category's nested Accordion from whatever slices declared
  // themselves into that category — `slice.id` is a plain `string` here
  // (not a literal key of ToolcribSliceStateMap), so this one call site
  // needs the same narrow type bridge Phase 2's own generic `setSliceState`
  // already accepted for exactly this reason. Each slice's own TState is
  // erased to `any` by `ThemeSlice[]`'s default generics at this point,
  // which is what makes the bridge type-check at all — the alternative
  // would be re-deriving each slice's own state type generically here,
  // which defeats the point of a registry-driven loop.
  const renderCategorySection = (category: ThemeSliceCategory): ReactNode => (
    <Accordion
      type="single"
      items={slicesByCategory[category].map(slice => ({
        value: slice.id,
        title: slice.name,
        content: slice.renderEditorControl!(
          sliceStates[slice.id as keyof ToolcribSliceStateMap] ?? slice.defaultState,
          patch => setSliceState(slice.id as keyof ToolcribSliceStateMap, patch)
        ),
      }))}
    />
  );

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
        tooltip={isResponsiveConfig(parameters.paddingMode) ? 'Controlled by a responsive breakpoint config (set via initialParameters) -- showing its base tier' : 'Controls internal container padding density across all components'}
        value={resolveBaseMode(parameters.paddingMode)}
        onChange={val => setPaddingMode(val as PaddingMode)}
        disabled={isResponsiveConfig(parameters.paddingMode)}
        options={[
          { label: 'Compact (Tight rem padding)', value: 'compact' },
          { label: 'Normal (Standard rem padding)', value: 'normal' },
          { label: 'Spacious (Generous rem padding)', value: 'spacious' },
        ]}
      />
      <FieldRow
        label="Global Margin & Element Gaps"
        tooltip={isResponsiveConfig(parameters.marginMode) ? 'Controlled by a responsive breakpoint config (set via initialParameters) -- showing its base tier' : 'Controls vertical rhythm and gap spacing between UI elements'}
        value={resolveBaseMode(parameters.marginMode || 'normal')}
        onChange={val => setMarginMode(val as MarginMode)}
        disabled={isResponsiveConfig(parameters.marginMode)}
        options={[
          { label: 'Compact (Tight element gaps)', value: 'compact' },
          { label: 'Normal (Standard element gaps)', value: 'normal' },
          { label: 'Spacious (Generous element gaps)', value: 'spacious' },
        ]}
      />
      <FieldRow
        label="Corner Rounding Mode"
        tooltip={isResponsiveConfig(parameters.cornerRadiusMode) ? 'Controlled by a responsive breakpoint config (set via initialParameters) -- showing its base tier' : undefined}
        value={resolveBaseMode(parameters.cornerRadiusMode)}
        onChange={val => setCornerRadiusMode(val as CornerRadiusMode)}
        disabled={isResponsiveConfig(parameters.cornerRadiusMode)}
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

  // Thin wrappers delegating to each slice's own renderEditorControl,
  // instead of re-inlining their JSX here — animation/typography stay
  // hand-placed inside "Global" (see GLOBAL_ONLY_SLICE_IDS's own comment
  // for why), but no longer duplicate their control markup to do it.
  const animationContent = AnimationThemeSlice.renderEditorControl!(
    sliceStates.animation,
    patch => setSliceState('animation', patch)
  );

  const typographyContent = TypographyThemeSlice.renderEditorControl!(
    sliceStates.typography,
    patch => setSliceState('typography', patch)
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

  // ---- Category groups: each renders its own inner Accordion of sections ----

  const globalGroupContent = (
    <Accordion
      type="single"
      defaultValue="appearance"
      items={[
        { value: 'appearance', title: '🎨 Appearance & Base Color (HSV)', content: appearanceContent },
        { value: 'typography', title: '🔤 Typography (Font Family, Size & Line Height)', content: typographyContent },
        { value: 'density', title: '📐 Density, Spacing & Elevation', content: densityContent },
        { value: 'animation', title: '✨ Motion, Transitions & Physics', content: animationContent },
        { value: 'harmony', title: '🎼 Color Harmony & Hue Spread', content: harmonyContent },
        { value: 'subthemes', title: '🌈 Monochromatic Subthemes', content: subthemeContent },
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
          list of all registered slices would be unusably long to scan or
          scroll. Global stays hand-written (its content isn't uniformly
          slice-driven); the other five are generated from whatever slices
          declared themselves into that category. */}
      <Accordion
        type="single"
        defaultValue="global"
        items={[
          { value: 'global', title: '🌐 Global Theme & Color System', content: globalGroupContent },
          { value: 'layout', title: '📐 Layout Primitives', content: renderCategorySection('Layout Primitives') },
          { value: 'containers', title: '📦 Containers', content: renderCategorySection('Containers') },
          { value: 'overlays', title: '🪟 Overlays', content: renderCategorySection('Overlays') },
          { value: 'datadisplay', title: '📊 Data Display', content: renderCategorySection('Data Display') },
          { value: 'formcontrols', title: '🎛️ Form Controls', content: renderCategorySection('Form Controls') },
        ]}
      />
    </div>
  );
};
