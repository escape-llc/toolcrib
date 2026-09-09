import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { normalizeFilePath, matchesPattern, affectedNodes, nodeForOutput, resolveTargetsOrFiles } from './graphEngine.js';

// Reads build-graph.json directly rather than importing scripts/lib/
// buildGraph.js -- see buildGraph.test.js's own comment for exactly why
// (import.meta.url throws under Vitest's transform; confirmed directly,
// not assumed).
function readGraph() {
  const graphPath = path.resolve(process.cwd(), 'scripts', 'lib', 'build-graph.json');
  return JSON.parse(fs.readFileSync(graphPath, 'utf-8')).nodes;
}

describe('normalizeFilePath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(normalizeFilePath('src\\theme\\zIndex.ts')).toBe('src/theme/zIndex.ts');
  });

  it('strips a leading ./', () => {
    expect(normalizeFilePath('./README.md')).toBe('README.md');
  });
});

describe('matchesPattern', () => {
  it('matches a file under a dir/** subtree', () => {
    expect(matchesPattern('src/theme/**', 'src/theme/zIndex.ts')).toBe(true);
  });

  it('matches the subtree directory itself', () => {
    expect(matchesPattern('src/theme/**', 'src/theme')).toBe(true);
  });

  it('does not match a file outside the subtree', () => {
    expect(matchesPattern('src/theme/**', 'src/components/Button.tsx')).toBe(false);
  });

  it('matches an exact-file pattern only exactly', () => {
    expect(matchesPattern('README.md', 'README.md')).toBe(true);
    expect(matchesPattern('README.md', 'ai-docs/README.md')).toBe(false);
  });

  it('matches after normalizing a backslash-separated input path (simulating a naive Windows-side caller)', () => {
    expect(matchesPattern('src/theme/**', 'src\\theme\\zIndex.ts')).toBe(true);
  });
});

describe('affectedNodes (real graph)', () => {
  const graph = readGraph();

  it('README.md affects only docs -- the exact incident this engine exists to catch', () => {
    const result = affectedNodes(graph, ['README.md']);
    expect(result.map((r) => r.node.id)).toEqual(['docs']);
  });

  it('src/theme/zIndex.ts affects manifest, docs, and index', () => {
    const result = affectedNodes(graph, ['src/theme/zIndex.ts']);
    expect(result.map((r) => r.node.id).sort()).toEqual(['docs', 'index', 'manifest']);
  });

  it('src/__tests__/Button.test.tsx affects manifest and docs, but NOT index -- proves index\'s narrower scoping is actually implemented', () => {
    const result = affectedNodes(graph, ['src/__tests__/Button.test.tsx']);
    expect(result.map((r) => r.node.id).sort()).toEqual(['docs', 'manifest']);
  });

  it('security-advisories.json affects nothing -- proves inputs: [] is honored even for a real, existing output file', () => {
    const result = affectedNodes(graph, ['security-advisories.json']);
    expect(result).toEqual([]);
  });

  it('an unrelated real file affects nothing -- proves "unrelated" is reported correctly, not a catch-all match', () => {
    const result = affectedNodes(graph, ['scripts/eslint.config.js']);
    expect(result).toEqual([]);
  });

  it('each match carries the real reason from the graph, not just the pattern', () => {
    const result = affectedNodes(graph, ['README.md']);
    expect(result[0].matches[0].reason).toContain('llms-full.txt');
  });
});

describe('nodeForOutput (real graph)', () => {
  const graph = readGraph();

  it('identifies which node produces a given output file', () => {
    expect(nodeForOutput(graph, 'ai-docs/CORE.md')).toBe('docs');
  });

  it('returns null for a file that is not any node\'s output', () => {
    expect(nodeForOutput(graph, 'README.md')).toBeNull();
  });
});

describe('resolveTargetsOrFiles (real graph)', () => {
  const graph = readGraph();

  it('resolves a direct target name without performing any file matching', () => {
    const result = resolveTargetsOrFiles(graph, ['docs']);
    expect(result.map((n) => n.id)).toEqual(['docs']);
  });

  it('composes a target name and a file path in one call, deduplicated', () => {
    const result = resolveTargetsOrFiles(graph, ['docs', 'src/theme/zIndex.ts']);
    expect(result.map((n) => n.id).sort()).toEqual(['docs', 'index', 'manifest']);
  });

  it('excludes a live-source node by default even when named directly', () => {
    const result = resolveTargetsOrFiles(graph, ['security-advisories']);
    expect(result).toEqual([]);
  });

  it('includes a live-source node when explicitly named directly with includeLive', () => {
    const result = resolveTargetsOrFiles(graph, ['security-advisories'], { includeLive: true });
    expect(result.map((n) => n.id)).toEqual(['security-advisories']);
  });
});
