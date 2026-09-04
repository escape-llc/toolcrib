#!/usr/bin/env node
/**
 * Renders ai-docs/templates/CORE.md.hbs into ai-docs/CORE.md, using the
 * same source-derived data as scripts/generate-manifest.js (via
 * scripts/lib/extract.js) — so the two documents can't independently drift
 * from source, or from each other, the way CORE.md's hand-written
 * Component Reference / Theme Slices / Event Bus tables previously could
 * (confirmed: CORE.md was missing 9 of 32 real event channels and 4 of 20
 * real components before this generator existed).
 *
 * What's generated vs. authored:
 *  - Component Reference tables: fully generated from
 *    extract.js's generateComponents() (name/slots/props/description),
 *    grouped by the required `@manifestCategory` tag. Deliberately uniform
 *    columns across all five categories (Component/Slots/Props/
 *    Description) rather than the old hand-written per-category column
 *    sets (e.g. Overlays' old "Bus Events" column) — the manifest has no
 *    structured "which events does component X emit" field to render
 *    that from without inventing a second authored mapping; the
 *    trade-off is intentional, not an oversight.
 *  - Z-Index table: Tier/Value generated from zIndexScale; "Used By" is
 *    authored in Z_INDEX_USAGE below (mirrors MANUAL_IMPORT_OVERRIDES'
 *    pattern in extract.js) — generation fails outright if a tier is
 *    missing an entry, so the *structure* can't silently drift even
 *    though the *prose* is still hand-written.
 *  - Event Bus table: name/payload generated from eventBus.channels;
 *    a handful of channels get an authored extra note (EVENT_NOTES
 *    below), same pattern as Z_INDEX_USAGE.
 *  - Anti-Patterns table (§3): a handful of rows with no single owning
 *    component (a structural convention, or a small set of components
 *    sharing one combined message with no natural per-component split)
 *    are authored in STATIC_ANTI_PATTERNS below; the rest are generated
 *    from any component carrying BOTH `@manifestAntiPatternAvoid` and
 *    `@manifestAntiPatternInstead` — closes the same "shipped with a
 *    @manifest tag but no corresponding doc row" gap the Component
 *    Reference/Event Bus tables were built to close (see AGENTS.md).
 *  - Theme Slices sentence: generated from themeSystem.slices.
 *  - Everything else (Root Setup, Core Principles, §5/§7/§9 prose, code
 *    samples): static template content — no source-of-truth to derive it
 *    from, so it's authored directly in the .hbs file, not templated.
 *
 * Also renders ai-docs/templates/examples/*.md.hbs into ai-docs/examples/
 * — narrative walkthroughs of the toolkit's bespoke, no-training-data-prior
 * mechanisms (overrides+StyleDomain composition, event bus sticky replay,
 * the z-index scale, Splitter's imperative bus command). The prose is
 * hand-authored (no source-of-truth to derive a "why" from), but each
 * template interpolates the specific facts it quotes (a prop's type, an
 * event's payload, a Z_INDEX value) from the same extract.js data as
 * everything above, so a renamed prop/event/tier fails `--check` instead
 * of silently leaving the example stale.
 *
 * Also renders llms.txt and llms-full.txt at the repo root (alongside
 * README.md/LICENSE, not under ai-docs/ — matches the llms.txt spec's
 * site-root expectation; there's no hosted docs site to nest under).
 * These are a different audience than everything else this file renders:
 * ai-docs/ is aimed at an AI that has *already* vendored toolcrib into a
 * consumer app and needs usage guidance; llms.txt is aimed at an LLM
 * encountering the toolcrib project itself for the first time (a search, a
 * GitHub browse, an agent doing research) — pre-adoption discovery, not
 * post-adoption reference. llms.txt itself follows the llmstxt.org spec
 * (H1, one blockquote summary, H2-sectioned link lists, a specially-named
 * `## Optional` section for droppable-when-context-is-limited links) via
 * ai-docs/templates/llms-txt.hbs, with a handful of source-derived facts
 * (component count, category list, event channel count) interpolated in so
 * the summary can't silently drift the way README.md's own hand-typed
 * component count already could (a separate, pre-existing risk this
 * doesn't fix). llms-full.txt has no template at all — it's the
 * community-convention "everything inlined in one file" companion (not
 * part of the formal spec), built by pure concatenation of already-
 * generated/authored content (README.md + this run's own CORE.md render +
 * NEW_APP.md + REFACTOR_APP.md) rather than authoring prose a third time.
 *
 * Usage:
 *   node scripts/generate-docs.js            # check mode (default) — exits 1 on drift
 *   node scripts/generate-docs.js --check     # same, explicit
 *   node scripts/generate-docs.js --write     # regenerate ai-docs/CORE.md + ai-docs/examples/*.md in full
 */
import fs from 'node:fs';
import path from 'node:path';
import Handlebars from 'handlebars';
import {
  ROOT,
  generateZIndexScale,
  generateThemeSlices,
  generateEventChannels,
  generateComponents,
  VALID_CATEGORIES,
  CATEGORY_SLUGS,
} from './lib/extract.js';
import { toToon } from './lib/toon.js';

const TEMPLATE_PATH = path.join(ROOT, 'ai-docs', 'templates', 'CORE.md.hbs');
const CORE_MD_PATH = path.join(ROOT, 'ai-docs', 'CORE.md');
const EXAMPLES_TEMPLATE_DIR = path.join(ROOT, 'ai-docs', 'templates', 'examples');
const EXAMPLES_OUTPUT_DIR = path.join(ROOT, 'ai-docs', 'examples');

const LLMS_TXT_TEMPLATE_PATH = path.join(ROOT, 'ai-docs', 'templates', 'llms-txt.hbs');
const LLMS_TXT_PATH = path.join(ROOT, 'llms.txt');
const LLMS_FULL_TXT_PATH = path.join(ROOT, 'llms-full.txt');
const README_PATH = path.join(ROOT, 'README.md');
const NEW_APP_PATH = path.join(ROOT, 'ai-docs', 'NEW_APP.md');
const REFACTOR_APP_PATH = path.join(ROOT, 'ai-docs', 'REFACTOR_APP.md');

// Authored "Used By" text per Z_INDEX tier — the tier/value columns are
// generated, this prose isn't. Missing an entry here for a real tier is a
// hard generation error (see assembleZIndexRows), not a silent gap.
const Z_INDEX_USAGE = {
  BASE: 'Cards, Grids, Stacks, Accordion',
  STICKY: 'DataTable headers, sticky Toolbars',
  SPLITTER: 'Splitter resize handles',
  DRAWER: 'Drawer panels, Theme Editor',
  MODAL: 'Modal dialogs',
  DROPDOWN: 'Select dropdowns, Popup, DropdownMenu',
  TOOLTIP: 'Tooltip overlays',
  TOAST: 'Toast notifications',
};

// Authored extra context for a handful of event channels whose meaning
// isn't fully captured by name + payload type alone. Optional — most
// channels have none.
const EVENT_NOTES = {
  'tab:changed':
    '`id` is the `<TabStrip id>` group identifier; sticky (see above), so a `<TabStrip.Panel>` mounted after this fires still gets the current value replayed to it',
  'error:boundary':
    'emitted by `<AIErrorBoundary>` (used internally by `<Modal>`/`<Drawer>`) whenever a child throws during render',
  'route:navigate':
    'a one-shot imperative navigation command, deliberately not sticky; forwarded to a real router via `<RouterAdapterProvider>`/`useRouterBridge()` — see the router-integration example',
};

// Authored rows for anti-patterns with no single owning component — a
// structural convention (ToolcribProvider deliberately has no @manifest
// tag, matching ThemeProvider/ToastProvider's own carve-out, so it can't
// be scanned), a genuine cross-cutting principle owned by no one
// component (z-index/px-vs-rem/color-variables/prop-drilling/style-
// className), or a set of components sharing one combined message with
// no natural per-component split (Modal/Drawer/Popup all equally "manage
// overlay state, portal correctly, use Z_INDEX" — three near-duplicate
// generated rows would be a regression from the one coherent row below,
// not an improvement). Concatenated with the generated, component-derived
// rows in assembleAntiPatternRows() below into one uniform list — mirrors
// Z_INDEX_USAGE/EVENT_NOTES' own "authored prose merged into a row object
// before the template runs" pattern; nowhere in this codebase does a
// Handlebars table mix raw static Markdown rows with a separate {{#each}}
// block for the same table.
const STATIC_ANTI_PATTERNS = [
  {
    avoid: 'Manually wire `<ThemeProvider>` + `<ToastProvider>` + `<ToastContainer>` at the app root',
    instead: "Use `<ToolcribProvider>` — composes all three in the correct order, so there's no separate `<ToastContainer>` to forget (see §1)",
  },
  {
    avoid: 'Manually manage overlay open/close with `useState`, create custom popup/modal/drawer components, or use `position: fixed` with manual z-index',
    instead: 'Let `<Modal>`, `<Drawer>`, `<Popup>` manage state internally (or use `aiBus.openModal(id)`) — they portal correctly, handle focus traps/backdrop/light dismiss, and already use the `Z_INDEX` scale',
  },
  {
    avoid: 'Hardcode `z-index` values',
    instead: "Use the `Z_INDEX` scale: `import { Z_INDEX } from '#toolcrib'`",
  },
  {
    avoid: 'Use `px` units for spacing, borders, radii',
    instead: 'Use `rem` values. Only `--ai-master-font-size` is in `px`',
  },
  {
    avoid: 'Hardcode colour values (hex, rgb)',
    instead: 'Use CSS variables: `var(--ai-color-primary)`, `var(--ai-subtheme-error)`',
  },
  {
    avoid: 'Prop-drill callbacks through component trees',
    instead: 'Use `aiBus.emit()` / `useAIEvent()` for cross-tree communication',
  },
  {
    avoid: 'Pass `style={{...}}` or `className="..."` to a toolcrib component',
    instead:
      "Use that component's `overrides` prop (§9) if it has theme-controlled axes; if what you need genuinely isn't one of them, a plain `<div>` is still fine — `<Block>` is the same escape hatch with theme-aware background/padding/radius/border defaults",
  },
];

function assembleZIndexRows() {
  const scale = generateZIndexScale();
  return Object.entries(scale).map(([tier, value]) => {
    const usedBy = Z_INDEX_USAGE[tier];
    if (usedBy === undefined) {
      throw new Error(`generate-docs.js: Z_INDEX tier '${tier}' has no Z_INDEX_USAGE entry — add one.`);
    }
    return { tier, value, usedBy };
  });
}

function assembleEventChannelRows() {
  return generateEventChannels().map(({ name, payload }) => ({
    name,
    payload,
    note: EVENT_NOTES[name] ?? null,
  }));
}

function assembleAntiPatternRows() {
  const generated = generateComponents()
    .filter((c) => c.antiPatternAvoid && c.antiPatternInstead)
    .map((c) => ({ avoid: c.antiPatternAvoid, instead: c.antiPatternInstead }));
  // Static rows first (foundational/structural principles), generated
  // rows after in generateComponents()'s own deterministic (alphabetical
  // by component name) order — same ordering discipline as every other
  // generated list in this file.
  return [...STATIC_ANTI_PATTERNS, ...generated];
}

function assembleComponentsByCategory() {
  const components = generateComponents();
  const rows = components.map((c) => ({
    name: c.name,
    slots: c.slots && c.slots.length > 0 ? c.slots.map((s) => `\`.${s}\``).join(', ') : '—',
    props: c.props && Object.keys(c.props).length > 0 ? Object.keys(c.props).map((p) => `\`${p}\``).join(', ') : '—',
    description: c.description,
    category: c.category,
  }));
  return VALID_CATEGORIES.map((category) => ({
    category,
    slug: CATEGORY_SLUGS[category],
    components: rows.filter((r) => r.category === category),
  }));
}

function assembleTemplateData() {
  return {
    componentsByCategory: assembleComponentsByCategory(),
    zIndexRows: assembleZIndexRows(),
    themeSliceIdList: generateThemeSlices()
      .map((s) => `\`${s.id}\``)
      .join(', '),
    eventChannelRows: assembleEventChannelRows(),
    eventChannelsToon: toToon(generateEventChannels()),
    antiPatternRows: assembleAntiPatternRows(),
  };
}

function assembleLlmsTxtData() {
  return {
    componentCount: generateComponents().length,
    categoryList: VALID_CATEGORIES.join(', '),
    eventChannelCount: generateEventChannels().length,
  };
}

// llms-full.txt has no template of its own -- pure concatenation of
// already-generated/authored content. Takes coreMdContent as a parameter
// (rather than re-rendering CORE.md.hbs itself) so there's exactly one
// render of CORE.md per run and both outputs are guaranteed to embed the
// identical content, not two independently-computed renders that could
// theoretically diverge.
// Labeled dividers, not a bare `---` -- CORE.md already uses bare `---` for
// its own internal section breaks, so an unlabeled one here would be
// ambiguous between "a new source document starts here" and "just another
// internal section break."
function llmsFullSection(sourceFile, content) {
  return `<!-- ===== ${sourceFile} ===== -->\n\n${content.trim()}`;
}

function assembleLlmsFullTxt(coreMdContent) {
  const readme = fs.readFileSync(README_PATH, 'utf-8');
  const newApp = fs.readFileSync(NEW_APP_PATH, 'utf-8');
  const refactorApp = fs.readFileSync(REFACTOR_APP_PATH, 'utf-8');
  return [
    llmsFullSection('README.md', readme),
    llmsFullSection('ai-docs/CORE.md', coreMdContent),
    llmsFullSection('ai-docs/NEW_APP.md', newApp),
    llmsFullSection('ai-docs/REFACTOR_APP.md', refactorApp),
    '',
  ].join('\n\n');
}

// -------------------------------------------------------------------------
// ai-docs/examples/ — one small, flat, named-field data object per
// template, mirroring assembleZIndexRows/assembleEventChannelRows/
// assembleComponentsByCategory's own shape above rather than passing raw
// arrays into the template and reaching for Handlebars' generic `lookup`
// helper. Each function pulls only the specific fact its example quotes.
// -------------------------------------------------------------------------

function assembleOverridesExampleFacts() {
  const components = generateComponents();
  const card = components.find((c) => c.name === 'Card');
  const progress = components.find((c) => c.name === 'Progress');
  return {
    cardOverridesType: card.props.overrides.type,
    progressSubthemeType: progress.props.subtheme.type,
  };
}

function assembleEventBusExampleFacts() {
  const tabChanged = generateEventChannels().find((c) => c.name === 'tab:changed');
  return {
    tabChangedPayload: tabChanged.payload,
  };
}

function assembleZIndexExampleFacts() {
  return {
    zIndexModalValue: generateZIndexScale().MODAL,
  };
}

function assembleSplitterExampleFacts() {
  const splitChanged = generateEventChannels().find((c) => c.name === 'splitter:split_changed');
  return {
    splitterSplitChangedPayload: splitChanged.payload,
  };
}

function assembleRouterExampleFacts() {
  const routeNavigate = generateEventChannels().find((c) => c.name === 'route:navigate');
  return {
    routeNavigatePayload: routeNavigate.payload,
  };
}

function assembleWildcardExampleFacts() {
  const elementResized = generateEventChannels().find((c) => c.name === 'element:resized');
  return {
    elementResizedPayload: elementResized.payload,
  };
}

function assembleAuthExampleFacts() {
  const authUnauthorized = generateEventChannels().find((c) => c.name === 'auth:unauthorized');
  return {
    authUnauthorizedPayload: authUnauthorized.payload,
  };
}

// No source-derived facts to interpolate — every code sample in this one
// is hand-written and static (unlike the event-payload examples above).
function assembleSSRThemeExampleFacts() {
  return {};
}

// Same reasoning as assembleSSRThemeExampleFacts — LocaleProvider isn't a
// manifest component and carries no per-event fact worth interpolating.
function assembleLocaleExampleFacts() {
  return {};
}

// file: under ai-docs/templates/examples/, rendered to the same basename
// (minus .hbs) under ai-docs/examples/. data: this template's own small
// assembler from above — never the shared assembleTemplateData(), since
// each example only needs a couple of specific facts, not everything
// CORE.md renders.
const EXAMPLE_TEMPLATES = [
  { file: 'overrides-and-style-domains.md.hbs', data: assembleOverridesExampleFacts },
  { file: 'event-bus-sticky-replay.md.hbs', data: assembleEventBusExampleFacts },
  { file: 'z-index-scale.md.hbs', data: assembleZIndexExampleFacts },
  { file: 'splitter-bus-command.md.hbs', data: assembleSplitterExampleFacts },
  { file: 'router-integration.md.hbs', data: assembleRouterExampleFacts },
  { file: 'wildcard-event-monitoring.md.hbs', data: assembleWildcardExampleFacts },
  { file: 'auth-unauthorized.md.hbs', data: assembleAuthExampleFacts },
  { file: 'ssr-theme-injection.md.hbs', data: assembleSSRThemeExampleFacts },
  { file: 'locale-provider.md.hbs', data: assembleLocaleExampleFacts },
];

function renderTemplate(templatePath, data) {
  const templateSource = fs.readFileSync(templatePath, 'utf-8');
  const template = Handlebars.compile(templateSource, { noEscape: true });
  return template(data);
}

function main() {
  Handlebars.registerHelper('json', (data) => new Handlebars.SafeString(JSON.stringify(data, null, 2)));
  Handlebars.registerHelper('toon', (rows) => new Handlebars.SafeString(toToon(rows)));

  const mode = process.argv.includes('--write') ? 'write' : 'check';

  const coreMdContent = renderTemplate(TEMPLATE_PATH, assembleTemplateData());

  const targets = [
    { filePath: CORE_MD_PATH, content: coreMdContent, label: 'ai-docs/CORE.md' },
    { filePath: LLMS_TXT_PATH, content: renderTemplate(LLMS_TXT_TEMPLATE_PATH, assembleLlmsTxtData()), label: 'llms.txt' },
    { filePath: LLMS_FULL_TXT_PATH, content: assembleLlmsFullTxt(coreMdContent), label: 'llms-full.txt' },
    ...EXAMPLE_TEMPLATES.map(({ file, data }) => ({
      filePath: path.join(EXAMPLES_OUTPUT_DIR, file.replace(/\.hbs$/, '')),
      content: renderTemplate(path.join(EXAMPLES_TEMPLATE_DIR, file), data()),
      label: `ai-docs/examples/${file.replace(/\.hbs$/, '')}`,
    })),
  ];

  if (mode === 'write') {
    fs.mkdirSync(EXAMPLES_OUTPUT_DIR, { recursive: true });
    for (const target of targets) {
      fs.writeFileSync(target.filePath, target.content);
    }
    console.log(`Wrote ${targets.length} doc file(s): ai-docs/CORE.md + llms.txt + llms-full.txt + ${EXAMPLE_TEMPLATES.length} example(s) under ai-docs/examples/.`);
    return;
  }

  const drifted = [];
  for (const target of targets) {
    if (!fs.existsSync(target.filePath)) {
      drifted.push(`${target.label} (missing)`);
      continue;
    }
    const current = fs.readFileSync(target.filePath, 'utf-8');
    if (current !== target.content) drifted.push(target.label);
  }

  if (drifted.length === 0) {
    console.log('ai-docs/CORE.md, llms.txt, llms-full.txt, and ai-docs/examples/ all match the templates + source exactly.');
    return;
  }

  console.error(`Doc drift detected in ${drifted.length} file(s):\n  ${drifted.join('\n  ')}`);
  console.error(`Run 'node scripts/generate-docs.js --write' to regenerate, then review the diff.`);
  process.exitCode = 1;
}

main();
