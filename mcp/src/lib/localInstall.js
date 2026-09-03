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
 * Returns `{ version }` or `null` if the file is missing or malformed.
 */
export function readLockInfo(vendoredRoot) {
  const lockPath = join(vendoredRoot, LOCK_FILENAME);
  try {
    const raw = readFileSync(lockPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed?.version !== 'string') return null;
    return { version: parsed.version };
  } catch {
    return null;
  }
}
