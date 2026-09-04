import { globalThemeSliceRegistry } from './slice';
import { PaddingThemeSlice } from './padding';
import { MarginThemeSlice } from './margin';
import { RadiusThemeSlice } from './radius';
import { ShadowThemeSlice } from './shadow';
import { DataTableThemeSlice } from '../components/DataTable/DataTableSlice';
import { AnimationThemeSlice } from './animation';
import { TabThemeSlice } from '../components/TabStrip/TabSlice';
import { DrawerThemeSlice } from '../components/Overlay/DrawerSlice';
import { AccordionThemeSlice } from '../components/Accordion/AccordionSlice';
import { CardThemeSlice } from '../components/Card/CardSlice';
import { TooltipThemeSlice } from '../components/Tooltip/TooltipSlice';
import { ButtonThemeSlice } from '../components/Form/ButtonSlice';
import { InputThemeSlice } from '../components/Form/InputSlice';
import { ToggleControlThemeSlice } from '../components/Form/ToggleControlSlice';
import { SelectThemeSlice } from '../components/Form/SelectSlice';
import { RadioGroupThemeSlice } from '../components/Form/RadioGroupSlice';
import { SliderThemeSlice } from '../components/Form/SliderSlice';
import { ModalThemeSlice } from '../components/Overlay/ModalSlice';
import { AlertDialogThemeSlice } from '../components/AlertDialog/AlertDialogSlice';
import { PopupThemeSlice } from '../components/Overlay/PopupSlice';
import { ToastThemeSlice } from '../components/Toast/ToastSlice';
import { DropdownMenuThemeSlice } from '../components/DropdownMenu/DropdownMenuSlice';
import { ContextMenuThemeSlice } from '../components/ContextMenu/ContextMenuSlice';
import { ProgressThemeSlice } from '../components/Progress/ProgressSlice';
import { SeparatorThemeSlice } from '../components/Separator/SeparatorSlice';
import { AvatarThemeSlice } from '../components/Avatar/AvatarSlice';
import { ToggleThemeSlice } from '../components/ToggleGroup/ToggleSlice';
import { CollapsibleThemeSlice } from '../components/Collapsible/CollapsibleSlice';
import { UIGroupThemeSlice } from '../components/UIGroup/UIGroupSlice';
import { ToolbarThemeSlice } from '../components/Toolbar/ToolbarSlice';
import { AppShellThemeSlice } from '../components/AppShell/AppShellSlice';
import { TypographyThemeSlice } from './typography';
import { TreeThemeSlice } from '../components/Tree/TreeSlice';
import { RatingThemeSlice } from '../components/Rating/RatingSlice';
import { SidebarThemeSlice } from '../components/Sidebar/SidebarSlice';
import { StepperThemeSlice } from '../components/Stepper/StepperSlice';
import { DatePickerThemeSlice } from '../components/DatePicker/DatePickerSlice';
import { BreadcrumbThemeSlice } from '../components/Breadcrumb/BreadcrumbSlice';
import { CarouselThemeSlice } from '../components/Carousel/CarouselSlice';
import { ComboboxThemeSlice } from '../components/Form/ComboboxSlice';
import { CommandPaletteThemeSlice } from '../components/CommandPalette/CommandPaletteSlice';
import { FileUploadThemeSlice } from '../components/Form/FileUploadSlice';
import { GalleryThemeSlice } from '../components/Gallery/GallerySlice';
import { HoverCardThemeSlice } from '../components/HoverCard/HoverCardSlice';
import { LabelThemeSlice } from '../components/Form/LabelSlice';
import { ScrollAreaThemeSlice } from '../components/ScrollArea/ScrollAreaSlice';
import { ViewerThemeSlice } from '../components/Viewer/ViewerSlice';
import { ChartThemeSlice } from '../components/Chart/ChartSlice';
import { LivingColorThemeSlice } from './livingColor';

// Extracted from themeContext.tsx (a 'use client' file) so a Server
// Component can populate the same global registry without pulling in
// anything client-only -- computeServerThemeCSS (serverThemeCSS.ts) needs
// globalThemeSliceRegistry.getAll()/computeAllVariables() populated to
// return correct per-slice CSS, and importing themeContext.tsx to get that
// would poison it as a client reference (Next.js: "attempted to call a
// client function from the server"). Both themeContext.tsx and
// serverThemeCSS.ts import this module purely for its side effect
// (`import './registerThemeSlices'`) -- whichever loads first populates
// the registry for both, so nothing here needs its own export.
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
globalThemeSliceRegistry.register(TreeThemeSlice);
globalThemeSliceRegistry.register(RatingThemeSlice);
globalThemeSliceRegistry.register(SidebarThemeSlice);
globalThemeSliceRegistry.register(StepperThemeSlice);
globalThemeSliceRegistry.register(DatePickerThemeSlice);
globalThemeSliceRegistry.register(BreadcrumbThemeSlice);
globalThemeSliceRegistry.register(CarouselThemeSlice);
globalThemeSliceRegistry.register(ComboboxThemeSlice);
globalThemeSliceRegistry.register(CommandPaletteThemeSlice);
globalThemeSliceRegistry.register(FileUploadThemeSlice);
globalThemeSliceRegistry.register(GalleryThemeSlice);
globalThemeSliceRegistry.register(HoverCardThemeSlice);
globalThemeSliceRegistry.register(LabelThemeSlice);
globalThemeSliceRegistry.register(ScrollAreaThemeSlice);
globalThemeSliceRegistry.register(ViewerThemeSlice);
globalThemeSliceRegistry.register(ChartThemeSlice);
globalThemeSliceRegistry.register(LivingColorThemeSlice);
