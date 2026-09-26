import React, { type ReactNode } from 'react';
import manifest from '../ai-docs/component-manifest.json';
import { Card, Badge, Block, Collapsible, HStack, VStack } from '#toolcrib';

// The demo's single component page (issue #624), organized like a physical
// tool crib: a shadow board up top (one outline per tool, so a missing
// demo is visible at a glance), then drawers (the five @manifestCategory
// groups) of catalog cards. Every fact on a card -- description, pick
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

export const entryAnchor = (name: string) => `enc-${name}`;
const categoryAnchor = (category: string) => `enc-drawer-${CATEGORY_CODE[category]}`;
export const SYSTEMS_ANCHOR = 'enc-systems';

function byCategory(): { category: string; items: (ManifestComponent & { bin: string })[] }[] {
  return CATEGORY_ORDER.map(category => {
    const items = COMPONENTS.filter(c => c.category === category)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c, i) => ({ ...c, bin: `${CATEGORY_CODE[category]}-${String(i + 1).padStart(2, '0')}` }));
    return { category, items };
  });
}

type TileState = 'demo' | 'via' | 'frame' | 'missing';

function tileState(demos: Record<string, EntryDemo>, name: string): TileState {
  const d = demos[name];
  if (d === undefined || d === null) return 'missing';
  if (isSeeAlso(d)) return 'via';
  if (isPageFrame(d)) return 'frame';
  return 'demo';
}

const TILE_STYLE: Record<TileState, React.CSSProperties> = {
  demo: { background: 'var(--ai-bg-surface, #ffffff)', border: '0.0625rem solid var(--ai-border, #d1d5db)', color: 'var(--ai-text-primary, #111827)' },
  via: { background: 'var(--ai-bg-surface, #ffffff)', border: '0.0625rem dashed var(--ai-border, #d1d5db)', color: 'var(--ai-text-primary, #111827)' },
  frame: { background: 'transparent', border: '0.0625rem dashed var(--ai-border, #d1d5db)', color: 'var(--ai-text-secondary, #6b7280)' },
  missing: { background: 'transparent', border: '0.125rem dashed var(--ai-subtheme-warning, #f59e0b)', color: 'var(--ai-text-secondary, #6b7280)' },
};

const TILE_HINT: Record<TileState, string> = {
  demo: '',
  via: 'shown with another tool',
  frame: 'this page is built with it',
  missing: 'no demo yet',
};

/** One outline per tool, grouped by drawer. A filled tile has its own live demo; a dashed one says why it doesn't. */
function ShadowBoard({ demos }: { demos: Record<string, EntryDemo> }) {
  const groups = byCategory();
  const missing = groups.flatMap(g => g.items).filter(c => tileState(demos, c.name) === 'missing');
  return (
    <Card>
      <Card.Header>
        <h2 id="enc-shadow-board" style={{ margin: 0, fontSize: '1rem' }}>Shadow board — every tool in the crib</h2>
      </Card.Header>
      <Card.Content>
        <VStack gap="md">
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>
            {COMPONENTS.length} components, generated from the component manifest. A solid outline has its own live demo below; a dashed one is shown alongside another tool or is part of this page's own frame
            {missing.length > 0 ? <>; an <strong>amber</strong> outline has no demo yet ({missing.map(c => c.name).join(', ')}).</> : '.'}
          </p>
          {groups.map(({ category, items }) => (
            <div key={category}>
              <a href={`#${categoryAnchor(category)}`} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', textDecoration: 'none' }}>
                {CATEGORY_CODE[category]} · {category}
              </a>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(8.5rem, 1fr))', gap: '0.375rem', marginTop: '0.375rem' }}>
                {items.map(c => {
                  const state = tileState(demos, c.name);
                  return (
                    <a
                      key={c.name}
                      href={`#${entryAnchor(c.name)}`}
                      data-shadow-tile={state}
                      title={TILE_HINT[state] ? `${c.name} — ${TILE_HINT[state]}` : c.name}
                      style={{
                        display: 'block',
                        padding: '0.375rem 0.5rem',
                        borderRadius: 'var(--ai-radius-sm, 0.25rem)',
                        fontSize: '0.8125rem',
                        textDecoration: 'none',
                        ...TILE_STYLE[state],
                      }}
                    >
                      <span style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: 'var(--ai-text-secondary)' }}>{c.bin}</span> {c.name}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
          <a href={`#${SYSTEMS_ANCHOR}`} style={{ fontSize: '0.8125rem' }}>
            Systems — the infrastructure every tool is wired into →
          </a>
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

function CatalogCard({ component, bin, demo }: { component: ManifestComponent; bin: string; demo: EntryDemo }) {
  const c = component;
  return (
    <section id={entryAnchor(c.name)} aria-labelledby={`${entryAnchor(c.name)}-title`} style={{ scrollMarginTop: '0.5rem' }}>
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
                        {COMPONENTS.some(x => x.name === s) ? <a href={`#${entryAnchor(s)}`}>{s}</a> : <code style={codeStyle}>{s}</code>}
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
                Shown in action with <a href={`#${entryAnchor(demo.seeAlso)}`}>{demo.seeAlso}</a>.{demo.note ? <> {demo.note}</> : null}
              </p>
            ) : isPageFrame(demo) ? (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>{demo.pageFrame}</p>
            ) : demo === undefined || demo === null ? (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>No live demo yet.</p>
            ) : (
              <div data-encyclopedia-demo={c.name} style={{ borderTop: '0.0625rem solid var(--ai-border)', paddingTop: '0.75rem' }}>
                {demo}
              </div>
            )}
          </VStack>
        </Card.Content>
      </Card>
    </section>
  );
}

/**
 * The Encyclopedia page body: shadow board, the five drawers of catalog
 * cards, then Systems. `demos` is keyed by manifest component name; a
 * component with no key renders as a missing (amber) outline rather than
 * silently disappearing, so a newly added component shows up here
 * automatically the moment it's in the manifest.
 */
export function Encyclopedia({ demos, systems }: { demos: Record<string, EntryDemo>; systems: SystemArea[] }) {
  const groups = byCategory();
  return (
    <VStack gap="lg">
      <ShadowBoard demos={demos} />

      {groups.map(({ category, items }) => (
        <section key={category} id={categoryAnchor(category)} aria-labelledby={`${categoryAnchor(category)}-title`}>
          <VStack gap="md">
            <h2 id={`${categoryAnchor(category)}-title`} style={{ margin: 0, fontSize: '1.125rem' }}>
              <span style={{ fontFamily: 'monospace', color: 'var(--ai-text-secondary)', fontSize: '0.875rem' }}>{CATEGORY_CODE[category]}</span> {category}
            </h2>
            {items.map(c => (
              <CatalogCard key={c.name} component={c} bin={c.bin} demo={demos[c.name]} />
            ))}
          </VStack>
        </section>
      ))}

      <section id={SYSTEMS_ANCHOR} aria-labelledby={`${SYSTEMS_ANCHOR}-title`}>
        <VStack gap="md">
          <h2 id={`${SYSTEMS_ANCHOR}-title`} style={{ margin: 0, fontSize: '1.125rem' }}>Systems — what every tool is wired into</h2>
          <p style={{ margin: 0, color: 'var(--ai-text-secondary)' }}>
            The infrastructure you get out of the box: every component above plugs into these, so an app built from them inherits all of it without writing any of it.
          </p>
          {systems.map(area => (
            <section key={area.id} id={`enc-sys-${area.id}`} aria-labelledby={`enc-sys-${area.id}-title`} style={{ scrollMarginTop: '0.5rem' }}>
              <Card>
                <Card.Header>
                  <h3 id={`enc-sys-${area.id}-title`} style={{ margin: 0, fontSize: '1rem' }}>{area.title}</h3>
                </Card.Header>
                <Card.Content>
                  <VStack gap="sm">
                    <p style={{ margin: 0 }}>{area.summary}</p>
                    {area.parts?.length ? (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>
                        Parts: {area.parts.map((p, i) => <React.Fragment key={p}>{i > 0 && ', '}<code style={codeStyle}>{p}</code></React.Fragment>)}
                      </div>
                    ) : null}
                    {area.demo && <div style={{ borderTop: '0.0625rem solid var(--ai-border)', paddingTop: '0.75rem' }}>{area.demo}</div>}
                  </VStack>
                </Card.Content>
              </Card>
            </section>
          ))}
        </VStack>
      </section>
    </VStack>
  );
}
