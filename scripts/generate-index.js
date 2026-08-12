#!/usr/bin/env node
/**
 * Generates src/index.ts — the public `#toolcrib` barrel every consumer
 * (and this repo's own demo app, via the same `#toolcrib` import alias)
 * actually imports from. Derived from source the same way the manifest and
 * CORE.md are: scan every file under the vendored directories
 * (theme/eventBus/observer/components), include one whose exports carry
 * `@manifest` (already means "public component") or the narrower
 * `@barrelExport` tag (everything else meant to be public — hooks, Slice
 * definitions, context types, shared utilities).
 *
 * This exists because the hand-maintained version drifted for real: an
 * audit while separating the demo app from the toolkit found `Content`,
 * `DataTableSlice`, and `useSliceOverrides` silently missing — each
 * shipped to every consumer as a vendored file, but literally unimportable
 * via `#toolcrib`. Opt-in by design (see extract.js's hasBarrelTag) rather
 * than "export everything under the vendored dirs" — nothing lands in the
 * public surface without an explicit marker.
 *
 * Usage:
 *   node scripts/generate-index.js            # check mode (default) — exits 1 on drift
 *   node scripts/generate-index.js --check     # same, explicit
 *   node scripts/generate-index.js --write     # regenerate src/index.ts in full
 */
import fs from 'node:fs';
import path from 'node:path';
import { SRC, generateBarrelExports } from './lib/extract.js';

const INDEX_PATH = path.join(SRC, 'index.ts');

const GROUP_HEADERS = {
  theme: '// Theme Engine',
  eventBus: '// Event Bus',
  observer: '// Observer & Adaptive Sizing',
  components: '// Components',
};

function renderIndexTs(barrel) {
  const lines = [];
  for (const key of ['theme', 'eventBus', 'observer', 'components']) {
    const specifiers = barrel[key];
    if (specifiers.length === 0) continue;
    if (lines.length > 0) lines.push('');
    lines.push(GROUP_HEADERS[key]);
    for (const spec of specifiers) {
      lines.push(`export * from '${spec}';`);
    }
  }
  return lines.join('\n') + '\n';
}

function main() {
  const mode = process.argv.includes('--write') ? 'write' : 'check';
  const barrel = generateBarrelExports();
  const generated = renderIndexTs(barrel);

  if (mode === 'write') {
    fs.writeFileSync(INDEX_PATH, generated);
    const total = Object.values(barrel).flat().length;
    console.log(`Wrote src/index.ts: ${total} module(s) re-exported.`);
    return;
  }

  const current = fs.readFileSync(INDEX_PATH, 'utf-8').replace(/\r\n?/g, '\n');
  if (current === generated) {
    console.log('src/index.ts matches source exactly.');
    return;
  }

  console.error('src/index.ts drift detected — generated output differs from the committed file.');
  console.error(`Run 'node scripts/generate-index.js --write' to regenerate, then review the diff.`);
  process.exitCode = 1;
}

main();
