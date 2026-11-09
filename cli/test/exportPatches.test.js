import { describe, it, expect } from 'vitest';
import { analyzeExport, ALLOWLIST, SHARED_FILES } from '../src/lib/exportPatches.js';
import { releaseFixture, localFixture, toMap } from './helpers/exportFixture.js';

const run = (release, local) => analyzeExport({ releaseFiles: toMap(release), localFiles: toMap(local) });
const byName = (result, name) => result.contributions.find((c) => c.name === name);
const filePaths = (c) => c.files.map((f) => f.relPath);

describe('analyzeExport — full fixture', () => {
  const result = run(releaseFixture(), localFixture());

  it('exports the allowlist and shared-file constants', () => {
    expect(ALLOWLIST).toEqual(['components', 'theme', 'eventBus', 'observer']);
    expect(SHARED_FILES).toContain('eventBus/eventBus.ts');
  });

  it('orders component units alphabetically, then infrastructure', () => {
    expect(result.contributions.map((c) => [c.name, c.type])).toEqual([
      ['Card', 'change'],
      ['Gauge', 'new-component'],
      ['useRetry', 'infrastructure'],
    ]);
  });

  it('pulls a new component, its slice and its new theme helper into one contribution', () => {
    const gauge = byName(result, 'Gauge');
    expect(filePaths(gauge)).toEqual([
      'components/Gauge/Gauge.tsx',
      'components/Gauge/GaugeSlice.ts',
      'components/ThemeEditor/sliceEditorControls.tsx',
      'eventBus/eventBus.ts',
      'theme/gaugeMath.ts',
      'theme/registerThemeSlices.ts',
    ]);
    expect(gauge.dependsOn).toEqual([]);
    expect(gauge.files.find((f) => f.relPath === 'theme/gaugeMath.ts').change).toBe('added');
  });

  it('attributes shared-file hunks to the contribution by prefix, import and identifier', () => {
    const gauge = byName(result, 'Gauge');
    const hunks = (p) => gauge.files.find((f) => f.relPath === p).hunks;
    expect(hunks('eventBus/eventBus.ts')).toBe(1);
    expect(hunks('theme/registerThemeSlices.ts')).toBe(2);
    expect(hunks('components/ThemeEditor/sliceEditorControls.tsx')).toBe(2);
  });

  it("gives each contribution only its own hunks, so it applies to the base on its own", () => {
    const patch = byName(result, 'Gauge').files.find((f) => f.relPath === 'eventBus/eventBus.ts').patch;
    expect(patch).toContain("+  'gauge:changed'");
    expect(patch).not.toContain('myapp:thing');
    expect(patch).not.toContain('gauge:reset');
    expect(patch).not.toContain('card:y');
    expect(patch).toContain('--- a/src/eventBus/eventBus.ts');
    expect(patch).toContain('+++ b/src/eventBus/eventBus.ts');
  });

  it('reports a hunk nothing references as app-specific', () => {
    expect(result.appSpecific).toHaveLength(1);
    expect(result.appSpecific[0].relPath).toBe('eventBus/eventBus.ts');
    expect(result.appSpecific[0].hunkText).toContain('myapp:thing');
  });

  it('flags a hunk two contributions match as ambiguous and exports it from neither', () => {
    expect(result.ambiguous).toHaveLength(1);
    expect(result.ambiguous[0].candidates).toEqual(['Card', 'Gauge']);
    expect(result.ambiguous[0].hunkText).toContain('gauge:reset');
    expect(result.ambiguous[0].hunkText).toContain('card:y');
    for (const c of result.contributions) {
      for (const f of c.files) {
        expect(f.patch).not.toContain('gauge:reset');
        expect(f.patch).not.toContain('card:y');
      }
    }
  });

  it('makes an unreferenced new hook its own infrastructure contribution', () => {
    const retry = byName(result, 'useRetry');
    expect(filePaths(retry)).toEqual(['observer/useRetry.ts']);
    expect(retry.checklist.barrel_export.status).toBe('fail');
    expect(retry.checklist.use_client.status).toBe('fail');
    expect(Object.keys(retry.checklist)).toEqual(['barrel_export', 'use_client', 'toolcrib_self_import', 'process_env', 'tests']);
  });

  it('lists index.ts as regenerated upstream and outside-allowlist files as not exported', () => {
    expect(result.regeneratedUpstream).toEqual(['index.ts']);
    expect(result.notExported).toEqual([
      { relPath: '__tests__/Gauge.test.tsx', change: 'added' },
      { relPath: 'ai-docs/CORE.md', change: 'modified' },
    ]);
  });

  it('runs the new-component checklist', () => {
    const c = byName(result, 'Gauge').checklist;
    expect(Object.keys(c)).toEqual([
      'manifest',
      'manifest_category',
      'style_free',
      'use_client',
      'toolcrib_self_import',
      'process_env',
      'event_prefix',
      'theme_slice',
      'form_controls',
      'tests',
    ]);
    expect(c.manifest.status).toBe('pass');
    expect(c.manifest_category.status).toBe('pass');
    expect(c.style_free.status).toBe('pass');
    expect(c.use_client.status).toBe('pass');
    expect(c.event_prefix.status).toBe('pass');
    expect(c.theme_slice.status).toBe('pass');
    expect(c.form_controls.status).toBe('n/a');
    expect(c.tests).toEqual({ status: 'pass', details: ['__tests__/Gauge.test.tsx'] });
  });

  it('runs only the short checklist for a change contribution', () => {
    expect(Object.keys(byName(result, 'Card').checklist)).toEqual(['use_client', 'toolcrib_self_import', 'process_env', 'event_prefix']);
  });
});

describe('analyzeExport — classification edge cases', () => {
  it('reports no changes for identical trees', () => {
    const r = run(releaseFixture(), releaseFixture());
    expect(r.hasChanges).toBe(false);
    expect(r.contributions).toEqual([]);
  });

  it('treats CRLF plus a BOM on an otherwise identical file as unchanged', () => {
    const local = releaseFixture();
    local['theme/padding.ts'] = '﻿' + local['theme/padding.ts'].replace(/\n/g, '\r\n');
    expect(run(releaseFixture(), local).hasChanges).toBe(false);
  });

  it('includes a deleted allowlisted file as a deletion patch in its component', () => {
    const local = releaseFixture();
    delete local['components/Card/CardSlice.ts'];
    local['components/Card/Card.tsx'] += '// touched\n';
    const card = byName(run(releaseFixture(), local), 'Card');
    const del = card.files.find((f) => f.relPath === 'components/Card/CardSlice.ts');
    expect(del.change).toBe('deleted');
    expect(del.patch).toContain('+++ /dev/null');
  });
});

describe('analyzeExport — import following', () => {
  const base = () => ({
    'components/A/A.tsx': `import { mid } from '../../theme/mid';\nexport const A = 1;\n`,
    'components/B/B.tsx': `import { leaf } from '../../theme/leaf';\nexport const B = 1;\n`,
    'theme/mid.ts': `import { leaf } from './leaf';\nexport const mid = leaf;\n`,
    'theme/leaf.ts': `export const leaf = 1;\n`,
  });

  it('follows imports transitively through unchanged files', () => {
    const local = base();
    local['components/A/A.tsx'] += '// edit\n';
    local['theme/leaf.ts'] = 'export const leaf = 2;\n';
    const r = run(base(), local);
    expect(r.contributions.map((c) => c.name)).toEqual(['A']);
    expect(filePaths(byName(r, 'A'))).toEqual(['components/A/A.tsx', 'theme/leaf.ts']);
  });

  it('makes a changed file reached by two units its own contribution and records dependsOn', () => {
    const local = base();
    local['components/A/A.tsx'] += '// edit\n';
    local['components/B/B.tsx'] += '// edit\n';
    local['theme/leaf.ts'] = 'export const leaf = 2;\n';
    const r = run(base(), local);
    expect(r.contributions.map((c) => [c.name, c.type])).toEqual([
      ['A', 'change'],
      ['B', 'change'],
      ['leaf', 'change'],
    ]);
    expect(byName(r, 'A').dependsOn).toEqual(['leaf']);
    expect(byName(r, 'B').dependsOn).toEqual(['leaf']);
    expect(filePaths(byName(r, 'leaf'))).toEqual(['theme/leaf.ts']);
  });

  it('groups unreached infrastructure files by import connectivity', () => {
    const files = { 'theme/a.ts': `export const a = 1;\n`, 'theme/b.ts': `import { a } from './a';\nexport const b = a;\n`, 'theme/c.ts': `export const c = 1;\n` };
    const local = {
      'theme/a.ts': `export const a = 2;\n`,
      'theme/b.ts': `import { a } from './a';\nexport const b = a + 1;\n`,
      'theme/c.ts': `export const c = 2;\n`,
    };
    const r = run(files, local);
    expect(r.contributions.map((c) => [c.name, filePaths(c)])).toEqual([
      ['a', ['theme/a.ts', 'theme/b.ts']],
      ['c', ['theme/c.ts']],
    ]);
  });

  it('records a reached changed file outside the allowlist as a missing dependency', () => {
    const release = { 'components/A/A.tsx': `export const A = 1;\n`, 'lib/helper.ts': `export const h = 1;\n` };
    const local = {
      'components/A/A.tsx': `import { h } from '../../lib/helper';\nexport const A = h;\n`,
      'lib/helper.ts': `export const h = 2;\n`,
    };
    const r = run(release, local);
    expect(byName(r, 'A').missingDependencies).toEqual(['lib/helper.ts']);
    expect(r.notExported).toEqual([{ relPath: 'lib/helper.ts', change: 'modified' }]);
  });
});

describe('analyzeExport — checklist rules', () => {
  const newComponent = (src, extra = {}) =>
    run({}, { 'components/Foo/Foo.tsx': src, ...extra }).contributions[0].checklist;
  const header = `/**\n * @manifest A foo\n * @manifestCategory Containers\n */\n`;

  it('use_client fails for a hook without the directive and passes with it', () => {
    const body = `${header}export const Foo = () => { useState(0); return null; };\n`;
    const fail = newComponent(`import { useState } from 'react';\n${body}`);
    expect(fail.use_client).toEqual({ status: 'fail', details: ['components/Foo/Foo.tsx'] });
    expect(newComponent(`// c\n'use client';\nimport { useState } from 'react';\n${body}`).use_client.status).toBe('pass');
  });

  it('use_client and style_free also check .jsx/.js files, not only TypeScript', () => {
    const c = run({}, {
      'components/Foo/Foo.jsx': `import { useState } from 'react';\n${header}export const Foo = () => { useState(0); return null; };\n`,
      'components/Foo/props.js': `export class FooProps extends React.HTMLAttributes<HTMLDivElement> {}\n`,
    }).contributions[0].checklist;
    expect(c.use_client).toEqual({ status: 'fail', details: ['components/Foo/Foo.jsx'] });
    expect(c.style_free.status).toBe('fail');
  });

  it('event_prefix also runs on a change to an existing component that adds a channel', () => {
    const release = {
      'components/Card/Card.tsx': `export const Card = () => null;\n`,
      'eventBus/eventBus.ts': `export interface AIEventMap {\n  'card:opened': {};\n}\n`,
    };
    const local = {
      'components/Card/Card.tsx': `export const Card = () => { emit('wrong:closed'); return null; };\n`,
      'eventBus/eventBus.ts': `export interface AIEventMap {\n  'card:opened': {};\n  'wrong:closed': {};\n}\n`,
    };
    const card = byName(run(release, local), 'Card');
    expect(card.type).toBe('change');
    expect(card.checklist.event_prefix.status).toBe('fail');
  });

  it('use_client ignores a hook mentioned only in a comment and a hook declaration', () => {
    const c = newComponent(`${header}// useState( here is prose\nexport function useFoo() { return 1; }\n`);
    expect(c.use_client.status).toBe('pass');
  });

  it('fails a #toolcrib self import and a bare process.env', () => {
    const c = newComponent(`'use client';\nimport { Card } from '#toolcrib';\n${header}export const Foo = () => process.env.NODE_ENV;\n`);
    expect(c.toolcrib_self_import.status).toBe('fail');
    expect(c.process_env.status).toBe('fail');
  });

  it('fails manifest and category checks for an untagged or mis-categorised component', () => {
    expect(newComponent(`export const Foo = () => null;\n`).manifest.status).toBe('fail');
    const bad = newComponent(`/**\n * @manifest A foo\n * @manifestCategory Widgets\n */\nexport const Foo = () => null;\n`);
    expect(bad.manifest_category.status).toBe('fail');
    const none = newComponent(`/**\n * @manifest A foo\n */\nexport const Foo = () => null;\n`);
    expect(none.manifest_category.status).toBe('fail');
  });

  it('style_free fails on raw HTMLAttributes and on a declared className', () => {
    expect(newComponent(`${header}interface P extends React.HTMLAttributes<HTMLDivElement> {}\nexport const Foo = () => null;\n`).style_free.status).toBe('fail');
    expect(newComponent(`${header}interface P {\n  className?: string;\n}\nexport const Foo = () => null;\n`).style_free.status).toBe('fail');
    expect(newComponent(`${header}export const Foo = () => null;\n`).style_free.status).toBe('n/a');
  });

  it('form_controls needs @manifestStates and always carries the upstream test note', () => {
    const block = (extra) => `/**\n * @manifest A foo\n * @manifestCategory Form Controls\n${extra} */\nexport const Foo = () => null;\n`;
    const noStates = newComponent(block(''));
    expect(noStates.form_controls.status).toBe('fail');
    const ok = newComponent(block(' * @manifestStates default, disabled, invalid\n'));
    expect(ok.form_controls.status).toBe('pass');
    expect(ok.form_controls.details).toContain('add to src/__tests__/formControlContract.test.tsx CONTROLS upstream');
  });

  it('theme_slice fails when the registry hunks are missing', () => {
    const slice = `import type { ThemeSlice } from '../../theme/slice';\nexport const FooThemeSlice: ThemeSlice<{}> = { id: 'foo' };\n`;
    const c = newComponent(`${header}export const Foo = () => null;\n`, { 'components/Foo/FooSlice.ts': slice });
    expect(c.theme_slice.status).toBe('fail');
    expect(c.theme_slice.details).toHaveLength(2);
  });

  it('event_prefix fails when an attributed channel is not one of the contribution prefixes', () => {
    const release = { 'eventBus/eventBus.ts': `export interface AIEventMap {\n  'a:x': 1;\n  'b:y': 2;\n}\n` };
    const local = {
      'eventBus/eventBus.ts': `export interface AIEventMap {\n  'a:x': 1;\n  'zzz:q': 3;\n  'b:y': 2;\n}\n`,
      // Owns the hunk by import reference only, with a different channel prefix.
      'components/Foo/Foo.tsx': `${header}const k = 'zzz:q';\nexport const Foo = () => k;\n`,
    };
    const c = run(release, local).contributions[0].checklist;
    expect(c.event_prefix.status).toBe('fail');
  });

  it('barrel_export passes when an added infrastructure file is tagged', () => {
    const r = run({}, { 'theme/util.ts': `/** @barrelExport */\nexport const util = 1;\n` });
    expect(r.contributions[0].checklist.barrel_export.status).toBe('pass');
  });
});
