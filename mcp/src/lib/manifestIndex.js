import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Fuse from 'fuse.js';

/**
 * Loads and indexes `ai-docs/component-manifest.json` once. The per-category
 * slices under `ai-docs/manifest/*.json` exist to reduce file-*opening* cost
 * for an agent reading raw files directly — that cost doesn't apply once a
 * server holds the whole (small, ~155KB) manifest in memory, so category
 * filtering here is just an in-memory filter over the one parsed document,
 * not a separate set of file reads.
 */
export function loadManifestIndex(vendoredRoot) {
  const manifestPath = join(vendoredRoot, 'ai-docs', 'component-manifest.json');
  const raw = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);

  const fuse = new Fuse(manifest.components, {
    keys: ['name', 'description', 'category'],
    threshold: 0.4,
    includeScore: true,
  });

  return {
    manifest,

    listCategories() {
      return [...new Set(manifest.components.map((c) => c.category))].sort();
    },

    listComponents(category) {
      const components = category
        ? manifest.components.filter((c) => c.category === category)
        : manifest.components;
      return components.map(({ name, category, description }) => ({ name, category, description }));
    },

    getComponent(name) {
      return manifest.components.find((c) => c.name.toLowerCase() === name.toLowerCase()) ?? null;
    },

    searchComponents(query, limit = 10) {
      return fuse
        .search(query)
        .slice(0, limit)
        .map((result) => ({
          name: result.item.name,
          category: result.item.category,
          description: result.item.description,
          // Fuse's score is 0 (perfect) to 1 (worst) — invert to a
          // percentage-match figure, matching the shape confirmed working
          // live against a real competing implementation this session
          // ("Dialog (match: 100%)"). Always defined: `includeScore: true`
          // above guarantees it.
          matchPercent: Math.round((1 - result.score) * 100),
        }));
    },

    getEventChannels(name) {
      const channels = manifest.eventBus.channels;
      if (!name) return { channels, helperMethods: manifest.eventBus.helperMethods };
      return channels.find((c) => c.name === name) ?? null;
    },

    getThemeSystem() {
      return { themeSystem: manifest.themeSystem, zIndexScale: manifest.zIndexScale };
    },
  };
}
