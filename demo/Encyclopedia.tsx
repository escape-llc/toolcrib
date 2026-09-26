import React, { type ReactNode } from 'react';
import manifest from '../ai-docs/component-manifest.json';
import demoSources from './demoSources.generated.json';
import { Card, Badge, Block, Breadcrumb, Collapsible, HStack, VStack, VisuallyHidden } from '#toolcrib';
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
  constraints?: string;
  childComponents?: string[];
  antiPatternAvoid?: string;
  antiPatternInstead?: string;
};

const COMPONENTS = (manifest as unknown as { components: ManifestComponent[] }).components;

/** Every manifest component name, alphabetical -- for per-component "go to" commands. */
export const ENCYCLOPEDIA_COMPONENT_NAMES = COMPONENTS.map(c => c.name).sort((a, b) => a.localeCompare(b));

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
export const entryAnchor = (name: string) => `enc-${name}`;
/** The `id` of a Systems page's `<section>`. */
export const systemAnchor = (id: string) => `enc-sys-${id}`;
/** Link targets (routes, see demo/hashRoute.ts). */
export const entryHref = (name: string) => routeHref({ page: 'encyclopedia', entry: name });
export const systemHref = (id: string) => routeHref({ page: 'encyclopedia', system: id });
const INDEX_HREF = routeHref({ page: 'encyclopedia' });

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

/** One outline per tool, grouped by drawer. A filled tile has its own live demo; a dashed one says why it doesn't. */
function ShadowBoard({ demos, featured }: { demos: Record<string, EntryDemo>; featured: Record<string, string> }) {
  const groups = byCategory();
  const missing = groups.flatMap(g => g.items).filter(c => tileState(demos, featured, c.name) === 'missing');
  return (
    <Card>
      <Card.Header>
        <h2 id="enc-shadow-board" style={{ margin: 0, fontSize: '1rem' }}>Shadow board — every tool in the crib</h2>
      </Card.Header>
      <Card.Content>
        <VStack gap="md">
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>
            {COMPONENTS.length} components, generated from the component manifest. Pick one to open its page. A <strong>★ highlighted</strong> outline is one of the richest demos, a good place to start; a solid outline has its own live demo; a dashed one is shown alongside another tool or is part of this page's own frame
            {missing.length > 0 ? <>; an <strong>amber</strong> outline has no demo yet ({missing.map(c => c.name).join(', ')}).</> : '.'}
          </p>
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
                    <a
                      key={c.name}
                      href={entryHref(c.name)}
                      data-shadow-tile={state}
                      title={hint ? `${c.name} — ${hint}` : c.name}
                      style={{
                        display: 'block',
                        padding: '0.375rem 0.5rem',
                        borderRadius: 'var(--ai-radius-sm, 0.25rem)',
                        fontSize: '0.8125rem',
                        textDecoration: 'none',
                        ...TILE_STYLE[state],
                      }}
                    >
                      <span style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: 'var(--ai-text-secondary)' }}>{c.bin}</span>{' '}
                      {state === 'featured' && <span aria-hidden="true" style={{ color: 'var(--ai-color-accent, #8b5cf6)' }}>★</span>}
                      {c.name}
                      {state === 'featured' && <VisuallyHidden> (featured: {featured[c.name]})</VisuallyHidden>}
                    </a>
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

/** The spec sheet: every prop, straight from the manifest. Collapsed by default -- the live demo is the headline. */
function SpecSheet({ props }: { props: Record<string, ManifestProp> }) {
  const names = Object.keys(props);
  if (names.length === 0) return null;
  return (
    <Collapsible trigger={`Spec sheet — ${names.length} prop${names.length === 1 ? '' : 's'}`}>
      {/* Wide type signatures can overflow at narrow widths; a scroll
          region needs keyboard access (axe: scrollable-region-focusable). */}
      <div tabIndex={0} role="region" aria-label="Spec sheet" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ borderBottom: '0.0625rem solid var(--ai-border)' }}>
              <th scope="col" style={{ textAlign: 'left', padding: '0.25rem 0.5rem 0.25rem 0' }}>Prop</th>
              <th scope="col" style={{ textAlign: 'left', padding: '0.25rem 0.5rem' }}>Type</th>
              <th scope="col" style={{ textAlign: 'left', padding: '0.25rem 0.5rem' }}>Default</th>
              <th scope="col" style={{ textAlign: 'left', padding: '0.25rem 0 0.25rem 0.5rem' }}>Description</th>
            </tr>
          </thead>
          <tbody>
            {names.map(n => {
              const p = props[n];
              return (
                <tr key={n} style={{ borderBottom: '0.0625rem solid var(--ai-border)', verticalAlign: 'top' }}>
                  <td style={{ padding: '0.25rem 0.5rem 0.25rem 0', whiteSpace: 'nowrap' }}>
                    <code style={codeStyle}>{n}</code>
                    {p.required && <span style={{ color: 'var(--ai-subtheme-error-text, #b91c1c)' }}> *</span>}
                  </td>
                  <td style={{ padding: '0.25rem 0.5rem' }}><code style={codeStyle}>{p.type}</code></td>
                  <td style={{ padding: '0.25rem 0.5rem' }}>{p.default ? <code style={codeStyle}>{p.default}</code> : ''}</td>
                  <td style={{ padding: '0.25rem 0 0.25rem 0.5rem', color: 'var(--ai-text-secondary)' }}>{p.description ? md(p.description) : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Collapsible>
  );
}

/**
 * The demo's own source, generated from demo/App.tsx (issue #638) -- the
 * exact JSX running above it. Collapsed by default, like the spec sheet.
 */
function SourceSheet({ source }: { source?: string }) {
  if (!source) return null;
  return (
    <Collapsible trigger="Source — this demo's code">
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--ai-text-secondary)' }}>
        Straight from the demo app, so it can reference the demo's own state and handlers (<code style={codeStyle}>addToast</code>, sample data).
      </p>
      {/* A scroll region needs keyboard access (axe: scrollable-region-focusable). */}
      <pre
        tabIndex={0}
        role="region"
        aria-label="Demo source"
        style={{ margin: 0, maxHeight: '28rem', overflow: 'auto', padding: '0.75rem', background: 'var(--ai-bg-container)', borderRadius: 'var(--ai-radius-sm)' }}
      >
        <code style={{ ...codeStyle, fontSize: '0.75rem' }}>{source}</code>
      </pre>
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
            <p style={{ margin: 0 }}>{md(c.description)}</p>

            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--ai-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pick ticket</div>
              {/* Wraps rather than scrolls: a horizontally-scrollable <code>
                  is a scroll region with no keyboard access (axe:
                  scrollable-region-focusable) -- Form's grouped import is
                  long enough to trigger it. */}
              <code style={{ ...codeStyle, display: 'block', padding: '0.375rem 0.5rem', background: 'var(--ai-bg-container)', borderRadius: 'var(--ai-radius-sm)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.import}</code>
            </div>

            {(c.slots?.length || c.childComponents?.length || c.constraints) && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>
                {c.slots?.length ? (
                  <div>
                    Slots: {c.slots.map((s, i) => <React.Fragment key={s}>{i > 0 && ', '}<code style={codeStyle}>{`${c.name}.${s}`}</code></React.Fragment>)}
                  </div>
                ) : null}
                {c.childComponents?.length ? (
                  <div>
                    Commonly used with:{' '}
                    {c.childComponents.map((s, i) => (
                      <React.Fragment key={s}>
                        {i > 0 && ', '}
                        {COMPONENTS.some(x => x.name === s) ? <a href={entryHref(s)}>{s}</a> : <code style={codeStyle}>{s}</code>}
                      </React.Fragment>
                    ))}
                  </div>
                ) : null}
                {c.constraints ? <div>Constraint: {md(c.constraints)}</div> : null}
              </div>
            )}

            {c.antiPatternAvoid && (
              <Block subtheme="warning" padding="sm" radius="sm">
                <div style={{ fontSize: '0.8125rem' }}>
                  <strong>⚠ Safety placard.</strong> <strong>Don't:</strong> {md(c.antiPatternAvoid)}
                  {c.antiPatternInstead && <><br /><strong>Do:</strong> {md(c.antiPatternInstead)}</>}
                </div>
              </Block>
            )}

            <SpecSheet props={c.props} />

            {isSeeAlso(demo) ? (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>
                Shown in action with <a href={entryHref(demo.seeAlso)}>{demo.seeAlso}</a>.{demo.note ? <> {demo.note}</> : null}
              </p>
            ) : isPageFrame(demo) ? (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>{demo.pageFrame}</p>
            ) : demo === undefined || demo === null ? (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>No live demo yet.</p>
            ) : (
              <>
                <div data-encyclopedia-demo={c.name} style={{ borderTop: '0.0625rem solid var(--ai-border)', paddingTop: '0.75rem' }}>
                  {demo}
                </div>
                <SourceSheet source={DEMO_SOURCES.components[c.name]} />
              </>
            )}
          </VStack>
        </Card.Content>
      </Card>
    </section>
  );
}

const navLinkStyle: React.CSSProperties = { fontSize: '0.8125rem' };

/** Breadcrumb trail plus prev/next within the same drawer (or the Systems list). */
function EntryNav({ trail, prev, next }: { trail: string[]; prev?: { label: string; href: string }; next?: { label: string; href: string } }) {
  return (
    <HStack gap="md" wrap align="center" justify="between">
      <Breadcrumb>
        <Breadcrumb.Item href={INDEX_HREF}>Encyclopedia</Breadcrumb.Item>
        {trail.map(t => <Breadcrumb.Item key={t}>{t}</Breadcrumb.Item>)}
      </Breadcrumb>
      <nav aria-label="Neighboring pages">
        <HStack gap="md">
          {prev && <a href={prev.href} rel="prev" style={navLinkStyle}>← {prev.label}</a>}
          {next && <a href={next.href} rel="next" style={navLinkStyle}>{next.label} →</a>}
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
            <p style={{ margin: 0 }}>{area.summary}</p>
            {area.parts?.length ? (
              <div style={{ fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>
                Parts: {area.parts.map((p, i) => <React.Fragment key={p}>{i > 0 && ', '}<code style={codeStyle}>{p}</code></React.Fragment>)}
              </div>
            ) : null}
            {area.demo && (
              <>
                <div style={{ borderTop: '0.0625rem solid var(--ai-border)', paddingTop: '0.75rem' }}>{area.demo}</div>
                <SourceSheet source={DEMO_SOURCES.systems[area.id]} />
              </>
            )}
          </VStack>
        </Card.Content>
      </Card>
    </section>
  );
}

/** The Systems list on the index page: one link per area. */
function SystemsIndex({ systems }: { systems: SystemArea[] }) {
  return (
    <Card>
      <Card.Header>
        <h2 id="enc-systems" style={{ margin: 0, fontSize: '1rem' }}>Systems — what every tool is wired into</h2>
      </Card.Header>
      <Card.Content>
        <VStack gap="sm">
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>
            The infrastructure you get out of the box: every component plugs into these, so an app built from them inherits all of it without writing any of it.
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {systems.map(area => (
              <li key={area.id}>
                <a href={systemHref(area.id)}>{area.title}</a>
              </li>
            ))}
          </ul>
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
 * The Encyclopedia page: the shadow board and Systems list as its index,
 * or one tool's page (`entry`, a manifest component name) or one Systems
 * area's page (`system`, an area id), chosen by the route. Only that one
 * page's live demo is mounted. `demos` is keyed by manifest component name;
 * a component with no key renders as a missing (amber) outline rather than
 * silently disappearing, so a newly added component shows up here
 * automatically the moment it's in the manifest. `featured` highlights a
 * few of the richest demos on the shadow board (name -> one-line reason).
 */
export function Encyclopedia({
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
  if (system !== undefined) {
    const i = systems.findIndex(a => a.id === system);
    if (i < 0) return <NotFound what={`Systems area "${system}"`} />;
    const { prev, next } = neighbor(systems, i, a => ({ label: a.title, href: systemHref(a.id) }));
    return (
      <VStack gap="md">
        <EntryNav trail={['Systems', systems[i].title]} prev={prev} next={next} />
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

  return (
    <VStack gap="lg">
      <ShadowBoard demos={demos} featured={featured} />
      <SystemsIndex systems={systems} />
    </VStack>
  );
}

function NotFound({ what }: { what: string }) {
  return (
    <Card>
      <Card.Content>
        <p style={{ margin: 0 }}>
          No {what} in the crib. <a href={INDEX_HREF}>Back to the shadow board</a>.
        </p>
      </Card.Content>
    </Card>
  );
}