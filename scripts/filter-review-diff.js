#!/usr/bin/env node
/**
 * Reads a unified diff (e.g. `gh pr diff`) on stdin and writes it to stdout
 * without its generated files (issue #694; see scripts/lib/generatedPaths.js).
 * A leading note names each omitted file, so the reviewer still knows it
 * changed. With `--count-file <path>`, also writes the number omitted there
 * for gemini-review.yml's metadata block.
 *
 * Reads build-graph.json directly rather than via buildGraph.js: that loader
 * goes through extract.js, which needs scripts/' own `typescript` install,
 * and the review runner has no node_modules at all.
 */
import fs from 'node:fs';
import { filterGeneratedFromDiff } from './lib/generatedPaths.js';

const graphText = fs.readFileSync(new URL('./lib/build-graph.json', import.meta.url), 'utf-8').replace(/^﻿/, '');
const graph = JSON.parse(graphText).nodes;
const { diff, omitted } = filterGeneratedFromDiff(graph, fs.readFileSync(0, 'utf-8'));

const countFlag = process.argv.indexOf('--count-file');
if (countFlag !== -1) fs.writeFileSync(process.argv[countFlag + 1], String(omitted.length));

if (omitted.length > 0) {
  process.stdout.write(
    'Generated files changed in this PR but omitted from the diff below. CI checks each one against its source, so they need no review:\n' +
      omitted.map(p => `  ${p}\n`).join('') +
      '\n'
  );
}
process.stdout.write(diff);
