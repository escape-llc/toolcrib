import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveVendoredRoot, readLockInfo } from './lib/localInstall.js';
import { loadManifestIndex } from './lib/manifestIndex.js';
import { loadCoreDoc } from './lib/coreDoc.js';
import { loadExamples } from './lib/examples.js';

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
 */
export function buildServer({ root } = {}) {
  const candidateRoot = root ? root.replace(/[/\\]+$/, '') : resolveVendoredRoot(process.cwd());
  const vendoredRoot = candidateRoot && existsSync(join(candidateRoot, '.toolcrib-lock.json')) ? candidateRoot : null;
  if (!vendoredRoot) {
    const looked = root ? candidateRoot : `walking up from ${process.cwd()}`;
    throw new Error(
      `toolcrib-mcp: could not find a vendored toolcrib install (looked for toolcrib/.toolcrib-lock.json, ${root ? `at ${looked}` : looked}). Pass --root <path> to point at it explicitly.`
    );
  }

  const lock = readLockInfo(vendoredRoot);
  const manifestIndex = loadManifestIndex(vendoredRoot);
  const coreDoc = loadCoreDoc(vendoredRoot);
  const examples = loadExamples(vendoredRoot);

  const server = new McpServer({ name: 'toolcrib-mcp', version: '0.1.0' });

  server.registerTool(
    'get_install_info',
    {
      description:
        'Reports which vendored toolcrib install this server is serving — the exact version and directory path, so a caller can confirm it is talking to the right project.',
    },
    async () => json({ vendoredRoot, version: lock?.version ?? null })
  );

  server.registerTool(
    'list_categories',
    { description: 'Lists every component category (e.g. "Form Controls", "Overlays").' },
    async () => json(manifestIndex.listCategories())
  );

  server.registerTool(
    'list_components',
    {
      description:
        'Lists component names, categories, and one-line descriptions — optionally filtered to one category. Call get_component for full prop detail on a specific one.',
      inputSchema: { category: z.string().optional().describe('Exact category name from list_categories, e.g. "Form Controls"') },
    },
    async ({ category }) => json(manifestIndex.listComponents(category))
  );

  server.registerTool(
    'get_component',
    {
      description:
        'Returns full detail for one component: every prop with its type/default/required flag, slots, and any usage constraints.',
      inputSchema: { name: z.string().describe('Exact component name, e.g. "DataTable"') },
    },
    async ({ name }) => {
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
    async ({ query }) => json(manifestIndex.searchComponents(query))
  );

  server.registerTool(
    'list_examples',
    {
      description:
        'Lists the worked examples available for mechanisms with no prior in ordinary React/Radix training data (event bus sticky replay, overrides+StyleDomain composition, router integration, etc.).',
    },
    async () => json(examples.listExamples())
  );

  server.registerTool(
    'get_example',
    {
      description: "Returns one worked example's full content by name (see list_examples for available names).",
      inputSchema: { name: z.string() },
    },
    async ({ name }) => {
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
    async () => json(manifestIndex.getThemeSystem())
  );

  return server;
}
