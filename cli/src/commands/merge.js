import path from 'node:path';
import * as p from '@clack/prompts';
import { fetchRelease } from '../lib/release.js';
import { PendingChanges, normalize, joinPatchPath } from '../lib/patches.js';
import { mergeImportsField } from '../lib/deps.js';
import { fileExists, readJsonIfExists, readLock, readTextIfExists, proposeLockUpdate } from '../lib/project.js';
import { MANAGED_DOCS, KNOWN_TARGET_FILES, listManagedBlocks, upsertManagedBlock } from '../lib/managedDocs.js';

const TOOLKIT_DIR = './toolcrib';
// See init.js for why this exists — installs predating this entry need it
// added on `merge` too, not just on a fresh `init`.
const TOOLKIT_IMPORTS_ENTRY = { '#toolcrib': './toolcrib/index.ts' };

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

/**
 * Same classify()-based logic as the vendored-files loop below, applied to
 * managed <!-- toolcrib:managed:... --> blocks inside AGENTS.md/CLAUDE.md
 * instead of whole files under ./toolcrib/ — this is what makes content the
 * user merged from ai-docs/ into their own instruction file round-trip
 * detectable and updatable, the same way everything else already is.
 *
 * "original" for a given block is resolved from whatever version the block
 * itself claims (its `version=` attribute), not necessarily oldRelease —
 * the block may be older or newer than the currently-installed toolkit
 * version if it was hand-edited or added out of band.
 */
async function mergeManagedBlocks(projectRoot, oldRelease, newRelease, changes, conflicts) {
  let updatedCount = 0;
  let keptCount = 0;

  for (const targetFile of KNOWN_TARGET_FILES) {
    const targetPath = path.join(projectRoot, targetFile);
    const currentFileContent = readTextIfExists(targetPath);
    if (!currentFileContent) continue;

    const blocks = listManagedBlocks(currentFileContent);
    if (blocks.length === 0) continue;

    let proposedFileContent = currentFileContent;
    let fileChanged = false;

    for (const block of blocks) {
      const docFile = MANAGED_DOCS[block.docId];
      if (!docFile || !newRelease.allFiles().includes(`ai-docs/${docFile}`)) continue;

      let originalDocContent;
      try {
        if (block.version === oldRelease.version) {
          originalDocContent = oldRelease.readFile(`ai-docs/${docFile}`);
        } else {
          const atVersionRelease = await fetchRelease(block.version);
          originalDocContent = atVersionRelease.readFile(`ai-docs/${docFile}`);
          await atVersionRelease.cleanup();
        }
      } catch {
        // The version this block claims no longer resolves to a real
        // release — can't establish drift without it. `doctor` surfaces
        // this same situation as an explicit warning; here, just skip it
        // rather than guess.
        continue;
      }

      const updatedDocContent = newRelease.readFile(`ai-docs/${docFile}`);
      // block.content was already trimEnd()'d at extraction — the raw
      // release reads above still have their trailing newline, so both
      // must be trimmed the same way before classify() compares them, or
      // every block registers as "conflict"/"safe-update" purely from that
      // trailing newline rather than real content drift. See the matching
      // fix/comment in doctor.js, where this was originally caught.
      const status = classify(originalDocContent.trimEnd(), block.content, updatedDocContent.trimEnd());

      switch (status) {
        case 'unchanged':
        case 'safe-update':
          proposedFileContent = upsertManagedBlock(proposedFileContent, block.docId, newRelease.version, updatedDocContent);
          fileChanged = fileChanged || status === 'safe-update';
          updatedCount++;
          break;
        case 'keep-local':
          keptCount++;
          break;
        case 'conflict':
          // Not a vendored file under TOOLKIT_DIR, so patchPath can't be
          // derived from relPath the way vendored-file conflicts below can
          // — it's set explicitly here instead.
          conflicts.push({
            relPath: `${targetFile} (managed block "${block.docId}")`,
            patchPath: `${targetFile}.managed-${block.docId}`,
            original: originalDocContent,
            local: block.content,
            updated: updatedDocContent,
          });
          break;
      }
    }

    if (fileChanged) {
      changes.propose(targetFile, currentFileContent, proposedFileContent, targetFile);
    }
  }

  return { updatedCount, keptCount };
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
  let oldRelease, newRelease;
  try {
    [oldRelease, newRelease] = await Promise.all([
      fetchRelease(lock.version),
      fetchRelease(options.version),
    ]);
  } catch (err) {
    spinner.stop('Failed to fetch releases');
    throw err;
  }
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
  let deletedCount = 0;

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
        changes.propose(joinPatchPath(TOOLKIT_DIR, relPath), local, updated, relPath);
        updatedCount++;
        break;
      case 'keep-local':
        keptCount++;
        break;
      case 'conflict':
        conflicts.push({ relPath, patchPath: joinPatchPath(TOOLKIT_DIR, relPath), original, local, updated });
        break;
    }
  }

  // A file present in oldRelease but absent from newRelease was removed
  // upstream — e.g. useAnimatedMount.ts when Drawer moved to Radix
  // Presence in v0.10.0. Without this pass, a vendored copy of a file
  // upstream no longer ships just sits there forever, unreferenced but
  // never cleaned up, since the loop above only ever visits paths that
  // still exist in the *new* release. classify(original, local, '')
  // reuses the same four-way logic as the update loop, treating "removed
  // upstream" as updated content of '': local unmodified from original ->
  // safe to delete; local modified -> a real conflict (don't silently
  // discard someone's customization just because upstream dropped the
  // file), same as any other conflicting edit.
  for (const relPath of oldRelease.allFiles()) {
    if (newRelease.allFiles().includes(relPath)) continue;

    const targetPath = path.join(projectRoot, TOOLKIT_DIR, relPath);
    if (!fileExists(targetPath)) continue; // already absent locally — nothing to propose
    const local = readTextIfExists(targetPath);

    const original = oldRelease.readFile(relPath);
    const status = classify(original, local, '');

    switch (status) {
      case 'safe-update':
        changes.propose(joinPatchPath(TOOLKIT_DIR, relPath), local, '', relPath);
        deletedCount++;
        break;
      case 'conflict':
        conflicts.push({
          relPath,
          patchPath: joinPatchPath(TOOLKIT_DIR, relPath),
          original,
          local,
          updated: '',
          removedUpstream: true,
        });
        break;
      // 'unchanged'/'keep-local' can't occur here: original is always
      // non-empty (relPath came from oldRelease.allFiles()) and updated is
      // always '', so upstreamChanged is unconditionally true.
    }
  }

  const managedBlockCounts = await mergeManagedBlocks(projectRoot, oldRelease, newRelease, changes, conflicts);
  updatedCount += managedBlockCounts.updatedCount;
  keptCount += managedBlockCounts.keptCount;

  await Promise.all([oldRelease.cleanup(), newRelease.cleanup()]);

  // Installs from before the "imports" subpath entry existed won't have it —
  // propose adding it here too, not just on a fresh `init`.
  const pkgPath = path.join(projectRoot, 'package.json');
  const userPkg = readJsonIfExists(pkgPath);
  if (userPkg) {
    const importsResult = mergeImportsField(userPkg, TOOLKIT_IMPORTS_ENTRY);
    if (importsResult.changed) {
      changes.propose(
        'package.json',
        readTextIfExists(pkgPath),
        JSON.stringify(importsResult.pkg, null, 2) + '\n',
        'package.json'
      );
    }
  }

  // Advance the lock file to the target version. Proposed unconditionally
  // — the version genuinely changed (the early return above already ruled
  // out oldRelease.version === newRelease.version), regardless of whether
  // any individual vendored file's content also did. Without this, the
  // lock keeps pointing at the pre-merge version forever: `doctor` would
  // keep reporting "a newer version is available" for a version you just
  // installed, and a later `merge` would diff from the wrong baseline,
  // misclassifying every file that legitimately changed in this merge as
  // a local edit — and flagging false conflicts against it next time.
  const lockChange = proposeLockUpdate(projectRoot, newRelease.version);
  changes.propose(lockChange.relPath, lockChange.current, lockChange.proposed, '.toolcrib-lock.json');

  // Conflicts get their own patch showing the *upstream* diff (local vs.
  // untouched), so the human/AI can see exactly what upstream changed
  // without it silently overwriting local customizations.
  for (const conflict of conflicts) {
    changes.propose(
      `${conflict.patchPath}.upstream-diff`,
      '',
      buildConflictNote(conflict),
      `${conflict.relPath} (conflict)`
    );
  }

  if (!changes.isEmpty()) {
    await changes.writeAll(projectRoot);
  }

  p.log.success(
    `${updatedCount} file(s) updated cleanly, ${keptCount} local edit(s) preserved untouched` +
      (deletedCount > 0 ? `, ${deletedCount} file(s) removed upstream and proposed for deletion` : '') +
      '.'
  );
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
  if (conflict.removedUpstream) {
    return (
      `This file was modified locally, but removed upstream in the new version.\n` +
      `Automatic deletion was skipped — review manually or ask your AI assistant:\n` +
      `"reconcile my local changes to ${conflict.relPath}, which was removed upstream"\n`
    );
  }
  return (
    `This file was modified locally AND changed upstream.\n` +
    `Automatic merge was skipped — review manually or ask your AI assistant:\n` +
    `"reconcile my local changes to ${conflict.relPath} with the upstream update"\n`
  );
}
