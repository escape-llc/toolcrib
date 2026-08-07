import path from 'node:path';
import * as p from '@clack/prompts';
import { fetchRelease } from '../lib/release.js';
import { PendingChanges, normalize } from '../lib/patches.js';
import { readLock, readTextIfExists } from '../lib/project.js';

const TOOLKIT_DIR = './toolcrib';

/**
 * Four-way classification per vendored file, comparing:
 *   - original: what was shipped in the currently-installed version
 *   - local:    what's actually on disk now (possibly hand/AI-edited)
 *   - updated:  what the new version ships
 *
 * All three are read fresh, on demand, every time — nothing here trusts
 * a previously-cached hash (see design notes on why that was dropped).
 */
function classify(original, local, updated) {
  const localModified = normalize(local) !== normalize(original);
  const upstreamChanged = normalize(original) !== normalize(updated);

  if (!localModified && !upstreamChanged) return 'unchanged';
  if (!localModified && upstreamChanged) return 'safe-update';
  if (localModified && !upstreamChanged) return 'keep-local';
  return 'conflict';
}

export async function mergeCommand(options) {
  const projectRoot = process.cwd();
  p.intro('toolcrib merge');

  const lock = readLock(projectRoot);
  if (!lock) {
    p.log.error('No toolcrib install found (missing .toolcrib-lock.json). Run `toolcrib init` first.');
    process.exitCode = 1;
    return;
  }

  const spinner = p.spinner();
  spinner.start(`Fetching current (v${lock.version}) and target (${options.version}) releases`);
  const [oldRelease, newRelease] = await Promise.all([
    fetchRelease(lock.version),
    fetchRelease(options.version),
  ]);
  spinner.stop(`Comparing v${oldRelease.version} → v${newRelease.version}`);

  if (oldRelease.version === newRelease.version) {
    p.outro('Already on this version. Run `toolcrib doctor` to check for local drift instead.');
    await Promise.all([oldRelease.cleanup(), newRelease.cleanup()]);
    return;
  }

  const changes = new PendingChanges();
  const conflicts = [];
  let updatedCount = 0;
  let keptCount = 0;

  for (const relPath of newRelease.allFiles()) {
    const targetPath = path.join(projectRoot, TOOLKIT_DIR, relPath);
    const local = readTextIfExists(targetPath);
    const updated = newRelease.readFile(relPath);
    // A file that's new in this release won't exist in oldRelease — treat as empty original.
    const original = oldRelease.allFiles().includes(relPath) ? oldRelease.readFile(relPath) : '';

    const status = classify(original, local, updated);

    switch (status) {
      case 'unchanged':
      case 'safe-update':
        changes.propose(path.join(TOOLKIT_DIR, relPath), local, updated, relPath);
        updatedCount++;
        break;
      case 'keep-local':
        keptCount++;
        break;
      case 'conflict':
        conflicts.push({ relPath, original, local, updated });
        break;
    }
  }

  await Promise.all([oldRelease.cleanup(), newRelease.cleanup()]);

  // Conflicts get their own patch showing the *upstream* diff (local vs.
  // untouched), so the human/AI can see exactly what upstream changed
  // without it silently overwriting local customizations.
  for (const conflict of conflicts) {
    changes.propose(
      path.join(TOOLKIT_DIR, conflict.relPath) + '.upstream-diff',
      '',
      buildConflictNote(conflict),
      `${conflict.relPath} (conflict)`
    );
  }

  if (!changes.isEmpty()) {
    await changes.writeAll(projectRoot);
  }

  p.log.success(`${updatedCount} file(s) updated cleanly, ${keptCount} local edit(s) preserved untouched.`);
  if (conflicts.length > 0) {
    p.log.warn(
      `${conflicts.length} conflict(s) — both local and upstream changed:\n` +
        conflicts.map((c) => `  ${c.relPath}`).join('\n') +
        `\n\nSee the .upstream-diff patch for each — ask your AI assistant to reconcile them.`
    );
  }

  p.outro(changes.isEmpty() ? 'No changes to apply.' : 'Review ./toolcrib-patches/, then run `toolcrib apply`.');
}

function buildConflictNote(conflict) {
  return (
    `This file was modified locally AND changed upstream.\n` +
    `Automatic merge was skipped — review manually or ask your AI assistant:\n` +
    `"reconcile my local changes to ${conflict.relPath} with the upstream update"\n`
  );
}
