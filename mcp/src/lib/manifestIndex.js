import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Fuse from 'fuse.js';

// English function words / generic request filler common in a user's raw
// wording ("I want a...", "how do I show...", "is there a..."). These must
// be stripped before per-token fuzzy search below, not just short tokens --
// several are 3+ characters and still fuzzy-match real component names at
// high confidence purely by coincidence (e.g. "for" -> Form 98%, "the" ->
// ThemeEditor 91%, "to" -> Tooltip 92%), which would otherwise bury the
// query's actual meaningful keyword under false-positive noise.
const SEARCH_STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being',
  'to', 'of', 'in', 'on', 'at', 'for', 'with', 'without', 'and', 'or', 'but',
  'do', 'does', 'did', 'how', 'why', 'when', 'where', 'who', 'what', 'which',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we',
  'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'me', 'him',
  'us', 'them', 'want', 'wants', 'wanted', 'need', 'needs', 'needed', 'like',
  'show', 'showing', 'give', 'get', 'got', 'has', 'have', 'had', 'can',
  'could', 'would', 'should', 'will', 'shall', 'may', 'might', 'must',
  'there', 'here', 'some', 'something', 'someone', 'any', 'anything',
  'please', 'help', 'component', 'components', 'thing', 'way', 'kind',
]);

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
      // Fuse's default (non-extended) mode scores the *entire* query string
      // as one approximate pattern against each field. That penalizes query
      // length relative to the matched text — so a caller (or a harness
      // passing a user's raw words straight through, e.g. "I want a
      // dropdown menu component") loses the match entirely once filler
      // words push total length past Fuse's threshold, even though the
      // query contains an exact, unambiguous keyword ("dropdown"). Splitting
      // into tokens and searching each independently, then keeping each
      // item's *best* per-token score, fixes that without changing behavior
      // for the already-working single-keyword case (one token = identical
      // result to before).
      const rawTokens = query
        .split(/\s+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const tokens = rawTokens.filter((t) => !SEARCH_STOPWORDS.has(t));
      // If every token was a stopword (e.g. query is just "how do I"),
      // fall back to the raw query rather than searching nothing.
      const searchTokens = tokens.length > 0 ? tokens : (rawTokens.length > 0 ? rawTokens : [query]);

      const bestScoreByItem = new Map();
      for (const token of searchTokens) {
        for (const result of fuse.search(token)) {
          const prev = bestScoreByItem.get(result.item);
          if (prev === undefined || result.score < prev) {
            bestScoreByItem.set(result.item, result.score);
          }
        }
      }

      return [...bestScoreByItem.entries()]
        .sort((a, b) => a[1] - b[1])
        .slice(0, limit)
        .map(([item, score]) => ({
          name: item.name,
          category: item.category,
          description: item.description,
          // Fuse's score is 0 (perfect) to 1 (worst) — invert to a
          // percentage-match figure, matching the shape confirmed working
          // live against a real competing implementation this session
          // ("Dialog (match: 100%)"). Always defined: `includeScore: true`
          // above guarantees it.
          matchPercent: Math.round((1 - score) * 100),
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
