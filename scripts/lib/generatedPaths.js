/**
 * Which repo paths are generated, and a filter that drops them from a
 * unified diff (issue #694). Generated files add nothing to a Gemini review
 * or audit -- CI's check-* jobs already verify each one against its source
 * -- but they can dominate the input: five reviews under #541's model trial
 * were 290-420 KB, mostly regenerated artifacts.
 *
 * The list is derived, not hand-typed: every `outputs` pattern of every
 * build-graph node, so a new generator is covered the moment its node is
 * added (buildGraph.test.js already requires one per check-* script), plus
 * npm lockfiles, which no generator here produces but are just as
 * machine-written.
 *
 * Pure: takes the graph's nodes as an argument and imports only
 * graphEngine.js. filter-review-diff.js runs this on the review runner with
 * no `npm install`, so nothing here may reach extract.js or `typescript`.
 */
import { matchesPattern, normalizeFilePath } from './graphEngine.js';

/** Machine-written files outside the build graph, matched by basename anywhere in the repo. */
export const GENERATED_BASENAMES = ['package-lock.json'];

/** True if `filePath` is a build-graph output or a lockfile. */
export function isGeneratedPath(graph, filePath) {
  const f = normalizeFilePath(filePath);
  if (GENERATED_BASENAMES.includes(f.slice(f.lastIndexOf('/') + 1))) return true;
  return graph.some(node => (node.outputs ?? []).some(pattern => matchesPattern(pattern, f)));
}

const DIFF_HEADER = /^diff --git "?a\/.*?"? "?b\/(.*?)"?$/;

/**
 * Splits `diffText` at each `diff --git` header and drops the sections for
 * generated paths. Anything before the first header is kept as-is. Returns
 * the remaining diff and the omitted paths, in diff order.
 */
export function filterGeneratedFromDiff(graph, diffText) {
  const lines = diffText.split('\n');
  const kept = [];
  const omitted = [];
  let dropping = false;
  for (const line of lines) {
    // Tolerates CRLF input (a Windows shell pipe), which would otherwise
    // leave a \r inside the captured path.
    const header = DIFF_HEADER.exec(line.replace(/\r$/, ''));
    if (header) {
      dropping = isGeneratedPath(graph, header[1]);
      if (dropping) omitted.push(header[1]);
    }
    if (!dropping) kept.push(line);
  }
  return { diff: kept.join('\n'), omitted };
}
