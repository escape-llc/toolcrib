import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { diffArrays } from 'diff';
import { gitMergeFile } from './git.js';

/**
 * Line-level three-way merge for `toolcrib merge`.
 *
 * Two engines, same contract: `git merge-file -p` when git is available, and
 * a pure-JS diff3 built on the `diff` package's Myers `diffArrays` otherwise.
 * Both take LF-normalized text (callers normalize line endings first and
 * restore the local file's EOL style afterwards) and return
 * `{ merged, conflicts, engine }`, where `conflicts` is the number of
 * conflict regions and `merged` carries standard markers
 * (`<<<<<<< local` / `=======` / `>>>>>>> <newLabel>`) for each of them.
 *
 * The JS engine matches git on clean-vs-conflict outcome for ordinary edits:
 * edits that touch or overlap conflict, identical edits on both sides
 * resolve, and a conflicting region is refined down to the lines that
 * actually differ (git's "zealous" behavior). It does not replicate git's
 * extra heuristic of folding two conflicts separated by only a few
 * non-alphanumeric lines into one, so marker granularity can differ from git
 * in those rare layouts.
 */

/** NUL byte, or bytes that are not valid UTF-8. Such content is never line-merged. */
export function isBinaryBuffer(buf) {
  if (buf.includes(0)) return true;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf);
    return false;
  } catch {
    return true;
  }
}

/** 'crlf' when the text uses CRLF more than bare LF, else 'lf'. */
export function detectEol(text) {
  const crlf = (text.match(/\r\n/g) || []).length;
  const lf = (text.match(/\n/g) || []).length - crlf;
  return crlf > lf ? 'crlf' : 'lf';
}

export function toEol(text, eol) {
  return eol === 'crlf' ? text.replace(/\n/g, '\r\n') : text;
}

const splitLines = (text) => text.match(/[^\n]*\n|[^\n]+$/g) || [];
const ensureNl = (lines) =>
  lines.length > 0 && !lines[lines.length - 1].endsWith('\n')
    ? [...lines.slice(0, -1), lines[lines.length - 1] + '\n']
    : lines;

/** Changed regions of `other` relative to `base`: [{ s, e, lines }] over base indexes [s, e). */
function hunks(base, other) {
  const out = [];
  let pos = 0;
  let cur = null;
  for (const part of diffArrays(base, other)) {
    if (!part.added && !part.removed) {
      if (cur) out.push(cur);
      cur = null;
      pos += part.value.length;
      continue;
    }
    cur ??= { s: pos, e: pos, lines: [] };
    if (part.removed) {
      cur.e += part.value.length;
      pos += part.value.length;
    } else {
      cur.lines.push(...part.value);
    }
  }
  if (cur) out.push(cur);
  return out;
}

function render(base, hs, start, end) {
  const out = [];
  let pos = start;
  for (const h of hs) {
    out.push(...base.slice(pos, h.s), ...h.lines);
    pos = h.e;
  }
  out.push(...base.slice(pos, end));
  return out;
}

const same = (a, b) => a.length === b.length && a.every((l, i) => l === b[i]);

export function mergeThreeWayJs(base, ours, theirs, labels) {
  const b = splitLines(base);
  const A = hunks(b, splitLines(ours));
  const B = hunks(b, splitLines(theirs));
  const out = [];
  let conflicts = 0;
  let pos = 0;
  let i = 0;
  let j = 0;

  const conflictBlock = (o, t) => {
    conflicts++;
    out.push(`<<<<<<< ${labels.ours}\n`, ...ensureNl(o), '=======\n', ...ensureNl(t), `>>>>>>> ${labels.theirs}\n`);
  };

  while (i < A.length || j < B.length) {
    const takeA = i < A.length && (j >= B.length || A[i].s <= B[j].s);
    const first = takeA ? A[i++] : B[j++];
    const gA = takeA ? [first] : [];
    const gB = takeA ? [] : [first];
    const start = first.s;
    let end = first.e;
    for (;;) {
      if (i < A.length && A[i].s <= end) {
        end = Math.max(end, A[i].e);
        gA.push(A[i++]);
      } else if (j < B.length && B[j].s <= end) {
        end = Math.max(end, B[j].e);
        gB.push(B[j++]);
      } else break;
    }

    out.push(...b.slice(pos, start));
    pos = end;

    if (gB.length === 0) {
      out.push(...render(b, gA, start, end));
    } else if (gA.length === 0) {
      out.push(...render(b, gB, start, end));
    } else {
      const o = render(b, gA, start, end);
      const t = render(b, gB, start, end);
      if (same(o, t)) {
        out.push(...o);
      } else {
        // Refine: lines both sides agree on stay outside the markers.
        let po = [];
        let pt = [];
        const flush = () => {
          if (po.length || pt.length) conflictBlock(po, pt);
          po = [];
          pt = [];
        };
        for (const part of diffArrays(o, t)) {
          if (part.removed) po.push(...part.value);
          else if (part.added) pt.push(...part.value);
          else {
            flush();
            out.push(...part.value);
          }
        }
        flush();
      }
    }
  }
  out.push(...b.slice(pos));
  return { merged: out.join(''), conflicts };
}

async function mergeWithGit(base, ours, theirs, labels) {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'toolcrib-merge-'));
  try {
    fs.writeFileSync(path.join(dir, 'ours'), ours);
    fs.writeFileSync(path.join(dir, 'base'), base);
    fs.writeFileSync(path.join(dir, 'theirs'), theirs);
    const { merged, conflicts } = await gitMergeFile(dir, { ours: labels.ours, base: 'base', theirs: labels.theirs });
    return { merged, conflicts };
  } finally {
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * @param {{base:string, ours:string, theirs:string}} texts - LF-normalized, BOM-free
 * @param {{engine?: 'git'|'js', newLabel: string}} opts - `engine` defaults to 'js';
 *   a git failure on one file falls back to the JS engine for that file.
 */
export async function mergeThreeWay({ base, ours, theirs }, { engine = 'js', newLabel }) {
  const labels = { ours: 'local', theirs: newLabel };
  if (engine === 'git') {
    try {
      return { ...(await mergeWithGit(base, ours, theirs, labels)), engine: 'git' };
    } catch {
      // fall through to the pure-JS engine
    }
  }
  return { ...mergeThreeWayJs(base, ours, theirs, labels), engine: 'js' };
}
