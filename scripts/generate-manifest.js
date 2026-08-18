#!/usr/bin/env node
/**
 * Generates the ENTIRE ai-docs/component-manifest.json from source, using
 * the TypeScript Compiler API (via scripts/lib/extract.js) to read
 * structure and JSDoc directly off the source of truth — the same
 * motivation as build-release.js's peerDependency scan: a hand-maintained
 * manifest drifts from an AI-edited codebase silently, this doesn't.
 *
 * All the actual source-parsing lives in scripts/lib/extract.js, shared
 * with scripts/generate-docs.js (ai-docs/CORE.md's generator) so the two
 * outputs read source exactly once, conceptually, and can't disagree with
 * each other about what's true.
 *
 * Section -> source of truth (see extract.js's own functions for exactly
 * how each is derived):
 *  - name/version:        root package.json
 *  - $schema/description: fixed constants below (describe the manifest
 *                          itself, not derived from application source)
 *  - themeSystem.colorSpace: fixed constant (an architectural fact with no
 *                          single canonical source location to derive from)
 *  - themeSystem.supportedHarmonies: the `HarmonyMode` union type in
 *                          src/theme/harmonies.ts
 *  - themeSystem.cssVariables: every `--ai-*` custom property referenced
 *                          anywhere under src/theme/ or src/components/
 *  - themeSystem.slices:   every `globalThemeSliceRegistry.register(X)`
 *                          call in src/theme/themeContext.tsx, resolved to
 *                          each `X`'s own `id`/`name` fields
 *  - zIndexScale:          the `Z_INDEX` object in src/theme/zIndex.ts
 *  - eventBus.singleton/hookName: verified (not just assumed) to exist as
 *                          `aiBus`/`useAIEvent` exports
 *  - eventBus.channels:    the `AIEventMap` interface in src/eventBus/eventBus.ts
 *  - eventBus.helperMethods: public methods on the `AIEventBus` class
 *                          (excluding on/off/emit) — "emits" is read from
 *                          the first `this.emit(...)` call in the method
 *                          body, "returns" from an `@manifestReturns` tag
 *  - components:           every `export const X: React.FC<...>` /
 *                          `export function X(...)` carrying an
 *                          `@manifest <description>` JSDoc tag, plus a
 *                          required `@manifestCategory` (generation fails
 *                          outright if either is missing/invalid, or if a
 *                          component's own props re-declare `style`/
 *                          `className` — see extract.js's
 *                          validateCategories/validateNoForbiddenProps)
 *
 * See ai-docs/CORE.md / AGENTS.md for the JSDoc tag conventions a new
 * component needs to show up here at all (`@manifest` is the load-bearing
 * one — no tag, no manifest entry, silently).
 *
 * Also writes/checks a per-@manifestCategory split of `components`/`$defs`
 * under ai-docs/manifest/<slug>.json — same data, scoped to one category,
 * so an agent working in e.g. Data Display doesn't have to load every
 * other category's prop detail just to check one component's exact type.
 * Pure filtering over the same in-memory data above; no new source parsing.
 *
 * Usage:
 *   node scripts/generate-manifest.js            # check mode (default) — exits 1 on drift
 *   node scripts/generate-manifest.js --check     # same, explicit
 *   node scripts/generate-manifest.js --write     # regenerate component-manifest.json + the category split, in full
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT,
  VALID_CATEGORIES,
  CATEGORY_SLUGS,
  generateZIndexScale,
  generateSupportedHarmonies,
  generateCssVariables,
  generateThemeSlices,
  generateEventBusMeta,
  generateEventChannels,
  generateHelperMethods,
  generateComponents,
  getCollectedTypeDefs,
} from './lib/extract.js';

const MANIFEST_PATH = path.join(ROOT, 'ai-docs', 'component-manifest.json');
const MANIFEST_SPLIT_DIR = path.join(ROOT, 'ai-docs', 'manifest');

// Meta-descriptive text about the manifest document itself — not a
// property of application source, so there's nothing to derive this from.
const SCHEMA_URL = 'https://json-schema.org/draft/2020-12/schema';
const MANIFEST_DESCRIPTION = 'AI-consumable component manifest for React UI toolkit. All units are rem unless noted.';
// An architectural fact ("this toolkit computes color in HSV"), not a
// value that lives at any single, extractable source location.
const COLOR_SPACE = 'HSV';

function categorySplitDescription(category) {
  return (
    `Per-category slice of component-manifest.json's "components" array (category: ${category}), ` +
    `for on-demand detail without loading the full manifest. See component-manifest.json for ` +
    `themeSystem/zIndexScale/eventBus and cross-category data.`
  );
}

function buildManifestSplitPointer() {
  return {
    note:
      'Full component detail is also available split by @manifestCategory under ai-docs/manifest/<slug>.json ' +
      '— smaller to load when only one category is needed.',
    categories: Object.fromEntries(VALID_CATEGORIES.map((c) => [c, `manifest/${CATEGORY_SLUGS[c]}.json`])),
  };
}

/**
 * Filter the root manifest's `components`/`$defs` down to one
 * manifest-shaped object per category. A `$defs` entry is included in a
 * category's file if its name appears anywhere (whole-word) in that
 * category's own filtered components' serialized JSON — cheap and
 * correct-by-construction (can never miss a real reference), at the small,
 * accepted cost of occasionally over-including a def whose name happens to
 * also appear in an unrelated prop's prose. A missed reference would be a
 * real bug; a few stray extra bytes are not.
 */
function splitByCategory(manifest) {
  const defs = manifest.$defs ?? {};
  const result = {};
  for (const category of VALID_CATEGORIES) {
    const categoryComponents = manifest.components.filter((c) => c.category === category);
    const categoryText = JSON.stringify(categoryComponents);
    const categoryDefs = {};
    for (const [defName, defBody] of Object.entries(defs)) {
      if (new RegExp(`\\b${defName}\\b`).test(categoryText)) categoryDefs[defName] = defBody;
    }
    result[CATEGORY_SLUGS[category]] = {
      $schema: SCHEMA_URL,
      name: manifest.name,
      version: manifest.version,
      description: categorySplitDescription(category),
      category,
      components: categoryComponents,
      ...(Object.keys(categoryDefs).length > 0 ? { $defs: categoryDefs } : {}),
    };
  }
  return result;
}

function generateManifest() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
  const eventBusMeta = generateEventBusMeta();
  const components = generateComponents();
  // Must be read after generateComponents() -- it's populated as a side
  // effect of that call (see extract.js's getCollectedTypeDefs comment).
  const defs = getCollectedTypeDefs();

  return {
    $schema: SCHEMA_URL,
    name: pkg.name,
    version: pkg.version,
    description: MANIFEST_DESCRIPTION,
    themeSystem: {
      colorSpace: COLOR_SPACE,
      supportedHarmonies: generateSupportedHarmonies(),
      cssVariables: generateCssVariables(),
      slices: generateThemeSlices(),
    },
    zIndexScale: generateZIndexScale(),
    eventBus: {
      singleton: eventBusMeta.singleton,
      hookName: eventBusMeta.hookName,
      channels: generateEventChannels(),
      helperMethods: generateHelperMethods(),
    },
    components,
    manifestSplit: buildManifestSplitPointer(),
    ...(Object.keys(defs).length > 0 ? { $defs: defs } : {}),
  };
}

function main() {
  const mode = process.argv.includes('--write') ? 'write' : 'check';
  const generated = generateManifest();
  const categoryManifests = splitByCategory(generated);

  const targets = [
    { filePath: MANIFEST_PATH, data: generated, label: 'ai-docs/component-manifest.json' },
    ...Object.entries(categoryManifests).map(([slug, data]) => ({
      filePath: path.join(MANIFEST_SPLIT_DIR, `${slug}.json`),
      data,
      label: `ai-docs/manifest/${slug}.json`,
    })),
  ];

  if (mode === 'write') {
    fs.mkdirSync(MANIFEST_SPLIT_DIR, { recursive: true });
    for (const target of targets) {
      fs.writeFileSync(target.filePath, JSON.stringify(target.data, null, 2) + '\n');
    }
    console.log(
      `Wrote ${targets.length} manifest file(s) (component-manifest.json + ${Object.keys(categoryManifests).length} category split(s)): ` +
        `${generated.components.length} component(s), ${generated.eventBus.channels.length} event channel(s), ` +
        `${generated.eventBus.helperMethods.length} helper method(s), ${generated.themeSystem.cssVariables.length} CSS variable(s).`
    );
    return;
  }

  const drifted = [];
  for (const target of targets) {
    if (!fs.existsSync(target.filePath)) {
      drifted.push(`${target.label} (missing)`);
      continue;
    }
    const current = JSON.parse(fs.readFileSync(target.filePath, 'utf-8'));
    if (JSON.stringify(current, null, 2) !== JSON.stringify(target.data, null, 2)) {
      drifted.push(target.label);
    }
  }

  if (drifted.length === 0) {
    console.log('component-manifest.json and its category split all match source exactly.');
    return;
  }

  console.error(`Manifest drift detected in ${drifted.length} file(s):\n  ${drifted.join('\n  ')}`);
  console.error(`Run 'node scripts/generate-manifest.js --write' to regenerate, then review the diff.`);
  process.exitCode = 1;
}

main();
