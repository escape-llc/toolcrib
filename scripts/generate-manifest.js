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
 * Usage:
 *   node scripts/generate-manifest.js            # check mode (default) — exits 1 on drift
 *   node scripts/generate-manifest.js --check     # same, explicit
 *   node scripts/generate-manifest.js --write     # regenerate ai-docs/component-manifest.json in full
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT,
  generateZIndexScale,
  generateSupportedHarmonies,
  generateCssVariables,
  generateThemeSlices,
  generateEventBusMeta,
  generateEventChannels,
  generateHelperMethods,
  generateComponents,
} from './lib/extract.js';

const MANIFEST_PATH = path.join(ROOT, 'ai-docs', 'component-manifest.json');

// Meta-descriptive text about the manifest document itself — not a
// property of application source, so there's nothing to derive this from.
const SCHEMA_URL = 'https://json-schema.org/draft/2020-12/schema';
const MANIFEST_DESCRIPTION = 'AI-consumable component manifest for React UI toolkit. All units are rem unless noted.';
// An architectural fact ("this toolkit computes color in HSV"), not a
// value that lives at any single, extractable source location.
const COLOR_SPACE = 'HSV';

function generateManifest() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
  const eventBusMeta = generateEventBusMeta();

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
    components: generateComponents(),
  };
}

function main() {
  const mode = process.argv.includes('--write') ? 'write' : 'check';
  const generated = generateManifest();

  if (mode === 'write') {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(generated, null, 2) + '\n');
    console.log(
      `Wrote ai-docs/component-manifest.json: ${generated.components.length} component(s), ` +
        `${generated.eventBus.channels.length} event channel(s), ${generated.eventBus.helperMethods.length} helper method(s), ` +
        `${generated.themeSystem.cssVariables.length} CSS variable(s).`
    );
    return;
  }

  const current = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  const a = JSON.stringify(current, null, 2);
  const b = JSON.stringify(generated, null, 2);
  if (a === b) {
    console.log('component-manifest.json matches source exactly.');
    return;
  }

  console.error('component-manifest.json drift detected — generated output differs from the committed file.');
  console.error(`Run 'node scripts/generate-manifest.js --write' to regenerate, then review the diff.`);
  process.exitCode = 1;
}

main();
