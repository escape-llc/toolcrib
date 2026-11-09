import { describe, it, expect } from 'vitest';
import {
  contributionFolder,
  patchFileName,
  yamlScalar,
  renderSummary,
  renderReadme,
  parseIntents,
} from '../src/lib/exportFormat.js';

const PATCH = '--- /dev/null\n+++ b/src/components/Gauge/Gauge.tsx\n@@ -0,0 +1 @@\n+hello\n';

const contribution = () => ({
  name: 'Gauge',
  type: 'new-component',
  files: [
    { relPath: 'components/Gauge/Gauge.tsx', upstreamPath: 'src/components/Gauge/Gauge.tsx', change: 'added', patch: PATCH },
    { relPath: 'eventBus/eventBus.ts', upstreamPath: 'src/eventBus/eventBus.ts', change: 'modified', hunks: 1, patch: PATCH },
  ],
  dependsOn: [],
  missingDependencies: [],
  checklist: {
    manifest: { status: 'pass', details: [] },
    use_client: { status: 'fail', details: ['components/Gauge/Gauge.tsx'] },
  },
});

describe('names', () => {
  it('numbers folders 1-based and patch files from 0001', () => {
    expect(contributionFolder(0, 'Gauge')).toBe('01-Gauge');
    expect(contributionFolder(11, 'a b')).toBe('12-a-b');
    expect(patchFileName(0, 'src/components/Gauge/Gauge.tsx')).toBe('0001-src-components-Gauge-Gauge.tsx.patch');
  });
});

describe('yamlScalar', () => {
  it('leaves plain paths and versions unquoted', () => {
    expect(yamlScalar('src/components/Gauge/Gauge.tsx')).toBe('src/components/Gauge/Gauge.tsx');
    expect(yamlScalar('0.16.0')).toBe('0.16.0');
  });

  it('quotes empty, colon-space, hash, flow punctuation and indicator-leading values', () => {
    expect(yamlScalar('')).toBe('""');
    expect(yamlScalar('a: b')).toBe('"a: b"');
    expect(yamlScalar('a #b')).toBe('"a #b"');
    expect(yamlScalar('a,b')).toBe('"a,b"');
    expect(yamlScalar('[x]')).toBe('"[x]"');
    expect(yamlScalar('@scope')).toBe('"@scope"');
    expect(yamlScalar('- item')).toBe('"- item"');
    expect(yamlScalar('ok-name')).toBe('ok-name');
  });

  it('escapes backslashes and quotes inside a quoted scalar', () => {
    expect(yamlScalar('a "b" \\ #')).toBe('"a \\"b\\" \\\\ #"');
  });
});

describe('renderSummary checklist table escaping', () => {
  it('escapes backslashes before pipes so a detail cannot open a new column', () => {
    const c = contribution();
    c.checklist = { use_client: { status: 'fail', details: ['a\\|b', 'c|d'] } };
    const out = renderSummary({
      contribution: c,
      baseVersion: '0.16.0',
      cliVersion: '0.9.0',
      notExported: [],
      regeneratedUpstream: [],
      patches: [],
    });
    expect(out).toContain('| use_client | fail | a\\\\\\|b; c\\|d |');
  });
});

describe('renderSummary', () => {
  const text = renderSummary({
    contribution: contribution(),
    baseVersion: '0.16.0',
    cliVersion: '0.9.0',
    notExported: [{ relPath: 'ai-docs/CORE.md', change: 'modified' }],
    regeneratedUpstream: ['index.ts'],
    patches: contribution().files.map((file, i) => ({ file, fileName: patchFileName(i, file.upstreamPath) })),
  });

  it('opens with the exact machine-stable metadata block', () => {
    const expected = `<details><summary>Patch metadata</summary>

\`\`\`yaml
kind: consumer-patch
schema: 1
base_version: 0.16.0
cli_version: 0.9.0
contribution: Gauge
type: new-component
files:
  - path: src/components/Gauge/Gauge.tsx
    change: added
    intent: unspecified  # bug-fix | missing-feature | customization
  - path: src/eventBus/eventBus.ts
    change: modified
    hunks: 1
    intent: unspecified  # bug-fix | missing-feature | customization
depends_on: []
missing_dependencies: []
not_exported: [ai-docs/CORE.md]
regenerated_upstream: [index.ts]
checklist:
  manifest: pass
  use_client: fail
\`\`\`

</details>
`;
    expect(text.startsWith(expected)).toBe(true);
  });

  it('renders the heading, checklist table and one diff block per patch', () => {
    expect(text).toContain('## Gauge (new-component, base v0.16.0)');
    expect(text).toContain('| manifest | pass | |');
    expect(text).toContain('| use_client | fail | components/Gauge/Gauge.tsx |');
    expect(text).toContain('#### src/components/Gauge/Gauge.tsx');
    expect(text).toContain('#### src/eventBus/eventBus.ts');
    expect(text.match(/```diff/g)).toHaveLength(2);
  });

  it('uses a longer fence when a patch contains backticks', () => {
    const c = contribution();
    c.files = [{ ...c.files[0], patch: '+```js\n+x\n+```\n' }];
    const out = renderSummary({
      contribution: c,
      baseVersion: '1.0.0',
      cliVersion: '0.9.0',
      notExported: [],
      regeneratedUpstream: [],
      patches: [{ file: c.files[0], fileName: 'x' }],
    });
    expect(out).toContain('````diff');
    expect(out).toContain('not_exported: []');
  });
});

describe('parseIntents', () => {
  const summary = (intents) =>
    renderSummary({
      contribution: contribution(),
      baseVersion: '0.16.0',
      cliVersion: '0.9.0',
      notExported: [],
      regeneratedUpstream: [],
      patches: [],
    }).replace(/intent: unspecified {2}#[^\n]*/g, () => `intent: ${intents.shift()}`);

  it('reads the placeholders back, in file order, without the comment', () => {
    const text = renderSummary({
      contribution: contribution(),
      baseVersion: '0.16.0',
      cliVersion: '0.9.0',
      notExported: [],
      regeneratedUpstream: [],
      patches: [],
    });
    expect(parseIntents(text)).toEqual(['unspecified', 'unspecified']);
  });

  it('round-trips filled-in values, with or without a trailing comment', () => {
    expect(parseIntents(summary(['bug-fix', 'customization  # edited']))).toEqual(['bug-fix', 'customization']);
  });

  it('returns an empty list when there is no yaml block', () => {
    expect(parseIntents('nothing here')).toEqual([]);
  });
});

describe('renderReadme', () => {
  const readme = renderReadme({
    baseVersion: '0.16.0',
    entries: [{ folder: '01-Gauge', contribution: contribution() }],
    notExported: [{ relPath: 'ai-docs/CORE.md', change: 'modified' }],
    regeneratedUpstream: ['index.ts'],
    appSpecific: [{ relPath: 'eventBus/eventBus.ts', hunkText: "@@ -1,0 +2,1 @@\n+  'myapp:thing': 1;" }],
    ambiguous: [{ relPath: 'eventBus/eventBus.ts', hunkText: '@@ -1,0 +2,2 @@\n+a\n+b', candidates: ['Card', 'Gauge'] }],
  });

  it('lists contributions and every report section', () => {
    expect(readme).toContain('| 01-Gauge | Gauge | new-component | 2 |');
    expect(readme).toContain('## Not exported');
    expect(readme).toContain('- ai-docs/CORE.md (modified)');
    expect(readme).toContain('## Regenerated upstream');
    expect(readme).toContain('## App-specific shared-file changes');
    expect(readme).toContain("+  'myapp:thing': 1;");
    expect(readme).toContain('## Ambiguous shared-file changes');
    expect(readme).toContain('Candidates: Card, Gauge');
    expect(readme).toContain("Fill in each contribution's `intent:` lines in its SUMMARY.md before posting.");
    expect(readme.match(/```diff/g)).toHaveLength(2);
  });
});
