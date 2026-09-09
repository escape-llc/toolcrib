/**
 * Pure logic for matching changed files against the build graph's declared
 * input patterns -- no fs/path/import.meta.url, so this is directly
 * importable under Vitest with no subprocess indirection, and directly
 * testable against synthetic data without touching the real graph or disk.
 *
 * This answers the reverse question the four generators' own --check
 * modes don't: given a changed file, which output(s) does it affect and
 * why -- not whether a specific output is currently stale (that's what
 * --check already does correctly, per file, and this doesn't duplicate).
 */

/** Replaces \ with /, strips a leading ./ -- load-bearing for Windows:
 * git diff --name-only and CI emit forward-slash paths, but a hand-typed
 * or path.join-constructed path won't be. */
export function normalizeFilePath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

/** Exactly two pattern shapes exist in the real graph: an exact file, or
 * a dir/** subtree -- no glob library needed. */
export function matchesPattern(pattern, filePath) {
  const p = normalizeFilePath(pattern);
  const f = normalizeFilePath(filePath);
  if (p.endsWith('/**')) {
    const prefix = p.slice(0, -3);
    return f === prefix || f.startsWith(prefix + '/');
  }
  return f === p;
}

/**
 * Returns one entry per graph node with >=1 matching input, each carrying
 * exactly which file matched which pattern and why (straight from the
 * JSON's own "reason" field) -- the literal fix for "drift detected, zero
 * indication of why."
 */
export function affectedNodes(graph, changedFiles, { includeLive = false } = {}) {
  const results = [];
  for (const node of graph) {
    if (node.liveSource && !includeLive) continue;
    const matches = [];
    for (const file of changedFiles) {
      for (const input of node.inputs) {
        if (matchesPattern(input.pattern, file)) {
          matches.push({ file, pattern: input.pattern, reason: input.reason });
        }
      }
    }
    if (matches.length > 0) results.push({ node, matches });
  }
  return results;
}

/** Which node produces this file -- cheap, since outputs is already
 * declared. Lets callers flag the plausible mistake of editing a
 * generated file directly. */
export function nodeForOutput(graph, filePath) {
  for (const node of graph) {
    for (const outputPattern of node.outputs) {
      if (matchesPattern(outputPattern, filePath)) return node.id;
    }
  }
  return null;
}

/**
 * Resolves a mixed list of target names (real graph node ids, e.g. "docs")
 * and file paths (resolved via affectedNodes) into a deduplicated set of
 * nodes -- the "make <target>" ergonomics plus the new reverse lookup,
 * composed in one call rather than either/or.
 */
export function resolveTargetsOrFiles(graph, targetsOrFiles, { includeLive = false } = {}) {
  const byId = new Map(graph.map((n) => [n.id, n]));
  const resolved = new Map(); // id -> node
  const files = [];

  for (const arg of targetsOrFiles) {
    const directNode = byId.get(arg);
    if (directNode) {
      if (!directNode.liveSource || includeLive) resolved.set(directNode.id, directNode);
    } else {
      files.push(arg);
    }
  }

  if (files.length > 0) {
    for (const { node } of affectedNodes(graph, files, { includeLive })) {
      resolved.set(node.id, node);
    }
  }

  return [...resolved.values()];
}
