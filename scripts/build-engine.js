#!/usr/bin/env node
/**
 * CLI for the generation pipeline's dependency graph (build-graph.json).
 * Answers "which output(s) does this changed file affect, and which
 * command produces them" -- the reverse of what each generator's own
 * --check already answers ("is this specific output stale"), which this
 * doesn't duplicate or replace. See AGENTS.md and build-graph.json's own
 * header comment for the full account.
 *
 * Not an incremental-build cache: no persisted content hashes, no
 * "skip if unchanged" state. The four generators' own content-diff
 * --check remains the sole source of truth for staleness; this only ever
 * answers "which command is even worth running." Not a git integration
 * either -- doesn't shell out to `git diff` itself, only accepts a file
 * list via argv/stdin, so the actual matching stays subprocess-free and
 * directly testable; pipe `git diff --name-only ... | node
 * scripts/build-engine.js affected --stdin` if that's what you want. Not
 * a replacement for src/__tests__/docsInSync.test.ts or ci.yml's own
 * --check steps -- those stay independently authoritative.
 *
 * Arguments to affected/check/write are targets-or-files, like legacy
 * `make <target>` plus the new reverse lookup, not either/or: an argument
 * exactly matching a graph node id (manifest/docs/index/security-
 * advisories) is a direct target reference; anything else is a file path
 * resolved via the graph's declared inputs. The two forms freely mix in
 * one invocation.
 *
 * Usage:
 *   node scripts/build-engine.js list [--include-live]
 *   node scripts/build-engine.js affected <target-or-file...>
 *   node scripts/build-engine.js affected --stdin   # reads file list from stdin, one per line
 *   node scripts/build-engine.js check <target-or-file...>
 *   node scripts/build-engine.js check --all [--include-live]
 *   node scripts/build-engine.js write <target-or-file...>
 *   node scripts/build-engine.js write --all [--include-live]
 */
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import readline from 'node:readline';
import { GRAPH } from './lib/buildGraph.js';
import { affectedNodes, resolveTargetsOrFiles } from './lib/graphEngine.js';

const exec = promisify(execCallback);

function nonLiveNodes(graph, includeLive) {
  return graph.filter((n) => includeLive || !n.liveSource);
}

async function readStdinLines() {
  const rl = readline.createInterface({ input: process.stdin });
  const lines = [];
  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed) lines.push(trimmed);
  }
  return lines;
}

function cmdList(args) {
  const includeLive = args.includes('--include-live');
  for (const node of nonLiveNodes(GRAPH, includeLive)) {
    console.log(`${node.id}${node.liveSource ? ' (live source, no local inputs)' : ''}`);
    console.log(`  outputs: ${node.outputs.join(', ')}`);
    if (node.inputs.length > 0) {
      console.log(`  inputs:  ${node.inputs.map((i) => i.pattern).join(', ')}`);
    }
    console.log(`  check:   ${node.check}`);
    console.log(`  write:   ${node.write}`);
  }
}

async function cmdAffected(args) {
  const files = args.includes('--stdin') ? await readStdinLines() : args;
  if (files.length === 0) {
    console.error('No files given. Pass file paths as arguments, or --stdin to read them from stdin (one per line).');
    process.exitCode = 1;
    return;
  }
  const results = affectedNodes(GRAPH, files);
  if (results.length === 0) {
    console.log('No graph node is affected by the given file(s).');
    return;
  }
  for (const { node, matches } of results) {
    console.log(`${node.id}:`);
    for (const m of matches) {
      console.log(`  ${m.file} matched "${m.pattern}" -- ${m.reason}`);
    }
  }
}

// Runs multiple nodes' commands concurrently, not sequentially -- amortizes
// Node process-startup overhead (measured as the real bottleneck, not the
// generators' own redundant source parsing) across nodes instead of
// paying it N times in sequence. A single node still runs as one exec
// call either way.
async function runNodes(nodes, field) {
  const results = await Promise.allSettled(
    nodes.map(async (node) => {
      const { stdout, stderr } = await exec(node[field], { cwd: process.cwd() });
      return { id: node.id, stdout, stderr };
    })
  );

  let failed = false;
  for (const [i, result] of results.entries()) {
    const id = nodes[i].id;
    if (result.status === 'fulfilled') {
      console.log(`--- ${id}: ok ---`);
      if (result.value.stdout.trim()) console.log(result.value.stdout.trim());
    } else {
      failed = true;
      console.error(`--- ${id}: FAILED ---`);
      const err = result.reason;
      if (err.stdout?.trim()) console.error(err.stdout.trim());
      if (err.stderr?.trim()) console.error(err.stderr.trim());
      if (!err.stdout && !err.stderr) console.error(err.message);
    }
  }
  return failed;
}

async function cmdCheckOrWrite(field, args) {
  const includeLive = args.includes('--include-live');
  const filteredArgs = args.filter((a) => a !== '--include-live' && a !== '--all');
  const nodes = args.includes('--all')
    ? nonLiveNodes(GRAPH, includeLive)
    : resolveTargetsOrFiles(GRAPH, filteredArgs, { includeLive });

  if (nodes.length === 0) {
    console.log(args.includes('--all') ? 'No nodes to run.' : 'No graph node is affected by the given target(s)/file(s).');
    return;
  }

  const failed = await runNodes(nodes, field);
  if (failed) process.exitCode = 1;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'list':
      cmdList(args);
      break;
    case 'affected':
      await cmdAffected(args);
      break;
    case 'check':
      await cmdCheckOrWrite('check', args);
      break;
    case 'write':
      await cmdCheckOrWrite('write', args);
      break;
    default:
      console.error(`Unknown command "${command ?? ''}". Expected: list | affected | check | write`);
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
