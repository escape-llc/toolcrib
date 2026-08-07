import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createTwoFilesPatch } from 'diff';

export const PATCH_DIR = './toolcrib-patches';

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
 * this CLI makes (new files, package.json, .gitignore, AGENTS.md, component
 * edits) flows through here uniformly, then the human/AI applies what they
 * want via `toolcrib apply` or `git apply` directly.
 */
export class PendingChanges {
  constructor() {
    this.entries = [];
  }

  /**
   * @param {string} relPath - path relative to the project root
   * @param {string} currentContent - '' if the file doesn't exist yet
   * @param {string} proposedContent - the desired final content
   * @param {string} [label] - display label for the patch header
   */
  propose(relPath, currentContent, proposedContent, label = relPath) {
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
