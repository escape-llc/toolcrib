import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// Reads build-graph.json directly rather than importing scripts/lib/
// buildGraph.js: buildGraph.js resolves its path via extract.js's
// import.meta.url-based ROOT, which throws under Vitest's Vite-based
// transform ("The URL must be of scheme file") -- the same cross-tool
// quirk extract.test.js/toon.test.js already document and work around.
// Confirmed directly (not assumed): a throwaway Vitest run importing
// buildGraph.js failed with exactly that error before this file was
// written this way. `npm test`/`vitest run` always run from the repo
// root, so process.cwd() is a safe, simple anchor here, matching the
// same established pattern.
function readGraph() {
  const graphPath = path.resolve(process.cwd(), 'scripts', 'lib', 'build-graph.json');
  return JSON.parse(fs.readFileSync(graphPath, 'utf-8')).nodes;
}

function readPackageScripts() {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  return JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).scripts;
}

describe('build-graph.json matches package.json scripts', () => {
  it('every node\'s check/write command corresponds to a real npm script', () => {
    const graph = readGraph();
    const scripts = readPackageScripts();
    for (const node of graph) {
      const checkScript = node.check.replace(/^npm run /, '');
      const writeScript = node.write.replace(/^npm run /, '');
      expect(scripts[checkScript], `${node.id}'s check script "${checkScript}"`).toBeDefined();
      expect(scripts[writeScript], `${node.id}'s write script "${writeScript}"`).toBeDefined();
    }
  });

  it('every real check-*/generate-* pair in package.json has a matching graph node -- catches a future 5th generator added without a graph entry', () => {
    const graph = readGraph();
    const scripts = readPackageScripts();
    const graphCheckScripts = new Set(graph.map((n) => n.check.replace(/^npm run /, '')));

    const checkScriptNames = Object.keys(scripts).filter((name) => name.startsWith('check-'));
    for (const checkScriptName of checkScriptNames) {
      expect(graphCheckScripts.has(checkScriptName), `check-* script "${checkScriptName}" has no matching graph node`).toBe(true);
    }
  });
});

describe('build-graph.json patterns correspond to real files on disk', () => {
  function existsAsFileOrDir(pattern) {
    const normalized = pattern.replace(/\/\*\*$/, '');
    const fullPath = path.resolve(process.cwd(), normalized);
    return fs.existsSync(fullPath);
  }

  it('every input pattern resolves to something real -- catches a typo in the graph itself', () => {
    const graph = readGraph();
    for (const node of graph) {
      for (const input of node.inputs) {
        expect(existsAsFileOrDir(input.pattern), `${node.id}'s input pattern "${input.pattern}"`).toBe(true);
      }
    }
  });

  it('every non-live node\'s output patterns resolve to something real (already generated)', () => {
    const graph = readGraph();
    for (const node of graph) {
      for (const output of node.outputs) {
        expect(existsAsFileOrDir(output), `${node.id}'s output pattern "${output}"`).toBe(true);
      }
    }
  });

  it('every input carries a non-empty reason', () => {
    const graph = readGraph();
    for (const node of graph) {
      for (const input of node.inputs) {
        expect(input.reason?.length, `${node.id}'s input "${input.pattern}" has an empty reason`).toBeGreaterThan(0);
      }
    }
  });
});
