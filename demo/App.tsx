import React, { useState, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { z } from 'zod';
import { CalendarDate, Time } from '@internationalized/date';
import toolcribIcon from './toolcrib-256x256.png';
import {
  useTheme,
  ThemeProvider,
  ThemeEditor,
  Card,
  CardSimple,
  Form,
  FormField,
  FormError,
  Input,
  Checkbox,
  Switch,
  Textarea,
  Button,
  SubmitButton,
  RadioGroup,
  Popup,
  Drawer,
  Modal,
  useToast,
  DataTable,
  type Column,
  TabStrip,
  UIGroup,
  Splitter,
  Tooltip,
  Accordion,
  DropdownMenu,
  Select,
  Slider,
  Toolbar,
  VStack,
  HStack,
  Grid,
  Content,
  Block,
  AppShell,
  StyleDomainProvider,
  aiBus,
  useAIEvent,
  AlertDialog,
  Progress,
  Separator,
  Avatar,
  Toggle,
  ToggleGroup,
  ContextMenu,
  Collapsible,
  AIErrorBoundary,
  DeferredContent,
  VisuallyHidden,
  AccessibleIcon,
  Label,
  ScrollArea,
  HoverCard,
  AspectRatio,
  Combobox,
  Listbox,
  type ListboxOptionData,
  FileUpload,
  Pagination,
  Badge,
  EmptyState,
  Skeleton,
  Spinner,
  Tree,
  type TreeItemData,
  Rating,
  Sidebar,
  type SidebarItemData,
  Stepper,
  type StepperStepData,
  DatePicker,
  Calendar,
  TimeField,
  Breadcrumb,
  CommandPalette,
  type CommandPaletteItemData,
  Carousel,
  type CarouselSlideItem,
  Filmstrip,
  type FilmstripItem,
  Gallery,
  type GalleryItem,
  BarChart,
  LineChart,
  PieChart,
  Sparkline,
  Heatmap,
} from '#toolcrib';

// Named so the "collapse event log" toolbar button (in the AppShell.Main
// render below) can target this specific Splitter's `id` over aiBus,
// without hardcoding the same magic numbers/string in two places.
const MAIN_SPLITTER_ID = 'main-demo-splitter';
const MAIN_SPLITTER_INITIAL_SPLIT = 70;
// Small enough that the Collapse button (below) actually reads as
// "collapsed to the toolbar," not just "smaller" -- 15% of a typical
// viewport height left a visibly scrollable slice of the event log still
// showing beneath its own toolbar (reported directly, from a real
// screenshot). Also gates manual drag/keyboard resizing of *either*
// panel via Splitter's own minSize floor, not just this collapse target
// -- a deliberate reuse, not an accidental side effect: there's no
// reason a user dragging the handle by hand should stop earlier than the
// button does.
const MAIN_SPLITTER_MIN_SIZE = 5;

// A small, separate Acme Analytics roster for the standalone <Listbox>
// demo below — deliberately not sliced from the 250-row `dummyUsers`
// dataset, since it needs its own department labels ("Design",
// "Engineering", "Product") for the render slot to split on, not
// dummyUsers' Admin/Editor/Viewer access-role shape. label carries " — "
// so the render slot can split it into a two-line name/role display,
// while label itself stays the plain string the filter matches against.
const TEAM_MEMBERS: ListboxOptionData[] = [
  { label: 'Ava Chen — Design', value: 'ava' },
  { label: 'Marcus Lee — Engineering', value: 'marcus' },
  { label: 'Priya Patel — Product', value: 'priya' },
  { label: 'Sam Rivera — Engineering', value: 'sam' },
  { label: 'Jordan Kim — Design', value: 'jordan' },
].map(opt => ({
  ...opt,
  render: (o: ListboxOptionData) => {
    const [name, role] = o.label.split(' — ');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
        <span style={{ fontWeight: 'var(--ai-font-weight-semibold, 600)' }}>{name}</span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--ai-text-secondary)' }}>{role}</span>
      </div>
    );
  },
}));

const TABLE_COLUMN_OPTIONS = [
  { label: 'Name', value: 'name' },
  { label: 'Email', value: 'email' },
  { label: 'Role', value: 'role' },
  { label: 'Status', value: 'status' },
  { label: 'Actions', value: 'actions' },
];

const COUNTRY_OPTIONS = [
  { label: 'United States', value: 'us' },
  { label: 'United Kingdom', value: 'uk' },
  { label: 'Canada', value: 'ca' },
  { label: 'Germany', value: 'de' },
  { label: 'France', value: 'fr' },
  { label: 'Japan', value: 'jp' },
  { label: 'Australia', value: 'au' },
  { label: 'Brazil', value: 'br' },
];

// Zod validation schema for Demo Form
const userProfileSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Please enter a valid email address'),
  country: z.string().min(1, 'Please choose a country'),
  role: z.enum(['admin', 'editor', 'viewer'], { error: 'Role is required' }),
  contactPref: z.enum(['email', 'sms', 'phone'], { error: 'Select a contact preference' }),
  startDate: z.instanceof(CalendarDate, { message: 'Please select a start date' }),
  notifications: z.boolean(),
  agreeTerms: z.boolean().refine(val => val === true, 'You must accept the terms'),
  bio: z.string().max(200, 'Bio cannot exceed 200 characters').optional(),
});

interface DemoUser {
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'Active' | 'Pending' | 'Inactive';
  score: number;
}

// Backs the Data Table tab and the Combobox async search demo -- one
// fictional company, "Acme Analytics" (the same name the Charts tab's
// own dashboard already uses), rather than two disconnected sets of
// anonymous placeholder data.
const dummyUsers: DemoUser[] = Array.from({ length: 250 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  email: `user${i + 1}@acmeanalytics.io`,
  role: i % 3 === 0 ? 'Admin' : i % 2 === 0 ? 'Editor' : 'Viewer',
  status: i % 4 === 0 ? 'Pending' : i % 5 === 0 ? 'Inactive' : 'Active',
  score: Math.floor(Math.random() * 100),
}));

// --- Media demo assets ------------------------------------------------------
// Self-contained, inline SVG data URIs rather than an external image host —
// same "isolated, no network dependency" philosophy as the wireframe gallery
// below, just for photo-shaped content instead of layout structure.
function demoImage(bg: string, label: string, w = 480, h = 320): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="${Math.round(h / 8)}" fill="rgba(255,255,255,0.9)">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const MEDIA_PALETTE = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#ec4899', '#6b7280'];

const GALLERY_ITEMS: GalleryItem[] = Array.from({ length: 8 }, (_, i) => ({
  id: `photo-${i + 1}`,
  thumbnailSrc: demoImage(MEDIA_PALETTE[i % MEDIA_PALETTE.length], `#${i + 1}`, 300, 300),
  fullSrc: demoImage(MEDIA_PALETTE[i % MEDIA_PALETTE.length], `Photo #${i + 1}`, 1200, 800),
  alt: `Demo photo ${i + 1}`,
  caption: `Demo photo ${i + 1} of ${8} — a placeholder image generated inline, not fetched from anywhere.`,
}));

const CAROUSEL_SLIDES: CarouselSlideItem[] = ['Welcome', 'Features', 'Pricing', 'Get Started'].map((label, i) => ({
  id: `slide-${i}`,
  content: (
    <div
      style={{
        aspectRatio: '16 / 7',
        borderRadius: 'var(--ai-radius-md, 0.375rem)',
        background: MEDIA_PALETTE[i % MEDIA_PALETTE.length],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: '1.25rem',
        fontWeight: 700,
      }}
    >
      {label}
    </div>
  ),
}));

const FILMSTRIP_ITEMS: FilmstripItem[] = Array.from({ length: 10 }, (_, i) => ({
  id: `frame-${i + 1}`,
  label: `Frame ${i + 1}`,
  content: (
    <img
      src={demoImage(MEDIA_PALETTE[i % MEDIA_PALETTE.length], String(i + 1), 100, 100)}
      alt=""
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  ),
}));

// --- Navigation demo data ----------------------------------------------------
const TREE_ITEMS: TreeItemData[] = [
  {
    id: 'src',
    label: '📁 src',
    children: [
      {
        id: 'components',
        label: '📁 components',
        children: [
          { id: 'card-tsx', label: '📄 Card.tsx' },
          { id: 'button-tsx', label: '📄 Button.tsx' },
          { id: 'tree-tsx', label: '📄 Tree.tsx' },
        ],
      },
      {
        id: 'theme',
        label: '📁 theme',
        children: [
          { id: 'theme-context-tsx', label: '📄 themeContext.tsx' },
          { id: 'harmonies-ts', label: '📄 harmonies.ts' },
        ],
      },
      { id: 'index-ts', label: '📄 index.ts' },
    ],
  },
  {
    id: 'demo',
    label: '📁 demo',
    children: [{ id: 'app-tsx', label: '📄 App.tsx' }],
  },
  { id: 'package-json', label: '📄 package.json' },
  { id: 'readme-md', label: '📄 README.md', disabled: true },
];

const SIDEBAR_ITEMS: SidebarItemData[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { id: 'projects', label: 'Projects', icon: '📁' },
  { id: 'team', label: 'Team', icon: '👥' },
  { id: 'reports', label: 'Reports', icon: '📊' },
  { id: 'settings', label: 'Settings', icon: '⚙️', disabled: true },
];

// Single source of truth for the 12 main-demo tabs' labels -- both the
// TabStrip head row and the CommandPalette's "Go to" commands used to
// keep their own separate copy of this list, and they'd already drifted
// (the CommandPalette one was quietly missing "charts"). `plainLabel`
// strips the leading emoji for contexts (the command palette's own list
// rows) that already render an icon column of their own.
const TAB_DEFS: Record<string, { label: string; plainLabel: string }> = {
  overview: { label: '🚀 Overview & Architecture', plainLabel: 'Overview & Architecture' },
  forms: { label: '📝 Forms & Zod Engine', plainLabel: 'Forms & Zod Engine' },
  overlays: { label: '🪟 Overlays & Actions', plainLabel: 'Overlays & Actions' },
  toasts: { label: '🔔 Toast Subsystem', plainLabel: 'Toast Subsystem' },
  datatable: { label: '📊 Data Table', plainLabel: 'Data Table' },
  charts: { label: '📈 Charts', plainLabel: 'Charts' },
  navigation: { label: '🧭 Navigation & Structure', plainLabel: 'Navigation & Structure' },
  media: { label: '🖼️ Media Gallery', plainLabel: 'Media Gallery' },
  status: { label: '🎛️ Feedback & Status', plainLabel: 'Feedback & Status' },
  layout: { label: '📐 Common Layout Idioms', plainLabel: 'Common Layout Idioms' },
  wireframes: { label: '🗺️ Wireframe Gallery', plainLabel: 'Wireframe Gallery' },
  showcase: { label: '🧩 Component Showcase', plainLabel: 'Component Showcase' },
};

// Groups the 12 flat tabs above into a real <AppShell.Sidebar> nav rail --
// a sidebar group with more than one tabId still shows a (now much
// shorter) <TabStrip> for the tabs within it; a solo-tabId group skips
// the redundant single-item strip entirely (see the render below).
const NAV_GROUPS: { id: string; label: string; icon: string; tabIds: string[] }[] = [
  { id: 'overview', label: 'Overview', icon: '🚀', tabIds: ['overview'] },
  { id: 'forms-data', label: 'Forms & Data', icon: '📋', tabIds: ['forms', 'datatable'] },
  { id: 'feedback', label: 'Overlays & Feedback', icon: '🔔', tabIds: ['overlays', 'toasts', 'status'] },
  { id: 'analytics', label: 'Analytics', icon: '📈', tabIds: ['charts'] },
  { id: 'nav-layout', label: 'Navigation & Layout', icon: '🧭', tabIds: ['navigation', 'layout'] },
  { id: 'media-wireframes', label: 'Media & Wireframes', icon: '🖼️', tabIds: ['media', 'wireframes'] },
  { id: 'showcase', label: 'Showcase', icon: '🧩', tabIds: ['showcase'] },
];

const STEPPER_STEPS: StepperStepData[] = [
  {
    id: 'account',
    label: 'Account',
    content: (
      <p style={{ margin: 0 }}>
        Step 1 of 3 — plain content, no <code>formId</code>. Forward navigation here is never blocked.
      </p>
    ),
  },
  {
    id: 'profile',
    label: 'Profile',
    formId: 'stepper-profile-form',
    content: (
      <VStack gap="sm">
        <p style={{ margin: 0 }}>
          Step 2 of 3 — this step sets <code>formId="stepper-profile-form"</code>. The "Confirm" step stays
          unreachable until the form below reports <code>isValid: true</code> at least once (type a display name
          of 3+ characters).
        </p>
        <Form id="stepper-profile-form" schema={z.object({ displayName: z.string().min(3, 'At least 3 characters') })} initialValues={{ displayName: '' }} onSubmit={() => {}}>
          <FormField name="displayName" label="Display Name">
            <Input placeholder="e.g. Jane Doe" />
          </FormField>
        </Form>
      </VStack>
    ),
  },
  {
    id: 'confirm',
    label: 'Confirm',
    content: <p style={{ margin: 0 }}>Step 3 of 3 — reachable only once the Profile step's form is valid.</p>,
  },
];

// --- Layout Wireframe Gallery ---------------------------------------------
// Each wireframe below is a self-contained HTML document rendered via
// iframe `srcDoc`, deliberately isolated from the parent page's own CSS and
// from the live HSV theme — a wireframe's whole point is structure over
// finish, so these use a fixed flat palette rather than reading
// `:root`'s theme variables. The region colors are consistent across every
// wireframe (see the legend rendered above the gallery) so a viewer can
// visually parse "this box plays this role" the moment they recognize the
// color, without re-reading each one from scratch.
const LOREM_SHORT =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
const LOREM_TINY = 'Lorem ipsum dolor sit amet consectetur.';

const WIREFRAME_STYLE = `
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f3f4f6; color: #111827; overflow: hidden; }
  .region { display: flex; align-items: center; }
  .chrome { color: #fff; font-size: 11px; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; }
  .header { background: #3b82f6; padding: 0 14px; height: 34px; flex-shrink: 0; justify-content: space-between; }
  .sidebar { background: #8b5cf6; flex-direction: column; align-items: stretch; padding: 10px 0; gap: 3px; flex-shrink: 0; }
  .sidebar .nav-item { color: #fff; font-size: 11px; padding: 6px 14px; opacity: 0.8; }
  .sidebar .nav-item.active { opacity: 1; background: rgba(255,255,255,0.2); font-weight: 700; }
  .aside { background: #f59e0b; flex-direction: column; align-items: stretch; padding: 10px 12px; gap: 6px; flex-shrink: 0; }
  .footer { background: #6b7280; padding: 0 14px; height: 26px; flex-shrink: 0; }
  .content { background: #ffffff; border-left: 3px solid #10b981; padding: 12px 14px; overflow: hidden; min-width: 0; min-height: 0; }
  .content-label { color: #10b981; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
  .content p { margin: 0 0 6px; font-size: 11px; line-height: 1.5; color: #4b5563; }
  .bar { height: 8px; border-radius: 3px; background: rgba(255,255,255,0.5); }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; min-width: 0; }
  .card .top { height: 4px; border-radius: 2px; margin-bottom: 6px; }
  .card p { margin: 0; font-size: 9.5px; line-height: 1.4; color: #6b7280; }
  .grid { display: grid; gap: 8px; }
`;

function wireframeDoc(bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${WIREFRAME_STYLE}</style></head><body>${bodyHtml}</body></html>`;
}

interface WireframeDef {
  title: string;
  components: string;
  /** Static tiles (the default): a self-contained HTML document rendered via iframe `srcDoc`. */
  srcDoc?: string;
  /**
   * Live tiles: real Toolcrib components, portaled into the iframe's own
   * document (see `<LiveIframe>`) so they're genuinely interactive —
   * draggable `<Splitter>` handles, real `<TabStrip>` tab switching —
   * rather than a flat CSS approximation. Reserved for the couple of
   * layouts (like a Splitter-heavy IDE workbench) where "can you actually
   * drag it" is the point; the rest stay static since there's nothing in
   * them to interact with.
   */
  content?: ReactNode;
}

/**
 * Mounts `children` into a *different* Document — the iframe's own, via
 * `ReactDOM.createPortal` — so real Toolcrib components (not a flat HTML/
 * CSS approximation) can render and behave normally inside a gallery tile:
 * a real `<Splitter>` handle actually drags, a real `<TabStrip>` actually
 * switches panels.
 *
 * Two things a portal into an iframe needs that a same-document portal
 * doesn't:
 *  1. The iframe's document starts with no stylesheets of its own — clone
 *     every `<style>`/`<link rel="stylesheet">` from the outer document's
 *     `<head>` into it once the iframe loads, so the portaled content gets
 *     the same base CSS (resets, keyframes) as the rest of the app.
 *  2. Its own `<ThemeProvider targetDocument={mountDoc}>`, not a shared
 *     one — `ThemeProvider` writes CSS custom properties onto
 *     `(targetDocument ?? document).documentElement`; without passing the
 *     iframe's own document explicitly here, the default (the bare global
 *     `document`) would inject this instance's variables onto the *outer*
 *     page's `<html>` instead, fighting with the real page's own
 *     `ThemeProvider` in main.tsx. See themeContext.tsx's own comment on
 *     why the prop exists.
 */
const LiveIframe: React.FC<{ title: string; height: string; children: ReactNode }> = ({ title, height, children }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mountDoc, setMountDoc] = useState<Document | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const setup = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
        doc.head.appendChild(node.cloneNode(true));
      });
      doc.body.style.margin = '0';
      setMountDoc(doc);
    };

    if (iframe.contentDocument?.readyState === 'complete') {
      setup();
    } else {
      iframe.addEventListener('load', setup);
    }
    return () => iframe.removeEventListener('load', setup);
  }, []);

  return (
    <>
      <iframe
        ref={iframeRef}
        title={title}
        style={{
          width: '100%',
          height,
          border: '0.0625rem solid var(--ai-border, #e5e7eb)',
          borderRadius: 'var(--ai-radius-md, 0.375rem)',
          display: 'block',
        }}
      />
      {mountDoc &&
        createPortal(
          <ThemeProvider targetDocument={mountDoc}>
            <div style={{ height: '100vh', boxSizing: 'border-box' }}>{children}</div>
          </ThemeProvider>,
          mountDoc.body
        )}
    </>
  );
};

const WIREFRAMES: WireframeDef[] = [
  {
    title: 'App Shell',
    components: '<AppShell>',
    srcDoc: wireframeDoc(`
      <div style="display:flex;flex-direction:column;height:100vh;">
        <div class="header region chrome"><span>Header</span></div>
        <div class="content" style="flex:1;">
          <div class="content-label">Main</div>
          <p>${LOREM_SHORT}</p>
          <p>${LOREM_TINY}</p>
        </div>
      </div>
    `),
  },
  {
    title: 'Dashboard',
    components: '<AppShell> + <Splitter> + <Grid>',
    srcDoc: wireframeDoc(`
      <div style="display:flex;flex-direction:column;height:100vh;">
        <div class="header region chrome"><span>Header</span></div>
        <div style="display:flex;flex:1;min-height:0;">
          <div class="sidebar" style="width:110px;">
            <div class="nav-item active">Overview</div>
            <div class="nav-item">Analytics</div>
            <div class="nav-item">Settings</div>
          </div>
          <div class="content" style="flex:1;">
            <div class="content-label">Main</div>
            <div class="grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:8px;">
              <div class="card"><div class="top" style="background:#3b82f6"></div><p>${LOREM_TINY}</p></div>
              <div class="card"><div class="top" style="background:#8b5cf6"></div><p>${LOREM_TINY}</p></div>
              <div class="card"><div class="top" style="background:#f59e0b"></div><p>${LOREM_TINY}</p></div>
            </div>
            <p>${LOREM_SHORT}</p>
          </div>
        </div>
      </div>
    `),
  },
  {
    title: 'Holy Grail',
    components: '<AppShell> + nested <Splitter> + <Content>',
    srcDoc: wireframeDoc(`
      <div style="display:flex;flex-direction:column;height:100vh;">
        <div class="header region chrome"><span>Header</span></div>
        <div style="display:flex;flex:1;min-height:0;">
          <div class="sidebar" style="width:80px;">
            <div class="nav-item active">Nav 1</div>
            <div class="nav-item">Nav 2</div>
          </div>
          <div class="content" style="flex:1;">
            <div class="content-label">Main</div>
            <p>${LOREM_SHORT}</p>
          </div>
          <div class="aside" style="width:90px;">
            <div class="chrome">Aside</div>
            <div class="bar"></div>
            <div class="bar" style="width:70%"></div>
          </div>
        </div>
        <div class="footer region chrome"><span>Footer</span></div>
      </div>
    `),
  },
  {
    title: 'Master-Detail',
    components: '<Splitter> + <UIGroup>',
    srcDoc: wireframeDoc(`
      <div style="display:flex;height:100vh;">
        <div class="sidebar" style="width:120px;">
          <div class="nav-item active">Item 1</div>
          <div class="nav-item">Item 2</div>
          <div class="nav-item">Item 3</div>
          <div class="nav-item">Item 4</div>
        </div>
        <div class="content" style="flex:1;">
          <div class="content-label">Detail</div>
          <p>${LOREM_SHORT}</p>
          <p>${LOREM_TINY}</p>
          <div style="display:flex;gap:6px;margin-top:8px;">
            <div style="background:#3b82f6;color:#fff;font-size:10px;padding:5px 10px;border-radius:4px;">Save</div>
            <div style="border:1px solid #d1d5db;color:#6b7280;font-size:10px;padding:5px 10px;border-radius:4px;">Cancel</div>
          </div>
        </div>
      </div>
    `),
  },
  {
    title: 'Card Grid',
    components: '<Toolbar> + <Grid> + <Card>',
    srcDoc: wireframeDoc(`
      <div style="display:flex;flex-direction:column;height:100vh;">
        <div class="header region chrome"><span>Toolbar</span><span class="bar" style="width:40px;height:14px;"></span></div>
        <div class="content" style="flex:1;">
          <div class="grid" style="grid-template-columns:repeat(3,1fr);">
            <div class="card"><div class="top" style="background:#3b82f6"></div><p>${LOREM_TINY}</p></div>
            <div class="card"><div class="top" style="background:#8b5cf6"></div><p>${LOREM_TINY}</p></div>
            <div class="card"><div class="top" style="background:#10b981"></div><p>${LOREM_TINY}</p></div>
            <div class="card"><div class="top" style="background:#f59e0b"></div><p>${LOREM_TINY}</p></div>
            <div class="card"><div class="top" style="background:#ef4444"></div><p>${LOREM_TINY}</p></div>
            <div class="card"><div class="top" style="background:#6b7280"></div><p>${LOREM_TINY}</p></div>
          </div>
        </div>
      </div>
    `),
  },
  {
    title: 'Kanban Board',
    components: '<Toolbar> + <HStack> + <VStack> + <Card>',
    srcDoc: wireframeDoc(`
      <div style="display:flex;flex-direction:column;height:100vh;">
        <div class="header region chrome"><span>Toolbar</span></div>
        <div class="content" style="flex:1;display:flex;gap:10px;overflow:hidden;">
          ${['To Do', 'In Progress', 'Done']
            .map(
              col => `
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;">
              <div class="content-label">${col}</div>
              <div class="card"><div class="top" style="background:#3b82f6"></div><p>${LOREM_TINY}</p></div>
              <div class="card"><div class="top" style="background:#8b5cf6"></div><p>${LOREM_TINY}</p></div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `),
  },
  {
    title: 'IDE Workbench (live)',
    components: '<Splitter> (nested ×2, draggable) + <TabStrip>',
    content: (
      <Splitter id="live-ide-outer" orientation="horizontal" initialSplit={78}>
        <Splitter.Panel>
          <Splitter id="live-ide-inner" orientation="vertical" initialSplit={72}>
            <Splitter.Panel>
              <TabStrip
                id="live-ide-tabs"
                defaultActiveId="app"
                items={[
                  { id: 'app', label: 'App.tsx' },
                  { id: 'index', label: 'index.ts' },
                ]}
              />
              <TabStrip.Panel groupId="live-ide-tabs" value="app">
                <div style={{ padding: '0.625rem', fontFamily: 'monospace', fontSize: '0.6875rem', color: 'var(--ai-text-secondary)', lineHeight: 1.8 }}>
                  <div>import React from 'react';</div>
                  <div>export const App = () =&gt; ...</div>
                </div>
              </TabStrip.Panel>
              <TabStrip.Panel groupId="live-ide-tabs" value="index">
                <div style={{ padding: '0.625rem', fontFamily: 'monospace', fontSize: '0.6875rem', color: 'var(--ai-text-secondary)' }}>
                  <div>export * from './App';</div>
                </div>
              </TabStrip.Panel>
            </Splitter.Panel>
            <Splitter.Panel>
              <div style={{ background: '#111827', color: '#6ee7b7', fontFamily: 'monospace', fontSize: '0.6875rem', padding: '0.5rem', height: '100%', boxSizing: 'border-box' }}>
                <div style={{ color: '#34d399' }}>&gt; npm run dev</div>
                <div>VITE ready in 320 ms</div>
              </div>
            </Splitter.Panel>
          </Splitter>
        </Splitter.Panel>
        <Splitter.Panel>
          <div style={{ padding: '0.625rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.6875rem', marginBottom: '0.375rem' }}>Explorer</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--ai-text-secondary)', lineHeight: 1.9 }}>
              📁 src<br />&nbsp;&nbsp;📄 App.tsx<br />&nbsp;&nbsp;📄 index.ts
            </div>
          </div>
        </Splitter.Panel>
      </Splitter>
    ),
  },
  {
    title: 'Split Diff / Compare (live)',
    components: '<Splitter> (draggable) + <TabStrip>',
    content: (
      <Splitter id="live-diff" orientation="horizontal" initialSplit={50}>
        <Splitter.Panel>
          <TabStrip id="live-diff-left" defaultActiveId="v1" items={[{ id: 'v1', label: 'v1 — App.tsx' }]} />
          <TabStrip.Panel groupId="live-diff-left" value="v1">
            <div style={{ padding: '0.625rem', fontFamily: 'monospace', fontSize: '0.6875rem' }}>
              <div style={{ color: 'var(--ai-text-secondary)' }}>import React from 'react';</div>
              <div style={{ background: 'rgba(239, 68, 68, 0.15)' }}>const OLD = true;</div>
              <div style={{ color: 'var(--ai-text-secondary)' }}>export const App = () =&gt; ...</div>
            </div>
          </TabStrip.Panel>
        </Splitter.Panel>
        <Splitter.Panel>
          <TabStrip id="live-diff-right" defaultActiveId="v2" items={[{ id: 'v2', label: 'v2 — App.tsx' }]} />
          <TabStrip.Panel groupId="live-diff-right" value="v2">
            <div style={{ padding: '0.625rem', fontFamily: 'monospace', fontSize: '0.6875rem' }}>
              <div style={{ color: 'var(--ai-text-secondary)' }}>import React from 'react';</div>
              <div style={{ background: 'rgba(16, 185, 129, 0.15)' }}>const NEW = true;</div>
              <div style={{ color: 'var(--ai-text-secondary)' }}>export const App = () =&gt; ...</div>
            </div>
          </TabStrip.Panel>
        </Splitter.Panel>
      </Splitter>
    ),
  },
];

const WIREFRAME_LEGEND: { label: string; color: string }[] = [
  { label: 'Header / Toolbar', color: '#3b82f6' },
  { label: 'Sidebar / Nav', color: '#8b5cf6' },
  { label: 'Main Content', color: '#10b981' },
  { label: 'Aside', color: '#f59e0b' },
  { label: 'Footer', color: '#6b7280' },
];

/**
 * Throws during render once `triggerKey > 0` — an error boundary only
 * catches render/lifecycle errors, not ones thrown inside an event handler,
 * so the "crash" has to be a render-time effect of state changing, not the
 * button's own onClick. Module-level (not defined inside App) so it isn't
 * torn down and recreated — with fresh internal state — on every App
 * re-render.
 */
const Flaky: React.FC<{ triggerKey: number }> = ({ triggerKey }) => {
  if (triggerKey > 0) {
    throw new Error(`Simulated render crash #${triggerKey}`);
  }
  return <p style={{ margin: 0 }}>Nothing went wrong (yet). Click the button below to simulate a render crash.</p>;
};

export const App: React.FC = () => {
  const { parameters, sliceStates, toggleDarkMode } = useTheme();
  const typographyState = sliceStates.typography;
  const { addToast, setAnchor } = useToast();

  // <TabStrip id="main-demo"> would happily manage this itself
  // (uncontrolled) — it's promoted to controlled state here for exactly one
  // reason: <CommandPalette>'s "Go to ..." items below need a way to switch
  // tabs from a component with no ancestor/descendant relationship to the
  // TabStrip. TabStrip still broadcasts `tab:changed` on `aiBus` the same
  // way either way; this only adds the explicit React-level hook.
  const [activeTab, setActiveTab] = useState('overview');
  // Derived, not its own state -- activeTab is the single source of truth
  // for "where am I," same reasoning as Block/Listbox's own derived values
  // elsewhere in this file. Keeping a separate activeGroupId in sync with
  // activeTab (e.g. from a <CommandPalette> "go to" command jumping into a
  // tab whose group isn't currently selected) would be exactly the kind
  // of dual-source-of-truth bug this avoids by construction.
  const activeGroup = NAV_GROUPS.find(g => g.tabIds.includes(activeTab)) ?? NAV_GROUPS[0];
  const [eventLogs, setEventLogs] = useState<{ id: string; event: string; payload: string; time: string }[]>([]);
  const [listboxQuery, setListboxQuery] = useState('');
  const [listboxActiveIndex, setListboxActiveIndex] = useState<number | undefined>(undefined);
  const [listboxSelected, setListboxSelected] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['name', 'email', 'status']);
  const [progressValue, setProgressValue] = useState(45);
  const [flakyTriggerKey, setFlakyTriggerKey] = useState(0);
  const [paginationPage, setPaginationPage] = useState(1);
  const [selectedUserKeys, setSelectedUserKeys] = useState<string[]>([]);
  const [ratingValue, setRatingValue] = useState(4);
  const [sidebarActiveId, setSidebarActiveId] = useState('dashboard');
  const [dashboardDateRange, setDashboardDateRange] = useState('30d');
  const [dashboardDimension, setDashboardDimension] = useState('all');
  const [eventLogCollapsed, setEventLogCollapsed] = useState(false);
  // MAIN_SPLITTER_ID/MAIN_SPLITTER_MIN_SIZE below give the "collapse the
  // event log" button a stable target: Splitter has no controlled/ref prop
  // for its split ratio, but it listens for `splitter:split_changed` on
  // aiBus, matched by its own `id`, exactly the way Modal/Collapsible are
  // already commanded by their own `id` -- driving it here is the same
  // pattern the rest of this toolkit already uses for cross-component
  // action, not a Splitter-specific special case. The handle itself still
  // works too (drag, arrow keys, dblclick-to-reset) -- this button is an
  // additional way to reach the same `split` state, not a replacement.
  const toggleEventLogCollapsed = () => {
    aiBus.emit('splitter:split_changed', {
      id: MAIN_SPLITTER_ID,
      split: eventLogCollapsed ? MAIN_SPLITTER_INITIAL_SPLIT : 100 - MAIN_SPLITTER_MIN_SIZE,
    });
    setEventLogCollapsed(v => !v);
  };

  // Data-driven for <CommandPalette> — grouped, each entry either jumps to
  // a tab (closing over setActiveTab, the same controlled hook above) or
  // fires a small cross-cutting action, demonstrating why a command palette
  // is genuinely useful once an app has more than a couple of screens.
  const commandPaletteItems: CommandPaletteItemData[] = [
    ...Object.entries(TAB_DEFS).map(([id, def]) => ({
      value: `goto-${id}`,
      label: def.plainLabel,
      group: 'Go to',
      onSelect: () => setActiveTab(id),
    })),
    {
      value: 'toggle-dark-mode',
      label: 'Toggle dark mode',
      group: 'Actions',
      icon: '🌙',
      onSelect: toggleDarkMode,
    },
    {
      value: 'fire-test-toast',
      label: 'Fire a test toast',
      group: 'Actions',
      icon: '🔔',
      onSelect: () => addToast({ type: 'info', message: 'Triggered from the Command Palette' }),
    },
    {
      value: 'open-theme-designer',
      label: 'Open Theme Designer',
      group: 'Actions',
      icon: '🎨',
      onSelect: () => aiBus.openDrawer('theme-editor-panel'),
    },
  ];

  // Subscribe to ALL aiBus events for the live event monitor
  useAIEvent('*' as any, (event: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const eventName = event.type || 'aiBus:event';
    const logItem = {
      id: Math.random().toString(36).substring(2, 9),
      event: eventName,
      // Plain JSON.stringify throws on payloads containing a raw DOM node
      // (e.g. element:resized's `target: HTMLElement`, from useAdaptiveSize)
      // — a real "Converting circular structure to JSON" crash caught here
      // via a browser run, not visible from types or unit tests. Render DOM
      // nodes as a short tag description instead of failing the whole log
      // entry.
      //
      // `instanceof HTMLElement` alone isn't enough: it checks against
      // *this* document's HTMLElement constructor, but aiBus is a single
      // shared module-level singleton, so an element from a live wireframe
      // tile (a real component tree portaled into an <iframe>'s own,
      // separate document — see LiveIframe) is an HTMLElement from a
      // *different* realm, and cross-realm instanceof always fails even
      // though the object genuinely is one — the same "circular structure"
      // crash resurfaces from that direction instead. `nodeType === 1`
      // (Element) is realm-independent, confirmed via a real browser run
      // dragging a live tile's Splitter, which is exactly what triggers a
      // resize event with a foreign-realm target.
      payload: JSON.stringify(event.detail || event, (_key, value) =>
        value && typeof value === 'object' && value.nodeType === 1 ? `<${value.tagName.toLowerCase()}>` : value
      ),
      time: timestamp,
    };
    setEventLogs(prev => [logItem, ...prev.slice(0, 49)]);
  });

  // `error:boundary` is already visible in the log above (it's part of the
  // wildcard stream every other event goes through) — this is a *second*,
  // narrower subscription showing the pattern a real app would actually
  // use: forward just the events you care about to wherever "elsewhere"
  // is. A toast stands in for a real destination (Sentry, a support queue,
  // your own backend) — same idea, just swap what happens inside the
  // callback. Nothing else about this pattern is error-specific: the same
  // `aiBus.on`/`useAIEvent` mechanism works for any event, or the wildcard
  // stream wholesale, if what you want is broader usage telemetry rather
  // than only crash reports.
  useAIEvent('error:boundary', event => {
    addToast({
      type: 'error',
      priority: 'high',
      title: `Caught in <${event.componentName}>`,
      message: event.error,
    });
  });

  const columns: Column<DemoUser>[] = [
    { key: 'id', title: 'ID', width: 60, sortable: true },
    { key: 'name', title: 'User Name', width: 140, sortable: true },
    { key: 'email', title: 'Email Address', width: 220, sortable: true },
    { key: 'role', title: 'Role Level', width: 110, sortable: true },
    {
      key: 'status',
      title: 'Status',
      width: 110,
      sortable: true,
      render: ({ value: val }) => (
        <span
          style={{
            padding: '0.2rem 0.5rem',
            borderRadius: 'var(--ai-radius-sm, 0.25rem)',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: val === 'Active' ? 'var(--ai-subtheme-success-bg)' : val === 'Pending' ? 'var(--ai-subtheme-warning-bg)' : 'var(--ai-subtheme-error-bg)',
            color: val === 'Active' ? 'var(--ai-subtheme-success-text)' : val === 'Pending' ? 'var(--ai-subtheme-warning-text)' : 'var(--ai-subtheme-error-text)',
            border: `0.0625rem solid ${val === 'Active' ? 'var(--ai-subtheme-success-border)' : val === 'Pending' ? 'var(--ai-subtheme-warning-border)' : 'var(--ai-subtheme-error-border)'}`,
          }}
        >
          {val as string}
        </span>
      ),
    },
    { key: 'score', title: 'Score', width: 90, sortable: true },
  ];

  return (
    <>
      {/* Mounted once, near the root — same "render it once, it works from
          anywhere" shape as <ToastContainer>. Its own Cmd/Ctrl+K listener
          registers itself on mount; items are the data-driven array built
          above. Also directly openable via aiBus.openCommandPalette(id),
          demonstrated by the button on the Overlays tab. */}
      <CommandPalette id="global-command-palette" items={commandPaletteItems} />
      <AppShell layout="sidebar-left">
      {/* Top Header Bar */}
      <AppShell.Header>
        <HStack gap="sm">
          <img
            src={toolcribIcon}
            alt="Toolcrib"
            width={56}
            height={56}
            style={{ borderRadius: 'var(--ai-radius-md, 0.375rem)', flexShrink: 0 }}
          />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>Toolcrib</h1>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--ai-text-secondary)' }}>
              React UI Component Package Tailored for AI Consumption
            </p>
          </div>
        </HStack>

        {/* Back in a single UIGroup (was briefly split into a plain
            wrapping row to fix narrow-viewport overflow) — the trigger is
            now an icon-only glyph instead of a full text label, so the
            whole merged pill+button cluster is narrow enough to actually
            fit next to the title at most widths, and AppShell.Header's own
            flexWrap (see its own comment) still drops this whole cluster
            to a second line as a unit on the rare width where it doesn't.
            The label moves to a Tooltip so it's still discoverable, not
            lost. */}
        <UIGroup>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.875rem',
              background: 'var(--ai-bg-container, #f9fafb)',
              border: '0.0625rem solid var(--ai-border, #d1d5db)',
              fontSize: '0.875rem',
              color: 'var(--ai-text-secondary, #6b7280)',
            }}
          >
            <Tooltip content="Current theme base color">
              <span
                role="img"
                aria-label="Theme base color swatch"
                style={{
                  display: 'inline-block',
                  width: '1rem',
                  height: '1rem',
                  borderRadius: 'var(--ai-radius-sm, 0.25rem)',
                  border: '0.0625rem solid var(--ai-border, #d1d5db)',
                  background: 'var(--ai-color-base)',
                  flexShrink: 0,
                }}
              />
            </Tooltip>
            <span>
              Harmony: <strong style={{ color: 'var(--ai-text-primary)' }}>{parameters.harmonyMode}</strong> | Mode: <strong style={{ color: 'var(--ai-text-primary)' }}>{parameters.isDarkMode ? 'Dark 🌙' : 'Light ☀️'}</strong> | Master Font: <strong style={{ color: 'var(--ai-text-primary)' }}>{typographyState.masterFontSize}px</strong>
            </span>
          </div>
          <Drawer
            id="theme-editor-panel"
            title="🎨 OOTB Theme Designer"
            trigger={
              // squareCorners="left" set explicitly, not left to UIGroup's
              // usual automatic CSS: that CSS only reaches its own direct
              // children, and this Button sits two wrappers deep (Drawer's
              // own trigger div, then Tooltip's own trigger span) — both
              // wrappers correctly stretch/report the squared radius
              // themselves (confirmed via a real browser run), but neither
              // is the visible element, so the squaring had no visible
              // effect and the button's own natural corners showed instead.
              <Tooltip content="OOTB Theme Designer" side="bottom">
                <Button variant="primary" squareCorners="left" aria-label="Open Theme Designer">🎨</Button>
              </Tooltip>
            }
            width="26rem"
          >
            <ThemeEditor />
          </Drawer>
        </UIGroup>
      </AppShell.Header>

      {/* Primary nav rail -- <Sidebar> in its real, intended context (see
          AppShell.Sidebar's own doc comment), not the bounded demo box
          on the Navigation & Structure tab. Selecting a group jumps
          activeTab to that group's first tab; activeGroup itself is
          derived from activeTab (see its own comment above), so this
          stays in sync regardless of how activeTab changes -- a sidebar
          click, a <CommandPalette> "go to" command, or the (now
          shorter, per-group) <TabStrip> below all funnel through the
          same setActiveTab. */}
      <AppShell.Sidebar>
        <Sidebar
          items={NAV_GROUPS.map(g => ({ id: g.id, label: g.label, icon: g.icon }))}
          activeId={activeGroup.id}
          aria-label="Primary navigation"
          onItemClick={groupId => {
            const group = NAV_GROUPS.find(g => g.id === groupId);
            if (group) setActiveTab(group.tabIds[0]);
          }}
        />
      </AppShell.Sidebar>

      {/* Main Content Area with Resizable Splitter */}
      <AppShell.Main>
        <Splitter id={MAIN_SPLITTER_ID} orientation="vertical" initialSplit={MAIN_SPLITTER_INITIAL_SPLIT} minSize={MAIN_SPLITTER_MIN_SIZE}>
          {/* Top Panel: Interactive Component Playground */}
          {/* <Content> fills the Splitter.Panel and establishes the flex
              domain; unlike a plain div (or VStack, which doesn't declare
              squareCorners and would leak it onto the DOM — confirmed via
              a real browser run), it explicitly declares and consumes
              squareCorners, so Panel's corner-squaring cloneElement()
              forwards correctly. */}
          <Splitter.Panel squareCorners="bottom">
            <Content>
              {/* Scoped to the active sidebar group's own tabIds, not the
                  full list of 12 -- the sidebar handles top-level
                  navigation now, so this only needs to disambiguate
                  between the (at most 3) tabs within whichever group is
                  selected. Stays mounted even for a solo-tab group
                  (display:none, not conditional rendering) so its own
                  tab:changed broadcast effect keeps firing on every
                  activeTab change regardless of group size -- an
                  unmount/remount here would risk missing exactly the
                  broadcast TabStrip.Panel elsewhere in the tree depends
                  on to know a new tab is active. */}
              <div style={{ display: activeGroup.tabIds.length > 1 ? undefined : 'none' }}>
                <TabStrip
                  id="main-demo"
                  activeId={activeTab}
                  onChange={setActiveTab}
                  items={activeGroup.tabIds.map(id => ({ id, label: TAB_DEFS[id].label }))}
                />
              </div>

              {/*
                <Content.Grow> is the scrollable container for the active
                tab. No `key={activeTab}` trick needed anymore to force the
                fade-in animation on switch — each <TabStrip.Panel> below
                mounts/unmounts on its own (it returns null while inactive)
                and carries its own animation, so a fresh mount already
                replays it without any help from this wrapper. This
                component's only job is providing the scrollable flex
                region within <Content>'s domain; it has no idea which tab
                is active, on purpose.
              */}
              <Content.Grow data-testid="main-content-scroll">
                {/* Tab 1: Overview & Architecture */}
                <TabStrip.Panel groupId="main-demo" value="overview">
                  <VStack gap="lg">
                    <Card>
                      <Card.Header>🛡️ Why Toolcrib?</Card.Header>
                      <Card.Content>
                        <p style={{ marginTop: 0 }}>
                          An AI generating UI code from scratch tends to hit the same handful of failure surfaces over and over — not because it doesn't know React, but because nothing structural is stopping it from reinventing the same broken wheel a different way each time. <code>Toolcrib</code> exists to put a real structural boundary at each one, without taking control away from you.
                        </p>
                        {/* StyleDomainProvider, not overrides.subtheme on each
                            CardSimple individually — one ancestor setting
                            gives the whole grid a consistent informational
                            tint without repeating "subtheme: 'info'" six
                            times, and (being Context-based, not CSS
                            inheritance) it'd still reach a card even if one
                            rendered through a portal. */}
                        <StyleDomainProvider subtheme="info">
                          <Grid columns={2} gap="sm">
                          {[
                            {
                              icon: '🎨',
                              title: 'Ad-hoc CSS drift',
                              body: <>Hardcoded pixels, hex colors, and z-index values scattered across components make theming and consistency nearly impossible to maintain by hand. Every value in <code>Toolcrib</code> is <code>rem</code>-based and resolves through the HSV-derived CSS variable theme system, so one change at <code>:root</code> (or one preset swap) reaches every component at once.</>,
                            },
                            {
                              icon: '🪟',
                              title: 'Reinvented, subtly-broken overlays',
                              body: <>A hand-rolled modal is easy to get 90% right and very easy to ship without a real focus trap, light-dismiss, or correct portal target. <code>Popup</code>, <code>Modal</code>, <code>Drawer</code>, and <code>AlertDialog</code> wrap Radix UI primitives specifically so that 90% is handled once, correctly, instead of approximated per-component.</>,
                            },
                            {
                              icon: '🔌',
                              title: 'Cross-tree wiring hacks',
                              body: <>Passing callbacks through five layers of props (or reaching for a global singleton) just to let two unrelated components talk is a common improvisation. The <code>aiBus</code> event bus (<code>aiBus.emit()</code> / <code>useAIEvent()</code>) is the one sanctioned escape hatch for that specific problem, so it doesn't need reinventing per feature.</>,
                            },
                            {
                              icon: '♿',
                              title: 'Silent accessibility gaps',
                              body: <>A missing focus-visible ring or keyboard interaction is invisible in a quick visual check and only surfaces later, for a real keyboard/screen-reader user. Interactive states (hover, focus-visible, active) are injected systematically across every component from one shared stylesheet, not hand-added per instance.</>,
                            },
                            {
                              icon: '👻',
                              title: 'Hallucinated props and APIs',
                              body: <>Guessing at a prop name that doesn't exist is a routine AI failure mode against an unfamiliar library. Full TypeScript coverage plus a generated component manifest (<code>ai-docs/component-manifest.json</code>) mean the real API surface is always mechanically derivable, never guessed at.</>,
                            },
                            {
                              icon: '🔓',
                              title: 'Losing control to a black box',
                              body: <>The usual tradeoff for all of the above is an opaque, locked-down component library you can't see inside or diverge from. <code>Toolcrib</code> is vendored directly into your project via <code>toolcrib init</code> — every file is yours to read, patch, or fork — and the <code>overrides</code> prop plus per-instance style domains give you fine-grained control without ever reaching for a raw <code>style</code>/<code>className</code> escape hatch.</>,
                            },
                          ].map(item => (
                            <CardSimple key={item.title} title={<>{item.icon} {item.title}</>} overrides={{ padding: 'compact' }}>
                              <p style={{ margin: 0, fontSize: '0.8125rem' }}>{item.body}</p>
                            </CardSimple>
                          ))}
                          </Grid>
                        </StyleDomainProvider>
                      </Card.Content>
                    </Card>

                    <Grid columns={2} gap="lg">
                      <Card>
                        <Card.Header>⚡ Why Use Radix UI Primitives Underneath?</Card.Header>
                        <Card.Content>
                          <p style={{ marginTop: 0 }}>
                            An AI generating a dialog, a menu, or a set of tabs from scratch tends to get keyboard support, focus management, and ARIA roles roughly 90% right and ship it anyway — the missing 10% (a focus trap that doesn't quite trap, an escape key that doesn't close, a role that isn't announced) is invisible in a quick visual check and only shows up for a real keyboard or screen-reader user. <code>Toolcrib</code> doesn't re-solve that per component: it wraps Radix UI's unstyled primitives (`radix-ui`) once per interaction pattern and adds HSV theming, slots, and event bus dispatch on top, so every component built on the same primitive inherits the same correct behavior for free.
                          </p>
                          <ul style={{ paddingLeft: '1.25rem', margin: '0.5rem 0' }}>
                            <li><strong>Overlays</strong>: Dialog (<code>Modal</code>, <code>AlertDialog</code>), Popover (<code>Popup</code>; <code>Combobox</code>'s anchoring only), Portal (<code>Drawer</code>) — focus trap, background lockout, light-dismiss, and correct portal targeting, handled once instead of approximated per component.</li>
                            <li><strong>Disclosure &amp; Structure</strong>: Accordion, Collapsible, Separator, ScrollArea, AspectRatio — expand/collapse and custom-scrollbar keyboard behavior with real ARIA roles, not a styled <code>&lt;div&gt;</code> pretending to be one.</li>
                            <li><strong>Menus &amp; Navigation</strong>: DropdownMenu, ContextMenu, NavigationMenu (<code>Sidebar</code>), Tabs (<code>TabStrip</code>, <code>Stepper</code>), Toolbar — typeahead and arrow-key/roving-tabindex traversal for free.</li>
                            <li><strong>Form Controls</strong>: RadioGroup (<code>RadioGroup</code>, <code>Rating</code>), Checkbox, Switch, Select, Slider, Toggle/ToggleGroup, Label — real <code>aria-checked</code>/<code>aria-valuenow</code> semantics, not a row of clickable spans.</li>
                            <li><strong>Feedback &amp; Info</strong>: Toast, Tooltip, HoverCard, Progress, Avatar — priority queueing, hover/focus delay handling, determinate/indeterminate ARIA states.</li>
                            <li><strong>Accessibility Utilities</strong>: VisuallyHidden, AccessibleIcon — screen-reader-only text and icon labeling with zero visual footprint.</li>
                          </ul>
                        </Card.Content>
                      </Card>

                      <Card>
                        <Card.Header>🧩 Why Use Common Layout Idioms & Theme Slices?</Card.Header>
                        <Card.Content>
                          <p style={{ marginTop: 0 }}>
                            Traditional LLM code generation often suffers from ad-hoc CSS clutter (`p-1`, `mb-4`, hardcoded pixels). <code>Toolcrib</code> solves this by giving the AI high-level layout idioms:
                          </p>
                          <ul style={{ paddingLeft: '1.25rem', margin: '0.5rem 0' }}>
                            <li><strong><code>&lt;VStack&gt;</code> & <code>&lt;HStack&gt;</code></strong>: Self-spacing vertical & horizontal flex containers.</li>
                            <li><strong><code>&lt;Grid&gt;</code></strong>: Multi-column responsive card grids.</li>
                            <li><strong><code>&lt;Toolbar&gt;</code></strong>: Header action bars with <code>Left</code>, <code>Center</code>, and <code>Right</code> slots.</li>
                            <li><strong><code>ThemeSlice</code> Engine</strong>: Pluggable design capabilities (<code>margin</code>, <code>padding</code>, <code>radius</code>, <code>shadow</code>, <code>table</code>).</li>
                          </ul>
                        </Card.Content>
                      </Card>
                    </Grid>

                    <Card>
                      <Card.Header>🎯 No Radix Primitive to Lean On — Hand-Built to the Same Standard</Card.Header>
                      <Card.Content>
                        <p style={{ marginTop: 0 }}>
                          Radix ships no Combobox, no standalone option-list, and no horizontal filmstrip-style strip primitive at all — for these, <code>Toolcrib</code> doesn't approximate something close and call it done. It follows the same <a href="https://www.w3.org/WAI/ARIA/apg/" target="_blank" rel="noreferrer">WAI-ARIA Authoring Practices Guide</a> patterns Radix itself implements internally, just written by hand instead of imported:
                        </p>
                        <ul style={{ paddingLeft: '1.25rem', margin: '0.5rem 0' }}>
                          <li><strong><code>Combobox</code></strong> — the APG Combobox pattern (listbox + filtering + keyboard navigation hand-built on top of Popover purely for anchored positioning), including Escape-to-close and scroll-into-view as the highlighted option moves out of frame.</li>
                          <li><strong><code>Listbox</code></strong> — the APG Listbox pattern (<code>role="listbox"</code>/<code>"option"</code>, <code>aria-selected</code>, <code>aria-activedescendant</code>) extracted standalone from Combobox's own internals — see the Component Showcase tab.</li>
                          <li><strong><code>Filmstrip</code></strong> — real roving tabindex (exactly one <code>tabIndex=0</code> stop at a time, matching the APG's own composite-widget model) with Arrow/Home/End keyboard navigation, not a scrollable row of plain divs.</li>
                        </ul>
                        <p style={{ marginBottom: 0 }}>
                          This same attention runs underneath every component regardless of whether Radix backs it: every interactive element gets a real <code>:focus-visible</code> ring from one shared, systematically-injected stylesheet (<code>injectInteractionStyles()</code>) rather than each component hand-adding its own — before this existed, several components reset the browser's default outline to nothing and never replaced it, a real WCAG 2.4.7 gap invisible in a quick visual pass and only caught by actually tabbing through the UI.
                        </p>
                      </Card.Content>
                    </Card>

                    <Card>
                      <Card.Header>📐 AI Schema, Color Theory & WCAG Enforcement</Card.Header>
                      <Card.Content>
                        <p style={{ marginTop: 0 }}>
                          In <code>Toolcrib</code>, all component dimensions, paddings, gaps, and font sizes are calculated in <code>rem</code> units.
                          Changing the <strong>Master Font Size</strong> slider in the OOTB Theme Designer updates <code>--ai-master-font-size</code> on <code>:root</code>, smoothly scaling the entire UI layout up or down in real time!
                        </p>
                        <pre style={{ background: 'var(--ai-bg-container)', padding: '0.75rem', borderRadius: 'var(--ai-radius-md, 0.375rem)', fontSize: '0.75rem', overflowX: 'auto', margin: 0 }}>
{`:root {
  font-size: var(--ai-master-font-size, 16px);
  --ai-padding-md: 0.5rem 1rem;
  --ai-margin-gap: 0.875rem;
  --ai-table-cell-padding: var(--ai-padding-sm);
}`}
                        </pre>
                        <p>
                          A whole theme is generated from a <em>single</em> base HSV color plus a <strong>harmony mode</strong> — real color theory, not designer-picked swatches: <code>analogous</code> hues sit close together on the wheel for a cohesive look, <code>complementary</code>/<code>split-complementary</code> and <code>triadic</code> spread hues apart by a fixed geometric relationship for deliberate contrast. Pick a base color and a mode in the Theme Designer, and the entire primary/secondary/accent/quaternary palette — plus every semantic subtheme below — derives from that one decision.
                        </p>
                        <ul style={{ paddingLeft: '1.25rem', margin: '0.5rem 0' }}>
                          <li><strong>Readable text is computed, not chosen.</strong> <code>pickReadableTextColor()</code> checks a real WCAG contrast ratio (the same relative-luminance formula from the spec, via <code>getHSVContrastRatio()</code>) against both pure black and pure white, and picks whichever wins — provably ≥4.5:1 against <em>any</em> background, so a vivid, high-luminance primary color never silently produces unreadable white-on-bright-fill text the way a hardcoded <code>color: white</code> would.</li>
                          <li><strong>Themed text on a neutral surface is nudged, not guessed.</strong> <code>ensureWCAGContrast()</code> takes a foreground/background pair and iteratively adjusts Value (and, if needed, Saturation) — never Hue — until a target ratio is met, so secondary text stays recognizably "the theme's color" instead of being replaced by generic black or white.</li>
                          <li><strong>Semantic subthemes (error/success/warning/info) generate their own accessible pairs</strong> — main/background/border/text/on-main — the same way, so a themed error banner is exactly as WCAG-compliant as the default palette, in every color a consumer picks.</li>
                        </ul>
                        <p style={{ marginBottom: 0 }}>
                          The result: an AI (or a human) picking an arbitrary base color and harmony mode gets a full, internally-consistent, accessible palette for free — accessibility here is a property the color <em>math</em> guarantees, not a manual contrast-checker pass someone has to remember to run.
                        </p>
                      </Card.Content>
                    </Card>
                  </VStack>
                </TabStrip.Panel>

                {/* Tab 2: Forms & Zod Engine */}
                <TabStrip.Panel groupId="main-demo" value="forms">
                  <Grid columns={2} gap="lg">
                    <Card>
                      <Card.Header>User Profile Form (Zod 4 Validated Engine)</Card.Header>
                      <Card.Content>
                        <Form
                          id="profile-form"
                          schema={userProfileSchema}
                          initialValues={{ username: '', email: '', country: '', role: 'editor', contactPref: 'email', startDate: new CalendarDate(2026, 3, 15), notifications: true, agreeTerms: false }}
                          onSubmit={values => {
                            addToast({ type: 'success', message: `User ${values.username} created successfully! (Contact: ${values.contactPref})` });
                          }}
                        >
                          <FormField name="username" label="Username" helperText="Unique username handle">
                            <Input placeholder="johndoe" />
                          </FormField>

                          <FormField name="email" label="Email Address">
                            <Input type="email" placeholder="john@example.com" />
                          </FormField>

                          <FormField name="country" label="Country" helperText="Type to filter — no Radix primitive covers this, hand-built on Popover">
                            <Combobox options={COUNTRY_OPTIONS} placeholder="Search countries..." />
                          </FormField>

                          <FormField name="role" label="Role Level">
                            <Select
                              options={[
                                { label: 'Administrator', value: 'admin' },
                                { label: 'Content Editor', value: 'editor' },
                                { label: 'Viewer Only', value: 'viewer' },
                              ]}
                            />
                          </FormField>

                          <FormField name="contactPref" label="Preferred Contact Method">
                            <RadioGroup
                              name="contactPref"
                              direction="horizontal"
                              options={[
                                { label: 'Email', value: 'email' },
                                { label: 'SMS Text', value: 'sms' },
                                { label: 'Phone Call', value: 'phone' },
                              ]}
                            />
                          </FormField>

                          <FormField name="startDate" label="Start Date" helperText="Zod-validated via z.instanceof(CalendarDate) — the same DatePicker as the standalone demo below, now wired into this form's own validation and submit values">
                            {/* aria-label, not label -- FormField already
                                renders "Start Date" visibly above; DatePicker's
                                own `label` would render a second, visually
                                duplicate one since its composite date-segment
                                structure can't pick up FormField's plain
                                htmlFor association the way a single <input id>
                                can. */}
                            <DatePicker aria-label="Start Date" />
                          </FormField>

                          <FormField name="notifications">
                            <Switch name="notifications" label="Enable Email Notifications" />
                          </FormField>

                          <FormField name="agreeTerms">
                            <Checkbox name="agreeTerms" label="I agree to terms and conditions" />
                          </FormField>

                          <FormField name="bio" label="Short Bio (Optional)">
                            <Textarea placeholder="Tell us about yourself..." />
                          </FormField>

                          <FormError />

                          <Card.Actions>
                            <SubmitButton>Save Profile</SubmitButton>
                          </Card.Actions>
                        </Form>
                      </Card.Content>
                    </Card>

                    <Card>
                      <Card.Header>Form Architecture & Validation Features</Card.Header>
                      <Card.Content>
                        <p style={{ marginTop: 0 }}>
                          The <code>Form</code> component provides automatic Zod 4 schema validation, field registration, error layout, and touched field tracking without prop-drilling.
                        </p>
                        <VStack gap="sm">
                          <div style={{ padding: '0.75rem', background: 'var(--ai-bg-container)', borderRadius: 'var(--ai-radius-sm)' }}>
                            <strong>Strongly-Typed Event Bus:</strong> Form submission and error states automatically emit <code>form:submitted</code> and <code>form:errored</code> events.
                          </div>
                          <div style={{ padding: '0.75rem', background: 'var(--ai-bg-container)', borderRadius: 'var(--ai-radius-sm)' }}>
                            <strong>Theme Spacing:</strong> Every <code>&lt;FormField&gt;</code> automatically applies <code>marginBottom: var(--ai-margin-gap)</code>.
                          </div>
                        </VStack>
                      </Card.Content>
                    </Card>
                  </Grid>

                  {/* Calendar/TimeField/Rating live outside the Zod form above
                      deliberately — standalone, uncontrolled-by-default demos
                      of each control's own onChange. DatePicker itself now
                      appears twice: once wired into the form above (Zod-
                      validated, part of the submitted values), and again here
                      as its own standalone onChange demo — the same
                      component, two different integration styles. */}
                  <Card overrides={{ padding: 'compact' }}>
                    <Card.Header>Date, Time & Rating Inputs (`&lt;DatePicker&gt;`, `&lt;Calendar&gt;`, `&lt;TimeField&gt;`, `&lt;Rating&gt;`)</Card.Header>
                    <Card.Content>
                      <Grid columns={3} gap="lg">
                        <VStack gap="sm">
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)' }}>Popover Calendar (`&lt;DatePicker&gt;`)</div>
                          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>
                            Backed by <code>@internationalized/date</code>'s <code>CalendarDate</code>, not a raw JS <code>Date</code> — correct across timezones/DST by construction. Hosted in toolcrib's own <code>&lt;Popup&gt;</code>, not a react-aria-components popover.
                          </p>
                          <DatePicker
                            name="demoMeetingDate"
                            label="Meeting Date"
                            defaultValue={new CalendarDate(2026, 3, 15)}
                            onChange={value => addToast({ type: 'info', message: `Meeting date: ${value?.toString() ?? '(cleared)'}`, priority: 'low' })}
                          />
                        </VStack>

                        <VStack gap="sm">
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)' }}>Inline Grid (`&lt;Calendar&gt;`) &amp; Time (`&lt;TimeField&gt;`)</div>
                          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>
                            <code>Calendar</code> is <code>DatePicker</code>'s own popover content, also usable standalone (inline, no popover) — paired here with <code>TimeField</code> for a full appointment slot.
                          </p>
                          <Calendar
                            aria-label="Appointment date"
                            defaultValue={new CalendarDate(2026, 3, 15)}
                            onChange={value => addToast({ type: 'info', message: `Calendar date: ${value.toString()}`, priority: 'low' })}
                          />
                          <TimeField
                            name="demoMeetingTime"
                            label="Meeting Time"
                            defaultValue={new Time(14, 30)}
                            onChange={value => addToast({ type: 'info', message: `Meeting time: ${value?.toString() ?? '(cleared)'}`, priority: 'low' })}
                          />
                        </VStack>

                        <VStack gap="sm">
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)' }}>Star Rating (`&lt;Rating&gt;`)</div>
                          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>
                            Built on Radix <code>RadioGroup</code> — real keyboard operability and <code>aria-checked</code> semantics, not a row of clickable spans.
                          </p>
                          <Rating
                            name="demoRating"
                            value={ratingValue}
                            onChange={value => {
                              setRatingValue(value);
                              addToast({ type: 'info', message: `Rated ${value} of 5`, priority: 'low' });
                            }}
                          />
                          <div style={{ fontSize: '0.75rem', color: 'var(--ai-text-secondary)' }}>Read-only (fractional fill):</div>
                          <Rating readOnly value={3.5} />
                        </VStack>
                      </Grid>
                    </Card.Content>
                  </Card>
                </TabStrip.Panel>

                {/* Tab 3: Overlays */}
                <TabStrip.Panel groupId="main-demo" value="overlays">
                  <Grid columns={3} gap="lg">
                    <Card>
                      <Card.Header>Popup Container (Popover)</Card.Header>
                      <Card.Content>
                        <p style={{ marginTop: 0 }}>Anchored contextual popup container with light dismiss.</p>
                        <Popup
                          id="demo-popup"
                          trigger={<Button variant="outline">Toggle Popup Menu</Button>}
                        >
                          <VStack gap="sm">
                            <strong style={{ fontSize: '0.875rem' }}>Account Quick Info</strong>
                            <p style={{ margin: 0, fontSize: '0.875rem' }}>User: john_doe@example.com</p>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--ai-text-secondary)' }}>Role: Administrator</p>
                            <Button size="sm" variant="primary" onClick={() => aiBus.closePopup('demo-popup')}>Dismiss</Button>
                          </VStack>
                        </Popup>
                      </Card.Content>
                    </Card>

                    <Card>
                      <Card.Header>Drawer</Card.Header>
                      <Card.Content>
                        <p style={{ marginTop: 0 }}>Side drawer sliding in from screen edge with backdrop and light dismiss.</p>
                        <Drawer
                          id="demo-drawer"
                          title="Application Details Drawer"
                          trigger={<Button variant="secondary">Open Drawer</Button>}
                        >
                          <p>This drawer is decoupled and easily controlled by AI.</p>
                          {/* Regression coverage for a real bug: Tooltip's exit
                              animation used to bubble an animationend event up
                              through this Drawer's own (React-tree, portal-
                              spanning) onAnimationEnd handler and close the
                              drawer just from hovering then un-hovering this
                              button. Fixed by migrating Drawer to Radix's
                              Presence primitive, which listens on the real DOM
                              node directly instead of via bubbling. */}
                          <Tooltip content="Hover then un-hover — must not close the drawer">
                            <Button variant="outline">Hover me (regression check)</Button>
                          </Tooltip>
                          <Button variant="danger" onClick={() => aiBus.closeDrawer('demo-drawer')}>Close Drawer</Button>
                        </Drawer>
                      </Card.Content>
                    </Card>

                    <Card>
                      <Card.Header>Modal Dialog (Focus Trap)</Card.Header>
                      <Card.Content>
                        <p style={{ marginTop: 0 }}>Modal dialog with complete focus lock out (`aria-modal`) and background lockout.</p>
                        <Modal trigger={<Button variant="primary">Open Modal Dialog</Button>} ariaLabel="Confirm Account Action">
                          <Modal.Header>Confirm Account Action</Modal.Header>
                          <Modal.Body>
                            Are you sure you want to perform this action? Keyboard navigation (Tab) is trapped safely inside this dialog.
                          </Modal.Body>
                          <Modal.Footer>
                            <Modal.Actions>
                              <UIGroup>
                                <Modal.CloseButton />
                                <Button variant="danger" onClick={() => { addToast({ type: 'success', message: 'Action confirmed!' }); }}>Confirm</Button>
                              </UIGroup>
                            </Modal.Actions>
                          </Modal.Footer>
                        </Modal>
                      </Card.Content>
                    </Card>

                    <Card>
                      <Card.Header>Command Palette (`&lt;CommandPalette&gt;`)</Card.Header>
                      <Card.Content>
                        <p style={{ marginTop: 0 }}>
                          Fuzzy-searchable action launcher, hosted inside toolcrib's own <code>Modal</code> (never <code>cmdk</code>'s own <code>Command.Dialog</code>). Mounted once near the app root (see the top of this file's <code>App</code> component) — try <kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd>+<kbd>K</kbd> from anywhere on this page, or the button below.
                        </p>
                        <Button variant="outline" icon="⌘" onClick={() => aiBus.openCommandPalette('global-command-palette')}>
                          Open Command Palette
                        </Button>
                      </Card.Content>
                    </Card>
                  </Grid>
                </TabStrip.Panel>

                {/* Tab 4: Toasts */}
                <TabStrip.Panel groupId="main-demo" value="toasts">
                  <Card>
                    <Card.Header>Toast Subsystem Controls</Card.Header>
                    <Card.Content>
                      <VStack gap="md">
                        <p style={{ marginTop: 0 }}>Dispatch notifications via <code>useToast()</code> or cross-tree via <code>aiBus.emit('toast:shown', ...)</code>.</p>
                        <UIGroup>
                          <Button variant="primary" onClick={() => aiBus.showToast('Informational message', 'info')}>
                            Fire Info Toast
                          </Button>
                          <Button subtheme="success" onClick={() => aiBus.showToast('Success notification!', 'success', 'high')}>
                            Fire Success Toast
                          </Button>
                          <Button subtheme="warning" onClick={() => aiBus.showToast('Warning: Check parameters', 'warning', 'high')}>
                            Fire Warning Toast
                          </Button>
                          <Button subtheme="error" onClick={() => aiBus.showToast('Critical System Failure', 'error', 'urgent')}>
                            Fire Urgent Error Toast
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              addToast({
                                type: 'error',
                                message: 'Connection lost',
                                sticky: true,
                                actions: [{ label: 'Retry', onClick: () => addToast({ type: 'success', message: 'Reconnected!' }) }],
                              })
                            }
                          >
                            Fire Sticky Toast w/ Action
                          </Button>
                        </UIGroup>

                        <HStack gap="sm">
                          {/* Native <label>, not <span> -- this Select's own
                              trigger renders as role="combobox", which
                              (unlike role="button") doesn't derive its
                              accessible name from visible content, only from
                              an aria-label/aria-labelledby or an associated
                              <label> (axe: button-name). */}
                          <label htmlFor="toast-anchor-select" style={{ fontWeight: 600, fontSize: '0.875rem' }}>Toast Anchor Position:</label>
                          <Select
                            id="toast-anchor-select"
                            defaultValue="top-right"
                            onChange={val => setAnchor(val as any)}
                            options={[
                              { label: 'Top Right', value: 'top-right' },
                              { label: 'Top Left', value: 'top-left' },
                              { label: 'Bottom Right', value: 'bottom-right' },
                              { label: 'Bottom Left', value: 'bottom-left' },
                              { label: 'Top Center', value: 'top-center' },
                              { label: 'Bottom Center', value: 'bottom-center' },
                            ]}
                          />
                        </HStack>
                      </VStack>
                    </Card.Content>
                  </Card>
                </TabStrip.Panel>

                {/* Tab 5: Virtualized Data Table */}
                <TabStrip.Panel groupId="main-demo" value="datatable">
                  {/* <Card layout="auto"> below must stay a *direct* flex
                      child of this panel, not nested inside a <VStack> —
                      VStack doesn't declare `flex` on its own root div, so
                      an auto-layout descendant has nothing to grow against
                      and collapses to a near-zero height instead of filling
                      the panel (confirmed via a real browser run: the whole
                      table silently vanished, leaving only the Pagination
                      card below it). The Pagination card stays a sibling
                      here, not wrapped together with the table, for the
                      same reason. */}
                  <Card layout="auto">
                    <Card.Header>
                      <Toolbar>
                        <Toolbar.Left>
                          <span>Acme Analytics — Team Directory (250 Rows, Adaptive Rem Height)</span>
                        </Toolbar.Left>
                        <Toolbar.Right>
                          <Button size="sm" variant="outline" icon="📊" onClick={() => addToast({ type: 'info', message: 'Table exported!' })}>Export CSV</Button>
                        </Toolbar.Right>
                      </Toolbar>
                    </Card.Header>
                    <Card.Content layout="auto" paddingMode="compact">
                      <DataTable
                        id="demo-users-table"
                        data={dummyUsers}
                        columns={columns}
                        pageSize={15}
                        pageSizeOptions={[5, 10, 15, 25, 50]}
                        containerHeight="auto"
                        rowKey={rec => rec.id}
                        onRowClick={rec => addToast({ type: 'info', message: `Clicked ${rec.name}`, priority: 'low' })}
                        rowSubtheme={rec =>
                          rec.status === 'Inactive'
                            // Preset form: one of the four semantic subthemes.
                            ? 'error'
                            : rec.score >= 90
                            // Custom Partial<SubthemeColors> slice form: an
                            // arbitrary "top performer" highlight the four
                            // presets don't cover.
                            ? { background: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.4)', color: 'rgb(109, 40, 217)' }
                            : undefined
                        }
                        selectable
                        selectedKeys={selectedUserKeys}
                        onSelectionChange={setSelectedUserKeys}
                        renderBulkActions={keys => (
                          <Button
                            size="sm"
                            variant="danger"
                            icon="🗑️"
                            onClick={() => {
                              addToast({ type: 'warning', message: `Deleted ${keys.length} user(s) (simulated)`, priority: 'medium' });
                              setSelectedUserKeys([]);
                            }}
                          >
                            Delete Selected
                          </Button>
                        )}
                      />
                    </Card.Content>
                  </Card>
                </TabStrip.Panel>

                {/* Tab: Charts -- a fake "Acme Analytics" dashboard, purely
                    to exercise BarChart/LineChart/PieChart together the way
                    a real consumer app would compose them: a filter row, a
                    stat-tile strip, then charts. Every number below is
                    invented for the demo, not real data. */}
                <TabStrip.Panel groupId="main-demo" value="charts">
                  <VStack gap="lg">
                    <Toolbar>
                      <Toolbar.Left>
                        <span style={{ fontWeight: 'var(--ai-font-weight-semibold, 600)', fontSize: '1.0625rem' }}>📈 Acme Analytics</span>
                      </Toolbar.Left>
                      <Toolbar.Right>
                        <Button size="sm" variant="outline" icon="⬇️" onClick={() => addToast({ type: 'info', message: 'Report exported!' })}>Export</Button>
                      </Toolbar.Right>
                    </Toolbar>

                    {/* Filter row, above everything it scopes -- per the
                        toolkit's dataviz method, filters are standard UI
                        composed from existing form controls (not a chart
                        component), date range first. Every chart/stat above
                        stays static in this demo (there's no real backing
                        data to refetch against), but the row demonstrates
                        the intended composition and placement. */}
                    <Toolbar>
                      <Toolbar.Left>
                        <div style={{ width: '10rem' }}>
                          <VisuallyHidden>
                            <Label htmlFor="dashboard-date-range">Date range</Label>
                          </VisuallyHidden>
                          <Select
                            id="dashboard-date-range"
                            value={dashboardDateRange}
                            onChange={setDashboardDateRange}
                            options={[
                              { label: 'Today', value: 'today' },
                              { label: 'Last 7 days', value: '7d' },
                              { label: 'Last 30 days', value: '30d' },
                              { label: 'Last 90 days', value: '90d' },
                            ]}
                          />
                        </div>
                        <div style={{ width: '10rem' }}>
                          <VisuallyHidden>
                            <Label htmlFor="dashboard-dimension">Channel</Label>
                          </VisuallyHidden>
                          <Select
                            id="dashboard-dimension"
                            value={dashboardDimension}
                            onChange={setDashboardDimension}
                            options={[
                              { label: 'All channels', value: 'all' },
                              { label: 'Organic search', value: 'organic' },
                              { label: 'Paid', value: 'paid' },
                              { label: 'Referral', value: 'referral' },
                            ]}
                          />
                        </div>
                      </Toolbar.Left>
                    </Toolbar>

                    <Grid columns={4} gap="md">
                      {[
                        { label: 'Revenue', value: '$2.02M', delta: '+12.4%', good: true, trend: [1.62, 1.7, 1.65, 1.78, 1.9, 1.85, 2.02] },
                        { label: 'Active users', value: '8,420', delta: '+4.6%', good: true, trend: [7200, 7400, 7350, 7800, 8050, 8200, 8420] },
                        { label: 'Conversion rate', value: '3.8%', delta: '-0.3%', good: false, trend: [4.3, 4.1, 4.2, 3.9, 4.0, 3.85, 3.8] },
                        { label: 'Churn', value: '1.9%', delta: '-0.5%', good: true, trend: [2.6, 2.4, 2.5, 2.2, 2.1, 2.0, 1.9] },
                      ].map(stat => (
                        <Card key={stat.label}>
                          <Card.Content>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>{stat.label}</div>
                            <div style={{ fontSize: '1.625rem', fontWeight: 'var(--ai-font-weight-semibold, 600)', margin: '0.25rem 0 0.5rem' }}>{stat.value}</div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                              <Badge subtheme={stat.good ? 'success' : 'error'} size="sm">{stat.delta}</Badge>
                              <Sparkline values={stat.trend} title={`${stat.label} trend, last 7 periods`} />
                            </div>
                          </Card.Content>
                        </Card>
                      ))}
                    </Grid>

                    <Grid columns={2} gap="md">
                      <Card>
                        <Card.Header>Revenue vs. Cost by Quarter</Card.Header>
                        <Card.Content>
                          <BarChart
                            title="Quarterly revenue vs. cost"
                            categories={['Q1', 'Q2', 'Q3', 'Q4']}
                            series={[
                              { label: 'Revenue', values: [420, 510, 480, 610] },
                              { label: 'Cost', values: [310, 340, 360, 390] },
                            ]}
                          />
                        </Card.Content>
                      </Card>

                      <Card>
                        <Card.Header>Signups Over Time</Card.Header>
                        <Card.Content>
                          <LineChart
                            title="Weekly signups over time"
                            categories={['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Wk 6']}
                            series={[
                              { label: 'Free tier', values: [120, 145, 160, 210, 240, 260] },
                              { label: 'Paid tier', values: [30, 42, 55, 60, 78, 95] },
                            ]}
                          />
                        </Card.Content>
                      </Card>
                    </Grid>

                    <Card>
                      <Card.Header>Signups by Tier (Stacked Area)</Card.Header>
                      <Card.Content>
                        <LineChart
                          title="Weekly signups by tier, stacked"
                          variant="area"
                          width={980}
                          categories={['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Wk 6']}
                          series={[
                            { label: 'Free tier', values: [120, 145, 160, 210, 240, 260] },
                            { label: 'Paid tier', values: [30, 42, 55, 60, 78, 95] },
                          ]}
                        />
                      </Card.Content>
                    </Card>

                    <Card>
                      <Card.Header>Support Tickets by Day &amp; Hour</Card.Header>
                      <Card.Content>
                        <Heatmap
                          title="Support tickets by day and hour"
                          width={980}
                          rows={['Mon', 'Tue', 'Wed', 'Thu', 'Fri']}
                          columns={['9am', '11am', '1pm', '3pm', '5pm']}
                          values={[
                            [8, 14, 22, 18, 9],
                            [6, 12, 19, 20, 11],
                            [5, 10, 16, 15, 8],
                            [9, 16, 24, 21, 12],
                            [7, 11, 15, 13, 6],
                          ]}
                          formatValue={v => `${v} tickets`}
                        />
                      </Card.Content>
                    </Card>

                    <Grid columns={2} gap="md">
                      <Card>
                        <Card.Header>Traffic by Source</Card.Header>
                        <Card.Content>
                          <PieChart
                            title="Traffic by source"
                            innerRadius={0.6}
                            legendPosition="side"
                            data={[
                              { label: 'Organic search', value: 420 },
                              { label: 'Direct', value: 210 },
                              { label: 'Referral', value: 140 },
                              { label: 'Social', value: 95 },
                              { label: 'Email', value: 60 },
                            ]}
                          />
                        </Card.Content>
                      </Card>

                      {/* The pie chart's table-view twin, per the toolkit's
                          dataviz method -- every chart should have a
                          WCAG-clean equivalent that doesn't depend on color
                          to read the values. */}
                      <Card>
                        <Card.Header>Traffic by Source (table view)</Card.Header>
                        <Card.Content>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--ai-border)' }}>
                                <th style={{ textAlign: 'left', padding: '0.375rem 0', color: 'var(--ai-text-secondary)', fontWeight: 'var(--ai-font-weight-semibold, 600)' }}>Source</th>
                                <th style={{ textAlign: 'right', padding: '0.375rem 0', color: 'var(--ai-text-secondary)', fontWeight: 'var(--ai-font-weight-semibold, 600)' }}>Sessions</th>
                                <th style={{ textAlign: 'right', padding: '0.375rem 0', color: 'var(--ai-text-secondary)', fontWeight: 'var(--ai-font-weight-semibold, 600)' }}>Share</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                { label: 'Organic search', value: 420 },
                                { label: 'Direct', value: 210 },
                                { label: 'Referral', value: 140 },
                                { label: 'Social', value: 95 },
                                { label: 'Email', value: 60 },
                              ].map(row => {
                                const total = 420 + 210 + 140 + 95 + 60;
                                return (
                                  <tr key={row.label} style={{ borderBottom: '1px solid var(--ai-border)' }}>
                                    <td style={{ padding: '0.375rem 0', color: 'var(--ai-text-primary)' }}>{row.label}</td>
                                    <td style={{ padding: '0.375rem 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.value.toLocaleString()}</td>
                                    <td style={{ padding: '0.375rem 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{((row.value / total) * 100).toFixed(1)}%</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </Card.Content>
                      </Card>
                    </Grid>
                  </VStack>
                </TabStrip.Panel>

                {/* Tab 6: Navigation & Structure */}
                <TabStrip.Panel groupId="main-demo" value="navigation">
                  <VStack gap="lg">
                    <Card>
                      <Card.Header>Breadcrumb Trail (`&lt;Breadcrumb&gt;`)</Card.Header>
                      <Card.Content>
                        <p style={{ marginTop: 0 }}>
                          Wraps <code>react-aria-components</code>'s <code>Breadcrumbs</code>. Middle items collapse into a <code>&lt;DropdownMenu&gt;</code> automatically once the trail overflows its container — narrow the browser window to see it happen.
                        </p>
                        <Breadcrumb>
                          <Breadcrumb.Item href="#" onClick={() => addToast({ type: 'info', message: 'Navigated to Home', priority: 'low' })}>Home</Breadcrumb.Item>
                          <Breadcrumb.Item href="#" onClick={() => addToast({ type: 'info', message: 'Navigated to Products', priority: 'low' })}>Products</Breadcrumb.Item>
                          <Breadcrumb.Item href="#" onClick={() => addToast({ type: 'info', message: 'Navigated to Electronics', priority: 'low' })}>Electronics</Breadcrumb.Item>
                          <Breadcrumb.Item href="#" onClick={() => addToast({ type: 'info', message: 'Navigated to Laptops', priority: 'low' })}>Laptops</Breadcrumb.Item>
                          <Breadcrumb.Item>Current Model</Breadcrumb.Item>
                        </Breadcrumb>
                      </Card.Content>
                    </Card>

                    <Grid columns={2} gap="lg">
                      <Card>
                        <Card.Header>Collapsible Nav Rail (`&lt;Sidebar&gt;`)</Card.Header>
                        <Card.Content>
                          <p style={{ marginTop: 0 }}>
                            This page's own left-hand navigation is a real <code>&lt;Sidebar&gt;</code> inside <code>&lt;AppShell.Sidebar&gt;</code> — the same component shown here again in a bounded box, isolated from that live grouping/routing logic, so its own collapse toggle and item states are easier to try in isolation.
                          </p>
                          <div style={{ height: '14rem', border: '0.0625rem solid var(--ai-border, #e5e7eb)', borderRadius: 'var(--ai-radius-md)', overflow: 'hidden', display: 'flex' }}>
                            <Sidebar
                              items={SIDEBAR_ITEMS}
                              activeId={sidebarActiveId}
                              aria-label="Example navigation"
                              onItemClick={id => setSidebarActiveId(id)}
                            />
                            <div style={{ flex: 1, padding: '0.75rem', fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>
                              Active: <strong style={{ color: 'var(--ai-text-primary)' }}>{SIDEBAR_ITEMS.find(i => i.id === sidebarActiveId)?.label}</strong>
                            </div>
                          </div>
                        </Card.Content>
                      </Card>

                      <Card>
                        <Card.Header>Hierarchical Tree (`&lt;Tree&gt;`)</Card.Header>
                        <Card.Content>
                          <p style={{ marginTop: 0 }}>
                            Full WAI-ARIA Treeview keyboard nav (arrows, Home/End, type-ahead) comes for free — try clicking an item, then using the arrow keys.
                          </p>
                          <div style={{ height: '14rem', overflowY: 'auto', border: '0.0625rem solid var(--ai-border, #e5e7eb)', borderRadius: 'var(--ai-radius-md)', padding: '0.5rem' }}>
                            <Tree
                              items={TREE_ITEMS}
                              defaultExpandedIds={['src', 'components']}
                              defaultSelectedId="card-tsx"
                              onSelectChange={id => id && addToast({ type: 'info', message: `Selected ${id}`, priority: 'low' })}
                            />
                          </div>
                        </Card.Content>
                      </Card>
                    </Grid>

                    <Card>
                      <Card.Header>Multi-Step Wizard (`&lt;Stepper&gt;`)</Card.Header>
                      <Card.Content>
                        <p style={{ marginTop: 0 }}>
                          Built on the same Radix Tabs primitive as <code>&lt;TabStrip&gt;</code>. The "Confirm" step blocks forward navigation until the Profile step's own form reports valid — try clicking ahead before filling in a display name.
                        </p>
                        <Stepper steps={STEPPER_STEPS} />
                      </Card.Content>
                    </Card>

                    {/* Moved here from the Data Table tab: that tab's own
                        <DataTable containerHeight="auto"> needs to flex-fill
                        essentially all of its Splitter panel's height to show
                        a useful number of rows — a second, fixed-height Card
                        as a flexShrink:0 sibling there permanently squeezed
                        DataTable's real available space down to less than its
                        own AUTO_HEIGHT_FALLBACK_PX floor, so the floor forced
                        DataTable taller than that shrunken allocation and it
                        overflowed/clipped against Card.Content's own
                        overflow:hidden (confirmed via a real browser run,
                        computed heights inspected at every ancestor level).
                        This tab's plain VStack has no such height budget to
                        protect, and pagination fits its own navigation theme
                        better here than as an unrelated aside next to the
                        data table anyway. */}
                    <Card>
                      <Card.Header>Standalone Pagination (`&lt;Pagination&gt;`)</Card.Header>
                      <Card.Content>
                        <p style={{ marginTop: 0 }}>
                          Same controlled/uncontrolled contract as <code>DataTable</code>'s own paging (<code>page</code>/<code>defaultPage</code>/<code>onPageChange</code>), usable anywhere a page needs paging without a table attached.
                        </p>
                        <Pagination
                          totalItems={137}
                          pageSize={10}
                          page={paginationPage}
                          onPageChange={page => setPaginationPage(page)}
                        />
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--ai-text-secondary)' }}>Current page: {paginationPage}</p>
                        {/* size="md"/"lg" -- the row above only ever demonstrated
                            the default size="sm". All three stay in sync since
                            they're bound to the same controlled page state. */}
                        <VStack gap="sm">
                          <Pagination
                            totalItems={137}
                            pageSize={10}
                            size="md"
                            page={paginationPage}
                            onPageChange={page => setPaginationPage(page)}
                          />
                          <Pagination
                            totalItems={137}
                            pageSize={10}
                            size="lg"
                            page={paginationPage}
                            onPageChange={page => setPaginationPage(page)}
                          />
                        </VStack>
                      </Card.Content>
                    </Card>
                  </VStack>
                </TabStrip.Panel>

                {/* Tab 7: Media Gallery */}
                <TabStrip.Panel groupId="main-demo" value="media">
                  <VStack gap="lg">
                    <Card>
                      <Card.Header>Swipeable Carousel (`&lt;Carousel&gt;`)</Card.Header>
                      <Card.Content>
                        <p style={{ marginTop: 0 }}>
                          Wraps <code>embla-carousel-react</code> — drag/swipe it directly, or use the arrows/dots. Looping, with a 4-second autoplay.
                        </p>
                        <Carousel slides={CAROUSEL_SLIDES} loop autoplay={{ delayMs: 4000 }} />
                      </Card.Content>
                    </Card>

                    <Card>
                      <Card.Header>Thumbnail Strip (`&lt;Filmstrip&gt;`)</Card.Header>
                      <Card.Content>
                        <p style={{ marginTop: 0 }}>
                          Shares <code>&lt;TabStrip&gt;</code>'s own overflow-scroll detection and active-indicator theming — narrow the window to see the scroll arrows appear.
                        </p>
                        <Filmstrip
                          items={FILMSTRIP_ITEMS}
                          defaultActiveId={FILMSTRIP_ITEMS[0].id}
                          onChange={id => addToast({ type: 'info', message: `Selected ${id}`, priority: 'low' })}
                        />
                      </Card.Content>
                    </Card>

                    <Card>
                      <Card.Header>Thumbnail Grid + Lightbox (`&lt;Gallery&gt;`, composing `&lt;Viewer&gt;`)</Card.Header>
                      <Card.Content>
                        <p style={{ marginTop: 0 }}>
                          Click any thumbnail to open the fullscreen <code>&lt;Viewer&gt;</code> lightbox (composes <code>&lt;ViewerContent&gt;</code> inside <code>&lt;Modal&gt;</code>) — arrow keys navigate, click the image to zoom, Escape closes only the viewer. Thumbnails defer via the same <code>&lt;DeferredContent&gt;</code> used elsewhere in this demo, not a second lazy-render mechanism.
                        </p>
                        <Gallery items={GALLERY_ITEMS} columns="auto-fit" />
                      </Card.Content>
                    </Card>
                  </VStack>
                </TabStrip.Panel>

                {/* Tab 8: Feedback & Status */}
                <TabStrip.Panel groupId="main-demo" value="status">
                  <VStack gap="lg">
                    <Grid columns={2} gap="lg">
                      <Card>
                        <Card.Header>Status Badges (`&lt;Badge&gt;`)</Card.Header>
                        <Card.Content>
                          <VStack gap="sm">
                            <HStack gap="sm" wrap>
                              <Badge subtheme="info">Info</Badge>
                              <Badge subtheme="success">Active</Badge>
                              <Badge subtheme="warning">Pending</Badge>
                              <Badge subtheme="error">Failed</Badge>
                              <Badge subtheme="success" icon="✓" size="sm">Verified</Badge>
                            </HStack>
                            {/* size="sm" vs. size="md", isolated from icon presence --
                                the row above only ever paired size="sm" with an icon,
                                so it couldn't demonstrate the two independently. */}
                            <HStack gap="sm" wrap align="center">
                              <Badge size="sm">Small</Badge>
                              <Badge size="md">Medium</Badge>
                              <Badge size="sm" icon="✓">Small + Icon</Badge>
                              <Badge size="md" icon="✓">Medium + Icon</Badge>
                            </HStack>
                            {/* variant (identity color, for a branded/labeled
                                badge that isn't a status) + appearance
                                (soft/solid/outline "hollow" style) — both
                                orthogonal to subtheme's own 4 status colors. */}
                            <HStack gap="sm" wrap align="center">
                              <Badge variant="primary">Primary</Badge>
                              <Badge variant="secondary">Secondary</Badge>
                              <Badge subtheme="success" appearance="solid">Solid</Badge>
                              <Badge subtheme="warning" appearance="outline">Outline</Badge>
                              <Badge variant="primary" appearance="solid">Solid Primary</Badge>
                              <Badge variant="secondary" appearance="outline">Outline Secondary</Badge>
                            </HStack>
                          </VStack>
                        </Card.Content>
                      </Card>

                      <Card>
                        <Card.Header>Loading Indicators (`&lt;Skeleton&gt;`, `&lt;Spinner&gt;`)</Card.Header>
                        <Card.Content>
                          <VStack gap="sm">
                            <HStack gap="sm" align="center">
                              <Skeleton shape="circle" width="2.5rem" height="2.5rem" />
                              <VStack gap="xs">
                                <Skeleton shape="text" width="9rem" />
                                <Skeleton shape="text" width="6rem" />
                              </VStack>
                            </HStack>
                            <HStack gap="md" align="center">
                              <Spinner size="sm" />
                              <Spinner size="md" subtheme="info" />
                              <Spinner size="lg" subtheme="success" />
                            </HStack>
                          </VStack>
                        </Card.Content>
                      </Card>

                      <Card>
                        <Card.Header>Living Color (Ambient Breathe &amp; Glow)</Card.Header>
                        <Card.Content>
                          <VStack gap="sm">
                            <div
                              className="ai-living-accent"
                              style={{
                                padding: 'var(--ai-padding-md, 0.5rem)',
                                borderRadius: 'var(--ai-radius-md, 0.375rem)',
                                color: 'var(--ai-color-primary-text, #ffffff)',
                                textAlign: 'center',
                                fontSize: '0.875rem',
                              }}
                            >
                              .ai-living-accent
                            </div>
                            <div
                              className="ai-living-glow"
                              style={{
                                padding: 'var(--ai-padding-md, 0.5rem)',
                                borderRadius: 'var(--ai-radius-md, 0.375rem)',
                                textAlign: 'center',
                                fontSize: '0.875rem',
                              }}
                            >
                              .ai-living-glow
                            </div>
                          </VStack>
                        </Card.Content>
                      </Card>
                    </Grid>

                    <Card>
                      <Card.Header>No-Content Placeholder (`&lt;EmptyState&gt;`)</Card.Header>
                      <Card.Content>
                        <EmptyState>
                          <EmptyState.Icon>📭</EmptyState.Icon>
                          <EmptyState.Title>No results found</EmptyState.Title>
                          <EmptyState.Description>Try adjusting your search or filters, or create a new record.</EmptyState.Description>
                          <EmptyState.Action>
                            <Button variant="primary" onClick={() => addToast({ type: 'info', message: 'Create new record clicked' })}>Create Record</Button>
                          </EmptyState.Action>
                        </EmptyState>
                      </Card.Content>
                    </Card>
                  </VStack>
                </TabStrip.Panel>

                {/* Tab 9: Common Layout Idioms (NEW) */}
                <TabStrip.Panel groupId="main-demo" value="layout">
                  <VStack gap="lg">
                    <Grid columns={2} gap="lg">
                      <Card>
                        <Card.Header>Vertical & Horizontal Stacks (`&lt;VStack&gt;` & `&lt;HStack&gt;`)</Card.Header>
                        <Card.Content>
                          <p style={{ marginTop: 0 }}>Self-spacing flex containers that automatically apply theme <code>--ai-margin-gap</code> spacing.</p>
                          {/* Demo chrome (background/padding/radius) lives on
                              plain wrapper divs, not VStack/HStack — they're
                              pure layout primitives with no styled-box
                              concept of their own. */}
                          <div style={{ background: 'var(--ai-bg-container)', padding: '1rem', borderRadius: 'var(--ai-radius-md)' }}>
                            <VStack gap="md">
                              <div style={{ background: 'var(--ai-bg-surface)', padding: '0.75rem', borderRadius: 'var(--ai-radius-sm)', fontWeight: 600 }}>VStack Item 1</div>
                              <div style={{ background: 'var(--ai-bg-surface)', padding: '0.75rem', borderRadius: 'var(--ai-radius-sm)', fontWeight: 600 }}>VStack Item 2</div>
                              <div style={{ background: 'var(--ai-bg-surface)', padding: '0.75rem', borderRadius: 'var(--ai-radius-sm)' }}>
                                <HStack justify="between">
                                  <span style={{ fontWeight: 600 }}>HStack Left Item</span>
                                  <Button size="sm" variant="primary">HStack Right Action</Button>
                                </HStack>
                              </div>
                            </VStack>
                          </div>
                        </Card.Content>
                      </Card>

                      <Card>
                        <Card.Header>Multi-Column Responsive Grids (`&lt;Grid&gt;`)</Card.Header>
                        <Card.Content>
                          <p style={{ marginTop: 0 }}>Responsive grid containers that consume <code>--ai-margin-gap</code> spacing without pixel calculations.</p>
                          <Grid columns={2} gap="md">
                            <div style={{ background: 'var(--ai-bg-container)', padding: '1rem', borderRadius: 'var(--ai-radius-sm)', textAlign: 'center', fontWeight: 600 }}>
                              Grid Column 1
                            </div>
                            <div style={{ background: 'var(--ai-bg-container)', padding: '1rem', borderRadius: 'var(--ai-radius-sm)', textAlign: 'center', fontWeight: 600 }}>
                              Grid Column 2
                            </div>
                            <div style={{ background: 'var(--ai-bg-container)', padding: '1rem', borderRadius: 'var(--ai-radius-sm)', textAlign: 'center', fontWeight: 600 }}>
                              Grid Column 3
                            </div>
                            <div style={{ background: 'var(--ai-bg-container)', padding: '1rem', borderRadius: 'var(--ai-radius-sm)', textAlign: 'center', fontWeight: 600 }}>
                              Grid Column 4
                            </div>
                          </Grid>
                        </Card.Content>
                      </Card>
                    </Grid>

                    <Card>
                      <Card.Header>Themed Container Divs (`&lt;Block&gt;`)</Card.Header>
                      <Card.Content>
                        <p style={{ marginTop: 0 }}>
                          The one component that accepts real <code>style</code>/<code>className</code> — for ad-hoc layout needs the two <code>&lt;div&gt;</code>s above stand in for. Its own <code>background</code>/<code>padding</code>/<code>radius</code>/<code>border</code> stay theme-driven by default, and <code>subtheme</code> resolves the same way <code>&lt;Badge&gt;</code>'s does.
                        </p>
                        <HStack gap="md" wrap>
                          <Block background="container" padding="md" radius="md">Container + padding + radius</Block>
                          <Block background="surface" padding="md" radius="md" border>Surface + border</Block>
                          <Block padding="md" radius="md" subtheme="success">Subtheme (soft)</Block>
                          <Block padding="md" radius="md" subtheme="warning" appearance="solid">Subtheme (solid)</Block>
                        </HStack>
                      </Card.Content>
                    </Card>

                    <Card>
                      <Card.Header>Action Toolbars with Slot Architecture (`&lt;Toolbar&gt;`)</Card.Header>
                      <Card.Content>
                        <VStack gap="md">
                          <p style={{ marginTop: 0 }}>Toolbars with explicit <code>Left</code>, <code>Center</code>, and <code>Right</code> slots prevent AI from writing ad-hoc flex styles.</p>
                          <div style={{ background: 'var(--ai-bg-container)', padding: '0.75rem 1rem', borderRadius: 'var(--ai-radius-md)' }}>
                            <Toolbar>
                              <Toolbar.Left>
                                <strong>Toolbar Title Left</strong>
                              </Toolbar.Left>
                              <Toolbar.Center>
                                <Button size="sm" variant="outline">Center Tab 1</Button>
                                <Button size="sm" variant="outline">Center Tab 2</Button>
                              </Toolbar.Center>
                              <Toolbar.Right>
                                <Button size="sm" variant="primary" icon="⚡">Action Right</Button>
                              </Toolbar.Right>
                            </Toolbar>
                          </div>
                        </VStack>
                      </Card.Content>
                    </Card>
                  </VStack>
                </TabStrip.Panel>

                {/* Tab 10: Layout Wireframe Gallery */}
                <TabStrip.Panel groupId="main-demo" value="wireframes">
                  <VStack gap="lg">
                    <Card>
                      <Card.Header>Common Layout Wireframes</Card.Header>
                      <Card.Content>
                        <p style={{ marginTop: 0 }}>
                          Each tile below is an isolated <code>&lt;iframe srcDoc&gt;</code> — a static structural wireframe, deliberately flat-colored and filled with lorem ipsum rather than skinned in the live HSV theme, since a wireframe's job is to communicate regions and proportions, not final finish. The caption under each names the Toolcrib layout primitives that build the real thing.
                        </p>
                        <HStack gap="md" wrap>
                          {WIREFRAME_LEGEND.map(item => (
                            <HStack key={item.label} gap="sm">
                              <div
                                style={{
                                  width: '0.75rem',
                                  height: '0.75rem',
                                  borderRadius: '0.1875rem',
                                  background: item.color,
                                  flexShrink: 0,
                                }}
                              />
                              <span style={{ fontSize: '0.75rem', color: 'var(--ai-text-secondary)' }}>{item.label}</span>
                            </HStack>
                          ))}
                        </HStack>
                      </Card.Content>
                    </Card>

                    <Grid columns={3} gap="lg">
                      {WIREFRAMES.map(wireframe => (
                        <Card key={wireframe.title}>
                          <Card.Header>{wireframe.title}</Card.Header>
                          <Card.Content>
                            {wireframe.content ? (
                              <LiveIframe title={`${wireframe.title} wireframe`} height="11.25rem">
                                {wireframe.content}
                              </LiveIframe>
                            ) : (
                              <iframe
                                title={`${wireframe.title} wireframe`}
                                srcDoc={wireframe.srcDoc}
                                sandbox=""
                                style={{
                                  width: '100%',
                                  height: '11.25rem',
                                  border: '0.0625rem solid var(--ai-border, #e5e7eb)',
                                  borderRadius: 'var(--ai-radius-md, 0.375rem)',
                                  display: 'block',
                                }}
                              />
                            )}
                            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--ai-text-secondary)', fontFamily: 'monospace' }}>
                              {wireframe.components}
                            </div>
                          </Card.Content>
                        </Card>
                      ))}
                    </Grid>
                  </VStack>
                </TabStrip.Panel>

                {/* Tab 11: Component Showcase */}
                <TabStrip.Panel groupId="main-demo" value="showcase">
                  <VStack gap="lg">
                    {/* Section 1: Button Variants & Subthemes */}
                    <Card>
                      <Card.Header>Button Subsystem (Variants, Sub-Themes & Glyphs)</Card.Header>
                      <Card.Content>
                        <VStack gap="sm">
                          <HStack gap="sm" wrap>
                            <Button variant="primary" icon="🚀" trailingIcon="➔" onClick={() => addToast({ type: 'info', message: 'Primary Button clicked!', priority: 'medium' })}>Primary Launch</Button>
                            <Button variant="secondary" icon="⚙️" onClick={() => addToast({ type: 'info', message: 'Secondary Button clicked!', priority: 'low' })}>Secondary Settings</Button>
                            <Button variant="outline" icon="⚡" onClick={() => addToast({ type: 'info', message: 'Outline Button clicked!', priority: 'medium' })}>Outline Action</Button>
                            <Button variant="danger" icon="🗑️" onClick={() => addToast({ type: 'error', message: 'Danger Button clicked!', priority: 'urgent' })}>Delete Record</Button>
                            <Button variant="ghost" icon="⭐" onClick={() => addToast({ type: 'info', message: 'Ghost Button clicked!', priority: 'low' })}>Favorite</Button>
                            <Button subtheme="success" icon="✅" onClick={() => addToast({ type: 'success', message: 'Success Subtheme Button clicked!', priority: 'medium' })}>Success Verified</Button>
                            <Button subtheme="warning" icon="⚠️" onClick={() => addToast({ type: 'warning', message: 'Warning Subtheme Button clicked!', priority: 'high' })}>Warning Alert</Button>
                            <Button subtheme="info" icon="ℹ️" onClick={() => addToast({ type: 'info', message: 'Info Subtheme Button clicked!', priority: 'medium' })}>Info Details</Button>
                          </HStack>
                          {/* size="sm"/"md"/"lg", isolated from variant/subtheme --
                              nothing above demonstrated the size prop at all. */}
                          <HStack gap="sm" wrap align="center">
                            <Button size="sm" variant="outline">Small</Button>
                            <Button size="md" variant="outline">Medium</Button>
                            <Button size="lg" variant="outline">Large</Button>
                          </HStack>
                        </VStack>
                      </Card.Content>
                    </Card>

                    {/* Section 1.5: CardSimple (token-saving shorthand) */}
                    <Card>
                      <Card.Header>Token-Saving Card Shorthand (`&lt;CardSimple&gt;`)</Card.Header>
                      <Card.Content>
                        <p style={{ marginTop: 0 }}>
                          Same visual result as slot-based <code>&lt;Card&gt;</code>, without composing <code>Header</code>/<code>Content</code>/<code>Footer</code> manually — useful when the AI just needs a quick single-purpose card.
                        </p>
                        <CardSimple
                          title="Quick Stats"
                          subtitle="Updated just now"
                          footer={<span style={{ fontSize: '0.75rem', color: 'var(--ai-text-secondary)' }}>Auto-refreshes every 30s</span>}
                          actions={<Button size="sm" variant="outline" onClick={() => addToast({ type: 'info', message: 'Refreshed!' })}>Refresh</Button>}
                        >
                          <div style={{ fontSize: '2rem', fontWeight: 800 }}>1,204</div>
                          <div style={{ color: 'var(--ai-text-secondary)', fontSize: '0.875rem' }}>Active Sessions</div>
                        </CardSimple>
                      </Card.Content>
                    </Card>

                    {/* Section 1.6: per-instance overrides & style domains —
                        Card no longer accepts `style`/`className`; instance-
                        level theme values go through `overrides`, resolved
                        as sparse CSS variables on Card's own root node (see
                        theme/useSliceOverrides.ts). `subtheme` follows the
                        same prop but falls back to the nearest
                        <StyleDomainProvider> if the instance doesn't set its
                        own — demonstrated below via a domain wrapping a
                        Card that doesn't set `overrides.subtheme` itself. */}
                    <Grid columns={2} gap="lg">
                      <Card overrides={{ padding: 'compact', headerStyle: 'subtle-bg' }}>
                        <Card.Header>Per-Instance Override (`overrides`)</Card.Header>
                        <Card.Content>
                          <p style={{ marginTop: 0 }}>
                            This Card passes <code>overrides={'{'}{'{'} padding: 'compact', headerStyle: 'subtle-bg' {'}'}{'}'}</code> — a sparse CSS-variable patch applied only to this Card's own root node, leaving every other Card (and the global Theme Editor's Card slice) untouched.
                          </p>
                        </Card.Content>
                      </Card>

                      <StyleDomainProvider subtheme="error">
                        <Card>
                          <Card.Header>Style Domain (`&lt;StyleDomainProvider&gt;`)</Card.Header>
                          <Card.Content>
                            <p style={{ marginTop: 0 }}>
                              This Card sets no <code>overrides.subtheme</code> of its own — its error-coloured border comes entirely from the ancestor <code>&lt;StyleDomainProvider subtheme="error"&gt;</code> wrapping it, via React Context (not CSS inheritance, so it still reaches components that render through a portal).
                            </p>
                          </Card.Content>
                        </Card>
                      </StyleDomainProvider>
                    </Grid>

                    {/* Section 2: Adaptive Card Layout & Groups */}
                    <Grid columns={2} gap="lg">
                      {/* No explicit height on this wrapper (or its sibling
                          below) — Grid's plain `display:'grid'` leaves
                          `align-items:stretch` as the browser default, so
                          each grid item's cross-axis size is already the
                          row's own height (driven by whichever card's
                          natural content is tallest), with no JS/measurement
                          involved. `layout="auto"`'s `height:'100%'` (see
                          Card.tsx) resolves against that stretched size
                          correctly per the CSS Grid spec even though it was
                          never given an explicit height — so the demo box
                          below grows/shrinks to match its row-mate
                          dynamically instead of both being pinned to a
                          hardcoded value that silently drifts out of sync
                          the moment either card's content changes. */}
                      <div>
                        <Card layout="auto">
                          <Card.Header>Adaptive Card (`layout="auto"`)</Card.Header>
                          <Card.Content layout="auto">
                            <p style={{ marginTop: 0 }}>
                              When <code>layout="auto"</code> is passed to <code>&lt;Card&gt;</code> and <code>&lt;Card.Content&gt;</code>, the card automatically fills 100% of its parent bounding box and configures flex box layout for child elements.
                            </p>
                            <div style={{ flex: 1, background: 'var(--ai-bg-container)', borderRadius: 'var(--ai-radius-md)', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ai-text-secondary)', fontWeight: 600 }}>
                              Auto-Filling Bounding Box Area
                            </div>
                          </Card.Content>
                          <Card.Footer>
                            <span>Adaptive Status: Active</span>
                            <Card.Actions>
                              <Button size="sm" variant="outline" icon="✨" onClick={() => addToast({ type: 'info', message: 'Card Action button clicked!', priority: 'medium' })}>Action</Button>
                            </Card.Actions>
                          </Card.Footer>
                        </Card>
                      </div>

                      {/* No layout="auto" here, unlike its sibling to the
                          left -- this card's content is a growing list of
                          example rows and must size itself to its own
                          content, driving the row's stretched height (see
                          this Grid's own comment above), not the other way
                          around. It previously had the same fixed-height
                          wrapper as its sibling, left over from an earlier,
                          shorter version of this content: harmless while it
                          fit, but a real clip once more example rows were
                          added -- reachable only via the browser's native
                          focus-scroll on Tab (which can scroll an
                          overflow:hidden ancestor even though a mouse wheel
                          can't), reported directly as "this card had two
                          versions of the mixed controls" being invisible to
                          normal scrolling. */}
                      <div>
                        <Card>
                          <Card.Header>Connected Toolbars & Groups (`&lt;UIGroup&gt;`)</Card.Header>
                          <Card.Content>
                            <VStack gap="md">
                              <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>3-Button Connected Group with Glyphs</div>
                                <UIGroup>
                                  <Button variant="outline" icon="◀" onClick={() => addToast({ type: 'info', message: 'Left toolbar button clicked!', priority: 'low' })}>Prev</Button>
                                  <Button variant="outline" icon="●" onClick={() => addToast({ type: 'info', message: 'Center toolbar button clicked!', priority: 'low' })}>Pause</Button>
                                  <Button variant="outline" icon="▶" onClick={() => addToast({ type: 'info', message: 'Right toolbar button clicked!', priority: 'low' })}>Next</Button>
                                </UIGroup>
                              </div>

                              <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Search Input Toolbar Group</div>
                                {/* display:'grid' (not a plain block div) —
                                    UIGroup is inline-flex, which shrinks to
                                    content in normal block flow regardless
                                    of a block parent's width; a grid item
                                    stretches to fill its track by default
                                    (justify-items:stretch), which works
                                    against an inline-flex child too. */}
                                <div style={{ display: 'grid', width: '100%' }}>
                                  <UIGroup>
                                    <Input placeholder="Search records..." />
                                    <Button variant="primary" icon="🔍" onClick={() => addToast({ type: 'success', message: 'Search executed!', priority: 'high' })}>Search</Button>
                                  </UIGroup>
                                </div>
                              </div>

                              <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Group Containing a Popup Trigger (wrapper-div squaring)</div>
                                {/* Regression coverage, live: Modal/Popup/
                                    AlertDialog all wrap their own `trigger`
                                    in an internal div (for flex-stretch
                                    inside a row like this one), which
                                    UIGroup's own direct-child CSS can't
                                    reach through — the actual Button here
                                    sits two DOM layers below that
                                    selector's reach. Squares correctly
                                    anyway via UIGroupContext, which
                                    propagates through that wrapper the
                                    same way useTargetDocument()/useNonce()
                                    already reach components nested inside
                                    a portal. See e2e/uiGroup.spec.ts for
                                    the real-browser assertion this exists
                                    to back up visually. */}
                                <UIGroup>
                                  <Button variant="outline" icon="◀">Prev</Button>
                                  <Popup
                                    id="uigroup-popup-demo"
                                    trigger={<Button variant="outline" icon="⚙️" aria-label="Options" />}
                                    placement="bottom-start"
                                  >
                                    <div style={{ padding: '0.75rem', fontSize: '0.8125rem' }}>Popup content</div>
                                  </Popup>
                                  <Button variant="outline" icon="▶">Next</Button>
                                </UIGroup>
                              </div>

                              <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Mixed Controls at a Standardized `size` (`&lt;Button&gt;`, `&lt;Input&gt;`, `&lt;Select&gt;` — same font-size + padding scale, so they line up regardless of which component renders each one)</div>
                                <VStack gap="sm">
                                  <UIGroup>
                                    <Button size="sm" variant="outline">sm</Button>
                                    <Input size="sm" placeholder="Small input" />
                                    {/* VisuallyHidden label, not just `placeholder` -- Select's
                                        trigger renders role="combobox", which (unlike
                                        role="button") doesn't derive its accessible name
                                        from visible content (axe: button-name). */}
                                    <VisuallyHidden>
                                      <Label htmlFor="showcase-select-sm">Small select</Label>
                                    </VisuallyHidden>
                                    <Select id="showcase-select-sm" size="sm" options={[{ label: 'Small', value: 'sm' }]} placeholder="Small select" />
                                  </UIGroup>
                                  <UIGroup>
                                    <Button size="lg" variant="outline">lg</Button>
                                    <Input size="lg" placeholder="Large input" />
                                    <VisuallyHidden>
                                      <Label htmlFor="showcase-select-lg">Large select</Label>
                                    </VisuallyHidden>
                                    <Select id="showcase-select-lg" size="lg" options={[{ label: 'Large', value: 'lg' }]} placeholder="Large select" />
                                  </UIGroup>
                                </VStack>
                              </div>
                            </VStack>
                          </Card.Content>
                        </Card>
                      </div>
                    </Grid>

                    {/* Section 3: Radix UI Primitives */}
                    <Card>
                      <Card.Header>Radix UI Primitives (Accordion, Dropdown Menu, Tooltip & Slider)</Card.Header>
                      <Card.Content>
                        <Grid columns={2} gap="lg">
                          <VStack gap="md">
                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Contextual Action Menu (`&lt;DropdownMenu&gt;`)</div>
                              <DropdownMenu
                                trigger={<Button variant="outline" icon="⚙️" trailingIcon="▼">User Actions Menu</Button>}
                                items={[
                                  { value: 'profile', label: 'View Profile', icon: '👤', onClick: () => addToast({ type: 'info', message: 'View Profile selected', priority: 'medium' }) },
                                  { value: 'settings', label: 'Account Settings', icon: '⚙️', onClick: () => addToast({ type: 'info', message: 'Settings selected', priority: 'low' }) },
                                  { isSeparator: true, value: 'sep1', label: '' },
                                  { value: 'logout', label: 'Log Out', icon: '🚪', onClick: () => addToast({ type: 'warning', message: 'User logged out', priority: 'high' }) },
                                ]}
                              />
                            </div>

                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Hover Tooltip (`&lt;Tooltip&gt;`)</div>
                              <Tooltip content="Radix UI Accessible Tooltip with HSV Styling">
                                <Button variant="secondary" icon="ℹ️">Hover For Tooltip</Button>
                              </Tooltip>
                            </div>

                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Interactive Range Slider (`&lt;Slider&gt;`)</div>
                              <Slider ariaLabel="Interactive range slider" defaultValue={65} onChange={val => addToast({ type: 'info', message: `Slider value changed to ${val}%`, priority: 'low' })} />
                            </div>
                          </VStack>

                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Expandable Accordion (`&lt;Accordion&gt;`)</div>
                            <Accordion
                              defaultValue="faq-1"
                              items={[
                                { value: 'faq-1', title: 'Why use Radix UI Primitives?', content: 'Radix UI primitives handle WAI-ARIA roles, focus trapping, keyboard navigation, and light-dismiss while Toolcrib handles slots, HSV theming, and event bus dispatching.' },
                                { value: 'faq-2', title: 'How does Event Bus integration work?', content: 'Every primitive action automatically emits strongly-typed events to aiBus (e.g. accordion:opened, menu:item_selected, slider:changed).' },
                              ]}
                            />
                          </div>
                        </Grid>
                      </Card.Content>
                    </Card>

                    {/* Section 4: Newer Radix wraps — AlertDialog, Progress,
                        Separator, Avatar, Toggle/ToggleGroup, ContextMenu,
                        Collapsible */}
                    <Card>
                      <Card.Header>Newer Primitives (AlertDialog, Progress, Separator, Avatar, Toggle, ContextMenu & Collapsible)</Card.Header>
                      <Card.Content>
                        <Grid columns={2} gap="lg">
                          <VStack gap="md">
                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Blocking Confirmation (`&lt;AlertDialog&gt;`)</div>
                              <AlertDialog trigger={<Button variant="danger" icon="🗑️">Delete Record</Button>} ariaLabel="Delete confirmation">
                                <AlertDialog.Header>Delete this record?</AlertDialog.Header>
                                <AlertDialog.Body>This action cannot be undone. Unlike Modal, clicking outside this dialog will not dismiss it.</AlertDialog.Body>
                                <AlertDialog.Footer>
                                  <AlertDialog.Actions>
                                    <AlertDialog.Cancel />
                                    <AlertDialog.Action onClick={() => addToast({ type: 'success', message: 'Record deleted' })}>Delete</AlertDialog.Action>
                                  </AlertDialog.Actions>
                                </AlertDialog.Footer>
                              </AlertDialog>
                            </div>

                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Determinate Progress Bar (`&lt;Progress&gt;`)</div>
                              <VStack gap="sm">
                                <Progress id="demo-upload" aria-label="Upload progress" value={progressValue} subtheme="success" />
                                <UIGroup>
                                  <Button size="sm" variant="outline" onClick={() => setProgressValue(v => Math.max(0, v - 10))}>-10%</Button>
                                  <Button size="sm" variant="outline" onClick={() => setProgressValue(v => Math.min(100, v + 10))}>+10%</Button>
                                </UIGroup>
                                {/* size="sm"/"md"/"lg" (bar thickness), isolated from the
                                    interactive default-size bar above. */}
                                <Progress value={progressValue} size="sm" aria-label="Small progress bar" />
                                <Progress value={progressValue} size="md" aria-label="Medium progress bar" />
                                <Progress value={progressValue} size="lg" aria-label="Large progress bar" />
                              </VStack>
                            </div>

                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>User Avatars with Fallback (`&lt;Avatar&gt;`)</div>
                              <HStack gap="sm" align="center">
                                <Avatar fallback="XS" alt="Small avatar example" size="sm" />
                                <Avatar fallback="JD" alt="Jane Doe" size="md" />
                                <Avatar fallback="AS" alt="Alex Smith" size="lg" />
                                <Separator orientation="vertical" decorative />
                                <Avatar src="https://broken-image-url.example/none.png" fallback="404" alt="Broken image" />
                              </HStack>
                            </div>
                          </VStack>

                          <VStack gap="md">
                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Single Disclosure Panel (`&lt;Collapsible&gt;`)</div>
                              <Collapsible trigger="Show advanced options">
                                <p style={{ margin: 0 }}>Content revealed on demand — for a single panel. See the Accordion above for a data-driven set of several.</p>
                              </Collapsible>
                            </div>

                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Toggle & Connected ToggleGroup (`&lt;Toggle&gt;` / `&lt;ToggleGroup&gt;`)</div>
                              <VStack gap="sm">
                                <Toggle name="favorite" onPressedChange={pressed => addToast({ type: 'info', message: `Favorite ${pressed ? 'enabled' : 'disabled'}`, priority: 'low' })}>⭐ Favorite</Toggle>
                                <ToggleGroup
                                  name="text-align"
                                  type="single"
                                  defaultValue="left"
                                  options={[
                                    { value: 'left', label: '◀ Left' },
                                    { value: 'center', label: '● Center' },
                                    { value: 'right', label: '▶ Right' },
                                  ]}
                                  onChange={val => addToast({ type: 'info', message: `Alignment: ${val}`, priority: 'low' })}
                                />
                              </VStack>
                            </div>

                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Right-Click Menu (`&lt;ContextMenu&gt;`)</div>
                              <ContextMenu
                                items={[
                                  { value: 'copy', label: 'Copy', icon: '📋', onClick: () => addToast({ type: 'info', message: 'Copied', priority: 'low' }) },
                                  { value: 'rename', label: 'Rename', icon: '✏️', onClick: () => addToast({ type: 'info', message: 'Rename selected', priority: 'low' }) },
                                  { isSeparator: true, value: 'sep', label: '' },
                                  { value: 'delete', label: 'Delete', icon: '🗑️', onClick: () => addToast({ type: 'warning', message: 'Deleted', priority: 'medium' }) },
                                ]}
                              >
                                <div style={{ padding: '1.25rem', border: '0.0625rem dashed var(--ai-border, #d1d5db)', borderRadius: 'var(--ai-radius-md, 0.375rem)', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>
                                  Right-click this area
                                </div>
                              </ContextMenu>
                            </div>
                          </VStack>
                        </Grid>
                      </Card.Content>
                    </Card>

                    {/* Section 4.5: Combobox — async search (distinct from
                        the client-side-filtered Country field on the Form
                        tab; this one simulates a real server round-trip)
                        and the multiple-selection chip mode. */}
                    <Card>
                      <Card.Header>Combobox: Async Search & Multi-Select (`&lt;Combobox&gt;`)</Card.Header>
                      <Card.Content>
                        <Grid columns={2} gap="lg">
                          <VStack gap="sm">
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)' }}>Async Server Search (`onSearch`)</div>
                            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>
                              Type a name below — each keystroke is debounced 300ms, then resolved against a simulated 200ms server round-trip over Acme Analytics' own 250-person team directory (the same dataset the Data Table tab uses). No Radix primitive backs this interaction at all (Radix ships no Combobox); the listbox, filtering, and keyboard navigation are hand-built on top of <code>Popover</code> purely for anchored positioning.
                            </p>
                            <Combobox
                              placeholder="Search users..."
                              ariaLabel="Search users"
                              searchDebounceMs={300}
                              onSearch={async (query) => {
                                await new Promise(resolve => setTimeout(resolve, 200));
                                if (!query) return [];
                                const q = query.toLowerCase();
                                return dummyUsers
                                  .filter(u => u.name.toLowerCase().includes(q))
                                  .slice(0, 8)
                                  .map(u => ({ label: `${u.name} (${u.email})`, value: String(u.id) }));
                              }}
                              onChange={(value) => {
                                if (value) addToast({ type: 'info', message: `Selected user #${value}`, priority: 'low' });
                              }}
                            />
                          </VStack>

                          <VStack gap="sm">
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)' }}>Multi-Select Tags (`multiple`)</div>
                            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>
                              Same component, <code>multiple</code> mode — selections render as removable chips instead of filling the input, the listbox stays open between picks, and Backspace on an empty query removes the last chip.
                            </p>
                            <Combobox
                              multiple
                              placeholder="Add skills..."
                              ariaLabel="Skills"
                              defaultValue={['react', 'typescript']}
                              options={[
                                { label: 'React', value: 'react' },
                                { label: 'TypeScript', value: 'typescript' },
                                { label: 'Node.js', value: 'node' },
                                { label: 'GraphQL', value: 'graphql' },
                                { label: 'PostgreSQL', value: 'postgres' },
                                { label: 'Docker', value: 'docker' },
                              ]}
                              onChange={(value) => {
                                addToast({ type: 'info', message: `Skills: ${(value as string[]).join(', ') || '(none)'}`, priority: 'low' });
                              }}
                            />
                          </VStack>
                        </Grid>
                      </Card.Content>
                    </Card>

                    {/* Section 4.55: Listbox — the keyboard-navigable
                        option list Combobox is built on, now usable
                        standalone. Left: a caller-owned text input drives
                        activeIndex/aria-activedescendant, exactly the
                        contract Combobox itself relies on internally, and
                        each option's `render` slot replaces the plain
                        label with a two-line name/role layout. Right: a
                        plain multiSelectable checklist with no input and
                        no keyboard state at all — just toggling
                        selectedValues membership on click. */}
                    <Card>
                      <Card.Header>Standalone Option List (`&lt;Listbox&gt;`)</Card.Header>
                      <Card.Content>
                        <Grid columns={2} gap="lg">
                          <VStack gap="sm">
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)' }}>Keyboard-Navigable Picker with a Custom `render` Slot</div>
                            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>
                              Extracted from <code>&lt;Combobox&gt;</code>'s own internals — Listbox owns no keyboard state itself, so the input below drives <code>activeIndex</code> and <code>aria-activedescendant</code> the same way Combobox already does internally.
                            </p>
                            <Input
                              value={listboxQuery}
                              placeholder="Filter teammates..."
                              aria-controls="demo-listbox-team"
                              aria-activedescendant={listboxActiveIndex !== undefined ? `demo-listbox-team-option-${listboxActiveIndex}` : undefined}
                              onChange={e => {
                                setListboxQuery(e.target.value);
                                setListboxActiveIndex(undefined);
                              }}
                              onKeyDown={e => {
                                const filtered = TEAM_MEMBERS.filter(m => m.label.toLowerCase().includes(listboxQuery.toLowerCase()));
                                if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  setListboxActiveIndex(i => Math.min(filtered.length - 1, (i ?? -1) + 1));
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  setListboxActiveIndex(i => Math.max(0, (i ?? 0) - 1));
                                } else if (e.key === 'Enter' && listboxActiveIndex !== undefined) {
                                  e.preventDefault();
                                  const opt = filtered[listboxActiveIndex];
                                  if (opt) {
                                    setListboxSelected(opt.value);
                                    setListboxQuery('');
                                    setListboxActiveIndex(undefined);
                                    addToast({ type: 'info', message: `Assigned to ${opt.label}`, priority: 'low' });
                                  }
                                }
                              }}
                            />
                            <div style={{ background: 'var(--ai-bg-container)', borderRadius: 'var(--ai-radius-md)' }}>
                              <Listbox
                                id="demo-listbox-team"
                                options={TEAM_MEMBERS.filter(m => m.label.toLowerCase().includes(listboxQuery.toLowerCase()))}
                                activeIndex={listboxActiveIndex}
                                selectedValues={listboxSelected ? [listboxSelected] : []}
                                aria-label="Teammates"
                                onSelect={opt => {
                                  setListboxSelected(opt.value);
                                  setListboxQuery('');
                                  setListboxActiveIndex(undefined);
                                  addToast({ type: 'info', message: `Assigned to ${opt.label}`, priority: 'low' });
                                }}
                              />
                            </div>
                          </VStack>

                          <VStack gap="sm">
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)' }}>Click-Only Multi-Select (`multiSelectable`, no input)</div>
                            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>
                              No keyboard state needed when there's no search box driving it — each click just toggles membership in <code>selectedValues</code>, the shape a "Visible Columns" quick-picker needs.
                            </p>
                            <div style={{ background: 'var(--ai-bg-container)', borderRadius: 'var(--ai-radius-md)' }}>
                              <Listbox
                                id="demo-listbox-columns"
                                options={TABLE_COLUMN_OPTIONS}
                                selectedValues={visibleColumns}
                                multiSelectable
                                aria-label="Visible table columns"
                                onSelect={opt => {
                                  setVisibleColumns(cols =>
                                    cols.includes(opt.value) ? cols.filter(c => c !== opt.value) : [...cols, opt.value]
                                  );
                                }}
                              />
                            </div>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--ai-text-secondary)' }}>
                              Visible: {visibleColumns.length ? visibleColumns.join(', ') : '(none)'}
                            </p>
                          </VStack>
                        </Grid>
                      </Card.Content>
                    </Card>

                    {/* Section 4.6: FileUpload — drag-and-drop with a
                        simulated upload transport (staged progress via
                        setTimeout, occasionally failing to demonstrate
                        Retry), reusing <Progress> per file and <AspectRatio>
                        for image thumbnails. */}
                    <Card>
                      <Card.Header>Drag-and-Drop File Upload (`&lt;FileUpload&gt;`)</Card.Header>
                      <Card.Content>
                        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>
                          Drop a few images (or click to browse) — max 4 files, 2 MB each. The upload transport below is entirely simulated (staged progress ticks, ~20% chance of a failure to show the Retry action) since toolcrib takes no opinion on the backend protocol: <code>onUpload</code> is just a consumer-supplied <code>(file, onProgress) =&gt; Promise&lt;void&gt;</code>.
                        </p>
                        <div style={{ maxWidth: '28rem' }}>
                          <FileUpload
                            accept="image/*"
                            maxFiles={4}
                            maxSizeBytes={2 * 1024 * 1024}
                            onUpload={(file, onProgress) =>
                              new Promise<void>((resolve, reject) => {
                                let pct = 0;
                                const tick = () => {
                                  pct += 20;
                                  onProgress(Math.min(pct, 100));
                                  if (pct < 100) {
                                    setTimeout(tick, 250);
                                  } else if (Math.random() < 0.2) {
                                    reject(new Error('Simulated network error'));
                                  } else {
                                    addToast({ type: 'success', message: `${file.name} uploaded`, priority: 'low' });
                                    resolve();
                                  }
                                };
                                setTimeout(tick, 250);
                              })
                            }
                          />
                        </div>
                      </Card.Content>
                    </Card>

                    {/* Section 5: Error Boundaries & Deferred Rendering */}
                    <Card>
                      <Card.Header>Resilience & Off-Screen Rendering (`&lt;AIErrorBoundary&gt;`, `&lt;DeferredContent&gt;`)</Card.Header>
                      <Card.Content>
                        <Grid columns={2} gap="lg">
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Catch Render Crashes (`&lt;AIErrorBoundary&gt;`)</div>
                            <VStack gap="sm">
                              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>
                                Wraps a subtree so a render error there shows a fallback instead of crashing the whole page — the same boundary <code>Modal</code>/<code>Drawer</code>/<code>AlertDialog</code> already wrap their own content in internally. It also emits <code>error:boundary</code> on the bus (see this card's top-right toast — that subscription is separate from the log panel below, forwarding just this one event as a real app would).
                              </p>
                              <div style={{ background: 'var(--ai-bg-container)', padding: '0.75rem', borderRadius: 'var(--ai-radius-md)' }}>
                                <AIErrorBoundary componentName="ShowcaseWidget" fallback={(error, reset) => (
                                  <VStack gap="sm">
                                    <p style={{ margin: 0, color: 'var(--ai-subtheme-error)', fontSize: '0.8125rem' }}>⚠️ {error.message}</p>
                                    <Button size="sm" variant="outline" onClick={() => { setFlakyTriggerKey(0); reset(); }}>Reset</Button>
                                  </VStack>
                                )}>
                                  <Flaky triggerKey={flakyTriggerKey} />
                                </AIErrorBoundary>
                              </div>
                              <Button size="sm" variant="danger" onClick={() => setFlakyTriggerKey(k => k + 1)}>💥 Trigger Error</Button>
                            </VStack>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Defer Off-Screen Content (`&lt;DeferredContent&gt;`)</div>
                            <VStack gap="sm">
                              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>
                                Each row below is wrapped in its own <code>&lt;DeferredContent&gt;</code> — scroll the list and the browser skips layout/paint for rows currently off-screen, resuming automatically as they scroll into view. Best for long lists/grids of many content-sized (not flex-fill) repeated items.
                              </p>
                              {/* tabIndex -- rows are plain text, no focusable descendant of their own (axe: scrollable-region-focusable). */}
                              <div tabIndex={0} style={{ height: '11.25rem', overflowY: 'auto', border: '0.0625rem solid var(--ai-border, #e5e7eb)', borderRadius: 'var(--ai-radius-md)' }}>
                                {Array.from({ length: 40 }, (_, i) => (
                                  <DeferredContent key={i} estimatedHeight={44}>
                                    <div
                                      style={{
                                        padding: '0.625rem 0.875rem',
                                        borderBottom: '0.0625rem solid var(--ai-border, #f3f4f6)',
                                        background: i % 2 === 0 ? 'transparent' : 'var(--ai-bg-container)',
                                        fontSize: '0.8125rem',
                                      }}
                                    >
                                      Deferred row #{i + 1}
                                    </div>
                                  </DeferredContent>
                                ))}
                              </div>
                            </VStack>
                          </div>
                        </Grid>
                      </Card.Content>
                    </Card>

                    {/* Section 6: Radix accessibility/layout utilities newly
                        added to the toolkit — VisuallyHidden, AccessibleIcon,
                        Label, ScrollArea */}
                    <Card>
                      <Card.Header>Accessibility, Scroll & Preview Utilities (`&lt;VisuallyHidden&gt;`, `&lt;AccessibleIcon&gt;`, `&lt;Label&gt;`, `&lt;ScrollArea&gt;`, `&lt;HoverCard&gt;`, `&lt;AspectRatio&gt;`)</Card.Header>
                      <Card.Content>
                        <Grid columns={2} gap="lg">
                          <VStack gap="md">
                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Accessible Name for a Decorative Icon (`&lt;AccessibleIcon&gt;`)</div>
                              <HStack gap="sm" align="center">
                                <AccessibleIcon label="Verified account">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ai-subtheme-success, #10b981)" strokeWidth="2.5" aria-hidden="true">
                                    <path d="M20 6 9 17l-5-5" />
                                  </svg>
                                </AccessibleIcon>
                                <span style={{ fontSize: '0.8125rem' }}>Jane Doe</span>
                              </HStack>
                              <p style={{ margin: '0.375rem 0 0', fontSize: '0.75rem', color: 'var(--ai-text-secondary)' }}>
                                The checkmark is purely decorative to a sighted user — <code>AccessibleIcon</code> marks it <code>aria-hidden</code> and gives screen readers the "Verified account" text instead, without an extra visible label crowding the row.
                              </p>
                            </div>

                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Screen-Reader-Only Text (`&lt;VisuallyHidden&gt;`)</div>
                              <HStack gap="sm" align="center">
                                <span aria-hidden="true" style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: 'var(--ai-subtheme-error, #ef4444)', display: 'inline-block' }} />
                                <span style={{ fontSize: '0.8125rem' }}>3</span>
                                <VisuallyHidden>3 unread notifications</VisuallyHidden>
                              </HStack>
                              <p style={{ margin: '0.375rem 0 0', fontSize: '0.75rem', color: 'var(--ai-text-secondary)' }}>
                                The dot and "3" are enough visually; the hidden text fills in the meaning ("3 unread notifications") for anyone not reading the badge by eye.
                              </p>
                            </div>

                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Rich Hover Preview (`&lt;HoverCard&gt;`)</div>
                              <HoverCard
                                id="demo-hovercard"
                                openDelay={150}
                                content={
                                  <VStack gap="xs">
                                    <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>Jane Doe</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--ai-text-secondary)' }}>Senior Engineer · Joined 2022</div>
                                    <Button size="sm" variant="outline" onClick={() => addToast({ type: 'info', message: 'Opened profile', priority: 'low' })}>View profile</Button>
                                  </VStack>
                                }
                              >
                                <a href="#profile" style={{ fontSize: '0.8125rem', color: 'var(--ai-color-primary, #3b82f6)' }}>@janedoe</a>
                              </HoverCard>
                              <p style={{ margin: '0.375rem 0 0', fontSize: '0.75rem', color: 'var(--ai-text-secondary)' }}>
                                Hover the username — unlike <code>Tooltip</code>, the card can hold a real, clickable <code>Button</code>; it doesn't dismiss on pointer-down. Mouse-only, by Radix's own design: <code>HoverCard</code> content is excluded from the Tab order (use <code>Popup</code> instead if this needs to be keyboard-reachable).
                              </p>
                            </div>
                          </VStack>

                          <VStack gap="md">
                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Standalone Form Label (`&lt;Label&gt;`)</div>
                              <Label htmlFor="demo-remember-me">
                                <input id="demo-remember-me" type="checkbox" />
                                <span>Remember me on this device</span>
                              </Label>
                              <p style={{ margin: '0.375rem 0 0', fontSize: '0.75rem', color: 'var(--ai-text-secondary)' }}>
                                Same component <code>FormField</code>'s own label uses internally — clicking the text toggles the checkbox, without hand-rolling the wrapping/`htmlFor` association.
                              </p>
                            </div>

                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Themed Custom Scrollbar (`&lt;ScrollArea&gt;`)</div>
                              <ScrollArea maxHeight="8rem" overrides={{ thumbWidth: 'thick' }}>
                                <VStack gap="xs">
                                  {Array.from({ length: 20 }, (_, i) => (
                                    <div key={i} style={{ padding: '0.375rem 0.625rem', fontSize: '0.8125rem', borderBottom: '0.0625rem solid var(--ai-border, #f3f4f6)' }}>
                                      Row {i + 1}
                                    </div>
                                  ))}
                                </VStack>
                              </ScrollArea>
                            </div>

                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Fixed Width-to-Height Ratio (`&lt;AspectRatio&gt;`)</div>
                              <div style={{ maxWidth: '12rem' }}>
                                <AspectRatio ratio={16 / 9}>
                                  <div style={{ width: '100%', height: '100%', borderRadius: 'var(--ai-radius-md)', background: 'var(--ai-color-primary, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem' }}>
                                    16:9
                                  </div>
                                </AspectRatio>
                              </div>
                              <p style={{ margin: '0.375rem 0 0', fontSize: '0.75rem', color: 'var(--ai-text-secondary)' }}>
                                Stays 16:9 regardless of the parent's width — resize the window to see it hold, the way a video thumbnail or card image needs to.
                              </p>
                            </div>
                          </VStack>
                        </Grid>
                      </Card.Content>
                    </Card>
                  </VStack>
                </TabStrip.Panel>
              </Content.Grow>
            </Content>
          </Splitter.Panel>

          {/* Bottom Panel: Live Event Bus Monitor */}
          <Splitter.Panel squareCorners="top">
            <Card layout="auto" squareCorners="top">
              <Card.Header paddingMode="compact">
                <Toolbar>
                  <Toolbar.Left>
                    <span style={{ fontSize: '0.875rem' }}>⚡ Live AI Event Bus Monitor (`aiBus` Stream)</span>
                  </Toolbar.Left>
                  <Toolbar.Right>
                    {/* A connected <UIGroup> instead of loose Toolbar.Button
                        siblings — same "3-Button Connected Group with
                        Glyphs" pattern shown on the Component Showcase tab,
                        just applied to a real toolbar instead of a demo
                        card. Plain <Button> (not Toolbar.Button): UIGroup's
                        border-merging CSS targets its own direct children,
                        and each Tooltip passes its child straight through
                        via Radix's asChild with no wrapper of its own, so
                        the Button stays UIGroup's direct child either way. */}
                    <UIGroup>
                      <Tooltip content="Download the captured events below as newline-delimited JSON — boilerplate for the telemetry-forwarding pattern this panel and the error:boundary toast above both demonstrate live in-browser: swap this Blob download for a fetch()/fs.appendFile() call and the same shape ships events to a real backend instead">
                        <Button
                          size="sm"
                          variant="outline"
                          icon="⬇️"
                          disabled={eventLogs.length === 0}
                          onClick={() => {
                            // One JSON object per line, oldest first (eventLogs
                            // is newest-first for display) — the standard JSONL
                            // convention so a consumer can append-only stream
                            // this to a file/log pipeline. `log.payload` is
                            // already a JSON string (built by JSON.stringify
                            // above), so it's spliced in directly rather than
                            // re-stringified, avoiding double-encoding it.
                            const lines = [...eventLogs].reverse().map(
                              log => `{"time":${JSON.stringify(log.time)},"event":${JSON.stringify(log.event)},"payload":${log.payload}}`
                            );
                            const blob = new Blob([lines.join('\n')], { type: 'application/x-ndjson' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `aibus-events-${Date.now()}.jsonl`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          Export JSONL
                        </Button>
                      </Tooltip>
                      <Tooltip content="Clear all recorded event log items from stream">
                        <Button
                          size="sm"
                          variant="outline"
                          icon="🗑️"
                          onClick={() => {
                            setEventLogs([]);
                            aiBus.emit('log:cleared', { timestamp: new Date().toLocaleTimeString() });
                          }}
                        >
                          Clear Log
                        </Button>
                      </Tooltip>
                      <Tooltip content={eventLogCollapsed ? 'Expand the event log panel back to its default height' : 'Collapse the event log panel to give the playground above more vertical space'}>
                        <Button
                          size="sm"
                          variant="outline"
                          icon={eventLogCollapsed ? '▲' : '▼'}
                          onClick={toggleEventLogCollapsed}
                        >
                          {eventLogCollapsed ? 'Expand' : 'Collapse'}
                        </Button>
                      </Tooltip>
                    </UIGroup>
                  </Toolbar.Right>
                </Toolbar>
              </Card.Header>
              {/* Omitted entirely (not just hidden) while collapsed --
                  Splitter's own minSize floor still leaves a couple of
                  percent of viewport height for this panel (a hard floor
                  on both panels, not something a "collapse" command can
                  bypass), and a scrollable log peeking through that gap
                  would defeat the point of collapsing it. */}
              {!eventLogCollapsed && (
                <Card.Content layout="auto" paddingMode="compact">
                  {/* tabIndex -- a keyboard-only user needs a way to reach and
                      scroll this region directly (axe: scrollable-region-focusable);
                      its content is plain text, no other focusable descendant. */}
                  <div tabIndex={0} style={{ background: 'var(--ai-bg-container)', color: 'var(--ai-text-primary)', padding: '0.5rem 0.75rem', borderRadius: 'var(--ai-radius-md, 0.375rem)', fontFamily: 'monospace', fontSize: '0.8rem', height: '100%', overflowY: 'auto' }}>
                    {eventLogs.length === 0 ? (
                      <div style={{ color: 'var(--ai-text-secondary)' }}>Listening for events on aiBus... (Drag the separator bar to resize)</div>
                    ) : (
                      eventLogs.map(log => (
                        <div key={log.id} style={{ marginBottom: '0.2rem' }}>
                          <span style={{ color: 'var(--ai-text-secondary)' }}>[{log.time}]</span>{' '}
                          {/* --ai-color-primary-readable, not --ai-color-primary --
                              this text sits on the log panel's near-neutral background,
                              and the raw hue measures under AA contrast there (axe:
                              color-contrast); same fix/reasoning as TabSlice.tsx's
                              own activeTextColor (see its comment for why a plain
                              harmonies.ts-generated var, not color-mix()). */}
                          <span style={{ color: 'var(--ai-color-primary-readable)', fontWeight: 'bold' }}>{log.event}</span>:{' '}
                          <span style={{ color: 'var(--ai-text-primary)' }}>{log.payload}</span>
                        </div>
                      ))
                    )}
                  </div>
                </Card.Content>
              )}
            </Card>
          </Splitter.Panel>
        </Splitter>
      </AppShell.Main>
      </AppShell>
    </>
  );
};

export default App;
