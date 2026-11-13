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

function buildPatchInfo(relPath, currentContent, proposedContent, label) {
  relPath = relPath.replace(/\\/g, '/');
  // label defaults to the *normalized* relPath — a default parameter
  // expression (`label = relPath`) would capture the pre-normalization
  // value instead, since defaults evaluate before the function body runs.
  if (label === undefined) label = relPath;
  if (normalize(currentContent) === normalize(proposedContent)) return null; // no-op

  const isNewFile = currentContent === '';
  // Symmetric with isNewFile above: a deletion is just a patch whose
  // *target* is /dev/null instead of its *source* — git apply (confirmed
  // directly against a real repo, not assumed) recognizes this from a
  // plain unified diff exactly the same way it recognizes a new file from
  // an empty source, no git-extended `diff --git`/`deleted file mode`
  // headers required. The `!isNewFile` guard only rules out the
  // '' -> '' case, already caught by the no-op check above; kept for
  // clarity that a file can't be simultaneously new and deleted.
  const isDeletedFile = proposedContent === '' && !isNewFile;
  const patch = createTwoFilesPatch(
    isNewFile ? '/dev/null' : `a/${relPath}`,
    isDeletedFile ? '/dev/null' : `b/${relPath}`,
    currentContent,
    proposedContent,
    isNewFile ? undefined : `${label} (current)`,
    isDeletedFile ? undefined : isNewFile ? `${label} (new file)` : `${label} (proposed)`
  );
  return { patch, isNewFile, isDeletedFile };
}

/**
 * Pure patch-text construction shared by PendingChanges.propose() and the
 * export-patches command. Returns the git-apply-compatible unified diff
 * string, or null when the two contents are equal after line-ending
 * normalization. '' as current means a new file; '' as proposed, a deletion.
 */
export function buildPatch(relPath, currentContent, proposedContent, label) {
  return buildPatchInfo(relPath, currentContent, proposedContent, label)?.patch ?? null;
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
    this.files = [];
  }

  /**
   * @param {string} relPath - path relative to the project root. Normalized
   *   to forward slashes unconditionally (see joinPatchPath's docstring) —
   *   this is the last-mile enforcement point before a patch header is
   *   built, regardless of whether the caller already went through
   *   joinPatchPath() or constructed relPath some other way.
   * @param {string} currentContent - '' if the file doesn't exist yet
   * @param {string} proposedContent - '' to propose deleting the file
   *   (only meaningful when currentContent is non-empty — '' vs '' is
   *   already a no-op via the check below)
   * @param {string} [label] - display label for the patch header
   */
  propose(relPath, currentContent, proposedContent, label) {
    relPath = relPath.replace(/\\/g, '/');
    const built = buildPatchInfo(relPath, currentContent, proposedContent, label);
    if (!built) return; // no-op, nothing to propose
    this.entries.push({ relPath, patch: built.patch, isNewFile: built.isNewFile, isDeletedFile: built.isDeletedFile });
  }

  /**
   * Stage a plain file (a conflict note, a binary upstream copy) next to the
   * patches. It is never a `.patch`, so `apply` never writes it into the
   * project. `relPath` is relative to the staging folder, forward-slash.
   */
  addStagedFile(relPath, content) {
    relPath = relPath.replace(/\\/g, '/');
    this.files.push({ relPath, content });
  }

  isEmpty() {
    return this.entries.length === 0 && this.files.length === 0;
  }

  count() {
    return this.entries.length;
  }

  summarize() {
    return this.entries
      .map((e) => `  ${e.isDeletedFile ? '- (deleted) ' : e.isNewFile ? '+ (new) ' : '~ '}${e.relPath}`)
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

    const resolvedDir = path.resolve(dir);
    for (const file of this.files) {
      const target = path.resolve(dir, ...file.relPath.split('/'));
      // Defense in depth, same spirit as patchFallback: a staged file never leaves the staging folder.
      if (!target.startsWith(resolvedDir + path.sep)) continue;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.content);
    }

    return written;
  }
}

/**
 * True when ./toolcrib-patches/ exists and holds anything at all. `merge` and
 * `init` refuse to start over it: they clear the folder when they write, which
 * would silently destroy unapplied patches and conflict notes.
 */
export function hasStagedWork(projectRoot) {
  const dir = path.join(projectRoot, PATCH_DIR);
  try {
    return fs.readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

export const STAGED_WORK_MESSAGE =
  './toolcrib-patches/ already holds staged work (unapplied patches or conflict notes). ' +
  'Run `toolcrib apply` to apply the patches, or delete the folder if you are done with it, then run this command again.';
