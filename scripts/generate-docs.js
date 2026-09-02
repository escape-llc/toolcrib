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
 *  - Theme Slices sentence: generated from themeSystem.slices.
 *  - Everything else (Root Setup, Core Principles, Anti-Patterns,
 *    §5/§7/§9 prose, code samples): static template content — no
 *    source-of-truth to derive it from, so it's authored directly in the
 *    .hbs file, not templated.
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
  };
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

  const targets = [
    { filePath: CORE_MD_PATH, content: renderTemplate(TEMPLATE_PATH, assembleTemplateData()), label: 'ai-docs/CORE.md' },
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
    console.log(`Wrote ${targets.length} doc file(s): ai-docs/CORE.md + ${EXAMPLE_TEMPLATES.length} example(s) under ai-docs/examples/.`);
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
    console.log('ai-docs/CORE.md and ai-docs/examples/ all match the templates + source exactly.');
    return;
  }

  console.error(`Doc drift detected in ${drifted.length} file(s):\n  ${drifted.join('\n  ')}`);
  console.error(`Run 'node scripts/generate-docs.js --write' to regenerate, then review the diff.`);
  process.exitCode = 1;
}

main();
