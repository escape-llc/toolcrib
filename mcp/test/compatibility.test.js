import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCompatibility, PARSER_MAP } from '../src/lib/compatibility.js';
import { computeSchemaFingerprint } from '../src/lib/schemaFingerprint.js';
import { loadManifestIndex } from '../src/lib/manifestIndex.js';
import { loadCoreDoc } from '../src/lib/coreDoc.js';
import { loadExamples } from '../src/lib/examples.js';
import { buildFakeProject, cleanupFakeProject } from './fixtures.js';

/**
 * A fake project's own real content (built by buildFakeProject) is a
 * deliberately minimal stand-in, not a replica of real production
 * ai-docs/ -- it was never going to coincidentally match the real,
 * hardcoded LEGACY_FINGERPRINT in compatibility.js (computed from real
 * CORE.md headings among other things), and it doesn't need to be, to be
 * a meaningful test. Registering the fixture's own computed fingerprint
 * in a small map built just for the test is what actually exercises the
 * "recognized" path deterministically, decoupled from real repo content
 * that could change independently of these tests.
 */
function parserMapFor(vendoredRoot) {
  const fingerprint = computeSchemaFingerprint(vendoredRoot);
  return new Map([[fingerprint, { loadManifestIndex, loadCoreDoc, loadExamples }]]);
}

describe('checkCompatibility', () => {
  let projectRoot;

  afterEach(() => cleanupFakeProject(projectRoot));

  it('returns no warning and the matching parsers for a recognized schema shape', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;

    const result = checkCompatibility(built.vendoredRoot, parserMapFor(built.vendoredRoot));
    expect(result.warning).toBe(null);
    expect(result.fingerprint).not.toBe(null);
    expect(typeof result.parsers.loadManifestIndex).toBe('function');
    expect(typeof result.parsers.loadCoreDoc).toBe('function');
    expect(typeof result.parsers.loadExamples).toBe('function');
  });

  it('is not affected by an unrelated version number — compatibility is about schema shape, not version', () => {
    // Regression test for the exact assumption COMPATIBLE_RANGE's old
    // semver-based design made and this fingerprint design deliberately
    // drops: a fake project's real ai-docs/ content is untouched here,
    // only .toolcrib-lock.json's version string is unusual. Under the old
    // design this would have warned ("0.99.0 outside COMPATIBLE_RANGE");
    // under this one it's still the same, real, verified schema shape, so
    // it's still compatible.
    const built = buildFakeProject({ version: '0.99.0' });
    projectRoot = built.projectRoot;

    const result = checkCompatibility(built.vendoredRoot, parserMapFor(built.vendoredRoot));
    expect(result.warning).toBe(null);
  });

  it('warns and falls back to the newest known parsers when a component is missing a field this server actually reads', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    const knownGood = parserMapFor(built.vendoredRoot);

    const manifestPath = path.join(built.vendoredRoot, 'ai-docs', 'component-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    delete manifest.components[0].description;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    const result = checkCompatibility(built.vendoredRoot, knownGood);
    expect(result.warning).toContain("doesn't recognize");
    expect(result.warning).toContain(result.fingerprint.slice(0, 12));
    // Still gets a usable parser set back, not a refusal.
    expect(typeof result.parsers.loadManifestIndex).toBe('function');
  });

  it('is unaffected by real structural additions this server never reads ($defs, manifestSplit, constraints)', () => {
    // The exact shape of the false lead this fingerprint design was built
    // to avoid: these three fields are all real, and have all existed in
    // real released versions of component-manifest.json (see
    // compatibility.js's own LEGACY_FINGERPRINT comment), but none of them
    // are read by manifestIndex.js/coreDoc.js/examples.js.
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    const knownGood = parserMapFor(built.vendoredRoot);

    const manifestPath = path.join(built.vendoredRoot, 'ai-docs', 'component-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.$defs = { SomeType: { type: 'string' } };
    manifest.manifestSplit = { categories: ['Overlays'] };
    manifest.components[0].constraints = 'Requires exactly 2 children';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    const result = checkCompatibility(built.vendoredRoot, knownGood);
    expect(result.warning).toBe(null);
  });

  it('degrades gracefully (does not throw) when the manifest is missing or unreadable entirely', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    fs.rmSync(path.join(built.vendoredRoot, 'ai-docs', 'component-manifest.json'));

    const result = checkCompatibility(built.vendoredRoot);
    expect(result.fingerprint).toBe(null);
    expect(result.warning).toContain('Could not determine');
    expect(typeof result.parsers.loadManifestIndex).toBe('function');
  });

  it('PARSER_MAP has at least the one known-verified legacy entry', () => {
    expect(PARSER_MAP.size).toBeGreaterThanOrEqual(1);
  });

  it('the real PARSER_MAP warns for a fake fixture (sanity check that fixtures and real production content are genuinely different)', () => {
    // Not testing production behavior here -- just confirming the premise
    // every other test in this file relies on: buildFakeProject()'s output
    // is not, and was never meant to be, a byte-for-byte stand-in for this
    // repo's own real ai-docs/. If this test ever starts failing (the
    // fixture starts matching LEGACY_FINGERPRINT for real), the other
    // tests in this file relying on dependency injection would still pass
    // -- but it would be worth understanding why before assuming it's fine.
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    const result = checkCompatibility(built.vendoredRoot);
    expect(result.warning).not.toBe(null);
  });

  it('the real PARSER_MAP recognizes this repo\'s own current, real ai-docs/ content with no warning', () => {
    // Regression coverage for a real, previously-shipped gap: this exact
    // scenario (v0.14.0's CORE.md inserting a new numbered section, which
    // benignly renumbers every heading after it -- see
    // V0_14_0_FINGERPRINT's own comment in compatibility.js) went
    // undetected until manually running mcp/integration-test/run.mjs,
    // which isn't wired into `npm test` and so isn't part of normal CI.
    // This test IS wired in, against the real repo root directly (which
    // already has the `ai-docs/` layout computeSchemaFingerprint expects,
    // no fixture-copying needed) -- the next time CORE.md's heading set
    // (or anything else this fingerprint tracks) changes without a
    // matching PARSER_MAP update, this fails the normal test suite
    // immediately instead of silently shipping a warning to every real
    // consumer.
    const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
    const result = checkCompatibility(repoRoot);
    expect(result.warning).toBe(null);
  });
});
