'use client';

/**
 * Every registered slice's Theme Editor control UI, consolidated into one
 * file instead of living inline inside each *Slice.tsx file -- Part of
 * #577 (registerThemeSlices.ts tree-shaking audit). Every one of these
 * functions references FieldRow (a real UI component, pulling in Select/
 * Label/etc. transitively) or, for the three Global-section slices,
 * <Slider> directly -- keeping them inline inside each component's own
 * always-eagerly-registered slice file meant importing ANY toolcrib
 * component (even just <Button>) unconditionally bundled all ~44 other
 * components' Theme Editor UI too, via themeContext.tsx's own eager
 * './registerThemeSlices' side-effect import. Moving them here means this
 * file -- not themeContext.tsx -- is what pulls FieldRow in, and this file
 * is only ever imported by ThemeEditor.tsx itself, an opt-in component a
 * consumer explicitly imports when they want live theme editing. Nothing
 * about *slice registration* changes: every slice's pure data (id,
 * defaultState, getCSSVariables, fieldVars) is still eagerly registered
 * exactly as before, in each *Slice.tsx file, which is what SSR
 * (computeServerThemeCSS) and ThemeProvider's own :root variable
 * computation both correctly still depend on unconditionally.
 *
 * Keyed by each slice's own `id` (not the exported `XThemeSlice` object
 * itself) so ThemeEditor.tsx's existing registry-driven loop (iterating
 * `globalThemeSliceRegistry.getAll()`) needs only this one extra lookup,
 * with no other change to its own generic rendering logic.
 */
import { type ReactNode } from 'react';
import { FieldRow } from './ThemeEditorFieldRow';
import { Slider } from '../Form/Slider';
import { type AlertDialogSliceState, type AlertDialogBackdropBlur, type AlertDialogOverlayDarkness } from '../AlertDialog/AlertDialogSlice';
import { type AppShellSliceState, type AppShellDensity } from '../AppShell/AppShellSlice';
import { type AvatarSliceState, type AvatarShape } from '../Avatar/AvatarSlice';
import { type CollapsibleSliceState, type CollapsiblePadding } from '../Collapsible/CollapsibleSlice';
import { type DatePickerSliceState, type DatePickerCellSize } from '../DatePicker/DatePickerSlice';
import { type AccordionSliceState, type AccordionHeaderPadding, type AccordionItemGap, type AccordionPanelAnimation } from '../Accordion/AccordionSlice';
import { type ChartSliceState, type ChartGridStyle, type ChartTooltipShadow, type ChartHoverEmphasis } from '../Chart/ChartSlice';
import { type CarouselSliceState, type CarouselArrowSize, type CarouselDotSize, type CarouselDotSubtheme } from '../Carousel/CarouselSlice';
import { type TableSliceState, type TableDensity, type TableBorderStyle } from '../DataTable/DataTableSlice';
import { type CardSliceState, type CardPadding, type CardHeaderStyle } from '../Card/CardSlice';
import { type CommandPaletteSliceState, type CommandPaletteItemDensity } from '../CommandPalette/CommandPaletteSlice';
import { type BreadcrumbSliceState, type BreadcrumbGap } from '../Breadcrumb/BreadcrumbSlice';
import { type DropdownMenuSliceState, type DropdownMenuShadowDepth, type DropdownMenuItemDensity } from '../DropdownMenu/DropdownMenuSlice';
import { type ContextMenuSliceState, type ContextMenuShadowDepth, type ContextMenuItemDensity } from '../ContextMenu/ContextMenuSlice';
import { type HoverCardSliceState, type HoverCardShadowDepth, type HoverCardBorderStyle } from '../HoverCard/HoverCardSlice';
import { type ScrollAreaSliceState, type ScrollbarWidth } from '../ScrollArea/ScrollAreaSlice';
import { type RatingSliceState, type RatingIconSize, type RatingGap } from '../Rating/RatingSlice';
import { type ProgressSliceState, type ProgressTrackRadius } from '../Progress/ProgressSlice';
import { type SidebarSliceState, type SidebarItemGap } from '../Sidebar/SidebarSlice';
import { type SeparatorSliceState, type SeparatorThickness } from '../Separator/SeparatorSlice';
import { type GallerySliceState, type GalleryThumbnailAspectRatio } from '../Gallery/GallerySlice';
import { type DrawerSliceState, type DrawerWidth, type DrawerHeaderMargin, type DrawerBackdrop } from '../Overlay/DrawerSlice';
import { type TabSliceState, type TabVariant, type TabSize, type TabPanelTransition } from '../TabStrip/TabSlice';
import { type PopupSliceState, type PopupShadowDepth, type PopupBorderStyle } from '../Overlay/PopupSlice';
import { type ButtonSliceState, type ButtonFontWeight, type ButtonIconGap } from '../Form/ButtonSlice';
import { type StepperSliceState, type StepperSize } from '../Stepper/StepperSlice';
import { type ModalSliceState, type ModalBackdropBlur, type ModalOverlayDarkness } from '../Overlay/ModalSlice';
import { type ComboboxSliceState, type ComboboxPadding, type ComboboxItemDensity } from '../Form/ComboboxSlice';
import { type ToastSliceState, type ToastShadowDepth, type ToastAccentStyle } from '../Toast/ToastSlice';
import { type ToggleSliceState, type TogglePadding } from '../ToggleGroup/ToggleSlice';
import { type FileUploadSliceState, type FileUploadDensity } from '../Form/FileUploadSlice';
import { type InputSliceState, type InputPadding, type InputBorderWidth } from '../Form/InputSlice';
import { type ToolbarSliceState, type ToolbarSlotGap } from '../Toolbar/ToolbarSlice';
import { type RadioGroupSliceState, type RadioGroupGap, type RadioGroupDotSize } from '../Form/RadioGroupSlice';
import { type LabelSliceState, type LabelWeight, type LabelGap } from '../Form/LabelSlice';
import { type SelectSliceState, type SelectPadding, type SelectItemDensity } from '../Form/SelectSlice';
import { type SliderSliceState, type SliderTrackHeight, type SliderThumbSize } from '../Form/SliderSlice';
import { type ToggleControlSliceState, type ToggleControlSize } from '../Form/ToggleControlSlice';
import { type ViewerSliceState, type ViewerNavButtonSize, type ViewerCaptionStyle } from '../Viewer/ViewerSlice';
import { type UIGroupSliceState, type UIGroupOverlap } from '../UIGroup/UIGroupSlice';
import { type TreeSliceState, type TreeIndent, type TreeItemGap } from '../Tree/TreeSlice';
import { type TooltipSliceState, type TooltipTheme, type TooltipSize } from '../Tooltip/TooltipSlice';
import { type AnimationSliceState, type AnimationPreset } from '../../theme/animation';
import { type LivingColorSliceState, type LivingColorEnabled } from '../../theme/livingColor';
import { type TypographySliceState, type FontFamilyPreset } from '../../theme/typography';
import { DENSITY_ROW_HEIGHT_PX } from '../DataTable/DataTableSlice';

export const SLICE_EDITOR_CONTROLS: Record<string, (state: any, onChange: (next: any) => void) => ReactNode> = {
  alertdialog: (state: AlertDialogSliceState, onChange: (next: AlertDialogSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Alert Dialog Backdrop Blur"
            value={state.backdropBlur}
            onChange={val => onChange({ ...state, backdropBlur: val as AlertDialogBackdropBlur })}
            options={[
              { label: 'None', value: 'none' },
              { label: 'Subtle (0.1875rem)', value: 'subtle' },
              { label: 'Heavy (0.5rem)', value: 'heavy' },
            ]}
          />
          <FieldRow
            label="Alert Dialog Overlay Darkness"
            value={state.overlayDarkness}
            onChange={val => onChange({ ...state, overlayDarkness: val as AlertDialogOverlayDarkness })}
            options={[
              { label: 'Light (30% Black)', value: 'light' },
              { label: 'Normal (50% Black)', value: 'normal' },
              { label: 'Dark (70% Black)', value: 'dark' },
            ]}
          />
        </div>
  ),
  appshell: (state: AppShellSliceState, onChange: (next: AppShellSliceState) => void) => (
    <FieldRow
          label="App Shell Header & Main Density"
          tooltip="Since AppShell is meant to render once, this mostly exists for consistency with other components"
          value={state.density}
          onChange={val => onChange({ ...state, density: val as AppShellDensity })}
          options={[
            { label: 'Compact', value: 'compact' },
            { label: 'Normal', value: 'normal' },
            { label: 'Spacious', value: 'spacious' },
          ]}
        />
  ),
  avatar: (state: AvatarSliceState, onChange: (next: AvatarSliceState) => void) => (
    <FieldRow
          label="Avatar Shape"
          value={state.shape}
          onChange={val => onChange({ ...state, shape: val as AvatarShape })}
          options={[
            { label: 'Circle', value: 'circle' },
            { label: 'Rounded Square', value: 'rounded-square' },
            { label: 'Square', value: 'square' },
          ]}
        />
  ),
  collapsible: (state: CollapsibleSliceState, onChange: (next: CollapsibleSliceState) => void) => (
    <FieldRow
          label="Collapsible Header & Content Padding"
          value={state.padding}
          onChange={val => onChange({ ...state, padding: val as CollapsiblePadding })}
          options={[
            { label: 'Compact', value: 'compact' },
            { label: 'Normal', value: 'normal' },
            { label: 'Spacious', value: 'spacious' },
          ]}
        />
  ),
  datepicker: (state: DatePickerSliceState, onChange: (next: DatePickerSliceState) => void) => (
    <FieldRow
          label="Date Picker Grid Cell Size"
          value={state.cellSize}
          onChange={val => onChange({ ...state, cellSize: val as DatePickerCellSize })}
          options={[
            { label: 'Small', value: 'sm' },
            { label: 'Medium', value: 'md' },
            { label: 'Large', value: 'lg' },
          ]}
        />
  ),
  accordion: (state: AccordionSliceState, onChange: (next: AccordionSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Accordion Header Padding"
            value={state.headerPadding}
            onChange={val => onChange({ ...state, headerPadding: val as AccordionHeaderPadding })}
            options={[
              { label: 'Compact (0.5rem 0.75rem)', value: 'compact' },
              { label: 'Normal (0.875rem 1.125rem)', value: 'normal' },
              { label: 'Spacious (1.25rem 1.5rem)', value: 'spacious' },
            ]}
          />
          <FieldRow
            label="Inter-Header Item Gap Margin"
            value={state.itemGap}
            onChange={val => onChange({ ...state, itemGap: val as AccordionItemGap })}
            options={[
              { label: 'None (Flush 0px Gap)', value: 'none' },
              { label: 'Compact Gap (0.375rem Gap)', value: 'compact' },
              { label: 'Normal Gap (0.75rem Gap)', value: 'normal' },
              { label: 'Spacious Gap (1.25rem Gap)', value: 'spacious' },
            ]}
          />
          <FieldRow
            label="Panel Transition & Animation Preset"
            value={state.panelAnimation}
            onChange={val => onChange({ ...state, panelAnimation: val as AccordionPanelAnimation })}
            options={[
              { label: 'Slide & Fade Down (Smooth 0.25s)', value: 'slide-fade' },
              { label: 'Quick Expand (Snappy 0.2s)', value: 'expand' },
              { label: 'Scale & Fade (Pop In)', value: 'scale-fade' },
              { label: 'None (Instant Toggle)', value: 'none' },
            ]}
          />
        </div>
  ),
  chart: (state: ChartSliceState, onChange: (next: ChartSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Chart Gridlines"
            value={state.gridStyle}
            onChange={val => onChange({ ...state, gridStyle: val as ChartGridStyle })}
            options={[
              { label: 'Visible', value: 'visible' },
              { label: 'Hidden', value: 'hidden' },
            ]}
          />
          <FieldRow
            label="Chart Tooltip Shadow"
            value={state.tooltipShadow}
            onChange={val => onChange({ ...state, tooltipShadow: val as ChartTooltipShadow })}
            options={[
              { label: 'Subtle', value: 'subtle' },
              { label: 'Elevated', value: 'elevated' },
            ]}
          />
          <FieldRow
            label="Chart Hover Emphasis"
            tooltip="How strongly a bar or slice lifts (brightness + ring width) on hover/focus"
            value={state.hoverEmphasis}
            onChange={val => onChange({ ...state, hoverEmphasis: val as ChartHoverEmphasis })}
            options={[
              { label: 'Subtle', value: 'subtle' },
              { label: 'Bold', value: 'bold' },
            ]}
          />
        </div>
  ),
  carousel: (state: CarouselSliceState, onChange: (next: CarouselSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Carousel Arrow Size"
            value={state.arrowSize}
            onChange={val => onChange({ ...state, arrowSize: val as CarouselArrowSize })}
            options={[
              { label: 'Small (2rem)', value: 'sm' },
              { label: 'Medium (2.75rem)', value: 'md' },
              { label: 'Large (3.5rem)', value: 'lg' },
            ]}
          />
          <FieldRow
            label="Carousel Dot Size"
            value={state.dotSize}
            onChange={val => onChange({ ...state, dotSize: val as CarouselDotSize })}
            options={[
              { label: 'Small (0.375rem)', value: 'sm' },
              { label: 'Medium (0.5rem)', value: 'md' },
              { label: 'Large (0.75rem)', value: 'lg' },
            ]}
          />
          <FieldRow
            label="Carousel Active Dot Colour"
            value={state.dotActiveSubtheme}
            onChange={val => onChange({ ...state, dotActiveSubtheme: val as CarouselDotSubtheme })}
            options={[
              { label: 'Primary', value: 'primary' },
              { label: 'Secondary', value: 'secondary' },
              { label: 'Success', value: 'success' },
              { label: 'Info', value: 'info' },
            ]}
          />
          <FieldRow
            label="Carousel Slide Gap"
            value={state.slideGap}
            onChange={val => onChange({ ...state, slideGap: val as 'sm' | 'md' | 'lg' })}
            options={[
              { label: 'Small (0.5rem)', value: 'sm' },
              { label: 'Medium (1rem)', value: 'md' },
              { label: 'Large (1.5rem)', value: 'lg' },
            ]}
          />
        </div>
  ),
  table: (state: TableSliceState, onChange: (next: TableSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Table Cell Density"
            tooltip="Configures padding and row height across all Data Table instances"
            value={state.density}
            onChange={val => onChange({ ...state, density: val as TableDensity })}
            options={[
              { label: `Compact (${DENSITY_ROW_HEIGHT_PX.compact / 16}rem Row Height & Tight Cell Padding)`, value: 'compact' },
              { label: `Normal (${DENSITY_ROW_HEIGHT_PX.normal / 16}rem Row Height & Standard Cell Padding)`, value: 'normal' },
              { label: `Spacious (${DENSITY_ROW_HEIGHT_PX.spacious / 16}rem Row Height & Generous Cell Padding)`, value: 'spacious' },
            ]}
          />
          <FieldRow
            label="Grid Border Lines"
            value={state.borderStyle}
            onChange={val => onChange({ ...state, borderStyle: val as TableBorderStyle })}
            options={[
              { label: 'Horizontal Rows Only', value: 'horizontal' },
              { label: 'Full Grid Borders', value: 'grid' },
              { label: 'No Borders (Borderless)', value: 'none' },
            ]}
          />
        </div>
  ),
  card: (state: CardSliceState, onChange: (next: CardSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Card Padding"
            value={state.padding}
            onChange={val => onChange({ ...state, padding: val as CardPadding })}
            options={[
              { label: 'Compact (0.75rem 1rem)', value: 'compact' },
              { label: 'Normal (1.25rem 1.5rem)', value: 'normal' },
              { label: 'Spacious (1.75rem 2.25rem)', value: 'spacious' },
            ]}
          />
          <FieldRow
            label="Card Header Style"
            tooltip="Controls the header's background and bottom border across all Card components"
            value={state.headerStyle}
            onChange={val => onChange({ ...state, headerStyle: val as CardHeaderStyle })}
            options={[
              { label: 'Flush (No Border)', value: 'flush' },
              { label: 'Bordered (Bottom Border)', value: 'bordered' },
              { label: 'Subtle Background (Tinted Header)', value: 'subtle-bg' },
            ]}
          />
        </div>
  ),
  commandpalette: (state: CommandPaletteSliceState, onChange: (next: CommandPaletteSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Command Palette Item Density"
            value={state.itemDensity}
            onChange={val => onChange({ ...state, itemDensity: val as CommandPaletteItemDensity })}
            options={[
              { label: 'Compact', value: 'compact' },
              { label: 'Normal', value: 'normal' },
            ]}
          />
          {/* maxListHeight is a free-form rem string on the wire (not a closed
              union in state) — offered here as a small preset row, the same
              shape DrawerSlice's `width` field already uses for a CSS value
              that's free-form on the wire but closed in state. */}
          <FieldRow
            label="Command Palette Max List Height"
            tooltip="How tall the scrollable item list can grow before it scrolls internally"
            value={state.maxListHeight}
            onChange={val => onChange({ ...state, maxListHeight: val })}
            options={[
              { label: 'Compact (15rem)', value: '15rem' },
              { label: 'Normal (21.875rem)', value: '21.875rem' },
              { label: 'Tall (30rem)', value: '30rem' },
            ]}
          />
        </div>
  ),
  breadcrumb: (state: BreadcrumbSliceState, onChange: (next: BreadcrumbSliceState) => void) => (
    <FieldRow
          label="Breadcrumb Item Gap"
          value={state.gap}
          onChange={val => onChange({ ...state, gap: val as BreadcrumbGap })}
          options={[
            { label: 'Compact (0.375rem)', value: 'compact' },
            { label: 'Normal (0.5rem)', value: 'normal' },
            { label: 'Spacious (0.75rem)', value: 'spacious' },
          ]}
        />
  ),
  dropdownmenu: (state: DropdownMenuSliceState, onChange: (next: DropdownMenuSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Dropdown Menu Shadow Depth"
            value={state.shadowDepth}
            onChange={val => onChange({ ...state, shadowDepth: val as DropdownMenuShadowDepth })}
            options={[
              { label: 'Subtle', value: 'subtle' },
              { label: 'Elevated', value: 'elevated' },
            ]}
          />
          <FieldRow
            label="Dropdown Menu Item Density"
            value={state.itemDensity}
            onChange={val => onChange({ ...state, itemDensity: val as DropdownMenuItemDensity })}
            options={[
              { label: 'Compact', value: 'compact' },
              { label: 'Normal', value: 'normal' },
            ]}
          />
        </div>
  ),
  contextmenu: (state: ContextMenuSliceState, onChange: (next: ContextMenuSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Context Menu Shadow Depth"
            value={state.shadowDepth}
            onChange={val => onChange({ ...state, shadowDepth: val as ContextMenuShadowDepth })}
            options={[
              { label: 'Subtle', value: 'subtle' },
              { label: 'Elevated', value: 'elevated' },
            ]}
          />
          <FieldRow
            label="Context Menu Item Density"
            value={state.itemDensity}
            onChange={val => onChange({ ...state, itemDensity: val as ContextMenuItemDensity })}
            options={[
              { label: 'Compact', value: 'compact' },
              { label: 'Normal', value: 'normal' },
            ]}
          />
        </div>
  ),
  hoverCard: (state: HoverCardSliceState, onChange: (next: HoverCardSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Hover Card Shadow Depth"
            value={state.shadowDepth}
            onChange={val => onChange({ ...state, shadowDepth: val as HoverCardShadowDepth })}
            options={[
              { label: 'Subtle', value: 'subtle' },
              { label: 'Elevated', value: 'elevated' },
            ]}
          />
          <FieldRow
            label="Hover Card Border Style"
            value={state.borderStyle}
            onChange={val => onChange({ ...state, borderStyle: val as HoverCardBorderStyle })}
            options={[
              { label: 'Bordered', value: 'bordered' },
              { label: 'Borderless', value: 'borderless' },
            ]}
          />
        </div>
  ),
  scrollArea: (state: ScrollAreaSliceState, onChange: (next: ScrollAreaSliceState) => void) => (
    <FieldRow
          label="Scrollbar Width"
          value={state.thumbWidth}
          onChange={val => onChange({ ...state, thumbWidth: val as ScrollbarWidth })}
          options={[
            { label: 'Thin (0.375rem)', value: 'thin' },
            { label: 'Normal (0.5rem)', value: 'normal' },
            { label: 'Thick (0.75rem)', value: 'thick' },
          ]}
        />
  ),
  rating: (state: RatingSliceState, onChange: (next: RatingSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Rating Icon Size"
            value={state.iconSize}
            onChange={val => onChange({ ...state, iconSize: val as RatingIconSize })}
            options={[
              { label: 'Small (1rem)', value: 'sm' },
              { label: 'Medium (1.375rem)', value: 'md' },
              { label: 'Large (1.75rem)', value: 'lg' },
            ]}
          />
          <FieldRow
            label="Rating Icon Gap"
            value={state.gap}
            onChange={val => onChange({ ...state, gap: val as RatingGap })}
            options={[
              { label: 'Compact (0.125rem)', value: 'compact' },
              { label: 'Normal (0.25rem)', value: 'normal' },
              { label: 'Spacious (0.5rem)', value: 'spacious' },
            ]}
          />
        </div>
  ),
  progress: (state: ProgressSliceState, onChange: (next: ProgressSliceState) => void) => (
    <FieldRow
          label="Progress Bar Track Shape"
          value={state.trackRadius}
          onChange={val => onChange({ ...state, trackRadius: val as ProgressTrackRadius })}
          options={[
            { label: 'Sharp (0rem)', value: 'sharp' },
            { label: 'Rounded', value: 'rounded' },
            { label: 'Pill (Full Rounding)', value: 'pill' },
          ]}
        />
  ),
  sidebar: (state: SidebarSliceState, onChange: (next: SidebarSliceState) => void) => (
    <FieldRow
          label="Sidebar Nav Item Spacing"
          value={state.itemGap}
          onChange={val => onChange({ ...state, itemGap: val as SidebarItemGap })}
          options={[
            { label: 'Compact (0.125rem)', value: 'compact' },
            { label: 'Normal (0.375rem)', value: 'normal' },
          ]}
        />
  ),
  separator: (state: SeparatorSliceState, onChange: (next: SeparatorSliceState) => void) => (
    <FieldRow
          label="Separator Thickness"
          value={state.thickness}
          onChange={val => onChange({ ...state, thickness: val as SeparatorThickness })}
          options={[
            { label: 'Thin (0.0625rem)', value: 'thin' },
            { label: 'Normal (0.125rem)', value: 'normal' },
            { label: 'Thick (0.1875rem)', value: 'thick' },
          ]}
        />
  ),
  gallery: (state: GallerySliceState, onChange: (next: GallerySliceState) => void) => (
    <FieldRow
          label="Gallery Thumbnail Aspect Ratio"
          value={state.thumbnailAspectRatio}
          onChange={val => onChange({ ...state, thumbnailAspectRatio: val as GalleryThumbnailAspectRatio })}
          options={[
            { label: 'Square (1:1)', value: 'square' },
            { label: 'Landscape (16:9)', value: 'landscape' },
            { label: 'Portrait (3:4)', value: 'portrait' },
            { label: 'Auto (Natural Image Ratio)', value: 'auto' },
          ]}
        />
  ),
  drawer: (state: DrawerSliceState, onChange: (next: DrawerSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Drawer Panel Width"
            tooltip="Configures default width for Drawer panels"
            value={state.width}
            onChange={val => onChange({ ...state, width: val as DrawerWidth })}
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
            value={state.headerMargin}
            onChange={val => onChange({ ...state, headerMargin: val as DrawerHeaderMargin })}
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
            value={state.backdropBlur}
            onChange={val => onChange({ ...state, backdropBlur: val as DrawerBackdrop })}
            options={[
              { label: 'Subtle Blur (2px)', value: 'subtle' },
              { label: 'Heavy Glass Blur (8px)', value: 'heavy' },
              { label: 'None (Solid Backdrop)', value: 'none' },
            ]}
          />
        </div>
  ),
  tab: (state: TabSliceState, onChange: (next: TabSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Tab Group Variant"
            tooltip="Configures tab trigger visual styling across all TabStrip components"
            value={state.variant}
            onChange={val => onChange({ ...state, variant: val as TabVariant })}
            options={[
              { label: 'Pills (Rounded Pill Triggers)', value: 'pills' },
              { label: 'Underline (Bottom Active Indicator)', value: 'underline' },
              { label: 'Cards (Folder Tab Header Style)', value: 'cards' },
              { label: 'Segment (Segmented Control)', value: 'segment' },
            ]}
          />
          <FieldRow
            label="Tab Density & Size"
            value={state.size}
            onChange={val => onChange({ ...state, size: val as TabSize })}
            options={[
              { label: 'Small (Compact Padding & 12px Font)', value: 'sm' },
              { label: 'Medium (Standard Padding & 14px Font)', value: 'md' },
              { label: 'Large (Spacious Padding & 16px Font)', value: 'lg' },
            ]}
          />
          <FieldRow
            label="Tab Panel Switch Animation"
            value={state.panelTransition}
            onChange={val => onChange({ ...state, panelTransition: val as TabPanelTransition })}
            options={[
              { label: 'Fade In (Smooth Dissolve Transition)', value: 'fade' },
              { label: 'Scale & Fade (Pop & Scale Transition)', value: 'scale-fade' },
              { label: 'None (Instant Panel Switching)', value: 'none' },
            ]}
          />
        </div>
  ),
  popup: (state: PopupSliceState, onChange: (next: PopupSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Popup Shadow Depth"
            value={state.shadowDepth}
            onChange={val => onChange({ ...state, shadowDepth: val as PopupShadowDepth })}
            options={[
              { label: 'Subtle', value: 'subtle' },
              { label: 'Elevated', value: 'elevated' },
            ]}
          />
          <FieldRow
            label="Popup Border Style"
            value={state.borderStyle}
            onChange={val => onChange({ ...state, borderStyle: val as PopupBorderStyle })}
            options={[
              { label: 'Bordered', value: 'bordered' },
              { label: 'Borderless', value: 'borderless' },
            ]}
          />
        </div>
  ),
  button: (state: ButtonSliceState, onChange: (next: ButtonSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Button Font Weight"
            value={state.fontWeight}
            onChange={val => onChange({ ...state, fontWeight: val as ButtonFontWeight })}
            options={[
              { label: 'Normal (500)', value: 'normal' },
              { label: 'Semibold (600)', value: 'semibold' },
              { label: 'Bold (700)', value: 'bold' },
            ]}
          />
          <FieldRow
            label="Button Icon Gap"
            value={state.iconGap}
            onChange={val => onChange({ ...state, iconGap: val as ButtonIconGap })}
            options={[
              { label: 'Compact (0.25rem)', value: 'compact' },
              { label: 'Normal (0.5rem)', value: 'normal' },
              { label: 'Spacious (0.75rem)', value: 'spacious' },
            ]}
          />
        </div>
  ),
  stepper: (state: StepperSliceState, onChange: (next: StepperSliceState) => void) => (
    <FieldRow
          label="Stepper Indicator Size"
          value={state.size}
          onChange={val => onChange({ ...state, size: val as StepperSize })}
          options={[
            { label: 'Small', value: 'sm' },
            { label: 'Medium', value: 'md' },
            { label: 'Large', value: 'lg' },
          ]}
        />
  ),
  modal: (state: ModalSliceState, onChange: (next: ModalSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Modal Backdrop Blur"
            value={state.backdropBlur}
            onChange={val => onChange({ ...state, backdropBlur: val as ModalBackdropBlur })}
            options={[
              { label: 'None', value: 'none' },
              { label: 'Subtle (0.1875rem)', value: 'subtle' },
              { label: 'Heavy (0.5rem)', value: 'heavy' },
            ]}
          />
          <FieldRow
            label="Modal Overlay Darkness"
            value={state.overlayDarkness}
            onChange={val => onChange({ ...state, overlayDarkness: val as ModalOverlayDarkness })}
            options={[
              { label: 'Light (30% Black)', value: 'light' },
              { label: 'Normal (50% Black)', value: 'normal' },
              { label: 'Dark (70% Black)', value: 'dark' },
            ]}
          />
        </div>
  ),
  combobox: (state: ComboboxSliceState, onChange: (next: ComboboxSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Combobox Padding"
            value={state.padding}
            onChange={val => onChange({ ...state, padding: val as ComboboxPadding })}
            options={[
              { label: 'Compact', value: 'compact' },
              { label: 'Normal', value: 'normal' },
              { label: 'Spacious', value: 'spacious' },
            ]}
          />
          <FieldRow
            label="Combobox Item Density"
            value={state.itemDensity}
            onChange={val => onChange({ ...state, itemDensity: val as ComboboxItemDensity })}
            options={[
              { label: 'Compact', value: 'compact' },
              { label: 'Normal', value: 'normal' },
            ]}
          />
        </div>
  ),
  toast: (state: ToastSliceState, onChange: (next: ToastSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Toast Shadow Depth"
            value={state.shadowDepth}
            onChange={val => onChange({ ...state, shadowDepth: val as ToastShadowDepth })}
            options={[
              { label: 'Subtle', value: 'subtle' },
              { label: 'Elevated', value: 'elevated' },
            ]}
          />
          <FieldRow
            label="Toast Accent Style"
            value={state.accentStyle}
            onChange={val => onChange({ ...state, accentStyle: val as ToastAccentStyle })}
            options={[
              { label: 'Stripe (0.3125rem Accent Bar)', value: 'stripe' },
              { label: 'Border Only (No Accent Bar)', value: 'border-only' },
            ]}
          />
        </div>
  ),
  toggle: (state: ToggleSliceState, onChange: (next: ToggleSliceState) => void) => (
    <FieldRow
          label="Toggle & Toggle Group Padding"
          value={state.padding}
          onChange={val => onChange({ ...state, padding: val as TogglePadding })}
          options={[
            { label: 'Compact', value: 'compact' },
            { label: 'Normal', value: 'normal' },
            { label: 'Spacious', value: 'spacious' },
          ]}
        />
  ),
  fileUpload: (state: FileUploadSliceState, onChange: (next: FileUploadSliceState) => void) => (
    <FieldRow
          label="File Upload Dropzone Density"
          value={state.density}
          onChange={val => onChange({ ...state, density: val as FileUploadDensity })}
          options={[
            { label: 'Compact', value: 'compact' },
            { label: 'Normal', value: 'normal' },
            { label: 'Spacious', value: 'spacious' },
          ]}
        />
  ),
  input: (state: InputSliceState, onChange: (next: InputSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Input & Textarea Padding"
            value={state.padding}
            onChange={val => onChange({ ...state, padding: val as InputPadding })}
            options={[
              { label: 'Compact', value: 'compact' },
              { label: 'Normal', value: 'normal' },
              { label: 'Spacious', value: 'spacious' },
            ]}
          />
          <FieldRow
            label="Input & Textarea Border Width"
            value={state.borderWidth}
            onChange={val => onChange({ ...state, borderWidth: val as InputBorderWidth })}
            options={[
              { label: 'Thin (0.0625rem)', value: 'thin' },
              { label: 'Normal (0.125rem)', value: 'normal' },
              { label: 'Thick (0.1875rem)', value: 'thick' },
            ]}
          />
        </div>
  ),
  toolbar: (state: ToolbarSliceState, onChange: (next: ToolbarSliceState) => void) => (
    <FieldRow
          label="Toolbar Slot Gap"
          value={state.slotGap}
          onChange={val => onChange({ ...state, slotGap: val as ToolbarSlotGap })}
          options={[
            { label: 'Compact (0.25rem)', value: 'compact' },
            { label: 'Normal (0.5rem)', value: 'normal' },
            { label: 'Spacious (0.875rem)', value: 'spacious' },
          ]}
        />
  ),
  radiogroup: (state: RadioGroupSliceState, onChange: (next: RadioGroupSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Radio Group Gap"
            value={state.gap}
            onChange={val => onChange({ ...state, gap: val as RadioGroupGap })}
            options={[
              { label: 'Compact', value: 'compact' },
              { label: 'Normal', value: 'normal' },
              { label: 'Spacious', value: 'spacious' },
            ]}
          />
          <FieldRow
            label="Radio Dot Size"
            value={state.dotSize}
            onChange={val => onChange({ ...state, dotSize: val as RadioGroupDotSize })}
            options={[
              { label: 'Small', value: 'sm' },
              { label: 'Medium', value: 'md' },
              { label: 'Large', value: 'lg' },
            ]}
          />
        </div>
  ),
  label: (state: LabelSliceState, onChange: (next: LabelSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Label Font Weight"
            value={state.weight}
            onChange={val => onChange({ ...state, weight: val as LabelWeight })}
            options={[
              { label: 'Normal (400)', value: 'normal' },
              { label: 'Medium (500)', value: 'medium' },
              { label: 'Semibold (600)', value: 'semibold' },
              { label: 'Bold (700)', value: 'bold' },
            ]}
          />
          <FieldRow
            label="Label Gap"
            tooltip="Space between the label's own content and the control it wraps (e.g. Checkbox/Switch)"
            value={state.gap}
            onChange={val => onChange({ ...state, gap: val as LabelGap })}
            options={[
              { label: 'Compact (0.375rem)', value: 'compact' },
              { label: 'Normal (0.5rem)', value: 'normal' },
              { label: 'Spacious (0.625rem)', value: 'spacious' },
            ]}
          />
        </div>
  ),
  select: (state: SelectSliceState, onChange: (next: SelectSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Select Trigger Padding"
            value={state.padding}
            onChange={val => onChange({ ...state, padding: val as SelectPadding })}
            options={[
              { label: 'Compact', value: 'compact' },
              { label: 'Normal', value: 'normal' },
              { label: 'Spacious', value: 'spacious' },
            ]}
          />
          <FieldRow
            label="Select Item Density"
            value={state.itemDensity}
            onChange={val => onChange({ ...state, itemDensity: val as SelectItemDensity })}
            options={[
              { label: 'Compact', value: 'compact' },
              { label: 'Normal', value: 'normal' },
            ]}
          />
        </div>
  ),
  slider: (state: SliderSliceState, onChange: (next: SliderSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Slider Track Height"
            value={state.trackHeight}
            onChange={val => onChange({ ...state, trackHeight: val as SliderTrackHeight })}
            options={[
              { label: 'Thin (0.25rem)', value: 'thin' },
              { label: 'Normal (0.375rem)', value: 'normal' },
              { label: 'Thick (0.5rem)', value: 'thick' },
            ]}
          />
          <FieldRow
            label="Slider Thumb Size"
            value={state.thumbSize}
            onChange={val => onChange({ ...state, thumbSize: val as SliderThumbSize })}
            options={[
              { label: 'Small', value: 'sm' },
              { label: 'Medium', value: 'md' },
              { label: 'Large', value: 'lg' },
            ]}
          />
        </div>
  ),
  togglecontrol: (state: ToggleControlSliceState, onChange: (next: ToggleControlSliceState) => void) => (
    <FieldRow
          label="Checkbox & Switch Size"
          value={state.size}
          onChange={val => onChange({ ...state, size: val as ToggleControlSize })}
          options={[
            { label: 'Small', value: 'sm' },
            { label: 'Medium', value: 'md' },
            { label: 'Large', value: 'lg' },
          ]}
        />
  ),
  viewer: (state: ViewerSliceState, onChange: (next: ViewerSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Viewer Nav Button Size"
            value={state.navButtonSize}
            onChange={val => onChange({ ...state, navButtonSize: val as ViewerNavButtonSize })}
            options={[
              { label: 'Small (2rem)', value: 'sm' },
              { label: 'Medium (2.75rem)', value: 'md' },
              { label: 'Large (3.5rem)', value: 'lg' },
            ]}
          />
          <FieldRow
            label="Viewer Caption Style"
            tooltip="'Contrast' adds a dark bar + light text, for viewers hosted over busy/light media"
            value={state.captionStyle}
            onChange={val => onChange({ ...state, captionStyle: val as ViewerCaptionStyle })}
            options={[
              { label: 'Plain (Flush With Surface)', value: 'plain' },
              { label: 'Contrast (Dark Bar + Light Text)', value: 'contrast' },
            ]}
          />
        </div>
  ),
  uigroup: (state: UIGroupSliceState, onChange: (next: UIGroupSliceState) => void) => (
    <FieldRow
          label="UIGroup Border Overlap"
          tooltip="Global only — this shared, singleton stylesheet has no per-instance scoping to override"
          value={state.overlap}
          onChange={val => onChange({ ...state, overlap: val as UIGroupOverlap })}
          options={[
            { label: 'Thin (-0.0625rem)', value: 'thin' },
            { label: 'Normal (-0.125rem)', value: 'normal' },
          ]}
        />
  ),
  tree: (state: TreeSliceState, onChange: (next: TreeSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Tree Indent"
            value={state.indent}
            onChange={val => onChange({ ...state, indent: val as TreeIndent })}
            options={[
              { label: 'Compact (1rem)', value: 'compact' },
              { label: 'Normal (1.25rem)', value: 'normal' },
              { label: 'Spacious (1.75rem)', value: 'spacious' },
            ]}
          />
          <FieldRow
            label="Tree Row Gap"
            value={state.itemGap}
            onChange={val => onChange({ ...state, itemGap: val as TreeItemGap })}
            options={[
              { label: 'None (Flush)', value: 'none' },
              { label: 'Compact (0.125rem)', value: 'compact' },
              { label: 'Normal (0.25rem)', value: 'normal' },
            ]}
          />
        </div>
  ),
  tooltip: (state: TooltipSliceState, onChange: (next: TooltipSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Tooltip Colour Theme"
            value={state.theme}
            onChange={val => onChange({ ...state, theme: val as TooltipTheme })}
            options={[
              { label: 'Dark (Default)', value: 'dark' },
              { label: 'Light (Surface Colour)', value: 'light' },
              { label: 'Accent (Harmony Accent Colour)', value: 'accent' },
            ]}
          />
          <FieldRow
            label="Tooltip Size"
            value={state.size}
            onChange={val => onChange({ ...state, size: val as TooltipSize })}
            options={[
              { label: 'Small (Compact Padding & Font)', value: 'sm' },
              { label: 'Medium (Standard Padding & Font)', value: 'md' },
            ]}
          />
        </div>
  ),
  animation: (state: AnimationSliceState, onChange: (next: AnimationSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Transition Physics Preset"
            tooltip="Configures global easing curves and transition durations across all components"
            value={state.preset}
            onChange={val => onChange({ ...state, preset: val as AnimationPreset })}
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
              <span>{state.speed}x</span>
            </div>
            <Slider
              value={Math.round(state.speed * 100)}
              min={50}
              max={200}
              step={25}
              onChange={val => onChange({ ...state, speed: val / 100 })}
            />
          </div>
        </div>
  ),
  livingColor: (state: LivingColorSliceState, onChange: (next: LivingColorSliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Living Color"
            tooltip="Enables the ambient color-breathe/glow-pulse loop for elements opted in via .ai-living-accent / .ai-living-glow"
            value={state.enabled}
            onChange={val => onChange({ ...state, enabled: val as LivingColorEnabled })}
            options={[
              { label: 'On', value: 'on' },
              { label: 'Off', value: 'off' },
            ]}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 'var(--ai-font-weight-semibold, 600)' }}>
              <span>Breathe Duration</span>
              <span>{state.duration}s</span>
            </div>
            <Slider
              value={state.duration}
              min={2}
              max={20}
              step={1}
              onChange={val => onChange({ ...state, duration: val })}
              disabled={state.enabled === 'off'}
            />
          </div>
        </div>
  ),
  typography: (state: TypographySliceState, onChange: (next: TypographySliceState) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FieldRow
            label="Font Family"
            tooltip="Sets --ai-font-family, consumed anywhere a component uses fontFamily: 'inherit' up to :root"
            value={state.fontFamily}
            onChange={val => onChange({ ...state, fontFamily: val as FontFamilyPreset })}
            options={[
              { label: 'System (Inter / system-ui)', value: 'system' },
              { label: 'Serif (Georgia / Times)', value: 'serif' },
              { label: 'Monospace (SF Mono / Consolas)', value: 'monospace' },
            ]}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span>Master Font Size (rem Base)</span>
              <span>{state.masterFontSize}px</span>
            </div>
            <Slider
              ariaLabel="Master Font Size"
              min={12}
              max={24}
              value={state.masterFontSize}
              onChange={val => onChange({ ...state, masterFontSize: val })}
              commitOnRelease
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span>Line Height (Text Density)</span>
              <span>{state.baseLineHeight.toFixed(1)}</span>
            </div>
            <Slider
              ariaLabel="Line Height"
              min={1.2}
              max={2}
              step={0.1}
              value={state.baseLineHeight}
              onChange={val => onChange({ ...state, baseLineHeight: val })}
              commitOnRelease
            />
          </div>
        </div>
  ),
};
