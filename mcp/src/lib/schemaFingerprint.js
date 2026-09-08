import { readFileSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';

const HEADING_RE = /^(#{2,3})\s+(.*)$/;

/**
 * Computes a deterministic fingerprint of the exact structural facts this
 * server's own loaders (manifestIndex.js, coreDoc.js, examples.js) actually
 * depend on to work correctly — never the manifest's real content, order,
 * or counts, which change on every ordinary release and carry no
 * compatibility risk. Two vendored installs with the identical fingerprint
 * are guaranteed interchangeable from this server's point of view,
 * regardless of how different their real component/event/example counts
 * are.
 *
 * Deliberately excludes real fields that have existed in real releases but
 * are never read by this server's code — `$defs`, `manifestSplit`, and a
 * transient per-component `constraints` field (see toolcrib's own
 * AGENTS.md and this project's release history) all change the manifest's
 * raw shape without changing anything this fingerprint tracks, which is
 * exactly the point: a fingerprint scoped to real risk, not real diff.
 *
 * One-way and entirely internal to `toolcrib-mcp` — nothing is embedded
 * back into a consumer's vendored `ai-docs/`. This function is re-run
 * fresh against whatever is actually on disk every time compatibility is
 * checked, so it works identically for a release that predates this
 * function's own existence and one built after it.
 */
export function computeSchemaFingerprint(vendoredRoot) {
  const facts = {
    manifest: computeManifestFacts(vendoredRoot),
    coreDoc: computeCoreDocFacts(vendoredRoot),
    examples: computeExamplesFacts(vendoredRoot),
  };
  return createHash('sha256').update(JSON.stringify(facts)).digest('hex');
}

function computeManifestFacts(vendoredRoot) {
  const manifestPath = join(vendoredRoot, 'ai-docs', 'component-manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const components = Array.isArray(manifest.components) ? manifest.components : [];
  const channels = Array.isArray(manifest.eventBus?.channels) ? manifest.eventBus.channels : [];
  return {
    // manifestIndex.js's own real reads: listComponents/getComponent/
    // searchComponents all key on exactly these three fields, nothing else.
    everyComponentHasNameCategoryDescription: components.every(
      (c) => isNonEmptyString(c?.name) && isNonEmptyString(c?.category) && isNonEmptyString(c?.description)
    ),
    // getEventChannels' find-by-name lookup needs every channel to have a
    // real name; the rest of each channel object is returned opaquely.
    everyChannelHasName: channels.every((c) => isNonEmptyString(c?.name)),
    helperMethodsIsArray: Array.isArray(manifest.eventBus?.helperMethods),
    // getThemeSystem() returns both opaquely -- only presence matters.
    themeSystemPresent: manifest.themeSystem != null && typeof manifest.themeSystem === 'object',
    zIndexScalePresent: manifest.zIndexScale != null && typeof manifest.zIndexScale === 'object',
  };
}

function computeCoreDocFacts(vendoredRoot) {
  const corePath = join(vendoredRoot, 'ai-docs', 'CORE.md');
  const raw = readFileSync(corePath, 'utf8');
  // The exact set of ##/### heading texts, not just a count -- getSection()
  // substring-matches a caller's guess against these, so a heading being
  // renamed or removed is the real risk; more prose under an existing
  // heading (ordinary content growth) never touches this set. Sorted so
  // the fingerprint doesn't depend on document order, only membership.
  // Known, accepted limitation: this compares raw heading text including
  // any leading numbering (e.g. "1. Root Setup") -- a benign renumbering
  // from inserting/removing an earlier section would shift every later
  // heading's text and produce a fingerprint mismatch even though no
  // section was actually renamed. Low-stakes if it ever happens: the
  // compatibility check degrades to a warning, not a crash (see
  // compatibility.js), and this project's real history (verified directly
  // against all 13 releases) shows the section skeleton has never
  // actually changed at all, headings or otherwise.
  const headings = raw
    .split('\n')
    .map((line) => HEADING_RE.exec(line))
    .filter(Boolean)
    .map((m) => m[2].trim().toLowerCase())
    .sort();
  return { headings };
}

function computeExamplesFacts(vendoredRoot) {
  const examplesDir = join(vendoredRoot, 'ai-docs', 'examples');
  let files = [];
  try {
    files = readdirSync(examplesDir).filter((f) => extname(f) === '.md');
  } catch {
    files = [];
  }
  // Not the file count or name set -- both grow with ordinary content
  // (new worked examples shipping), which carries no compatibility risk.
  // Only whether examples.js's own "first non-heading line is the
  // description" convention still holds for every file that exists.
  const everyFileHasNonHeadingContent = files.every((file) => {
    const content = readFileSync(join(examplesDir, file), 'utf8');
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    return lines.some((l) => !l.trim().startsWith('#'));
  });
  return { everyFileHasNonHeadingContent };
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}
