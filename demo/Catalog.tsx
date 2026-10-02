import React, { type ReactNode, useEffect, useRef } from 'react';
import manifest from '../ai-docs/component-manifest.json';
import demoSources from './demoSources.generated.json';
import { Card, Badge, Block, Breadcrumb, Collapsible, HStack, Link, StyleDomainProvider, Text, VStack, VisuallyHidden } from '#toolcrib';
import { Eye } from 'lucide-react';
import { routeHref } from './hashRoute';

/** Each live demo's own source, generated from demo/App.tsx by scripts/generate-demo-sources.js. */
const DEMO_SOURCES = demoSources as { components: Record<string, string>; systems: Record<string, string> };

// The demo's component reference (issue #624), organized like a physical
// tool crib: a shadow board index (one outline per tool, grouped into the
// five @manifestCategory drawers, so a missing demo is visible at a glance)
// and one page per tool -- its catalog card and live demo -- plus one per
// Systems area. One page at a time, routed through the URL hash
// (demo/hashRoute.ts): with every live demo mounted at once the page was
// several times slower per interaction, badly enough that CI's WebKit e2e
// job tripled in length. Every fact on a card -- description, pick
// ticket (import line), spec sheet (props), slots, constraints, "commonly
// used with", safety placard -- is read straight from the GENERATED
// ai-docs/component-manifest.json, never hand-typed here, so it can't
// drift from the source it describes. Only the live demos themselves
// (which need App's own state) are passed in.

type ManifestProp = { type: string; description?: string; default?: string; required?: boolean };
type ManifestComponent = {
  name: string;
  import: string;
  category: string;
  description: string;
  props: Record<string, ManifestProp>;
  slots?: string[];
  slotProps?: Record<string, Record<string, ManifestProp>>;
  slotDescriptions?: Record<string, string>;
  constraints?: string;
  childComponents?: string[];
  antiPatternAvoid?: string;
  antiPatternInstead?: string;
};

const COMPONENTS = (manifest as unknown as { components: ManifestComponent[] }).components;

/** Every manifest component name, alphabetical -- for per-component "go to" commands. */
export const CATALOG_COMPONENT_NAMES = COMPONENTS.map(c => c.name).sort((a, b) => a.localeCompare(b));

/** Drawer order on the page -- the same five categories, in the order a reader builds a UI: layout first, inputs last. */
const CATEGORY_ORDER = ['Layout Primitives', 'Containers', 'Overlays', 'Data Display', 'Form Controls'] as const;
const CATEGORY_CODE: Record<string, string> = {
  'Layout Primitives': 'LP',
  Containers: 'CN',
  Overlays: 'OV',
  'Data Display': 'DD',
  'Form Controls': 'FC',
};

/**
 * What an entry shows below its catalog card:
 * - a ReactNode: the live demo;
 * - `{ seeAlso }`: demonstrated inside another entry's demo (e.g. Viewer via Gallery) -- a real demo, just not a separate one;
 * - `{ pageFrame }`: the component IS part of this page's own frame (AppShell, Content) -- no isolated demo, said plainly.
 */
export type EntryDemo = ReactNode | { seeAlso: string; note?: ReactNode } | { pageFrame: ReactNode };

const isSeeAlso = (d: EntryDemo): d is { seeAlso: string; note?: ReactNode } =>
  typeof d === 'object' && d !== null && !React.isValidElement(d) && 'seeAlso' in d;
const isPageFrame = (d: EntryDemo): d is { pageFrame: ReactNode } =>
  typeof d === 'object' && d !== null && !React.isValidElement(d) && 'pageFrame' in d;
const isLiveDemo = (d: EntryDemo) => d !== undefined && d !== null && !isSeeAlso(d) && !isPageFrame(d);

/** The live demo's frame: a rule above sets it off from the description; DocsPanel's tint sets it off from what follows. */
const DEMO_FRAME_STYLE: React.CSSProperties = {
  borderTop: '0.0625rem solid var(--ai-border)',
  padding: '0.75rem 0',
};

/**
 * The documentation under a live demo (pick ticket, spec sheet, blueprint...),
 * tinted so it can't be mistaken for more demo. A rule alone wasn't enough:
 * the docs are themed components too, so they looked like part of the demo.
 * A style domain (not a per-Block subtheme), so everything inside that follows
 * the domain picks up the same hue. `info` matches the fixtures board, the
 * page's other reference material.
 */
function DocsPanel({ children }: { children: ReactNode }) {
  return (
    <StyleDomainProvider subtheme="info">
      <Block padding="md" radius="md" border>
        <VStack gap="sm">{children}</VStack>
      </Block>
    </StyleDomainProvider>
  );
}

export interface SystemArea {
  id: string;
  title: string;
  /** One or two sentences: what you get without writing it yourself. */
  summary: ReactNode;
  /** The public pieces this area is made of (hooks, providers, helpers), shown as a parts list. */
  parts?: string[];
  demo?: ReactNode;
}

/** The `id` of a component page's `<section>` -- a stable hook for tests and `aria-labelledby`. */
export const entryAnchor = (name: string) => `cat-${name}`;
/** The `id` of a Systems page's `<section>`. */
export const systemAnchor = (id: string) => `cat-sys-${id}`;
/** Link targets (routes, see demo/hashRoute.ts). */
export const entryHref = (name: string) => routeHref({ page: 'catalog', entry: name });
export const systemHref = (id: string) => routeHref({ page: 'catalog', system: id });
const INDEX_HREF = routeHref({ page: 'catalog' });

function byCategory(): { category: string; items: (ManifestComponent & { bin: string })[] }[] {
  return CATEGORY_ORDER.map(category => {
    const items = COMPONENTS.filter(c => c.category === category)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c, i) => ({ ...c, bin: `${CATEGORY_CODE[category]}-${String(i + 1).padStart(2, '0')}` }));
    return { category, items };
  });
}

type TileState = 'featured' | 'demo' | 'via' | 'frame' | 'missing';

function tileState(demos: Record<string, EntryDemo>, featured: Record<string, string>, name: string): TileState {
  const d = demos[name];
  if (d === undefined || d === null) return 'missing';
  if (isSeeAlso(d)) return 'via';
  if (isPageFrame(d)) return 'frame';
  return name in featured ? 'featured' : 'demo';
}

const TILE_STYLE: Record<TileState, React.CSSProperties> = {
  // Accent, not primary: primary already means "link" and "selected" all
  // over the page, and a featured tile is neither.
  featured: { background: 'var(--ai-bg-surface, #ffffff)', border: '0.125rem solid var(--ai-color-accent, #8b5cf6)', color: 'var(--ai-text-primary, #111827)' },
  demo: { background: 'var(--ai-bg-surface, #ffffff)', border: '0.0625rem solid var(--ai-border, #d1d5db)', color: 'var(--ai-text-primary, #111827)' },
  via: { background: 'var(--ai-bg-surface, #ffffff)', border: '0.0625rem dashed var(--ai-border, #d1d5db)', color: 'var(--ai-text-primary, #111827)' },
  frame: { background: 'transparent', border: '0.0625rem dashed var(--ai-border, #d1d5db)', color: 'var(--ai-text-secondary, #6b7280)' },
  missing: { background: 'transparent', border: '0.125rem dashed var(--ai-subtheme-warning, #f59e0b)', color: 'var(--ai-text-secondary, #6b7280)' },
};

const TILE_HINT: Record<TileState, string> = {
  featured: '',
  demo: '',
  via: 'shown with another tool',
  frame: 'this page is built with it',
  missing: 'no demo yet',
};

// The last tool or fixture page opened, so a board can mark it when you come
// back (#680): stepping through pages with back/forward keeps your place.
// Per browser tab (sessionStorage), with an in-memory copy for when storage is
// unavailable (a private window, blocked site data).
const LAST_VISITED_KEY = 'toolcrib-demo:last-visited';
let lastVisitedMemo: string | undefined;
const visitKey = (kind: 'entry' | 'system', id: string) => `${kind}:${id}`;
function readLastVisited(): string {
  if (lastVisitedMemo === undefined) {
    try {
      lastVisitedMemo = sessionStorage.getItem(LAST_VISITED_KEY) ?? '';
    } catch {
      lastVisitedMemo = '';
    }
  }
  return lastVisitedMemo;
}
function writeLastVisited(key: string) {
  lastVisitedMemo = key;
  try {
    sessionStorage.setItem(LAST_VISITED_KEY, key);
  } catch {
    // storage unavailable: the in-memory copy still covers this session
  }
}

/**
 * One board tile, two lines like a bin label: part number, then the name.
 * `state` gives a tool tile its outline (see TILE_STYLE). With no `state`
 * (a fixture) the tile is a themed `<Block>`, so it takes its color from the
 * nearest `<StyleDomainProvider>`. `lastVisited` rings it and scrolls it into
 * view.
 */
function BoardTile({
  href,
  part,
  title,
  state,
  lastVisited,
  children,
}: {
  href: string;
  part: string;
  title: string;
  state?: TileState;
  lastVisited: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!lastVisited) return;
    // After the page's own scroll-to-top on route change (a parent effect,
    // which runs after this one).
    const frame = requestAnimationFrame(() => ref.current?.scrollIntoView?.({ block: 'center' }));
    return () => cancelAnimationFrame(frame);
  }, [lastVisited]);

  const label = (
    <VStack gap="xs">
      <Text as="span" mono size="xs" tone="secondary">
        {part}
        {/* A glyph, not the words (#704): the outline already says "this
            one", the eye just says why. Screen readers get the words. */}
        {lastVisited && (
          <Text as="span" variant="primary">
            {' '}<Eye size="1.1em" aria-hidden="true" style={{ verticalAlign: '-0.2em' }} />
            <VisuallyHidden> (last visited)</VisuallyHidden>
          </Text>
        )}
      </Text>
      <Text as="span">{children}</Text>
    </VStack>
  );
  return (
    // A whole tile is the link target (block, padded, bordered by state);
    // Link themes link text, not a tile surface.
    // eslint-disable-next-line toolcrib-internal/prefer-toolcrib-component
    <a
      ref={ref}
      href={href}
      title={lastVisited ? `${title} (last visited)` : title}
      data-shadow-tile={state ?? 'fixture'}
      data-last-visited={lastVisited ? '' : undefined}
      style={{
        display: 'block',
        borderRadius: 'var(--ai-radius-sm, 0.25rem)',
        fontSize: '0.8125rem',
        textDecoration: 'none',
        color: 'inherit',
        // "You were here": primary is the persistent selected/active identity
        // color (AGENTS.md color buckets).
        ...(lastVisited ? { outline: '0.125rem solid var(--ai-color-primary, #3b82f6)', outlineOffset: '0.125rem' } : {}),
        ...(state ? { padding: '0.375rem 0.5rem', ...TILE_STYLE[state] } : {}),
      }}
    >
      {state ? label : <Block padding="sm" radius="sm" border background="surface">{label}</Block>}
    </a>
  );
}

/** One outline per tool, grouped by drawer. A filled tile has its own live demo; a dashed one says why it doesn't. */
function ShadowBoard({ demos, featured, lastVisited }: { demos: Record<string, EntryDemo>; featured: Record<string, string>; lastVisited: string }) {
  const groups = byCategory();
  const missing = groups.flatMap(g => g.items).filter(c => tileState(demos, featured, c.name) === 'missing');
  return (
    <Card>
      <Card.Header>
        <HStack gap="sm" wrap align="center">
          <h2 id="cat-shadow-board" style={{ margin: 0, fontSize: '1rem' }}>Shadow board — every tool in the crib</h2>
          <Badge size="sm">{plural(COMPONENTS.length, 'tool')}</Badge>
        </HStack>
      </Card.Header>
      <Card.Content>
        <VStack gap="md">
          <Text size="sm" tone="secondary">
            Generated from the component manifest. Pick one to open its page. A <strong>★ highlighted</strong> outline is one of the richest demos, a good place to start; a solid outline has its own live demo; a dashed one is shown alongside another tool or is part of this page's own frame
            {missing.length > 0 ? <>; an <strong>amber</strong> outline has no demo yet ({missing.map(c => c.name).join(', ')}).</> : '.'}
          </Text>
          {groups.map(({ category, items }) => (
            <div key={category}>
              <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)' }}>
                {CATEGORY_CODE[category]} · {category}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(8.5rem, 1fr))', gap: '0.375rem', marginTop: '0.375rem' }}>
                {items.map(c => {
                  const state = tileState(demos, featured, c.name);
                  const hint = state === 'featured' ? featured[c.name] : TILE_HINT[state];
                  return (
                    <BoardTile
                      key={c.name}
                      href={entryHref(c.name)}
                      part={c.bin}
                      title={hint ? `${c.name} — ${hint}` : c.name}
                      state={state}
                      lastVisited={lastVisited === visitKey('entry', c.name)}
                    >
                      {/* Raw span, last rung of the ladder: Text's variant covers
                          primary/secondary only, and the featured star is
                          deliberately the accent hue (AGENTS.md color buckets). */}
                      {state === 'featured' && <span aria-hidden="true" style={{ color: 'var(--ai-color-accent, #8b5cf6)' }}>★ </span>}
                      {c.name}
                      {state === 'featured' && <VisuallyHidden> (featured: {featured[c.name]})</VisuallyHidden>}
                    </BoardTile>
                  );
                })}
              </div>
            </div>
          ))}
        </VStack>
      </Card.Content>
    </Card>
  );
}

const codeStyle: React.CSSProperties = { fontFamily: 'monospace', fontSize: '0.8125rem' };

/** Manifest prose is Markdown-flavored JSDoc: render its `backtick` spans as real inline code instead of literal backticks. */
function md(text: string): ReactNode {
  const parts = text.split(/`([^`]+)`/);
  if (parts.length === 1) return text;
  return parts.map((part, i) => (i % 2 === 1 ? <code key={i} style={codeStyle}>{part}</code> : part));
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/**
 * The spec sheet: the tool's slots and every prop, straight from the manifest
 * -- together, since both are the component's contract, and in the same
 * tabular form. Collapsed by default; the live demo is the headline. The
 * counts are badges on the trigger (inline spans: the trigger is a button, so
 * no block content).
 */
function SpecSheet({ component: c }: { component: ManifestComponent }) {
  const names = Object.keys(c.props ?? {});
  const slots = c.slots ?? [];
  if (names.length === 0 && slots.length === 0) return null;
  return (
    <Collapsible
      trigger={
        <>
          Spec sheet{' '}
          {slots.length > 0 && <Badge size="sm" variant="secondary">{plural(slots.length, 'slot')}</Badge>}{' '}
          {names.length > 0 && <Badge size="sm">{plural(names.length, 'prop')}</Badge>}
        </>
      }
    >
      <VStack gap="md">
        {slots.length > 0 && (
          <SpecTable
            caption="Slots"
            columns={['Slot', 'Props', 'Description']}
            rows={slots.map(s => {
              const own = c.slotProps?.[s] ?? {};
              const ownNames = Object.keys(own);
              return {
                key: s,
                cells: [
                  <code style={codeStyle}>{`${c.name}.${s}`}</code>,
                  ownNames.length === 0 ? '' : ownNames.map((n, i) => (
                    <React.Fragment key={n}>
                      {i > 0 && ', '}
                      <code style={codeStyle}>{n}</code>
                      {own[n].required && <Text as="span" subtheme="error">*</Text>}
                    </React.Fragment>
                  )),
                  c.slotDescriptions?.[s] ? md(c.slotDescriptions[s]) : '',
                ],
              };
            })}
          />
        )}
        {names.length > 0 && (
          <SpecTable
            caption="Props"
            columns={['Prop', 'Type', 'Default', 'Description']}
            rows={names.map(n => {
              const p = c.props[n];
              return {
                key: n,
                cells: [
                  <>
                    <code style={codeStyle}>{n}</code>
                    {p.required && <Text as="span" subtheme="error"> *</Text>}
                  </>,
                  <code style={codeStyle}>{p.type}</code>,
                  p.default ? <code style={codeStyle}>{p.default}</code> : '',
                  p.description ? md(p.description) : '',
                ],
              };
            })}
          />
        )}
      </VStack>
    </Collapsible>
  );
}

/**
 * One spec-sheet table. The first column is the name (no wrap), the last is
 * the description (secondary tone). Wide type signatures can overflow at
 * narrow widths, and a scroll region needs keyboard access (axe:
 * scrollable-region-focusable) and a unique name (axe: landmark-unique).
 */
function SpecTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: { key: string; cells: ReactNode[] }[] }) {
  const last = columns.length - 1;
  const pad = (i: number) => (i === 0 ? '0.25rem 0.5rem 0.25rem 0' : i === last ? '0.25rem 0 0.25rem 0.5rem' : '0.25rem 0.5rem');
  return (
    <div tabIndex={0} role="region" aria-label={`Spec sheet: ${caption.toLowerCase()}`} style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        <caption style={{ textAlign: 'left', captionSide: 'top', paddingBottom: '0.25rem' }}>
          <Text as="span" size="xs" weight="semibold" tone="secondary">{caption}</Text>
        </caption>
        <thead>
          <tr style={{ borderBottom: '0.0625rem solid var(--ai-border)' }}>
            {columns.map((col, i) => (
              <th key={col} scope="col" style={{ textAlign: 'left', padding: pad(i) }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key} style={{ borderBottom: '0.0625rem solid var(--ai-border)', verticalAlign: 'top' }}>
              {row.cells.map((cell, i) => (
                <td
                  key={i}
                  style={{
                    padding: pad(i),
                    ...(i === 0 ? { whiteSpace: 'nowrap' } : {}),
                    ...(i === last ? { color: 'var(--ai-text-secondary)' } : {}),
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
/**
 * The blueprint: the demo's own source, generated from demo/App.tsx (issue
 * #638) -- the exact JSX running above it, comments stripped (#678). Where the
 * spec sheet says what the tool is, the blueprint shows how it's built.
 * Collapsed by default, like the spec sheet.
 */
function Blueprint({ source }: { source?: string }) {
  if (!source) return null;
  return (
    <Collapsible trigger="Blueprint — how this demo is built">
      <VStack gap="sm">
        <Text size="xs" tone="secondary">
          Straight from the demo app, so it can reference the demo's own state and handlers (<code style={codeStyle}>addToast</code>, sample data).
        </Text>
        {/* A scroll region needs keyboard access (axe: scrollable-region-focusable). */}
        <pre
          tabIndex={0}
          role="region"
          aria-label="Blueprint"
          style={{ margin: 0, maxHeight: '28rem', overflow: 'auto', padding: '0.75rem', background: 'var(--ai-bg-container)', borderRadius: 'var(--ai-radius-sm)' }}
        >
          <code style={{ ...codeStyle, fontSize: '0.75rem' }}>{source}</code>
        </pre>
      </VStack>
    </Collapsible>
  );
}

function CatalogCard({ component, bin, demo }: { component: ManifestComponent; bin: string; demo: EntryDemo }) {
  const c = component;
  return (
    <section id={entryAnchor(c.name)} aria-labelledby={`${entryAnchor(c.name)}-title`}>
      <Card>
        <Card.Header>
          <HStack gap="sm" wrap align="center">
            <h3 id={`${entryAnchor(c.name)}-title`} style={{ margin: 0, fontSize: '1rem' }}>{c.name}</h3>
            <Badge size="sm">{bin}</Badge>
          </HStack>
        </Card.Header>
        <Card.Content>
          <VStack gap="sm">
            <Text>{md(c.description)}</Text>

            {/* The tool itself right under its one-line description, then
                everything about it (#704): documentation first pushed a big
                spec sheet or placard's worth of demo below the fold. The
                documentation sits in a tinted DocsPanel, so the border between
                the live demo and the docs about it reads at a glance. */}
            {isSeeAlso(demo) ? (
              <Text size="sm" tone="secondary">
                Shown in action with <Link href={entryHref(demo.seeAlso)}>{demo.seeAlso}</Link>.{demo.note ? <> {demo.note}</> : null}
              </Text>
            ) : isPageFrame(demo) ? (
              <Text size="sm" tone="secondary">{demo.pageFrame}</Text>
            ) : demo === undefined || demo === null ? (
              <Text size="sm" tone="secondary">No live demo yet.</Text>
            ) : (
              <div data-catalog-demo={c.name} style={DEMO_FRAME_STYLE}>
                {demo}
              </div>
            )}

            <DocsPanel>
              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--ai-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pick ticket</div>
                {/* Wraps rather than scrolls: a horizontally-scrollable <code>
                    is a scroll region with no keyboard access (axe:
                    scrollable-region-focusable) -- Form's grouped import is
                    long enough to trigger it. */}
                <code style={{ ...codeStyle, display: 'block', padding: '0.375rem 0.5rem', background: 'var(--ai-bg-container)', borderRadius: 'var(--ai-radius-sm)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.import}</code>
              </div>

              {(c.childComponents?.length || c.constraints) && (
                <VStack gap="xs">
                  {c.childComponents?.length ? (
                    <Text size="sm" tone="secondary">
                      Commonly used with:{' '}
                      {c.childComponents.map((s, i) => (
                        <React.Fragment key={s}>
                          {i > 0 && ', '}
                          {COMPONENTS.some(x => x.name === s) ? <Link href={entryHref(s)}>{s}</Link> : <code style={codeStyle}>{s}</code>}
                        </React.Fragment>
                      ))}
                    </Text>
                  ) : null}
                  {c.constraints ? <Text size="sm" tone="secondary">Constraint: {md(c.constraints)}</Text> : null}
                </VStack>
              )}

              {c.antiPatternAvoid && (
                <Block subtheme="warning" padding="sm" radius="sm">
                  <Text size="sm">
                    <strong>⚠ Safety placard.</strong> <strong>Don't:</strong> {md(c.antiPatternAvoid)}
                    {c.antiPatternInstead && <><br /><strong>Do:</strong> {md(c.antiPatternInstead)}</>}
                  </Text>
                </Block>
              )}

              <SpecSheet component={c} />
              {isLiveDemo(demo) && <Blueprint source={DEMO_SOURCES.components[c.name]} />}
            </DocsPanel>
          </VStack>
        </Card.Content>
      </Card>
    </section>
  );
}


/** Breadcrumb trail plus prev/next within the same drawer (or the fixtures board). */
function EntryNav({ trail, prev, next }: { trail: string[]; prev?: { label: string; href: string }; next?: { label: string; href: string } }) {
  return (
    <HStack gap="md" wrap align="center" justify="between">
      <Breadcrumb>
        {/* On the index itself the trail is just this crumb, as the current page. */}
        <Breadcrumb.Item href={trail.length > 0 ? INDEX_HREF : undefined}>Catalog</Breadcrumb.Item>
        {trail.map(t => <Breadcrumb.Item key={t}>{t}</Breadcrumb.Item>)}
      </Breadcrumb>
      <nav aria-label="Neighboring pages">
        <HStack gap="md">
          {prev && <Text as="span" size="sm"><Link href={prev.href} rel="prev">← {prev.label}</Link></Text>}
          {next && <Text as="span" size="sm"><Link href={next.href} rel="next">{next.label} →</Link></Text>}
        </HStack>
      </nav>
    </HStack>
  );
}

function SystemCard({ area }: { area: SystemArea }) {
  return (
    <section id={systemAnchor(area.id)} aria-labelledby={`${systemAnchor(area.id)}-title`}>
      <Card>
        <Card.Header>
          <h3 id={`${systemAnchor(area.id)}-title`} style={{ margin: 0, fontSize: '1rem' }}>{area.title}</h3>
        </Card.Header>
        <Card.Content>
          <VStack gap="sm">
            <Text>{area.summary}</Text>
            {/* Demo first, then the documentation -- same order as a tool's page (#704). */}
            {area.demo && <div style={DEMO_FRAME_STYLE}>{area.demo}</div>}
            {(area.parts?.length || area.demo) && (
              <DocsPanel>
                {area.parts?.length ? (
                  <Text size="sm" tone="secondary">
                    Parts: {area.parts.map((p, i) => <React.Fragment key={p}>{i > 0 && ', '}<code style={codeStyle}>{p}</code></React.Fragment>)}
                  </Text>
                ) : null}
                {area.demo && <Blueprint source={DEMO_SOURCES.systems[area.id]} />}
              </DocsPanel>
            )}
          </VStack>
        </Card.Content>
      </Card>
    </section>
  );
}

/** Fixture part numbers, in board order: FX-01, FX-02, ... */
const fixturePart = (i: number) => `FX-${String(i + 1).padStart(2, '0')}`;

/**
 * The fixtures board: the systems every tool plugs into (theme, event bus,
 * forms, toasts...), as a second shadow board. Its own style domain gives the
 * whole board a distinct hue from the theme, with no per-tile colors: each
 * tile is a `<Block>`, which follows the domain.
 */
function FixturesBoard({ systems, lastVisited }: { systems: SystemArea[]; lastVisited: string }) {
  return (
    <Card>
      <Card.Header>
        <HStack gap="sm" wrap align="center">
          <h2 id="cat-systems" style={{ margin: 0, fontSize: '1rem' }}>Fixtures — what every tool plugs into</h2>
          <StyleDomainProvider subtheme="info">
            <Badge size="sm">{plural(systems.length, 'fixture')}</Badge>
          </StyleDomainProvider>
        </HStack>
      </Card.Header>
      <Card.Content>
        <VStack gap="md">
          <Text size="sm" tone="secondary">
            The infrastructure you get out of the box: every tool in the crib is wired into these, so an app built from them inherits all of it without writing any of it.
          </Text>
          <StyleDomainProvider subtheme="info">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(10rem, 1fr))', gap: '0.375rem' }}>
              {systems.map((area, i) => (
                <BoardTile
                  key={area.id}
                  href={systemHref(area.id)}
                  part={fixturePart(i)}
                  title={area.title}
                  lastVisited={lastVisited === visitKey('system', area.id)}
                >
                  {area.title}
                </BoardTile>
              ))}
            </div>
          </StyleDomainProvider>
        </VStack>
      </Card.Content>
    </Card>
  );
}

const neighbor = <T,>(list: T[], i: number, toLink: (t: T) => { label: string; href: string }) => ({
  prev: i > 0 ? toLink(list[i - 1]) : undefined,
  next: i < list.length - 1 ? toLink(list[i + 1]) : undefined,
});

/**
 * The Catalog page: the shadow board and Systems list as its index,
 * or one tool's page (`entry`, a manifest component name) or one Systems
 * area's page (`system`, an area id), chosen by the route. Only that one
 * page's live demo is mounted. `demos` is keyed by manifest component name;
 * a component with no key renders as a missing (amber) outline rather than
 * silently disappearing, so a newly added component shows up here
 * automatically the moment it's in the manifest. `featured` highlights a
 * few of the richest demos on the shadow board (name -> one-line reason).
 */
export function Catalog({
  demos,
  systems,
  featured = {},
  entry,
  system,
}: {
  demos: Record<string, EntryDemo>;
  systems: SystemArea[];
  featured?: Record<string, string>;
  entry?: string;
  system?: string;
}) {
  // Before any early return: hooks run on every render.
  const visiting = system !== undefined ? visitKey('system', system) : entry !== undefined ? visitKey('entry', entry) : undefined;
  useEffect(() => {
    if (visiting) writeLastVisited(visiting);
  }, [visiting]);

  if (system !== undefined) {
    const i = systems.findIndex(a => a.id === system);
    if (i < 0) return <NotFound what={`Systems area "${system}"`} />;
    const { prev, next } = neighbor(systems, i, a => ({ label: a.title, href: systemHref(a.id) }));
    return (
      <VStack gap="md">
        <EntryNav trail={['Fixtures', `${fixturePart(i)} · ${systems[i].title}`]} prev={prev} next={next} />
        <SystemCard area={systems[i]} />
      </VStack>
    );
  }

  if (entry !== undefined) {
    const group = byCategory().find(g => g.items.some(c => c.name === entry));
    if (!group) return <NotFound what={`component "${entry}"`} />;
    const i = group.items.findIndex(c => c.name === entry);
    const c = group.items[i];
    const { prev, next } = neighbor(group.items, i, x => ({ label: x.name, href: entryHref(x.name) }));
    return (
      <VStack gap="md">
        <EntryNav trail={[group.category, c.name]} prev={prev} next={next} />
        <CatalogCard component={c} bin={c.bin} demo={demos[c.name]} />
      </VStack>
    );
  }

  const lastVisited = readLastVisited();
  return (
    <VStack gap="lg">
      <EntryNav trail={[]} />
      <ShadowBoard demos={demos} featured={featured} lastVisited={lastVisited} />
      <FixturesBoard systems={systems} lastVisited={lastVisited} />
    </VStack>
  );
}

function NotFound({ what }: { what: string }) {
  return (
    <Card>
      <Card.Content>
        <Text>
          No {what} in the crib. <Link href={INDEX_HREF}>Back to the shadow board</Link>.
        </Text>
      </Card.Content>
    </Card>
  );
}