import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { z } from 'zod';
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
  SlideOut,
  Modal,
  useToast,
  DataTable,
  Column,
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
  FileUpload,
} from '#toolcrib';

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

const dummyUsers: DemoUser[] = Array.from({ length: 250 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  role: i % 3 === 0 ? 'Admin' : i % 2 === 0 ? 'Editor' : 'Viewer',
  status: i % 4 === 0 ? 'Pending' : i % 5 === 0 ? 'Inactive' : 'Active',
  score: Math.floor(Math.random() * 100),
}));

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
  const { parameters, typographyState } = useTheme();
  const { addToast, setAnchor } = useToast();

  // No `activeTab` useState here anymore: <TabStrip id="main-demo"> manages
  // its own active-tab state and broadcasts it on `aiBus`; each
  // <TabStrip.Panel groupId="main-demo" value="..."> below listens for that
  // independently. Control and content don't share a DOM ancestor, a
  // prop, or state — see src/components/TabStrip/TabStrip.tsx.
  const [eventLogs, setEventLogs] = useState<{ id: string; event: string; payload: string; time: string }[]>([]);
  const [progressValue, setProgressValue] = useState(45);
  const [flakyTriggerKey, setFlakyTriggerKey] = useState(0);

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
      render: (val) => (
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
          {val}
        </span>
      ),
    },
    { key: 'score', title: 'Score', width: 90, sortable: true },
  ];

  return (
    <AppShell>
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
          <SlideOut
            id="theme-editor-panel"
            title="🎨 OOTB Theme Designer"
            trigger={
              // squareCorners="left" set explicitly, not left to UIGroup's
              // usual automatic CSS: that CSS only reaches its own direct
              // children, and this Button sits two wrappers deep (SlideOut's
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
          </SlideOut>
        </UIGroup>
      </AppShell.Header>

      {/* Main Content Area with Resizable Splitter */}
      <AppShell.Main>
        <Splitter orientation="vertical" initialSplit={70}>
          {/* Top Panel: Interactive Component Playground */}
          {/* <Content> fills the Splitter.Panel and establishes the flex
              domain; unlike a plain div (or VStack, which doesn't declare
              squareCorners and would leak it onto the DOM — confirmed via
              a real browser run), it explicitly declares and consumes
              squareCorners, so Panel's corner-squaring cloneElement()
              forwards correctly. */}
          <Splitter.Panel squareCorners="bottom">
            <Content>
              <TabStrip
                id="main-demo"
                defaultActiveId="overview"
                items={[
                  { id: 'overview', label: '🚀 Overview & Architecture' },
                  { id: 'form', label: '📝 Form & Zod Engine' },
                  { id: 'overlays', label: '🪟 Overlays (Popup / SlideOut / Modal)' },
                  { id: 'toasts', label: '🔔 Toast Subsystem' },
                  { id: 'datatable', label: '📊 Virtualized Data Table' },
                  { id: 'layout', label: '📐 Common Layout Idioms' },
                  { id: 'wireframes', label: '🖼️ Wireframe Gallery' },
                  { id: 'showcase', label: '🧩 Component Showcase' },
                ]}
              />

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
                              body: <>A hand-rolled modal is easy to get 90% right and very easy to ship without a real focus trap, light-dismiss, or correct portal target. <code>Popup</code>, <code>Modal</code>, <code>SlideOut</code>, and <code>AlertDialog</code> wrap Radix UI primitives specifically so that 90% is handled once, correctly, instead of approximated per-component.</>,
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
                            By wrapping Radix UI primitives (`radix-ui`), <code>Toolcrib</code> decouples robust WAI-ARIA accessibility, keyboard navigation, focus trapping, and light-dismiss from design system styling.
                          </p>
                          <ul style={{ paddingLeft: '1.25rem', margin: '0.5rem 0' }}>
                            <li><strong>Dialog (`Modal`)</strong>: Full focus trap & background lockout.</li>
                            <li><strong>Popover (`Popup`)</strong>: Trigger anchoring & escape dismiss.</li>
                            <li><strong>Toast (`Toast`)</strong>: Priority queueing & sticky user actions.</li>
                            <li><strong>Tabs (`TabStrip`)</strong>: Arrow key focus traversal.</li>
                            <li><strong>RadioGroup, Checkbox, Switch</strong>: Accessible form controls.</li>
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

                {/* Tab 2: Form & Zod Engine */}
                <TabStrip.Panel groupId="main-demo" value="form">
                  <Grid columns={2} gap="lg">
                    <Card>
                      <Card.Header>User Profile Form (Zod 4 Validated Engine)</Card.Header>
                      <Card.Content>
                        <Form
                          id="profile-form"
                          schema={userProfileSchema}
                          initialValues={{ username: '', email: '', country: '', role: 'editor', contactPref: 'email', notifications: true, agreeTerms: false }}
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
                      <Card.Header>SlideOut Drawer</Card.Header>
                      <Card.Content>
                        <p style={{ marginTop: 0 }}>Side drawer sliding in from screen edge with backdrop and light dismiss.</p>
                        <SlideOut
                          id="demo-slideout"
                          title="Application Details Drawer"
                          trigger={<Button variant="secondary">Open SlideOut Drawer</Button>}
                        >
                          <p>This drawer is decoupled and easily controlled by AI.</p>
                          <Button variant="danger" onClick={() => aiBus.closeSlideOut('demo-slideout')}>Close Drawer</Button>
                        </SlideOut>
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
                          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Toast Anchor Position:</span>
                          <Select
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
                  <Card layout="auto">
                    <Card.Header>
                      <Toolbar>
                        <Toolbar.Left>
                          <span>Virtualized Data Table (250 Rows, Adaptive Rem Height)</span>
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
                      />
                    </Card.Content>
                  </Card>
                </TabStrip.Panel>

                {/* Tab 6: Common Layout Idioms (NEW) */}
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

                {/* Tab 7: Layout Wireframe Gallery (NEW) */}
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

                {/* Tab 8: Component Showcase */}
                <TabStrip.Panel groupId="main-demo" value="showcase">
                  <VStack gap="lg">
                    {/* Section 1: Button Variants & Subthemes */}
                    <Card>
                      <Card.Header>Button Subsystem (Variants, Sub-Themes & Glyphs)</Card.Header>
                      <Card.Content>
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
                      {/* layout="auto" fills 100% of its container — Card
                          itself no longer accepts a raw style prop to pin a
                          fixed demo height, so the fixed size lives on this
                          plain wrapper div instead (not a toolcrib
                          component, so it's outside the "no ad hoc style"
                          constraint). */}
                      <div style={{ height: '18rem' }}>
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

                      <div style={{ height: '18rem' }}>
                        <Card layout="auto">
                          <Card.Header>Connected Toolbars & Groups (`&lt;UIGroup&gt;`)</Card.Header>
                          <Card.Content layout="auto">
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
                              <Slider defaultValue={65} onChange={val => addToast({ type: 'info', message: `Slider value changed to ${val}%`, priority: 'low' })} />
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
                                <Progress id="demo-upload" value={progressValue} subtheme="success" />
                                <UIGroup>
                                  <Button size="sm" variant="outline" onClick={() => setProgressValue(v => Math.max(0, v - 10))}>-10%</Button>
                                  <Button size="sm" variant="outline" onClick={() => setProgressValue(v => Math.min(100, v + 10))}>+10%</Button>
                                </UIGroup>
                              </VStack>
                            </div>

                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>User Avatars with Fallback (`&lt;Avatar&gt;`)</div>
                              <HStack gap="sm">
                                <Avatar fallback="JD" alt="Jane Doe" />
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
                              Type a name below — each keystroke is debounced 300ms, then resolved against a simulated 200ms server round-trip over the same 250-user dataset the Data Table tab uses. No Radix primitive backs this interaction at all (Radix ships no Combobox); the listbox, filtering, and keyboard navigation are hand-built on top of <code>Popover</code> purely for anchored positioning.
                            </p>
                            <Combobox
                              placeholder="Search users..."
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
                                Wraps a subtree so a render error there shows a fallback instead of crashing the whole page — the same boundary <code>Modal</code>/<code>SlideOut</code>/<code>AlertDialog</code> already wrap their own content in internally. It also emits <code>error:boundary</code> on the bus (see this card's top-right toast — that subscription is separate from the log panel below, forwarding just this one event as a real app would).
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
                              <div style={{ height: '11.25rem', overflowY: 'auto', border: '0.0625rem solid var(--ai-border, #e5e7eb)', borderRadius: 'var(--ai-radius-md)' }}>
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
                                Hover the username — unlike <code>Tooltip</code>, the card can hold a real, clickable <code>Button</code>; it doesn't dismiss on pointer-down.
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
                    {/* Toolbar.Button (not a plain Button): joins the
                        toolbar's roving-tabindex group — Left/Right arrow
                        keys move focus between these two actions instead of
                        each taking its own Tab stop. Still wrappable in
                        <Tooltip> exactly like a plain Button, since
                        Toolbar.Button forwards its ref. */}
                    <Tooltip content="Download the captured events below as newline-delimited JSON — boilerplate for the telemetry-forwarding pattern this panel and the error:boundary toast above both demonstrate live in-browser: swap this Blob download for a fetch()/fs.appendFile() call and the same shape ships events to a real backend instead">
                      <Toolbar.Button
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
                      </Toolbar.Button>
                    </Tooltip>
                    <Toolbar.Separator />
                    <Tooltip content="Clear all recorded event log items from stream">
                      <Toolbar.Button
                        size="sm"
                        variant="ghost"
                        icon="🗑️"
                        onClick={() => {
                          setEventLogs([]);
                          aiBus.emit('log:cleared', { timestamp: new Date().toLocaleTimeString() });
                        }}
                      >
                        Clear Log
                      </Toolbar.Button>
                    </Tooltip>
                  </Toolbar.Right>
                </Toolbar>
              </Card.Header>
              <Card.Content layout="auto" paddingMode="compact">
                <div style={{ background: 'var(--ai-bg-container)', color: 'var(--ai-text-primary)', padding: '0.5rem 0.75rem', borderRadius: 'var(--ai-radius-md, 0.375rem)', fontFamily: 'monospace', fontSize: '0.8rem', height: '100%', overflowY: 'auto' }}>
                  {eventLogs.length === 0 ? (
                    <div style={{ color: 'var(--ai-text-secondary)' }}>Listening for events on aiBus... (Drag the separator bar to resize)</div>
                  ) : (
                    eventLogs.map(log => (
                      <div key={log.id} style={{ marginBottom: '0.2rem' }}>
                        <span style={{ color: 'var(--ai-text-secondary)' }}>[{log.time}]</span>{' '}
                        <span style={{ color: 'var(--ai-color-primary)', fontWeight: 'bold' }}>{log.event}</span>:{' '}
                        <span style={{ color: 'var(--ai-text-primary)' }}>{log.payload}</span>
                      </div>
                    ))
                  )}
                </div>
              </Card.Content>
            </Card>
          </Splitter.Panel>
        </Splitter>
      </AppShell.Main>
    </AppShell>
  );
};

export default App;
