import React, { useState, ReactElement, isValidElement, cloneElement } from 'react';
import { useTheme } from '../../theme/themeContext';
import { HarmonyMode } from '../../theme/harmonies';
import { PaddingMode } from '../../theme/padding';
import { MarginMode } from '../../theme/margin';
import { CornerRadiusMode } from '../../theme/radius';
import { ShadowMode } from '../../theme/shadow';
import { Button } from '../Form/FormComponents';
import { Select } from '../Form/Select';
import { Slider } from '../Form/Slider';
import { Accordion } from '../Accordion/Accordion';
import { Tooltip } from '../Tooltip/Tooltip';
import { SlideOut } from '../Overlay/SlideOut';

export interface ThemeEditorProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactElement;
  style?: React.CSSProperties;
}

/** @manifest Real-time HSV theme editor rendered in a SlideOut panel */
export const ThemeEditor: React.FC<ThemeEditorProps> = ({
  isOpen,
  onOpenChange,
  trigger,
  style,
}) => {
  const {
    parameters,
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
    tableState,
    setTableState,
    animationState,
    setAnimationState,
    tabState,
    setTabState,
    slideOutState,
    setSlideOutState,
    accordionState,
    setAccordionState,
    cardState,
    setCardState,
    tooltipState,
    setTooltipState,
    toggleDarkMode,
  } = useTheme();

  const [copied, setCopied] = useState(false);

  const copyCSSVariables = () => {
    const cssText = `:root {\n` +
      Object.entries(cssVariables)
        .map(([k, v]) => `  ${k}: ${v};`)
        .join('\n') +
      `\n}`;
    navigator.clipboard.writeText(cssText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const defaultTrigger = <Button variant="primary">🎨 OOTB Theme Editor</Button>;
  const activeTrigger = trigger || defaultTrigger;

  const typedTrigger = activeTrigger as ReactElement<{ style?: React.CSSProperties }>;
  const renderedTrigger = isValidElement(typedTrigger)
    ? cloneElement(typedTrigger, {
        style: {
          height: '100%',
          alignSelf: 'stretch',
          ...(typedTrigger.props.style || {}),
          ...style,
        },
      })
    : activeTrigger;

  const appearanceContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Light / Dark Mode Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--ai-bg-container, #f9fafb)', borderRadius: 'var(--ai-radius-sm, 0.375rem)' }}>
        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Mode Appearance</span>
        <Button size="sm" variant="outline" onClick={toggleDarkMode}>
          {parameters.isDarkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}
        </Button>
      </div>

      {/* Base Color HSV Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
      </div>
    </div>
  );

  const densityContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Global Padding Mode */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Global Padding Mode</label>
          <Tooltip content="Controls internal container padding density across all components">
            <span style={{ fontSize: '0.75rem', cursor: 'pointer' }}>ℹ️</span>
          </Tooltip>
        </div>
        <Select
          value={parameters.paddingMode}
          onChange={val => setPaddingMode(val as PaddingMode)}
          options={[
            { label: 'Compact (Tight rem padding)', value: 'compact' },
            { label: 'Normal (Standard rem padding)', value: 'normal' },
            { label: 'Spacious (Generous rem padding)', value: 'spacious' },
          ]}
        />
      </div>

      {/* Global Margin & Spacing Mode */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Global Margin & Element Gaps</label>
          <Tooltip content="Controls vertical rhythm and gap spacing between UI elements">
            <span style={{ fontSize: '0.75rem', cursor: 'pointer' }}>ℹ️</span>
          </Tooltip>
        </div>
        <Select
          value={parameters.marginMode || 'normal'}
          onChange={val => setMarginMode(val as MarginMode)}
          options={[
            { label: 'Compact (Tight element gaps)', value: 'compact' },
            { label: 'Normal (Standard element gaps)', value: 'normal' },
            { label: 'Spacious (Generous element gaps)', value: 'spacious' },
          ]}
        />
      </div>

      {/* Global Corner Radius Mode */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Corner Rounding Mode</label>
        <Select
          value={parameters.cornerRadiusMode}
          onChange={val => setCornerRadiusMode(val as CornerRadiusMode)}
          options={[
            { label: 'Sharp (0rem Square Corners)', value: 'sharp' },
            { label: 'Subtle (Compact Corner Rounding)', value: 'subtle' },
            { label: 'Rounded (Standard Corner Rounding)', value: 'rounded' },
            { label: 'Pill (Full Rounding)', value: 'pill' },
          ]}
        />
      </div>

      {/* Elevation & Shadow Mode */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Elevation & Shadow Depth</label>
        <Select
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
    </div>
  );

  const harmonyContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Harmony Mode */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Color Harmony Mode</label>
          <Tooltip content="Calculates primary, secondary, and accent colors in HSV space">
            <span style={{ fontSize: '0.75rem', cursor: 'pointer' }}>ℹ️</span>
          </Tooltip>
        </div>
        <Select
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
      </div>

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

      {/* Master Font Size */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
          <span>Master Font Size (rem Base)</span>
          <span>{parameters.masterFontSize}px</span>
        </div>
        <Slider
          min={12}
          max={24}
          value={parameters.masterFontSize}
          onChange={val => setMasterFontSize(val)}
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
        <div style={{ padding: '0.5rem', background: 'var(--ai-subtheme-error-bg)', color: 'var(--ai-subtheme-error-text)', border: '0.0625rem solid var(--ai-subtheme-error-border)', borderRadius: 'var(--ai-radius-sm, 0.25rem)', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
          Error Subtheme
        </div>
        <div style={{ padding: '0.5rem', background: 'var(--ai-subtheme-success-bg)', color: 'var(--ai-subtheme-success-text)', border: '0.0625rem solid var(--ai-subtheme-success-border)', borderRadius: 'var(--ai-radius-sm, 0.25rem)', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
          Success Subtheme
        </div>
        <div style={{ padding: '0.5rem', background: 'var(--ai-subtheme-warning-bg)', color: 'var(--ai-subtheme-warning-text)', border: '0.0625rem solid var(--ai-subtheme-warning-border)', borderRadius: 'var(--ai-radius-sm, 0.25rem)', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
          Warning Subtheme
        </div>
        <div style={{ padding: '0.5rem', background: 'var(--ai-subtheme-info-bg)', color: 'var(--ai-subtheme-info-text)', border: '0.0625rem solid var(--ai-subtheme-info-border)', borderRadius: 'var(--ai-radius-sm, 0.25rem)', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
          Info Subtheme
        </div>
      </div>
    </div>
  );

  const tableContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Table Cell Density */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Table Cell Density</label>
          <Tooltip content="Configures padding and row height across all Data Table instances">
            <span style={{ fontSize: '0.75rem', cursor: 'pointer' }}>ℹ️</span>
          </Tooltip>
        </div>
        <Select
          value={tableState.density}
          onChange={val => setTableState({ density: val as any })}
          options={[
            { label: 'Compact (2.25rem Row Height & Tight Cell Padding)', value: 'compact' },
            { label: 'Normal (2.75rem Row Height & Standard Cell Padding)', value: 'normal' },
            { label: 'Spacious (3.5rem Row Height & Generous Cell Padding)', value: 'spacious' },
          ]}
        />
      </div>

      {/* Table Border Grid Style */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Grid Border Lines</label>
        <Select
          value={tableState.borderStyle}
          onChange={val => setTableState({ borderStyle: val as any })}
          options={[
            { label: 'Horizontal Rows Only', value: 'horizontal' },
            { label: 'Full Grid Borders', value: 'grid' },
            { label: 'No Borders (Borderless)', value: 'none' },
          ]}
        />
      </div>
    </div>
  );

  const animationContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Animation Preset */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Transition Physics Preset</label>
          <Tooltip content="Configures global easing curves and transition durations across all components">
            <span style={{ fontSize: '0.75rem', cursor: 'pointer' }}>ℹ️</span>
          </Tooltip>
        </div>
        <Select
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
      </div>

      {/* Animation Speed Factor */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 600 }}>
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

  const tabStripContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Tab Variant */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Tab Group Variant</label>
          <Tooltip content="Configures tab trigger visual styling across all TabStrip components">
            <span style={{ fontSize: '0.75rem', cursor: 'pointer' }}>ℹ️</span>
          </Tooltip>
        </div>
        <Select
          value={tabState.variant}
          onChange={val => setTabState({ variant: val as any })}
          options={[
            { label: 'Pills (Rounded Pill Triggers)', value: 'pills' },
            { label: 'Underline (Bottom Active Indicator)', value: 'underline' },
            { label: 'Cards (Folder Tab Header Style)', value: 'cards' },
            { label: 'Segment (Segmented Control)', value: 'segment' },
          ]}
        />
      </div>

      {/* Tab Size */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Tab Density & Size</label>
        <Select
          value={tabState.size}
          onChange={val => setTabState({ size: val as any })}
          options={[
            { label: 'Small (Compact Padding & 12px Font)', value: 'sm' },
            { label: 'Medium (Standard Padding & 14px Font)', value: 'md' },
            { label: 'Large (Spacious Padding & 16px Font)', value: 'lg' },
          ]}
        />
      </div>

      {/* Tab Panel Switch Transition */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Tab Panel Switch Animation</label>
        <Select
          value={tabState.panelTransition}
          onChange={val => setTabState({ panelTransition: val as any })}
          options={[
            { label: 'Fade In (Smooth Dissolve Transition)', value: 'fade' },
            { label: 'Scale & Fade (Pop & Scale Transition)', value: 'scale-fade' },
            { label: 'None (Instant Panel Switching)', value: 'none' },
          ]}
        />
      </div>
    </div>
  );

  const slideOutContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* SlideOut Default Width */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Drawer Panel Width</label>
          <Tooltip content="Configures default width for SlideOut drawers">
            <span style={{ fontSize: '0.75rem', cursor: 'pointer' }}>ℹ️</span>
          </Tooltip>
        </div>
        <Select
          value={slideOutState.width}
          onChange={val => setSlideOutState({ width: val as any })}
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
      </div>

      {/* Header Margin Mode */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Drawer Header Margin & Floating Mode</label>
        <Select
          value={slideOutState.headerMargin}
          onChange={val => setSlideOutState({ headerMargin: val as any })}
          options={[
            { label: 'Flush Header (0 Margin)', value: 'none' },
            { label: 'Compact Gap (0.5rem Bottom Margin)', value: 'compact' },
            { label: 'Normal Gap (1.0rem Bottom Margin)', value: 'normal' },
            { label: 'Spacious Gap (1.5rem Bottom Margin)', value: 'spacious' },
            { label: 'Floating Card Header (Detached Margin)', value: 'detached' },
          ]}
        />
      </div>

      {/* Backdrop Blur Intensity */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Backdrop Glassmorphism Blur</label>
        <Select
          value={slideOutState.backdropBlur}
          onChange={val => setSlideOutState({ backdropBlur: val as any })}
          options={[
            { label: 'Subtle Blur (2px)', value: 'subtle' },
            { label: 'Heavy Glass Blur (8px)', value: 'heavy' },
            { label: 'None (Solid Backdrop)', value: 'none' },
          ]}
        />
      </div>
    </div>
  );

  const accordionSectionContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header Padding */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Accordion Header Padding</label>
        <Select
          value={accordionState.headerPadding}
          onChange={val => setAccordionState({ headerPadding: val as any })}
          options={[
            { label: 'Compact (0.5rem 0.75rem)', value: 'compact' },
            { label: 'Normal (0.875rem 1.125rem)', value: 'normal' },
            { label: 'Spacious (1.25rem 1.5rem)', value: 'spacious' },
          ]}
        />
      </div>

      {/* Inter-Header Item Gap Margin */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Inter-Header Item Gap Margin</label>
        <Select
          value={accordionState.itemGap}
          onChange={val => setAccordionState({ itemGap: val as any })}
          options={[
            { label: 'None (Flush 0px Gap)', value: 'none' },
            { label: 'Compact Gap (0.375rem Gap)', value: 'compact' },
            { label: 'Normal Gap (0.75rem Gap)', value: 'normal' },
            { label: 'Spacious Gap (1.25rem Gap)', value: 'spacious' },
          ]}
        />
      </div>

      {/* Panel Transition & Animation Preset */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Panel Transition & Animation Preset</label>
        <Select
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
    </div>
  );

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontFamily: 'inherit' }}>
      {/* Collapsible Accordion Sections */}
      <Accordion
        type="single"
        defaultValue="appearance"
        items={[
          { value: 'appearance', title: '🎨 Appearance & Base Color (HSV)', content: appearanceContent },
          { value: 'density', title: '📐 Density, Spacing & Elevation', content: densityContent },
          { value: 'animation', title: '✨ Motion, Transitions & Physics', content: animationContent },
          { value: 'slideout', title: '🪟 SlideOut Drawer & Retract Dynamics', content: slideOutContent },
          { value: 'accordion', title: '🪗 Accordion Header & Gap Spacing', content: accordionSectionContent },
          { value: 'tab', title: '📑 Tab Group Panels & Variants', content: tabStripContent },
          { value: 'table', title: '📊 Data Table Layout & Density', content: tableContent },
          { value: 'harmony', title: '🎼 Color Harmony & Typography', content: harmonyContent },
          { value: 'subthemes', title: '🌈 Monochromatic Subthemes', content: subthemeContent },
        ]}
      />

      {/* Copy CSS Custom Properties Button */}
      <Button onClick={copyCSSVariables} variant="secondary" style={{ marginTop: '0.5rem' }}>
        {copied ? '✓ Copied CSS Variables!' : '📋 Copy CSS Custom Properties'}
      </Button>
    </div>
  );

  return (
    <SlideOut
      id="theme-editor-panel"
      title="🎨 OOTB Theme Designer"
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      trigger={renderedTrigger}
      style={style}
      width="26rem"
    >
      {content}
    </SlideOut>
  );
};
