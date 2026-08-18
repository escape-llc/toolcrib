import fs from 'node:fs';
import path from 'node:path';

// Directories never worth descending into for this scan: dependency trees,
// VCS internals, build output, and the vendored toolkit itself (its own
// source legitimately contains `<ThemeProvider>`/`<ToastProvider>` --
// scanning it would produce a false "found it" even for a consumer who
// never wired their own root).
const EXCLUDED_DIR_NAMES = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'toolcrib']);
const SOURCE_FILE_PATTERN = /\.(tsx|jsx|ts|js)$/;
// A generous but bounded walk -- this is a best-effort heuristic diagnostic
// (grep for a JSX pattern), not the byte-exact vendored-file drift check
// elsewhere in this tool, so it deliberately stops rather than walking an
// unbounded tree on a pathological repo layout.
const MAX_FILES_SCANNED = 2000;

function listCandidateFiles(rootDir) {
  const results = [];
  const stack = [rootDir];
  while (stack.length > 0 && results.length < MAX_FILES_SCANNED) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue; // unreadable directory (permissions, symlink loop) -- skip, not fatal to the scan
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (EXCLUDED_DIR_NAMES.has(entry.name) || entry.name.startsWith('.')) continue;
        stack.push(path.join(dir, entry.name));
      } else if (SOURCE_FILE_PATTERN.test(entry.name)) {
        results.push(path.join(dir, entry.name));
      }
    }
  }
  return results;
}

/**
 * Read-only heuristic: does this project's own source wire up toolcrib's
 * root providers, via `<ToolcribProvider>` or the equivalent manual
 * `<ThemeProvider>` + `<ToastProvider>` + `<ToastContainer>` composition?
 * Both are legitimate per `CORE.md` §1 -- this doesn't prefer one, it just
 * confirms *something* is wired, since every toolcrib component throws or
 * silently no-ops without it, and that failure mode gives no clue back to
 * "you forgot the root setup."
 *
 * Necessarily a grep-style heuristic, not a real JSX/AST check (unlike the
 * byte-exact vendored-file drift check elsewhere in this tool) -- a false
 * positive (e.g. these strings appearing only in a comment) is judged the
 * safer failure mode than a false "not found" nagging a project that's
 * actually wired correctly, just not in a way this scan happens to expect
 * (e.g. `ThemeProvider` re-exported under a local alias).
 *
 * Scans from `<projectRoot>/src` if present (the near-universal convention
 * for a React app's own source), falling back to `projectRoot` itself for
 * a project with no `src/` directory. Returns `{ found: boolean, via:
 * 'ToolcribProvider' | 'manual' | null }`.
 */
export function checkRootProviderWired(projectRoot) {
  const scanRoot = fs.existsSync(path.join(projectRoot, 'src')) ? path.join(projectRoot, 'src') : projectRoot;
  if (!fs.existsSync(scanRoot)) return { found: false, via: null };

  let sawThemeProvider = false;
  let sawToastProvider = false;
  let sawToastContainer = false;

  for (const filePath of listCandidateFiles(scanRoot)) {
    let text;
    try {
      text = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }
    if (text.includes('<ToolcribProvider')) {
      return { found: true, via: 'ToolcribProvider' };
    }
    if (text.includes('<ThemeProvider')) sawThemeProvider = true;
    if (text.includes('<ToastProvider')) sawToastProvider = true;
    if (text.includes('<ToastContainer')) sawToastContainer = true;
  }

  if (sawThemeProvider && sawToastProvider && sawToastContainer) {
    return { found: true, via: 'manual' };
  }
  return { found: false, via: null };
}
