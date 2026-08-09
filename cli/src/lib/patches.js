import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createTwoFilesPatch } from 'diff';

export const PATCH_DIR = './toolcrib-patches';

/**
 * Join path segments with '/' explicitly — never Node's path.join(), and
 * never the platform separator. Every relPath handed to
 * PendingChanges.propose() ends up in a git patch header, and git apply
 * rejects backslash-separated paths outright.
 *
 * path.join() is NOT safe here even when its inputs already look like they
 * use '/': it normalizes its result to the platform separator regardless
 * of what separators were already present in the inputs. Confirmed via a
 * real end-to-end `init` -> `apply` run on Windows — every nested vendored
 * file failed with "invalid path" until every relPath construction in this
 * CLI (commands/init.js, commands/merge.js, lib/zip.js) went through
 * explicit forward-slash joining instead of path.join().
 */
export function joinPatchPath(...segments) {
  return segments
    .map((segment) => segment.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

/**
 * Normalize line endings before any content comparison, so a checkout-time
 * CRLF/LF conversion (Git's core.autocrlf, an editor's save behavior, etc.)
 * never registers as a "real" difference. Applied consistently everywhere
 * content is compared, never persisted — see design notes on why cached
 * hashes proved fragile and were dropped in favor of on-demand comparison.
 */
export function normalize(content) {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Collects proposed file changes as unified diff patches. Nothing is ever
 * written directly to a pre-existing or ambiguous target — every mutation
 * this CLI makes (new vendored files, package.json, .gitignore, the version
 * lockfile) flows through here uniformly, then the human/AI applies what
 * they want via `toolcrib apply` or `git apply` directly.
 *
 * Notably absent: the user's own AGENTS.md / CLAUDE.md. The CLI vendors
 * ai-docs/ into ./toolcrib/ai-docs/ and tells the user to merge relevant
 * content in themselves (init.js's outro) — it never reads or proposes
 * changes to those files, so there's currently no tracked record of what
 * content in them originated from toolcrib vs. the user's own writing.
 */
export class PendingChanges {
  constructor() {
    this.entries = [];
  }

  /**
   * @param {string} relPath - path relative to the project root. Normalized
   *   to forward slashes unconditionally (see joinPatchPath's docstring) —
   *   this is the last-mile enforcement point before a patch header is
   *   built, regardless of whether the caller already went through
   *   joinPatchPath() or constructed relPath some other way.
   * @param {string} currentContent - '' if the file doesn't exist yet
   * @param {string} proposedContent - the desired final content
   * @param {string} [label] - display label for the patch header
   */
  propose(relPath, currentContent, proposedContent, label) {
    relPath = relPath.replace(/\\/g, '/');
    // label defaults to the *normalized* relPath — a default parameter
    // expression (`label = relPath`) would capture the pre-normalization
    // value instead, since defaults evaluate before the function body runs.
    if (label === undefined) label = relPath;
    if (normalize(currentContent) === normalize(proposedContent)) return; // no-op, nothing to propose

    const isNewFile = currentContent === '';
    const patch = createTwoFilesPatch(
      isNewFile ? '/dev/null' : `a/${relPath}`,
      `b/${relPath}`,
      currentContent,
      proposedContent,
      isNewFile ? undefined : `${label} (current)`,
      isNewFile ? `${label} (new file)` : `${label} (proposed)`
    );

    this.entries.push({ relPath, patch, isNewFile });
  }

  isEmpty() {
    return this.entries.length === 0;
  }

  count() {
    return this.entries.length;
  }

  summarize() {
    return this.entries
      .map((e) => `  ${e.isNewFile ? '+ (new) ' : '~ '}${e.relPath}`)
      .join('\n');
  }

  /** Write every staged patch to PATCH_DIR, numbered for stable apply order. */
  async writeAll(projectRoot) {
    const dir = path.join(projectRoot, PATCH_DIR);
    await fsp.rm(dir, { recursive: true, force: true }); // clear stale patches from a prior run
    await fsp.mkdir(dir, { recursive: true });

    const written = [];
    this.entries.forEach((entry, i) => {
      const seq = String(i + 1).padStart(4, '0');
      const safeName = entry.relPath.replace(/[/\\]/g, '-');
      const filePath = path.join(dir, `${seq}-${safeName}.patch`);
      fs.writeFileSync(filePath, entry.patch);
      written.push(filePath);
    });

    return written;
  }
}
