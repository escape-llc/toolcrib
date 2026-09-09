/**
 * Thin loader for scripts/lib/build-graph.json -- not the data itself.
 * Reuses extract.js's own already-proven ROOT constant rather than
 * recomputing path resolution.
 *
 * Safe to use import.meta.url here: docsInSync.test.ts's warning about
 * generator scripts not being importable under Vitest is about the four
 * top-level generate-X.js CLI scripts specifically, which self-invoke
 * main() on import -- not about import.meta.url itself. extract.js uses
 * the identical import.meta.url pattern for its own ROOT and is already
 * successfully imported directly under Vitest via extract.test.js. This
 * loader has no self-invoking main(), so it's safe the same way.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './extract.js';

const GRAPH_PATH = path.join(ROOT, 'scripts', 'lib', 'build-graph.json');

// Strips a leading UTF-8 BOM before JSON.parse -- mirrors
// cli/src/lib/project.js's readJsonIfExists precedent for the identical
// reason (a BOM'd JSON file breaks JSON.parse outright, and Node's fs
// never strips one itself). Implemented as local code, not an import:
// cli/ is a deliberately isolated package (its own node_modules, see
// AGENTS.md) not importable from scripts/.
function readJsonStripBOM(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8').replace(/^﻿/, '');
  return JSON.parse(content);
}

/** The parsed nodes array from build-graph.json. */
export const GRAPH = readJsonStripBOM(GRAPH_PATH).nodes;
