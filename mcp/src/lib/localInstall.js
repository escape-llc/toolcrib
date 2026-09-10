import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const LOCK_FILENAME = '.toolcrib-lock.json';

/**
 * Finds a vendored toolcrib install by walking upward from `startDir` looking
 * for `toolcrib/.toolcrib-lock.json` — an MCP host may launch this process
 * from an arbitrary cwd (or none reliably set at all, depending on how the
 * host's config invokes it), unlike the one-shot CLI commands in `cli/`,
 * which can safely assume cwd is already the project root.
 *
 * Returns the absolute path to the `toolcrib/` directory itself, or `null`
 * if none was found before reaching the filesystem root.
 */
export function resolveVendoredRoot(startDir) {
  let dir = resolve(startDir);
  while (true) {
    const candidate = join(dir, 'toolcrib');
    if (existsSync(join(candidate, LOCK_FILENAME))) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Reads `.toolcrib-lock.json` from an already-resolved vendored root.
 * Returns `{ version }` (plus `testsVersion` when the lock file has one —
 * set by `toolcrib init --with-tests`/a later `toolcrib merge` that kept
 * it in sync, see cli/src/lib/project.js's proposeLockUpdate) or `null` if
 * the file is missing or malformed. `testsVersion` is omitted entirely
 * rather than included as `null` when absent, matching the CLI's own lock
 * file shape exactly — an install that never opted into `--with-tests`
 * has a lock file with no such key at all, not one set to `null`.
 */
export function readLockInfo(vendoredRoot) {
  const lockPath = join(vendoredRoot, LOCK_FILENAME);
  try {
    const raw = readFileSync(lockPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed?.version !== 'string') return null;
    const info = { version: parsed.version };
    if (typeof parsed.testsVersion === 'string') info.testsVersion = parsed.testsVersion;
    return info;
  } catch {
    return null;
  }
}
