#!/usr/bin/env node
/**
 * Real end-to-end check: spawns the actual `src/index.js` bin entry as a
 * real subprocess, connects a real @modelcontextprotocol/sdk Client over a
 * real StdioClientTransport (the exact harness used earlier this session to
 * verify a competing library's MCP server actually worked, not just that it
 * started), and exercises real tool calls against real toolcrib ai-docs
 * content.
 *
 * The fixture is built by copying *this repo's own* ai-docs/ into the
 * toolcrib/ai-docs/ shape a real vendored install has, plus a synthetic
 * .toolcrib-lock.json using the root package.json's real version — this
 * repo's ai-docs/ is real, current, and already valid, but doesn't live
 * under a toolcrib/ subdirectory with a lock file the way a *consumer's*
 * vendored install does, so that shape has to be built rather than pointed
 * at directly. Not wired into `npm test` (same convention as
 * cli/integration-test/) — run manually with `node integration-test/run.mjs`.
 */
import { mkdtempSync, rmSync, cpSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const indexJs = join(here, '..', 'src', 'index.js');

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`  ok: ${message}`);
}

const fixtureRoot = mkdtempSync(join(tmpdir(), 'toolcrib-mcp-integration-'));
const vendoredRoot = join(fixtureRoot, 'toolcrib');

try {
  console.log('Building fixture from this repo\'s real ai-docs/ ...');
  mkdirSync(vendoredRoot, { recursive: true });
  cpSync(join(repoRoot, 'ai-docs'), join(vendoredRoot, 'ai-docs'), { recursive: true });
  const rootPkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  writeFileSync(join(vendoredRoot, '.toolcrib-lock.json'), JSON.stringify({ version: rootPkg.version }));

  console.log('Spawning real toolcrib-mcp subprocess ...');
  const transport = new StdioClientTransport({ command: process.execPath, args: [indexJs, '--root', vendoredRoot] });
  const client = new Client({ name: 'toolcrib-mcp-integration-test', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);

  const info = JSON.parse((await client.callTool({ name: 'get_install_info', arguments: {} })).content[0].text);
  assert(info.version === rootPkg.version, `get_install_info reports the real vendored version (${rootPkg.version})`);

  const categories = JSON.parse((await client.callTool({ name: 'list_categories', arguments: {} })).content[0].text);
  assert(categories.includes('Overlays'), 'list_categories includes the real "Overlays" category');

  const modal = JSON.parse((await client.callTool({ name: 'get_component', arguments: { name: 'Modal' } })).content[0].text);
  assert(modal.slots.includes('Header'), 'get_component("Modal") returns real slot data (.Header)');

  const search = JSON.parse((await client.callTool({ name: 'search_components', arguments: { query: 'dialog' } })).content[0].text);
  assert(
    search.some((r) => r.name === 'AlertDialog'),
    'search_components("dialog") ranks the real AlertDialog component'
  );

  const channels = JSON.parse((await client.callTool({ name: 'get_event_channels', arguments: {} })).content[0].text);
  assert(channels.channels.length === 68, `get_event_channels reports the real 68-channel count (got ${channels.channels.length})`);

  await client.close();
  console.log('\nAll integration checks passed against a real subprocess and real ai-docs content.');
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
