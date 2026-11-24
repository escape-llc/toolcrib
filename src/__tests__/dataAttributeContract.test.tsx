import { type ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import manifest from '../../ai-docs/component-manifest.json';
import { settleOverlay } from './testUtils/overlay';
import { ThemeProvider } from '../theme/themeContext';
import { AccessibleIcon } from '../components/Layout/AccessibleIcon';
import { AspectRatio } from '../components/Layout/AspectRatio';
import { Block } from '../components/Layout/Block';
import { Content } from '../components/Layout/Content';
import { DeferredContent } from '../components/Layout/DeferredContent';
import { Grid } from '../components/Layout/Grid';
import { VStack, HStack } from '../components/Layout/Stack';
import { VisuallyHidden } from '../components/Layout/VisuallyHidden';
import { Accordion } from '../components/Accordion/Accordion';
import { Alert } from '../components/Alert/Alert';
import { AlertDialog } from '../components/AlertDialog/AlertDialog';
import { AppShell } from '../components/AppShell/AppShell';
import { Avatar } from '../components/Avatar/Avatar';
import { Badge } from '../components/Badge/Badge';
import { Breadcrumb } from '../components/Breadcrumb/Breadcrumb';
import { Card } from '../components/Card/Card';
import { CardSimple } from '../components/Card/CardSimple';
import { Carousel } from '../components/Carousel/Carousel';
import { BarChart } from '../components/Chart/BarChart';
import { Heatmap } from '../components/Chart/Heatmap';
import { LineChart } from '../components/Chart/LineChart';
import { PieChart } from '../components/Chart/PieChart';
import { ScaleLegend } from '../components/Chart/ScaleLegend';
import { Sparkline } from '../components/Chart/Sparkline';
import { Collapsible } from '../components/Collapsible/Collapsible';
import { CommandPalette } from '../components/CommandPalette/CommandPalette';
import { ContextMenu } from '../components/ContextMenu/ContextMenu';
import { DataTable } from '../components/DataTable/DataTable';
import { Calendar } from '../components/DatePicker/Calendar';
import { DatePicker } from '../components/DatePicker/DatePicker';
import { DateRangePicker } from '../components/DatePicker/DateRangePicker';
import { RangeCalendar } from '../components/DatePicker/RangeCalendar';
import { TimeField } from '../components/DatePicker/TimeField';
import { DropdownMenu } from '../components/DropdownMenu/DropdownMenu';
import { EmptyState } from '../components/EmptyState/EmptyState';
import { Fieldset } from '../components/Fieldset/Fieldset';
import { Filmstrip } from '../components/Filmstrip/Filmstrip';
import { Form } from '../components/Form/FormContext';
import { FormField, FormError, Button, SubmitButton, Input, Textarea, Checkbox, Switch } from '../components/Form/FormComponents';
import { Label } from '../components/Form/Label';
import { Select } from '../components/Form/Select';
import { Combobox } from '../components/Form/Combobox';
import { RadioGroup } from '../components/Form/RadioGroup';
import { CheckboxGroup } from '../components/Form/CheckboxGroup';
import { Slider } from '../components/Form/Slider';
import { RangeSlider } from '../components/Form/RangeSlider';
import { FileUpload } from '../components/Form/FileUpload';
import { Gallery } from '../components/Gallery/Gallery';
import { HoverCard } from '../components/HoverCard/HoverCard';
import { Kbd } from '../components/Kbd/Kbd';
import { Link } from '../components/Link/Link';
import { Listbox } from '../components/Listbox/Listbox';
import { Meter } from '../components/Meter/Meter';
import { NumberField } from '../components/NumberField/NumberField';
import { OTPField } from '../components/OTPField/OTPField';
import { Drawer } from '../components/Overlay/Drawer';
import { Modal } from '../components/Overlay/Modal';
import { Popup } from '../components/Overlay/Popup';
import { Pagination } from '../components/Pagination/Pagination';
import { Progress } from '../components/Progress/Progress';
import { Rating } from '../components/Rating/Rating';
import { ScrollArea } from '../components/ScrollArea/ScrollArea';
import { Separator } from '../components/Separator/Separator';
import { Sidebar } from '../components/Sidebar/Sidebar';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { Spinner } from '../components/Spinner/Spinner';
import { Splitter } from '../components/Splitter/Splitter';
import { Stat } from '../components/Stat/Stat';
import { Stepper } from '../components/Stepper/Stepper';
import { TabStrip } from '../components/TabStrip/TabStrip';
import { Text } from '../components/Text/Text';
import { ThemeEditor } from '../components/ThemeEditor/ThemeEditor';
import { ToggleGroup, Toggle } from '../components/ToggleGroup/ToggleGroup';
import { Toolbar } from '../components/Toolbar/Toolbar';
import { Tooltip } from '../components/Tooltip/Tooltip';
import { Tree } from '../components/Tree/Tree';
import { UIGroup } from '../components/UIGroup/UIGroup';
import { Viewer } from '../components/Viewer/Viewer';
import { ViewerContent } from '../components/Viewer/ViewerContent';
import { VuMeter } from '../components/VuMeter/VuMeter';

// The data-* pass-through contract (#994). Every component, and every slot,
// takes consumer `data-*` attributes and puts them on ONE element: the one
// that carries its accessible role (what getByRole returns), or its outermost
// element when it has none. Each case renders the component with a probe
// attribute and a consumer `data-testid`, and checks both land on that
// element, and that nothing else got the probe. `data-testid` is the
// consumer's; the toolkit's own hooks are `data-ai-testid`.
//
// The first check fails if a manifest component or slot is in neither CASES
// nor EXEMPT below, so a new component can't skip the contract.

// embla measures real layout, which jsdom lacks (Carousel.test.tsx explains); a bare fake is enough here.
// The api object is hoisted: a fresh one per render would re-run Carousel's effects forever.
const emblaApi = vi.hoisted(() => ({
  selectedScrollSnap: () => 0,
  canScrollPrev: () => false,
  canScrollNext: () => true,
  scrollSnapList: () => [0, 1],
  scrollNext: () => {},
  scrollPrev: () => {},
  scrollTo: () => {},
  on: () => {},
  off: () => {},
}));
vi.mock('embla-carousel-react', () => ({ default: () => [() => {}, emblaApi] }));

const P = { 'data-ai-probe': 'x', 'data-testid': 'consumer-id' } as const;
const OPTIONS = [{ label: 'One', value: '1' }, { label: 'Two', value: '2' }];

interface Case {
  /** The component or slot, rendered with the probe props. */
  ui: ReactElement;
  /** The element that must carry the probe. Defaults to the outermost rendered element. */
  target?: () => Element | null;
  /** Gets an overlay or other deferred part onto the page before the check. */
  before?: () => void | Promise<void>;
}

const byRole = (role: string, name?: string | RegExp) => () => screen.getAllByRole(role, name ? { name } : undefined)[0];
const bySelector = (selector: string) => () => document.querySelector(selector);

const CASES: Record<string, () => Case> = {
  // Layout primitives
  AccessibleIcon: () => ({ ui: <AccessibleIcon label="Icon" {...P}><svg /></AccessibleIcon>, target: bySelector('svg') }),
  AspectRatio: () => ({ ui: <AspectRatio {...P}>x</AspectRatio> }),
  Block: () => ({ ui: <Block {...P}>x</Block> }),
  Content: () => ({ ui: <Content {...P}>x</Content> }),
  'Content.Grow': () => ({ ui: <Content.Grow {...P}>x</Content.Grow> }),
  DeferredContent: () => ({ ui: <DeferredContent estimatedHeight={10} {...P}>x</DeferredContent> }),
  Grid: () => ({ ui: <Grid {...P}>x</Grid> }),
  VStack: () => ({ ui: <VStack {...P}>x</VStack> }),
  HStack: () => ({ ui: <HStack {...P}>x</HStack> }),
  VisuallyHidden: () => ({ ui: <VisuallyHidden {...P}>x</VisuallyHidden> }),
  Separator: () => ({ ui: <Separator decorative={false} {...P} />, target: byRole('separator') }),
  Text: () => ({ ui: <Text {...P}>x</Text> }),
  Link: () => ({ ui: <Link href="/a" {...P}>x</Link>, target: byRole('link') }),
  Kbd: () => ({ ui: <Kbd {...P}>K</Kbd> }),
  Badge: () => ({ ui: <Badge {...P}>x</Badge> }),
  Skeleton: () => ({ ui: <Skeleton {...P} /> }),
  Spinner: () => ({ ui: <Spinner {...P} /> }),
  Avatar: () => ({ ui: <Avatar fallback="AB" {...P} /> }),
  Progress: () => ({ ui: <Progress aria-label="p" value={5} {...P} />, target: byRole('progressbar') }),
  Meter: () => ({ ui: <Meter aria-label="m" value={5} {...P} />, target: byRole('meter') }),
  VuMeter: () => ({ ui: <VuMeter level={0.5} label="vu" {...P} />, target: byRole('meter') }),
  Stat: () => ({ ui: <Stat label="Revenue" value={5} {...P} /> }),

  // Charts: the svg (or, for ScaleLegend, its gradient bar) is the role element.
  BarChart: () => ({ ui: <BarChart categories={['a', 'b']} series={[{ label: 's', values: [1, 2] }]} {...P} />, target: bySelector('svg[role="graphics-document"]') }),
  LineChart: () => ({ ui: <LineChart categories={['a', 'b']} series={[{ label: 's', values: [1, 2] }]} {...P} />, target: bySelector('svg[role="graphics-document"]') }),
  PieChart: () => ({ ui: <PieChart data={[{ label: 'a', value: 1 }, { label: 'b', value: 2 }]} {...P} />, target: bySelector('svg[role="graphics-document"]') }),
  Heatmap: () => ({ ui: <Heatmap columns={['a', 'b']} rows={['r']} values={[[1, 2]]} {...P} />, target: bySelector('svg[role="graphics-document"]') }),
  Sparkline: () => ({ ui: <Sparkline values={[1, 2, 3]} {...P} />, target: byRole('img') }),
  ScaleLegend: () => ({ ui: <ScaleLegend min={0} max={10} {...P} />, target: byRole('img') }),

  // Containers
  Card: () => ({ ui: <Card {...P}>x</Card> }),
  'Card.Header': () => ({ ui: <Card><Card.Header {...P}>h</Card.Header></Card>, target: () => screen.getByText('h') }),
  'Card.Content': () => ({ ui: <Card><Card.Content {...P}>c</Card.Content></Card>, target: () => screen.getByText('c') }),
  'Card.Footer': () => ({ ui: <Card><Card.Footer {...P}>f</Card.Footer></Card>, target: () => screen.getByText('f') }),
  'Card.Actions': () => ({ ui: <Card><Card.Actions {...P}>a</Card.Actions></Card>, target: () => screen.getByText('a') }),
  CardSimple: () => ({ ui: <CardSimple {...P}>x</CardSimple> }),
  AppShell: () => ({ ui: <AppShell {...P}>x</AppShell> }),
  'AppShell.Header': () => ({ ui: <AppShell><AppShell.Header {...P}>h</AppShell.Header></AppShell>, target: byRole('banner') }),
  'AppShell.Main': () => ({ ui: <AppShell><AppShell.Main {...P}>m</AppShell.Main></AppShell>, target: byRole('main') }),
  'AppShell.Sidebar': () => ({ ui: <AppShell><AppShell.Sidebar {...P}>s</AppShell.Sidebar></AppShell>, target: byRole('complementary') }),
  EmptyState: () => ({ ui: <EmptyState {...P}>x</EmptyState> }),
  'EmptyState.Icon': () => ({ ui: <EmptyState><EmptyState.Icon {...P}>i</EmptyState.Icon></EmptyState>, target: () => screen.getByText('i') }),
  'EmptyState.Title': () => ({ ui: <EmptyState><EmptyState.Title {...P}>t</EmptyState.Title></EmptyState>, target: () => screen.getByText('t') }),
  'EmptyState.Description': () => ({ ui: <EmptyState><EmptyState.Description {...P}>d</EmptyState.Description></EmptyState>, target: () => screen.getByText('d') }),
  'EmptyState.Action': () => ({ ui: <EmptyState><EmptyState.Action {...P}>a</EmptyState.Action></EmptyState>, target: () => screen.getByText('a') }),
  Alert: () => ({ ui: <Alert {...P}>x</Alert>, target: byRole('status') }),
  'Alert.Title': () => ({ ui: <Alert><Alert.Title {...P}>t</Alert.Title></Alert>, target: () => screen.getByText('t') }),
  'Alert.Description': () => ({ ui: <Alert><Alert.Description {...P}>d</Alert.Description></Alert>, target: () => screen.getByText('d') }),
  Collapsible: () => ({ ui: <Collapsible trigger="T" {...P}>x</Collapsible> }),
  Accordion: () => ({ ui: <Accordion items={[{ value: 'a', title: 'A', content: 'a' }]} {...P} /> }),
  Carousel: () => ({ ui: <Carousel slides={[{ id: '1', content: 'one' }, { id: '2', content: 'two' }]} {...P} /> }),
  Sidebar: () => ({ ui: <Sidebar aria-label="Nav" items={[{ id: 'a', label: 'A' }]} {...P} />, target: byRole('navigation') }),
  Stepper: () => ({ ui: <Stepper steps={[{ id: 'a', label: 'A', content: 'a' }, { id: 'b', label: 'B', content: 'b' }]} {...P} /> }),
  TabStrip: () => ({ ui: <TabStrip id="g" items={[{ id: 'a', label: 'A' }]} {...P} /> }),
  'TabStrip.Tab': () => ({ ui: <TabStrip.Tab id="a" {...P}>A</TabStrip.Tab>, target: byRole('button') }),
  'TabStrip.Panel': () => ({
    ui: <><TabStrip id="g" items={[{ id: 'a', label: 'A' }]} /><TabStrip.Panel groupId="g" value="a" {...P}>p</TabStrip.Panel></>,
    target: byRole('tabpanel'),
  }),
  Fieldset: () => ({ ui: <Fieldset legend="Group" {...P}>x</Fieldset>, target: byRole('group') }),
  Splitter: () => ({ ui: <Splitter {...P}><Splitter.Panel>a</Splitter.Panel><Splitter.Panel>b</Splitter.Panel></Splitter> }),
  'Splitter.Panel': () => ({ ui: <Splitter><Splitter.Panel {...P}>a</Splitter.Panel><Splitter.Panel>b</Splitter.Panel></Splitter>, target: () => screen.getByText('a') }),
  UIGroup: () => ({ ui: <UIGroup {...P}><Button>a</Button><Button>b</Button></UIGroup>, target: byRole('group') }),
  ScrollArea: () => ({ ui: <ScrollArea {...P}>x</ScrollArea>, before: settleOverlay }),
  Toolbar: () => ({ ui: <Toolbar {...P}>x</Toolbar> }),
  'Toolbar.Left': () => ({ ui: <Toolbar><Toolbar.Left {...P}>l</Toolbar.Left></Toolbar>, target: () => screen.getByText('l') }),
  'Toolbar.Center': () => ({ ui: <Toolbar><Toolbar.Center {...P}>c</Toolbar.Center></Toolbar>, target: () => screen.getByText('c') }),
  'Toolbar.Right': () => ({ ui: <Toolbar><Toolbar.Right {...P}>right</Toolbar.Right></Toolbar>, target: () => screen.getByText('right') }),
  'Toolbar.Button': () => ({ ui: <Toolbar><Toolbar.Button {...P}>b</Toolbar.Button></Toolbar>, target: byRole('button') }),
  'Toolbar.Separator': () => ({ ui: <Toolbar><Toolbar.Separator {...P} /></Toolbar>, target: byRole('separator') }),

  // Data display
  Breadcrumb: () => ({ ui: <Breadcrumb {...P}><Breadcrumb.Item href="/a">A</Breadcrumb.Item><Breadcrumb.Item>B</Breadcrumb.Item></Breadcrumb>, target: byRole('list') }),
  'Breadcrumb.Item': () => ({ ui: <Breadcrumb><Breadcrumb.Item href="/a" {...P}>A</Breadcrumb.Item><Breadcrumb.Item>B</Breadcrumb.Item></Breadcrumb>, target: byRole('link', 'A') }),
  'Breadcrumb.Separator': () => ({
    ui: <Breadcrumb separator={<Breadcrumb.Separator {...P} />}><Breadcrumb.Item href="/a">A</Breadcrumb.Item><Breadcrumb.Item>B</Breadcrumb.Item></Breadcrumb>,
    target: bySelector('span[aria-hidden="true"]'),
  }),
  Pagination: () => ({ ui: <Pagination totalItems={30} {...P} />, target: byRole('navigation') }),
  Tree: () => ({ ui: <Tree items={[{ id: 'a', label: 'A' }]} {...P} />, target: byRole('tree') }),
  DataTable: () => ({ ui: <DataTable columns={[{ key: 'n', title: 'N' }]} data={[{ id: 1, n: 'a' }]} rowKey={r => r.id} {...P} />, target: byRole('grid') }),
  Filmstrip: () => ({ ui: <Filmstrip items={[{ id: 'a', content: 'A', label: 'A' }]} {...P} />, target: byRole('listbox') }),
  Gallery: () => ({ ui: <Gallery items={[{ id: 'a', thumbnailSrc: 'a.png', fullSrc: 'a.png', alt: 'A' }]} {...P} /> }),
  ViewerContent: () => ({ ui: <ViewerContent items={[{ id: 'a', src: 'a.png', alt: 'A' }]} {...P} /> }),
  Viewer: () => ({
    ui: <Viewer isOpen items={[{ id: 'a', src: 'a.png', alt: 'A' }]} {...P} />,
    before: settleOverlay,
    target: byRole('dialog'),
  }),

  // Overlays
  Modal: () => ({ ui: <Modal isOpen {...P}>x</Modal>, before: settleOverlay, target: byRole('dialog') }),
  'Modal.Header': () => ({ ui: <Modal isOpen><Modal.Header {...P}>h</Modal.Header></Modal>, before: settleOverlay, target: () => screen.getByText('h') }),
  'Modal.Body': () => ({ ui: <Modal isOpen><Modal.Body {...P}>b</Modal.Body></Modal>, before: settleOverlay, target: () => screen.getByText('b') }),
  'Modal.Footer': () => ({ ui: <Modal isOpen><Modal.Footer {...P}>f</Modal.Footer></Modal>, before: settleOverlay, target: () => screen.getByText('f') }),
  'Modal.Actions': () => ({ ui: <Modal isOpen><Modal.Actions {...P}>a</Modal.Actions></Modal>, before: settleOverlay, target: () => screen.getByText('a') }),
  'Modal.CloseButton': () => ({ ui: <Modal isOpen><Modal.CloseButton {...P} /></Modal>, before: settleOverlay, target: byRole('button', 'Close') }),
  AlertDialog: () => ({ ui: <AlertDialog isOpen {...P}>x</AlertDialog>, before: settleOverlay, target: byRole('alertdialog') }),
  'AlertDialog.Header': () => ({ ui: <AlertDialog isOpen><AlertDialog.Header {...P}>h</AlertDialog.Header></AlertDialog>, before: settleOverlay, target: () => screen.getByText('h') }),
  'AlertDialog.Body': () => ({ ui: <AlertDialog isOpen><AlertDialog.Body {...P}>b</AlertDialog.Body></AlertDialog>, before: settleOverlay, target: () => screen.getByText('b') }),
  'AlertDialog.Footer': () => ({ ui: <AlertDialog isOpen><AlertDialog.Footer {...P}>f</AlertDialog.Footer></AlertDialog>, before: settleOverlay, target: () => screen.getByText('f') }),
  'AlertDialog.Actions': () => ({ ui: <AlertDialog isOpen><AlertDialog.Actions {...P}>a</AlertDialog.Actions></AlertDialog>, before: settleOverlay, target: () => screen.getByText('a') }),
  'AlertDialog.Cancel': () => ({ ui: <AlertDialog isOpen><AlertDialog.Cancel {...P} /></AlertDialog>, before: settleOverlay, target: byRole('button', 'Cancel') }),
  'AlertDialog.Action': () => ({ ui: <AlertDialog isOpen><AlertDialog.Action {...P} /></AlertDialog>, before: settleOverlay, target: byRole('button', 'Confirm') }),
  Drawer: () => ({ ui: <Drawer isOpen {...P}>x</Drawer>, before: settleOverlay, target: byRole('dialog') }),
  Popup: () => ({ ui: <Popup isOpen trigger={<button>t</button>} {...P}>x</Popup>, before: settleOverlay, target: bySelector('.ai-popup-content') }),
  'Popup.Trigger': () => ({ ui: <Popup anchor={<div><Popup.Trigger {...P}><button>t</button></Popup.Trigger></div>}>x</Popup>, target: byRole('button', 't') }),
  CommandPalette: () => ({ ui: <CommandPalette isOpen items={[{ value: 'a', label: 'A' }]} {...P} />, before: settleOverlay, target: byRole('dialog') }),
  // The data-* lands on the card (the popup), not on the trigger.
  HoverCard: () => ({
    ui: <HoverCard content="card" openDelay={0} {...P}><a href="/x">t</a></HoverCard>,
    before: async () => {
      fireEvent.mouseEnter(screen.getByRole('link'));
      fireEvent.mouseMove(screen.getByRole('link'));
      await settleOverlay();
      await act(async () => { await new Promise(r => setTimeout(r, 30)); });
      await settleOverlay();
    },
    target: bySelector('.ai-hovercard-content'),
  }),
  // Tooltip already forwards everything beyond its own props to the trigger it wraps, so data-* land there.
  Tooltip: () => ({ ui: <Tooltip content="tip" {...P}><button>t</button></Tooltip>, target: byRole('button') }),
  DropdownMenu: () => ({
    ui: <DropdownMenu trigger={<button>t</button>} items={[{ value: 'a', label: 'A' }]} {...P} />,
    before: async () => { fireEvent.mouseDown(screen.getByRole('button')); await settleOverlay(); },
    target: byRole('menu'),
  }),
  ContextMenu: () => ({
    ui: <ContextMenu items={[{ value: 'a', label: 'A' }]} {...P}><span>area</span></ContextMenu>,
    before: async () => { fireEvent.contextMenu(screen.getByText('area')); await settleOverlay(); },
    target: byRole('menu'),
  }),
  ThemeEditor: () => ({ ui: <ThemeProvider><ThemeEditor {...P} /></ThemeProvider> }),

  // Form controls
  Form: () => ({ ui: <Form {...P}>x</Form>, target: bySelector('form') }),
  FormField: () => ({ ui: <FormField name="n" {...P}><Input /></FormField> }),
  FormError: () => ({ ui: <Form><FormError {...P} /></Form>, target: bySelector('[data-ai-testid="form-error-summary-region"]') }),
  Button: () => ({ ui: <Button {...P}>b</Button>, target: byRole('button') }),
  SubmitButton: () => ({ ui: <SubmitButton {...P}>go</SubmitButton>, target: byRole('button') }),
  Label: () => ({ ui: <Label {...P}>l</Label> }),
  Input: () => ({ ui: <Input aria-label="i" {...P} />, target: byRole('textbox') }),
  Textarea: () => ({ ui: <Textarea aria-label="t" {...P} />, target: byRole('textbox') }),
  Checkbox: () => ({ ui: <Checkbox label="c" {...P} />, target: byRole('checkbox') }),
  Switch: () => ({ ui: <Switch label="s" {...P} />, target: byRole('switch') }),
  CheckboxGroup: () => ({ ui: <CheckboxGroup aria-label="cg" options={OPTIONS} {...P} />, target: byRole('group') }),
  RadioGroup: () => ({ ui: <RadioGroup aria-label="rg" options={OPTIONS} {...P} />, target: byRole('radiogroup') }),
  'RadioGroup.Option': () => ({ ui: <RadioGroup aria-label="rg"><RadioGroup.Option value="a" label="A" {...P} /></RadioGroup>, target: byRole('radio') }),
  Select: () => ({ ui: <Select aria-label="s" options={OPTIONS} {...P} />, target: byRole('combobox') }),
  Combobox: () => ({ ui: <Combobox aria-label="c" options={OPTIONS} {...P} />, target: byRole('combobox') }),
  Listbox: () => ({ ui: <Listbox id="lb" aria-label="l" options={OPTIONS} {...P} />, target: byRole('listbox') }),
  // The Slider and RangeSlider root carries role="group"; the thumbs are inside it.
  Slider: () => ({ ui: <Slider aria-label="sl" defaultValue={10} {...P} />, target: byRole('group') }),
  RangeSlider: () => ({ ui: <RangeSlider aria-label="rs" defaultValue={[10, 20]} {...P} />, target: byRole('group') }),
  FileUpload: () => ({ ui: <FileUpload aria-label="f" {...P} />, target: byRole('button') }),
  NumberField: () => ({ ui: <NumberField aria-label="n" {...P} />, target: byRole('textbox') }),
  OTPField: () => ({ ui: <OTPField aria-label="otp" length={2} {...P} />, target: byRole('group') }),
  Rating: () => ({ ui: <Rating aria-label="r" {...P} />, target: byRole('radiogroup') }),
  DatePicker: () => ({ ui: <DatePicker aria-label="d" {...P} /> }),
  DateRangePicker: () => ({ ui: <DateRangePicker aria-label="dr" {...P} /> }),
  TimeField: () => ({ ui: <TimeField aria-label="t" {...P} /> }),
  Calendar: () => ({ ui: <Calendar aria-label="c" {...P} /> }),
  RangeCalendar: () => ({ ui: <RangeCalendar aria-label="rc" {...P} /> }),
  ToggleGroup: () => ({ ui: <ToggleGroup type="single" aria-label="tg" options={OPTIONS} {...P} />, target: byRole('radiogroup') }),
  Toggle: () => ({ ui: <Toggle {...P}>t</Toggle>, target: byRole('button') }),
};

/** Components that render no element of their own, with why. */
const EXEMPT: Record<string, string> = {
  TooltipGroup: 'renders only a context provider around its children',
};

type ManifestComponent = { name: string; slots?: string[] };
const manifestNames = (manifest as { components: ManifestComponent[] }).components
  .flatMap(c => [c.name, ...(c.slots ?? []).map(s => `${c.name}.${s}`)]);

describe('data-* pass-through contract', () => {
  it('covers every manifest component and slot', () => {
    const unaccounted = manifestNames.filter(n => !(n in CASES) && !(n in EXEMPT));
    expect(unaccounted).toEqual([]);
    expect([...Object.keys(CASES), ...Object.keys(EXEMPT)].filter(n => !manifestNames.includes(n))).toEqual([]);
  });

  it.each(Object.keys(CASES))('%s puts consumer data-* on one element', async name => {
    const c = CASES[name]();
    const view = render(c.ui);
    await c.before?.();
    const target = c.target ? c.target() : view.container.firstElementChild;
    expect(target, `${name}: target element not found`).toBeTruthy();
    expect(target).toHaveAttribute('data-ai-probe', 'x');
    expect(target).toHaveAttribute('data-testid', 'consumer-id');
    // Exactly one element took them, and nothing is left on the reserved name.
    expect(document.querySelectorAll('[data-ai-probe]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-testid="consumer-id"]')).toHaveLength(1);
  });
});
