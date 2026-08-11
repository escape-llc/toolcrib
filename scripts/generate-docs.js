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
 * Usage:
 *   node scripts/generate-docs.js            # check mode (default) — exits 1 on drift
 *   node scripts/generate-docs.js --check     # same, explicit
 *   node scripts/generate-docs.js --write     # regenerate ai-docs/CORE.md in full
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
} from './lib/extract.js';
import { toToon } from './lib/toon.js';

const TEMPLATE_PATH = path.join(ROOT, 'ai-docs', 'templates', 'CORE.md.hbs');
const CORE_MD_PATH = path.join(ROOT, 'ai-docs', 'CORE.md');

// Authored "Used By" text per Z_INDEX tier — the tier/value columns are
// generated, this prose isn't. Missing an entry here for a real tier is a
// hard generation error (see assembleZIndexRows), not a silent gap.
const Z_INDEX_USAGE = {
  BASE: 'Cards, Grids, Stacks, Accordion',
  STICKY: 'DataTable headers, sticky Toolbars',
  SPLITTER: 'Splitter resize handles',
  DRAWER: 'SlideOut drawers, Theme Editor',
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
    'emitted by `<AIErrorBoundary>` (used internally by `<Modal>`/`<SlideOut>`) whenever a child throws during render',
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

function render() {
  Handlebars.registerHelper('json', (data) => new Handlebars.SafeString(JSON.stringify(data, null, 2)));
  Handlebars.registerHelper('toon', (rows) => new Handlebars.SafeString(toToon(rows)));

  const templateSource = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  const template = Handlebars.compile(templateSource, { noEscape: true });
  return template(assembleTemplateData());
}

function main() {
  const mode = process.argv.includes('--write') ? 'write' : 'check';
  const generated = render();

  if (mode === 'write') {
    fs.writeFileSync(CORE_MD_PATH, generated);
    console.log('Wrote ai-docs/CORE.md from ai-docs/templates/CORE.md.hbs.');
    return;
  }

  const current = fs.readFileSync(CORE_MD_PATH, 'utf-8');
  if (current === generated) {
    console.log('ai-docs/CORE.md matches the template + source exactly.');
    return;
  }

  console.error('ai-docs/CORE.md drift detected — generated output differs from the committed file.');
  console.error(`Run 'node scripts/generate-docs.js --write' to regenerate, then review the diff.`);
  process.exitCode = 1;
}

main();
