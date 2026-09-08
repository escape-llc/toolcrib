import { computeSchemaFingerprint } from './schemaFingerprint.js';
import { loadManifestIndex } from './manifestIndex.js';
import { loadCoreDoc } from './coreDoc.js';
import { loadExamples } from './examples.js';

/**
 * The one schema shape verified against every real toolcrib release to
 * date — v0.1.0 through v0.13.0, plus the current (unreleased) state —
 * computed directly via `computeSchemaFingerprint` against each release's
 * real, git-tagged `ai-docs/` content (release.yml builds each release
 * directly from its tag, so the tag *is* the shipped content), not
 * assumed. Real, unrelated structural additions across that same span
 * ($defs at v0.3.0, manifestSplit at v0.5.0, a transient per-component
 * constraints field at v0.3.0) don't move this value at all — confirmed
 * directly — because `computeSchemaFingerprint` is deliberately scoped to
 * only the facts this server's own loaders read, not the manifest's raw
 * shape.
 */
const LEGACY_FINGERPRINT = '739139651467f91e117b2564d3b00dd76dee49c17379f55755006852f7a19e52';

/**
 * Maps a known schema fingerprint to the loader functions verified to
 * parse it correctly. Every real toolcrib release to date shares one
 * fingerprint (`LEGACY_FINGERPRINT`) and therefore one entry here — a
 * second entry gets added only once a real future schema change both
 * ships and gets verified against, never speculatively. Growing this map
 * over time is how compatibility widens; nothing already here is ever
 * removed, since an older vendored install doesn't stop being real just
 * because a newer schema was also verified.
 *
 * Deliberately one-way: this file (and `computeSchemaFingerprint`) is the
 * only place a fingerprint value exists anywhere. A consumer's own
 * vendored `ai-docs/` never carries one, computed or otherwise — every
 * fingerprint here is derived fresh from real file content each time
 * `checkCompatibility` runs, which is exactly what lets it work
 * identically for a release that predates this mechanism's own existence.
 */
export const PARSER_MAP = new Map([[LEGACY_FINGERPRINT, { loadManifestIndex, loadCoreDoc, loadExamples }]]);

/**
 * Computes the real fingerprint of whatever is actually vendored at
 * `vendoredRoot` and looks it up in `parserMap`. A match returns the
 * exact parsers verified for that shape and no warning. No match falls
 * back to the newest known parser set (today, the only one) plus a
 * warning -- results may be inaccurate if the real schema changed in a way
 * that parser doesn't handle, but a best-effort answer beats a hard
 * refusal outright: an ai-docs shape change is often additive, so an
 * unverified newer version may well still work fine served by the same
 * parsers. Never throws -- a failure computing the fingerprint itself
 * (e.g. component-manifest.json missing or malformed) degrades the same
 * way, rather than taking down server startup entirely.
 *
 * `parserMap` defaults to the real, module-level PARSER_MAP -- every real
 * call site (server.js) calls this with one argument and gets that. The
 * parameter exists so tests can inject a small, purpose-built map keyed
 * on a test fixture's own computed fingerprint, rather than depending on
 * a fake fixture coincidentally matching real production content (it
 * shouldn't, and doesn't need to, to be a meaningful test).
 */
export function checkCompatibility(vendoredRoot, parserMap = PARSER_MAP) {
  let fingerprint;
  try {
    fingerprint = computeSchemaFingerprint(vendoredRoot);
  } catch (err) {
    return {
      fingerprint: null,
      parsers: newestParsers(parserMap),
      warning: `Could not determine the vendored install's schema shape: ${err.message}. Results may be inaccurate.`,
    };
  }

  if (parserMap.has(fingerprint)) {
    return { fingerprint, parsers: parserMap.get(fingerprint), warning: null };
  }

  return {
    fingerprint,
    parsers: newestParsers(parserMap),
    warning:
      `toolcrib-mcp doesn't recognize this vendored install's exact schema shape (fingerprint ${fingerprint.slice(0, 12)}...) -- ` +
      "serving it with the newest known parser set. Results may be inaccurate if the real schema changed in a way that parser doesn't handle.",
  };
}

function newestParsers(parserMap) {
  return [...parserMap.values()].at(-1);
}
