import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from '../src/server.js';
import { computeSchemaFingerprint } from '../src/lib/schemaFingerprint.js';
import { loadManifestIndex } from '../src/lib/manifestIndex.js';
import { loadCoreDoc } from '../src/lib/coreDoc.js';
import { loadExamples } from '../src/lib/examples.js';
import { buildFakeProject, cleanupFakeProject } from './fixtures.js';

/**
 * Connects a real Client to buildServer()'s output over an in-process,
 * in-memory transport pair — exercises the real registerTool wiring (tool
 * schemas, handler dispatch, error shapes) without spawning a subprocess.
 * The subprocess-based integration test covers the actual stdio/CLI path;
 * this covers the tool logic itself, in-process, for real coverage
 * instrumentation.
 */
async function connectedClient(vendoredRoot, parserMap) {
  const { server } = buildServer({ root: vendoredRoot, parserMap });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

/**
 * A fake project's own real content is a deliberately minimal stand-in,
 * not a replica of real production ai-docs/ — see compatibility.test.js's
 * own identical helper for the full reasoning. Registering the fixture's
 * own computed fingerprint is what lets most of this file's tests exercise
 * a "recognized, no warning" server without depending on real repo
 * content that could change independently of these tests.
 */
function parserMapFor(vendoredRoot) {
  const fingerprint = computeSchemaFingerprint(vendoredRoot);
  return new Map([[fingerprint, { loadManifestIndex, loadCoreDoc, loadExamples }]]);
}

function textOf(result) {
  return result.content[0].text;
}

describe('buildServer', () => {
  let projectRoot, client;

  beforeEach(async () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    client = await connectedClient(built.vendoredRoot, parserMapFor(built.vendoredRoot));
  });

  afterEach(() => cleanupFakeProject(projectRoot));

  it('throws a descriptive error when an explicit --root does not point at a vendored install', () => {
    expect(() => buildServer({ root: '/definitely/not/a/toolcrib/install' })).toThrow(/could not find a vendored toolcrib install/);
  });

  it('auto-detects the vendored root from cwd when no --root is given', () => {
    const built = buildFakeProject();
    const originalCwd = process.cwd();
    try {
      const nestedDir = path.join(built.projectRoot, 'src');
      fs.mkdirSync(nestedDir, { recursive: true });
      process.chdir(nestedDir);
      expect(() => buildServer({})).not.toThrow();
    } finally {
      process.chdir(originalCwd);
      cleanupFakeProject(built.projectRoot);
    }
  });

  it('throws the auto-detect phrasing (not the --root phrasing) when nothing is found via cwd', () => {
    const originalCwd = process.cwd();
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-mcp-empty-'));
    try {
      process.chdir(emptyDir);
      expect(() => buildServer({})).toThrow(/walking up from/);
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('registers all ten tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        'get_component',
        'get_core_doc',
        'get_event_channels',
        'get_example',
        'get_install_info',
        'get_theme_system',
        'list_categories',
        'list_components',
        'list_examples',
        'search_components',
      ].sort()
    );
  });

  it('get_install_info reports the resolved root and version, with no compatibility warning for a version in range', async () => {
    const result = await client.callTool({ name: 'get_install_info', arguments: {} });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.version).toBe('0.12.0');
    expect(parsed.vendoredRoot).toContain('toolcrib');
    expect(parsed.compatibilityWarning).toBe(null);
  });

  it('get_install_info reports no compatibility warning for an unusual version number alone — compatibility is about schema shape, not version', async () => {
    // Regression test for what the fingerprint-based design deliberately
    // drops from the old semver-range one: a fake project's real ai-docs/
    // content is untouched here, only the version string is unusual. Under
    // the old COMPATIBLE_RANGE design this would have warned; this design
    // recognizes it as the same real, verified schema shape regardless.
    const built = buildFakeProject({ version: '0.99.0' });
    try {
      const versionClient = await connectedClient(built.vendoredRoot, parserMapFor(built.vendoredRoot));
      const result = await versionClient.callTool({ name: 'get_install_info', arguments: {} });
      const parsed = JSON.parse(textOf(result));
      expect(parsed.compatibilityWarning).toBe(null);
    } finally {
      cleanupFakeProject(built.projectRoot);
    }
  });

  it('get_install_info surfaces a compatibility warning when the vendored schema shape is genuinely unrecognized', async () => {
    const built = buildFakeProject();
    try {
      const manifestPath = path.join(built.vendoredRoot, 'ai-docs', 'component-manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      delete manifest.components[0].description;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest));

      const unrecognizedClient = await connectedClient(built.vendoredRoot);
      const result = await unrecognizedClient.callTool({ name: 'get_install_info', arguments: {} });
      const parsed = JSON.parse(textOf(result));
      expect(parsed.compatibilityWarning).toContain("doesn't recognize");
    } finally {
      cleanupFakeProject(built.projectRoot);
    }
  });

  it('get_install_info reports a null version when the lock file has no readable version', async () => {
    const built = buildFakeProject();
    try {
      fs.writeFileSync(path.join(built.vendoredRoot, '.toolcrib-lock.json'), JSON.stringify({ notAVersion: true }));
      const noLockClient = await connectedClient(built.vendoredRoot);
      const result = await noLockClient.callTool({ name: 'get_install_info', arguments: {} });
      expect(JSON.parse(textOf(result)).version).toBe(null);
    } finally {
      cleanupFakeProject(built.projectRoot);
    }
  });

  it('list_categories, list_components, and get_component round-trip real manifest data', async () => {
    const categories = JSON.parse(textOf(await client.callTool({ name: 'list_categories', arguments: {} })));
    expect(categories).toEqual(['Containers', 'Overlays']);

    const overlays = JSON.parse(textOf(await client.callTool({ name: 'list_components', arguments: { category: 'Overlays' } })));
    expect(overlays.map((c) => c.name)).toEqual(['Modal', 'AlertDialog']);

    const modal = JSON.parse(textOf(await client.callTool({ name: 'get_component', arguments: { name: 'Modal' } })));
    expect(modal.slots).toEqual(['Header', 'Body']);
  });

  it('get_component reports an error result for an unknown component', async () => {
    const result = await client.callTool({ name: 'get_component', arguments: { name: 'NoSuchThing' } });
    expect(result.isError).toBe(true);
  });

  it('search_components ranks a real fuzzy match', async () => {
    const results = JSON.parse(textOf(await client.callTool({ name: 'search_components', arguments: { query: 'dialog' } })));
    expect(results.map((r) => r.name)).toContain('AlertDialog');
  });

  it('list_examples and get_example round-trip', async () => {
    const list = JSON.parse(textOf(await client.callTool({ name: 'list_examples', arguments: {} })));
    expect(list).toEqual([{ name: 'router-integration', description: 'Bridge aiBus navigate events to a real router.' }]);

    const example = await client.callTool({ name: 'get_example', arguments: { name: 'router-integration' } });
    expect(textOf(example)).toContain('# Router Integration');

    const missing = await client.callTool({ name: 'get_example', arguments: { name: 'nope' } });
    expect(missing.isError).toBe(true);
  });

  it('get_core_doc returns the whole document, or one section, or an error listing what is available', async () => {
    const whole = await client.callTool({ name: 'get_core_doc', arguments: {} });
    expect(textOf(whole)).toContain('Overlays');

    const section = await client.callTool({ name: 'get_core_doc', arguments: { section: '1. Root Setup' } });
    expect(textOf(section)).toContain('ToolcribProvider');

    const missing = await client.callTool({ name: 'get_core_doc', arguments: { section: 'Nope' } });
    expect(missing.isError).toBe(true);
  });

  it('get_event_channels returns the full list with helper methods, or one channel, or an error', async () => {
    const all = JSON.parse(textOf(await client.callTool({ name: 'get_event_channels', arguments: {} })));
    expect(all.helperMethods).toEqual(['openModal', 'closeModal']);

    const one = JSON.parse(textOf(await client.callTool({ name: 'get_event_channels', arguments: { name: 'modal:shown' } })));
    expect(one.payload).toBe('{ id: string }');

    const missing = await client.callTool({ name: 'get_event_channels', arguments: { name: 'nope:event' } });
    expect(missing.isError).toBe(true);
  });

  it('get_theme_system returns the reference data', async () => {
    const theme = JSON.parse(textOf(await client.callTool({ name: 'get_theme_system', arguments: {} })));
    expect(theme.themeSystem.colorSpace).toBe('HSV');
  });
});

describe('buildServer auto-refresh on a live vendored-install change', () => {
  let projectRoot, vendoredRoot, client;

  beforeEach(async () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    vendoredRoot = built.vendoredRoot;
    client = await connectedClient(vendoredRoot);
  });

  afterEach(() => cleanupFakeProject(projectRoot));

  it('reloads the manifest and reports the new version once .toolcrib-lock.json changes on disk, with no server restart', async () => {
    const before = JSON.parse(textOf(await client.callTool({ name: 'get_install_info', arguments: {} })));
    expect(before.version).toBe('0.12.0');
    const categoriesBefore = JSON.parse(textOf(await client.callTool({ name: 'list_categories', arguments: {} })));
    expect(categoriesBefore).toEqual(['Containers', 'Overlays']);

    // Simulate a real `toolcrib merge` upgrade happening while this same
    // server process is still alive: bump the lock version and add a real
    // new category to the manifest, exactly as a version bump would.
    fs.writeFileSync(path.join(vendoredRoot, '.toolcrib-lock.json'), JSON.stringify({ version: '0.13.0' }));
    const manifestPath = path.join(vendoredRoot, 'ai-docs', 'component-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.version = '0.13.0';
    manifest.components.push({
      name: 'Skeleton',
      import: "import { Skeleton } from '#toolcrib'",
      category: 'Data Display',
      description: 'Loading placeholder',
      props: {},
    });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    const after = JSON.parse(textOf(await client.callTool({ name: 'get_install_info', arguments: {} })));
    expect(after.version).toBe('0.13.0');
    const categoriesAfter = JSON.parse(textOf(await client.callTool({ name: 'list_categories', arguments: {} })));
    expect(categoriesAfter).toEqual(['Containers', 'Data Display', 'Overlays']);
  });

  it('keeps serving the last known-good state if the lock version changed but the new manifest is unreadable', async () => {
    const before = JSON.parse(textOf(await client.callTool({ name: 'list_categories', arguments: {} })));

    // A version bump caught mid-write: the lock file already has the new
    // version, but the manifest it should pair with is corrupt/incomplete.
    fs.writeFileSync(path.join(vendoredRoot, '.toolcrib-lock.json'), JSON.stringify({ version: '0.13.0' }));
    fs.writeFileSync(path.join(vendoredRoot, 'ai-docs', 'component-manifest.json'), '{not valid json');

    const after = JSON.parse(textOf(await client.callTool({ name: 'list_categories', arguments: {} })));
    expect(after).toEqual(before);

    const info = JSON.parse(textOf(await client.callTool({ name: 'get_install_info', arguments: {} })));
    expect(info.version).toBe('0.12.0');
  });
});
