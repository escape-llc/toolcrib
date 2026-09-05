import fs from 'node:fs';
import path from 'node:path';
import { FENCE_STYLES, upsertFence, extractFence } from './fences.js';

// No leading "./" — git apply rejects paths with one as invalid, and
// every other relPath used in PendingChanges (component files, package.json)
// is already written without it. Consistency here matters, not just style.
const LOCK_PATH = 'toolcrib/.toolcrib-lock.json';
const GITIGNORE_ENTRIES = ['/toolcrib-patches/'];
const GITIGNORE_FENCE_ID = 'gitignore';

// Node's fs never strips a UTF-8 BOM from a 'utf-8' read — it stays as a
// literal ﻿ at the start of the string. Left in place, it breaks
// JSON.parse() outright ("Unexpected token" — a real, well-known Node
// gotcha, not hypothetical: package.json/tsconfig.json saved by some
// Windows editors carry one). readJsonIfExists strips it for exactly that
// reason, at the read chokepoint, once, rather than defending against it
// at every JSON.parse call site.
function stripBOM(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(stripBOM(fs.readFileSync(filePath, 'utf-8')));
}

// Deliberately does NOT strip a BOM, unlike readJsonIfExists above --
// confirmed as a real, previously-shipped bug (found via
// cli/integration-test/run-windows-integration.mjs, not assumed): every
// call site of this function feeds `changes.propose()`'s "current"
// argument, which becomes the literal "before" context in a real diff/
// patch that `git apply` later matches byte-for-byte against the real
// file on disk. Stripping the BOM here made that comparison start from
// content that no longer matches what's actually in the file -- so a
// project with a BOM'd package.json (PowerShell's `Out-File`/`>`
// redirection adds one by default) got `error: patch does not apply` on
// the very first line, and the patch was silently discarded, every time.
// The BOM in the file itself is still handled correctly elsewhere: the
// *new* content computed from readJsonIfExists (which does strip it) is
// always BOM-free, so applying the resulting patch also naturally cleans
// up a pre-existing BOM going forward.
export function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
}

/**
 * True existence check, distinct from readTextIfExists's '' return value --
 * that '' can't tell "the file doesn't exist" apart from "the file exists
 * and is empty." Callers that specifically need the former (e.g. deciding
 * whether to propose a brand-new file vs. one that just happens to be
 * blank) should use this instead of `readTextIfExists(...) !== ''`.
 */
export function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * The ONLY thing persisted locally between CLI runs is the installed
 * version string — no cached hashes, no file-by-file state. Everything
 * else is recomputed on demand against the immutable release artifacts,
 * which is what keeps merge/doctor correct regardless of local
 * environment quirks (line-ending drift, etc.) — see design notes.
 */
export function readLock(projectRoot) {
  return readJsonIfExists(path.join(projectRoot, LOCK_PATH));
}

export function proposeLockUpdate(projectRoot, version) {
  const lockPath = path.join(projectRoot, LOCK_PATH);
  const current = readTextIfExists(lockPath);
  const proposed = JSON.stringify({ version }, null, 2) + '\n';
  return { relPath: LOCK_PATH, current, proposed };
}

/**
 * Propose adding toolcrib's required entries to .gitignore, idempotently.
 * Wrapped in a `#`-comment fence (see lib/fences.js) so a future version
 * can update or remove exactly these lines without disturbing anything the
 * user added to .gitignore themselves — the same round-trip guarantee
 * vendored files under ./toolcrib/ already have.
 *
 * Note: a pre-fence install (from before this existed) may still have a
 * bare, unfenced `/toolcrib-patches/` line from an earlier `init`. This
 * proposes the fenced block alongside it rather than trying to detect and
 * remove the old line — a harmless duplicate .gitignore entry, not a
 * correctness issue, and not worth the extra migration logic to avoid.
 */
export function proposeGitignore(projectRoot, version) {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const current = readTextIfExists(gitignorePath);

  const proposed = upsertFence(FENCE_STYLES.hash, current, GITIGNORE_FENCE_ID, version, GITIGNORE_ENTRIES.join('\n'));
  if (proposed === current) return null; // already present with identical content — nothing to propose

  return { relPath: '.gitignore', current, proposed };
}

/** Read back what version's worth of gitignore entries is currently fenced in, if any. */
export function readGitignoreFenceVersion(projectRoot) {
  const current = readTextIfExists(path.join(projectRoot, '.gitignore'));
  return extractFence(FENCE_STYLES.hash, current, GITIGNORE_FENCE_ID)?.version ?? null;
}
