import fs from 'node:fs';
import path from 'node:path';

// No leading "./" — git apply rejects paths with one as invalid, and
// every other relPath used in PendingChanges (component files, package.json)
// is already written without it. Consistency here matters, not just style.
const LOCK_PATH = 'toolcrib/.toolcrib-lock.json';
const GITIGNORE_ENTRIES = ['/toolcrib-patches/'];

export function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
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

/** Propose adding toolcrib's required entries to .gitignore, idempotently. */
export function proposeGitignore(projectRoot) {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const current = readTextIfExists(gitignorePath);

  const missing = GITIGNORE_ENTRIES.filter((entry) => !current.includes(entry));
  if (missing.length === 0) return null; // already present — nothing to propose

  const needsLeadingNewline = current.length > 0 && !current.endsWith('\n');
  const proposed = current + (needsLeadingNewline ? '\n' : '') + missing.join('\n') + '\n';

  return { relPath: '.gitignore', current, proposed };
}
