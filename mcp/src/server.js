import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resolveVendoredRoot, readLockInfo } from './lib/localInstall.js';
import { checkCompatibility } from './lib/compatibility.js';
import { loadTestSource } from './lib/testSource.js';

const json = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });
const text = (value) => ({ content: [{ type: 'text', text: value }] });
const errorText = (value) => ({ content: [{ type: 'text', text: value }], isError: true });

/**
 * Resolves a vendored toolcrib install and builds the McpServer that serves
 * it. Split out from `index.js`'s CLI-argument handling so it can also be
 * driven directly in tests (spawn-free unit tests import this; the
 * integration test spawns `index.js` as a real subprocess instead).
 *
 * Throws with a descriptive message (not a bare stack trace) if no vendored
 * install is found — a misconfigured MCP host pointing this at the wrong
 * directory is the most likely real-world failure mode, and that message is
 * what ends up in the host's own error surface.
 *
 * Returns `{ server, compatibilityWarning }` rather than the server alone —
 * `compatibilityWarning` (from lib/compatibility.js, `null` when the
 * vendored install's real schema fingerprint matches a known-verified one)
 * is surfaced both here, for the caller to log once at startup, and inside
 * `get_install_info`'s own response, so it's visible however the host
 * chooses to check.
 *
 * `parserMap` is passed straight through to `checkCompatibility` (see its
 * own doc comment) — omitted by every real call site, present only so
 * tests can exercise the "recognized schema" path against a fake
 * fixture's own computed fingerprint instead of real production content.
 */
export function buildServer({ root, parserMap } = {}) {
  const candidateRoot = root ? root.replace(/[/\\]+$/, '') : resolveVendoredRoot(process.cwd());
  const vendoredRoot = candidateRoot && existsSync(join(candidateRoot, '.toolcrib-lock.json')) ? candidateRoot : null;
  if (!vendoredRoot) {
    const looked = root ? candidateRoot : `walking up from ${process.cwd()}`;
    throw new Error(
      `toolcrib-mcp: could not find a vendored toolcrib install (looked for toolcrib/.toolcrib-lock.json, ${root ? `at ${looked}` : looked}). Pass --root <path> to point at it explicitly.`
    );
  }

  let lock = readLockInfo(vendoredRoot);
  // parserMap is undefined on every real call site -- checkCompatibility's
  // own default parameter handles that directly (JS defaults trigger on
  // undefined), so there's no need to special-case it here too.
  let compat = checkCompatibility(vendoredRoot, parserMap);
  let compatibilityWarning = compat.warning;
  let manifestIndex = compat.parsers.loadManifestIndex(vendoredRoot);
  let coreDoc = compat.parsers.loadCoreDoc(vendoredRoot);
  let examples = compat.parsers.loadExamples(vendoredRoot);
  // Deliberately NOT routed through PARSER_MAP/checkCompatibility -- the
  // schema-fingerprint mechanism exists specifically for ai-docs/ shape
  // drift (component-manifest.json/CORE.md/examples), which --with-tests'
  // __tests__/ + .toolcrib-tests-config.json have no relationship to at
  // all; they're a wholly separate, orthogonal vendored artifact.
  let testSource = loadTestSource(vendoredRoot);

  /**
   * Re-reads .toolcrib-lock.json (a few bytes) before every tool call and
   * reloads the manifest/CORE.md/examples in full whenever its version has
   * changed since the last load. An MCP host typically spawns this process
   * once per session and keeps it alive for the session's whole duration --
   * without this, a real `toolcrib merge` upgrade run mid-session would
   * leave every tool (including get_install_info's own version field)
   * silently serving whatever was on disk at startup, indefinitely. A
   * reload failure (e.g. a half-written file caught mid-merge) is swallowed
   * and the previous known-good state kept, rather than taking the whole
   * server down over a transient partial write.
   */
  function refreshIfStale() {
    const currentLock = readLockInfo(vendoredRoot);
    if (currentLock?.version === lock?.version) return;
    try {
      const nextCompat = checkCompatibility(vendoredRoot, parserMap);
      const nextManifestIndex = nextCompat.parsers.loadManifestIndex(vendoredRoot);
      const nextCoreDoc = nextCompat.parsers.loadCoreDoc(vendoredRoot);
      const nextExamples = nextCompat.parsers.loadExamples(vendoredRoot);
      const nextTestSource = loadTestSource(vendoredRoot);
      manifestIndex = nextManifestIndex;
      coreDoc = nextCoreDoc;
      examples = nextExamples;
      testSource = nextTestSource;
      lock = currentLock;
      compatibilityWarning = nextCompat.warning;
    } catch {
      // Keep serving the last known-good state.
    }
  }

  const server = new McpServer({ name: 'toolcrib-mcp', version: '0.1.0' });

  server.registerTool(
    'get_install_info',
    {
      description:
        'Reports which vendored toolcrib install this server is serving — the exact version and directory path, so a caller can confirm it is talking to the right project — plus whether the test suite (`toolcrib init --with-tests`) is installed, and a compatibility warning if that version is outside the range this server has actually been verified against.',
    },
    async () => {
      refreshIfStale();
      return json({
        vendoredRoot,
        version: lock?.version ?? null,
        testsInstalled: testSource.isInstalled,
        compatibilityWarning,
      });
    }
  );

  server.registerTool(
    'list_categories',
    { description: 'Lists every component category (e.g. "Form Controls", "Overlays").' },
    async () => {
      refreshIfStale();
      return json(manifestIndex.listCategories());
    }
  );

  server.registerTool(
    'list_components',
    {
      description:
        'Lists component names, categories, and one-line descriptions — optionally filtered to one category. Call get_component for full prop detail on a specific one.',
      inputSchema: { category: z.string().optional().describe('Exact category name from list_categories, e.g. "Form Controls"') },
    },
    async ({ category }) => {
      refreshIfStale();
      return json(manifestIndex.listComponents(category));
    }
  );

  server.registerTool(
    'get_component',
    {
      description:
        'Returns full detail for one component: every prop with its type/default/required flag, slots, and any usage constraints.',
      inputSchema: { name: z.string().describe('Exact component name, e.g. "DataTable"') },
    },
    async ({ name }) => {
      refreshIfStale();
      const component = manifestIndex.getComponent(name);
      if (!component) return errorText(`No component named "${name}". Try search_components first.`);
      return json(component);
    }
  );

  server.registerTool(
    'search_components',
    {
      description:
        "Fuzzy-searches component names, descriptions, and categories — use this when you don't already know the exact component name (e.g. \"something like a dialog\").",
      inputSchema: { query: z.string() },
    },
    async ({ query }) => {
      refreshIfStale();
      return json(manifestIndex.searchComponents(query));
    }
  );

  server.registerTool(
    'list_examples',
    {
      description:
        'Lists the worked examples available for mechanisms with no prior in ordinary React/Radix training data (event bus sticky replay, overrides+StyleDomain composition, router integration, etc.).',
    },
    async () => {
      refreshIfStale();
      return json(examples.listExamples());
    }
  );

  server.registerTool(
    'get_example',
    {
      description: "Returns one worked example's full content by name (see list_examples for available names).",
      inputSchema: { name: z.string() },
    },
    async ({ name }) => {
      refreshIfStale();
      const content = examples.getExample(name);
      if (content === null) return errorText(`No example named "${name}". Call list_examples first.`);
      return text(content);
    }
  );

  server.registerTool(
    'get_core_doc',
    {
      description:
        "Returns CORE.md — the system-prompt-style reference for toolcrib's rules and conventions. Pass a section heading for just that section, or omit for the whole document.",
      inputSchema: {
        section: z.string().optional().describe('Exact heading text, e.g. "Anti-Patterns" or "Event Bus — Complete Payload Reference"'),
      },
    },
    async ({ section }) => {
      refreshIfStale();
      const result = coreDoc.getSection(section);
      if (section && result === null) {
        return errorText(`No section "${section}". Available: ${coreDoc.listSections().map((s) => s.heading).join(', ')}`);
      }
      return text(result);
    }
  );

  server.registerTool(
    'get_event_channels',
    {
      description: "Returns the event bus's channel/payload reference and helper methods, or one channel's payload shape by name.",
      inputSchema: { name: z.string().optional().describe('Exact channel name, e.g. "modal:shown"') },
    },
    async ({ name }) => {
      refreshIfStale();
      const result = manifestIndex.getEventChannels(name);
      if (name && result === null) return errorText(`No event channel named "${name}".`);
      return json(result);
    }
  );

  server.registerTool(
    'get_theme_system',
    {
      description:
        'Returns the HSV-derived theme system *reference* (CSS variable names/roles, supported harmony modes, theme slice list) and the z-index scale. This is static documentation, not a live resolver — it does not compute actual CSS values for a given theme config.',
    },
    async () => {
      refreshIfStale();
      return json(manifestIndex.getThemeSystem());
    }
  );

  server.registerTool(
    'list_test_source',
    {
      description:
        "Lists the real component test files vendored by `toolcrib init --with-tests` (Vitest + Testing Library), with an inferred component name where the filename follows the X.test.tsx convention. Returns isInstalled: false with an empty list if this project never opted into --with-tests.",
    },
    async () => {
      refreshIfStale();
      return json({ isInstalled: testSource.isInstalled, files: testSource.listTestSource() });
    }
  );

  server.registerTool(
    'get_test_source',
    {
      description:
        "Returns one vendored test file's full content by its exact relative path (see list_test_source). This is real reference source, not guaranteed runnable as-is in your own project's test runner — adapt it to whatever you actually use if it isn't Vitest.",
      inputSchema: { path: z.string().describe('Exact relative path from list_test_source, e.g. "Button.test.tsx" or "testUtils/axe.ts"') },
    },
    async ({ path: relPath }) => {
      refreshIfStale();
      const content = testSource.getTestSource(relPath);
      if (content === null) return errorText(`No test source at "${relPath}". Call list_test_source first.`);
      return text(content);
    }
  );

  server.registerTool(
    'get_test_dependencies_patch',
    {
      description:
        "Computes a real unified diff proposing the vendored test suite's own peer dependencies (vitest, testing-library, etc.) be added to this project's package.json devDependencies — reads the project's real package.json directly, never modifies it. Returns null/a clear message if nothing needs proposing (no --with-tests install, or every dependency is already declared). The calling agent decides whether to apply it, adapt it, or ignore it — this server never writes to the project itself.",
    },
    async () => {
      refreshIfStale();
      if (!testSource.isInstalled) {
        return errorText('No --with-tests install found — nothing to propose. Run `toolcrib init --with-tests` first.');
      }
      const packageJsonPath = join(dirname(vendoredRoot), 'package.json');
      let packageJsonContent;
      try {
        packageJsonContent = readFileSync(packageJsonPath, 'utf8');
      } catch (err) {
        return errorText(`Could not read ${packageJsonPath}: ${err.message}`);
      }
      const patch = testSource.computeDevDependenciesPatch(packageJsonContent);
      if (patch === null) {
        return text('Every declared peer dependency is already present in package.json — nothing to propose.');
      }
      return text(patch);
    }
  );

  return { server, compatibilityWarning };
}
