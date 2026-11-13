import fs from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
import { createTwoFilesPatch } from 'diff';
import { fetchRelease, fetchTestsRelease } from '../lib/release.js';
import { resolveVersion } from '../lib/github.js';
import { isGitInstalled } from '../lib/git.js';
import { listFilesRecursive } from '../lib/zip.js';
import { isBinaryBuffer, detectEol, toEol, mergeThreeWay } from '../lib/lineMerge.js';
import { PendingChanges, normalize, joinPatchPath, hasStagedWork, STAGED_WORK_MESSAGE } from '../lib/patches.js';
import { resolveDependencyDecisions, buildProposedPackageJson, mergeImportsField } from '../lib/deps.js';
import { fileExists, readJsonIfExists, readLock, readTextIfExists, proposeLockUpdate } from '../lib/project.js';
import { MANAGED_DOCS, KNOWN_TARGET_FILES, listManagedBlocks, upsertManagedBlock } from '../lib/managedDocs.js';

const TOOLKIT_DIR = './toolcrib';
// See init.js for why this exists — installs predating this entry need it
// added on `merge` too, not just on a fresh `init`.
const TOOLKIT_IMPORTS_ENTRY = { '#toolcrib': './toolcrib/index.ts' };
// Conflict notes and binary upstream copies are staged here, under the
// staging folder (never under ./toolcrib/, and never as `.patch` files, so
// `apply` cannot write them into the kit).
const NOTES_DIR = 'conflicts';
// Meta files inside ./toolcrib/ that the CLI itself owns; never "project-added".
const KIT_META_FILES = new Set(['.toolcrib-lock.json', '.toolcrib-tests-config.json']);

/**
 * Four-way classification per vendored file, comparing:
 *   - original: what was shipped in the currently-installed version
 *   - local:    what's actually on disk now (possibly hand/AI-edited)
 *   - updated:  what the new version ships
 *
 * All three are read fresh, on demand, every time — nothing here trusts
 * a previously-cached hash (see design notes on why that was dropped).
 *
 * Returns one of five outcomes: 'unchanged', 'safe-update', 'keep-local',
 * 'conflict', or 'converged' (both sides changed to identical content).
 * 'conflict' means both sides changed differently; the caller then tries a
 * line-level three-way merge before reporting anything as a conflict.
 */
function classify(original, local, updated) {
  const localModified = normalize(local) !== normalize(original);
  const upstreamChanged = normalize(original) !== normalize(updated);

  if (!localModified && !upstreamChanged) return 'unchanged';
  if (!localModified && upstreamChanged) return 'safe-update';
  if (localModified && !upstreamChanged) return 'keep-local';
  // Both sides changed, but to the same content (e.g. upstream adopted the
  // consumer's own fix): nothing to propose and nothing to resolve.
  if (normalize(local) === normalize(updated)) return 'converged';
  return 'conflict';
}

/** Raw bytes of a release file; test fakes without readBuffer fall back to their text. */
function readBytes(release, relPath) {
  return release.readBuffer ? release.readBuffer(relPath) : Buffer.from(release.readFile(relPath), 'utf8');
}

function newResults() {
  return {
    updated: 0, // clean update patches proposed
    merged: [], // both sides changed, line merge was clean
    absorbed: [], // local change is already contained in the new release
    kept: 0, // local edit, upstream untouched
    deleted: 0, // removed upstream, proposed for deletion
    projectAdded: [], // in ./toolcrib/ but in neither release
    conflicts: [], // { relPath, displayPath, kind, collision, notePath }
  };
}

const fenced = (text) => `~~~~diff\n${text.trimEnd()}\n~~~~\n`;

/**
 * Stage a conflict's note (and, for a binary file, the untouched upstream
 * copy) in the staging folder and record it for the summary. `noteName` is
 * the toolkit-relative path the note is filed under.
 */
function recordConflict(ctx, { relPath, noteName = relPath, displayPath, kind, collision = false, body, upstreamBytes }) {
  const notePath = `${NOTES_DIR}/${noteName}.md`;
  const copyPath = upstreamBytes ? `${NOTES_DIR}/${noteName}.upstream` : null;
  const heading = collision ? `Add/add collision: ${displayPath}` : `Conflict: ${displayPath}`;
  const copyLine = copyPath ? `\nThe untouched upstream copy (v${ctx.newVersion}) is staged beside this note as \`${path.posix.basename(copyPath)}\`.\n` : '';
  ctx.changes.addStagedFile(notePath, `# ${heading}\n\n${body}\n${copyLine}`);
  if (copyPath) ctx.changes.addStagedFile(copyPath, upstreamBytes);
  ctx.results.conflicts.push({ relPath, displayPath, kind, collision, notePath: `./toolcrib-patches/${notePath}` });
}

function upstreamDiff(ctx, relPath, original, updated) {
  return (
    `## What upstream changed (v${ctx.oldVersion} to v${ctx.newVersion})\n\n` +
    fenced(createTwoFilesPatch(`a/${relPath}`, `b/${relPath}`, normalize(original), normalize(updated)))
  );
}

/**
 * The file changed on both sides, differently: try a line-level three-way
 * merge (original = base, local = ours, updated = theirs). A clean merge is
 * proposed as an ordinary patch; overlapping edits are proposed with conflict
 * markers and reported; anything that can't be line-merged (binary, deleted
 * locally) gets a note in the staging folder and the local file is untouched.
 */
async function resolveBothChanged(ctx, { relPath, targetPath, hasOriginal, oldRelease, newRelease, original, updated, collision }) {
  const patchPath = joinPatchPath(TOOLKIT_DIR, relPath);
  const displayPath = patchPath;
  const base = { relPath, displayPath, collision };

  if (!fileExists(targetPath)) {
    // In the old release, deleted from the project, changed upstream: nothing to merge into.
    recordConflict(ctx, {
      ...base,
      kind: 'deleted-locally',
      body:
        `This file was deleted from the project, but upstream changed it in v${ctx.newVersion}.\n` +
        `It was not recreated. Decide whether to restore it (take the upstream version below) or keep it deleted.\n\n` +
        upstreamDiff(ctx, relPath, original, updated),
    });
    return;
  }

  const localBytes = fs.readFileSync(targetPath);
  const originalBytes = hasOriginal ? readBytes(oldRelease, relPath) : Buffer.alloc(0);
  const updatedBytes = readBytes(newRelease, relPath);

  if (isBinaryBuffer(localBytes) || isBinaryBuffer(originalBytes) || isBinaryBuffer(updatedBytes)) {
    recordConflict(ctx, {
      ...base,
      kind: 'binary',
      body:
        `This is a binary file (not valid UTF-8 text), so it was not line-merged. ` +
        `Both your project and upstream changed it${collision ? '' : ` since v${ctx.oldVersion}`}.\n` +
        `Your copy in ./toolcrib/ is untouched. Pick one, or reconcile them with a tool that understands the format.`,
      upstreamBytes: updatedBytes,
    });
    return;
  }

  const localRaw = localBytes.toString('utf8'); // exact disk content (BOM and CRLF intact): what the patch must match
  const hasBom = localRaw.charCodeAt(0) === 0xfeff;
  const eol = detectEol(localRaw);
  const ours = normalize(hasBom ? localRaw.slice(1) : localRaw);
  const theirs = normalize(updated);
  const result = await mergeThreeWay({ base: normalize(original), ours, theirs }, { engine: ctx.engine, newLabel: `v${ctx.newVersion}` });

  const proposed = (hasBom ? '﻿' : '') + toEol(result.merged, eol);

  if (result.conflicts === 0) {
    if (result.merged === theirs) ctx.results.absorbed.push(displayPath);
    else ctx.results.merged.push(displayPath);
    ctx.changes.propose(patchPath, localRaw, proposed, relPath);
    return;
  }

  ctx.changes.propose(patchPath, localRaw, proposed, `${relPath} (conflict markers)`);
  recordConflict(ctx, {
    ...base,
    kind: 'markers',
    body:
      `${collision ? 'The project added this file and the new release now ships one at the same path. ' : 'Both your project and upstream changed this file. '}` +
      `${result.conflicts} region(s) overlap. The patch for ${displayPath} writes the merged file with ` +
      `\`<<<<<<< local\` / \`=======\` / \`>>>>>>> v${ctx.newVersion}\` markers; resolve each one in place and delete the markers.\n\n` +
      (collision ? '' : upstreamDiff(ctx, relPath, original, updated)),
  });
}

/**
 * The full four-way diff, applied per-file across one (oldRelease,
 * newRelease) pair — extracted so both the core toolkit files and (when
 * --with-tests was used) the vendored test-suite files run through the
 * exact same logic rather than a second copy-pasted loop. Both file sets
 * land under the same TOOLKIT_DIR: core relPaths have no prefix, test
 * relPaths are already `__tests__/`-prefixed (see
 * scripts/build-tests-release.js), so no separate target-directory
 * parameter is needed here.
 *
 * Records everything in `ctx` (`changes` for patches/notes, `results` for the
 * summary).
 */
async function diffReleaseFiles(projectRoot, oldRelease, newRelease, ctx) {
  const { changes, results } = ctx;

  // Found by review: allFiles() re-walks its temp directory recursively on
  // every call (listFilesRecursive is not cached), so calling
  // oldRelease.allFiles().includes(relPath)/newRelease.allFiles().includes(relPath)
  // inside these loops' own bodies (below) re-did that full filesystem walk
  // once per file — real O(n²) filesystem I/O for a release with hundreds
  // of files, made worse now that --with-tests doubles how often this
  // function runs per merge. Computed once, up front, as Sets for O(1)
  // membership checks instead.
  const oldFiles = new Set(oldRelease.allFiles());
  const newFiles = new Set(newRelease.allFiles());

  for (const relPath of newFiles) {
    const targetPath = path.join(projectRoot, TOOLKIT_DIR, relPath);
    const local = readTextIfExists(targetPath);
    const updated = newRelease.readFile(relPath);
    const hasOriginal = oldFiles.has(relPath);
    // A file that's new in this release won't exist in oldRelease — treat as
    // an empty original. If the project already has a file at that path it is
    // an add/add collision: the same three-way merge, with an empty base.
    const original = hasOriginal ? oldRelease.readFile(relPath) : '';
    const collision = !hasOriginal && fileExists(targetPath);

    const status = classify(original, local, updated);

    switch (status) {
      case 'unchanged':
      case 'safe-update':
        changes.propose(joinPatchPath(TOOLKIT_DIR, relPath), local, updated, relPath);
        results.updated++;
        break;
      case 'converged':
        // Local already matches the new release, so there's nothing to
        // propose: the change was absorbed upstream.
        results.absorbed.push(joinPatchPath(TOOLKIT_DIR, relPath));
        break;
      case 'keep-local':
        results.kept++;
        break;
      case 'conflict':
        await resolveBothChanged(ctx, { relPath, targetPath, hasOriginal, oldRelease, newRelease, original, updated, collision });
        break;
    }
  }

  // A file present in oldRelease but absent from newRelease was removed
  // upstream — e.g. useAnimatedMount.ts when Drawer moved to a Presence
  // primitive in v0.10.0. Without this pass, a vendored copy of a file
  // upstream no longer ships just sits there forever, unreferenced but
  // never cleaned up, since the loop above only ever visits paths that
  // still exist in the *new* release. classify(original, local, '')
  // reuses the same four-way logic as the update loop, treating "removed
  // upstream" as updated content of '': local unmodified from original ->
  // safe to delete; local modified -> a real conflict (don't silently
  // discard someone's customization just because upstream dropped the
  // file), same as any other conflicting edit. No merge is possible here, so
  // it's a note in the staging folder.
  for (const relPath of oldFiles) {
    if (newFiles.has(relPath)) continue;

    const targetPath = path.join(projectRoot, TOOLKIT_DIR, relPath);
    if (!fileExists(targetPath)) continue; // already absent locally — nothing to propose
    const local = readTextIfExists(targetPath);

    const original = oldRelease.readFile(relPath);
    const status = classify(original, local, '');

    switch (status) {
      case 'safe-update':
        changes.propose(joinPatchPath(TOOLKIT_DIR, relPath), local, '', relPath);
        results.deleted++;
        break;
      case 'conflict':
        recordConflict(ctx, {
          relPath,
          displayPath: joinPatchPath(TOOLKIT_DIR, relPath),
          kind: 'removed-upstream',
          body:
            `This file was modified locally, but removed upstream in v${ctx.newVersion}.\n` +
            `Automatic deletion was skipped and your copy is untouched. Review it, or ask your AI assistant:\n` +
            `"reconcile my local changes to ${relPath}, which was removed upstream"\n`,
        });
        break;
      // 'unchanged'/'keep-local' can't occur here: original is always
      // non-empty (relPath came from oldRelease.allFiles()) and updated is
      // always '', so upstreamChanged is unconditionally true. 'converged'
      // only happens for a locally-emptied file (local === updated === ''),
      // which this switch deliberately has no case for: nothing is
      // proposed, so the empty file is left on disk as-is.
    }
  }
}

/**
 * Files under ./toolcrib/ that neither the old nor the new release ships:
 * the project's own additions. Reported, never touched. `known` is every
 * release-relative path of every release involved; `testsInstalled` decides
 * whether `__tests__/` is the kit's (and so already covered by `known`) or
 * is simply not looked at.
 */
function findProjectAdded(projectRoot, known, testsInstalled) {
  const toolkitRoot = path.join(projectRoot, TOOLKIT_DIR);
  if (!fs.existsSync(toolkitRoot)) return [];
  return listFilesRecursive(toolkitRoot)
    .filter((relPath) => !KIT_META_FILES.has(relPath))
    .filter((relPath) => testsInstalled || !relPath.startsWith('__tests__/'))
    .filter((relPath) => !known.has(relPath))
    .map((relPath) => joinPatchPath(TOOLKIT_DIR, relPath))
    .sort();
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
async function mergeManagedBlocks(projectRoot, oldRelease, newRelease, ctx) {
  const { changes, results } = ctx;

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
        case 'converged':
          // 'converged': the block's content already matches the new doc, but
          // its version= attribute still names the old version. It must be
          // advanced anyway, or the next merge treats the old version's doc as
          // the "original" and misclassifies this block.
          proposedFileContent = upsertManagedBlock(proposedFileContent, block.docId, newRelease.version, updatedDocContent);
          fileChanged = fileChanged || status !== 'unchanged';
          if (status === 'converged') results.absorbed.push(`${targetFile} (managed block "${block.docId}")`);
          else results.updated++;
          break;
        case 'keep-local':
          results.kept++;
          break;
        case 'conflict': {
          // Not a vendored file under TOOLKIT_DIR. The block isn't a whole
          // file, so no line merge: a note with the upstream change.
          const displayPath = `${targetFile} (managed block "${block.docId}")`;
          recordConflict(ctx, {
            relPath: displayPath,
            noteName: `${targetFile}.managed-${block.docId}`,
            displayPath,
            kind: 'managed-block',
            body:
              `The managed block "${block.docId}" in ${targetFile} was edited locally AND changed upstream.\n` +
              `It was left as-is. Reconcile it by hand or ask your AI assistant.\n\n` +
              upstreamDiff(ctx, `${targetFile}.managed-${block.docId}`, originalDocContent, updatedDocContent),
          });
          break;
        }
      }
    }

    if (fileChanged) {
      changes.propose(targetFile, currentFileContent, proposedFileContent, targetFile);
    }
  }
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

  if (hasStagedWork(projectRoot)) {
    p.log.error(STAGED_WORK_MESSAGE);
    process.exitCode = 1;
    return;
  }

  const spinner = p.spinner();
  spinner.start(`Fetching current (v${lock.version}) and target (${options.version}) releases`);
  // Resolved once, then reused as a concrete version for every fetch below
  // that targets the "new" side — the same real, if narrow, race init.js
  // guards against: two independent 'latest' resolutions could otherwise
  // pair a core zip from one version with a tests zip from another if a
  // new release publishes in between.
  let resolvedVersion, oldRelease, newRelease, oldTestsRelease, newTestsRelease;
  try {
    resolvedVersion = await resolveVersion(options.version);
    const fetches = [fetchRelease(lock.version), fetchRelease(resolvedVersion)];
    // Auto-continue: no --with-tests flag on merge itself — whether the
    // test suite was ever installed is read straight from the lock file,
    // so it stays in sync automatically once opted into via init, with no
    // separate flag to remember on every later merge.
    if (lock.testsVersion) {
      fetches.push(fetchTestsRelease(lock.testsVersion), fetchTestsRelease(resolvedVersion));
    }
    // Promise.allSettled, not Promise.all — a real, found-by-review gap:
    // Promise.all rejects and abandons immediately on the first failure,
    // so any OTHER fetch among these 2-4 that had already resolved by then
    // (its own real temp directory already on disk) was never cleaned up,
    // permanently leaking it. allSettled waits for every fetch to finish
    // one way or the other, so every successfully-resolved release can
    // still be cleaned up before this function throws.
    const settled = await Promise.allSettled(fetches);
    const firstRejection = settled.find((r) => r.status === 'rejected');
    if (firstRejection) {
      await Promise.all(
        settled.filter((r) => r.status === 'fulfilled').map((r) => r.value.cleanup().catch(() => {}))
      );
      throw firstRejection.reason;
    }
    const results = settled.map((r) => r.value);
    [oldRelease, newRelease] = results;
    if (lock.testsVersion) {
      [oldTestsRelease, newTestsRelease] = results.slice(2);
    }
  } catch (err) {
    spinner.stop('Failed to fetch releases');
    throw err;
  }
  spinner.stop(`Comparing v${oldRelease.version} → v${newRelease.version}`);

  const cleanupAll = () =>
    Promise.all([oldRelease.cleanup(), newRelease.cleanup(), oldTestsRelease?.cleanup(), newTestsRelease?.cleanup()].filter(Boolean));

  if (oldRelease.version === newRelease.version) {
    p.outro('Already on this version. Run `toolcrib doctor` to check for local drift instead.');
    await cleanupAll();
    return;
  }

  const changes = new PendingChanges();
  const results = newResults();
  // `mergeEngine` is a test seam ('git' | 'js'), not a CLI flag.
  const engine = options.mergeEngine ?? ((await isGitInstalled()) ? 'git' : 'js');
  const ctx = { changes, results, engine, oldVersion: oldRelease.version, newVersion: newRelease.version };

  await diffReleaseFiles(projectRoot, oldRelease, newRelease, ctx);
  if (oldTestsRelease && newTestsRelease) {
    await diffReleaseFiles(projectRoot, oldTestsRelease, newTestsRelease, ctx);
  }

  await mergeManagedBlocks(projectRoot, oldRelease, newRelease, ctx);

  const known = new Set([
    ...oldRelease.allFiles(),
    ...newRelease.allFiles(),
    ...(oldTestsRelease?.allFiles() ?? []),
    ...(newTestsRelease?.allFiles() ?? []),
  ]);
  results.projectAdded = findProjectAdded(projectRoot, known, Boolean(lock.testsVersion));

  await cleanupAll();

  // package.json: the target release's peerDependencies the project doesn't
  // have yet (a release can introduce new ones -- e.g. the Base UI switch
  // added @base-ui/react), plus installs from before the "imports" subpath
  // entry existed. One combined patch, same reason as init.js: two propose()
  // calls for the same relPath would both diff against the original file.
  const pkgPath = path.join(projectRoot, 'package.json');
  const userPkg = readJsonIfExists(pkgPath);
  let depConflicts = [];
  let removedPeers = [];
  if (userPkg) {
    const depDecisions = resolveDependencyDecisions(userPkg, newRelease.config?.peerDependencies ?? {});
    const pkgWithDeps = depDecisions.toAdd.length > 0
      ? buildProposedPackageJson(userPkg, depDecisions.toAdd)
      : userPkg;
    // The vendored tests' own peers are dev tooling, so devDependencies, as in init.
    const testsDepDecisions = newTestsRelease
      ? resolveDependencyDecisions(pkgWithDeps, newTestsRelease.config?.peerDependencies ?? {})
      : null;
    const pkgWithAllDeps = testsDepDecisions?.toAdd.length > 0
      ? buildProposedPackageJson(pkgWithDeps, testsDepDecisions.toAdd, 'devDependencies')
      : pkgWithDeps;
    depConflicts = [...depDecisions.conflicts, ...(testsDepDecisions?.conflicts ?? [])];
    // Peers the old release needed and the new one doesn't: reported, never
    // removed -- the project may use them itself.
    const newPeers = newRelease.config?.peerDependencies ?? {};
    removedPeers = Object.keys(oldRelease.config?.peerDependencies ?? {}).filter(
      (name) => !(name in newPeers) && (userPkg.dependencies?.[name] || userPkg.devDependencies?.[name])
    );
    const importsResult = mergeImportsField(pkgWithAllDeps, TOOLKIT_IMPORTS_ENTRY);
    if (depDecisions.toAdd.length > 0 || testsDepDecisions?.toAdd.length > 0 || importsResult.changed) {
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
  const lockChange = proposeLockUpdate(
    projectRoot,
    newRelease.version,
    lock.testsVersion ? { testsVersion: newRelease.version } : {}
  );
  changes.propose(lockChange.relPath, lockChange.current, lockChange.proposed, '.toolcrib-lock.json');

  // Keeps .toolcrib-tests-config.json in sync too, same reasoning and same
  // unconditional-overwrite treatment as init.js's own step 4b — this is
  // meta-configuration (peerDependencies) a tool like toolcrib-mcp reads
  // directly off disk, not vendored source meant to be hand-customized.
  if (newTestsRelease) {
    const testsConfigPath = 'toolcrib/.toolcrib-tests-config.json';
    const proposedTestsConfig = JSON.stringify(newTestsRelease.config, null, 2) + '\n';
    changes.propose(
      testsConfigPath,
      readTextIfExists(path.join(projectRoot, testsConfigPath)),
      proposedTestsConfig,
      '.toolcrib-tests-config.json'
    );
  }

  if (!changes.isEmpty()) {
    await changes.writeAll(projectRoot);
  }

  const conflicts = results.conflicts.filter((c) => !c.collision);
  const collisions = results.conflicts.filter((c) => c.collision);

  p.log.success(
    `${results.updated} updated, ${results.merged.length} merged, ${results.absorbed.length} absorbed upstream, ` +
      `${results.kept} kept-local, ${results.projectAdded.length} project-added, ` +
      `${conflicts.length} conflict(s), ${collisions.length} collision(s), ${results.deleted} removed.`
  );
  const list = (title, items) => {
    if (items.length > 0) p.log.info(`${title}:\n${items.map((x) => `  ${x}`).join('\n')}`);
  };
  list('Merged (both sides changed, no overlap)', results.merged);
  list('Absorbed upstream (the new release already contains your change)', results.absorbed);
  list('Project-added (kept, not part of toolcrib)', results.projectAdded);
  const conflictLine = (c) => `  ${c.displayPath}  [${c.kind}] note: ${c.notePath}`;
  if (conflicts.length > 0) {
    p.log.warn(
      `${conflicts.length} conflict(s) — both local and upstream changed:\n` +
        conflicts.map(conflictLine).join('\n') +
        `\n\nFiles marked [markers] are staged with conflict markers to resolve after apply; for the others your file is untouched. ` +
        `Notes live in ./toolcrib-patches/${NOTES_DIR}/ and are never applied into ./toolcrib/.`
    );
  }
  if (collisions.length > 0) {
    p.log.warn(
      `${collisions.length} collision(s) — you added a file at a path the new release now ships:\n` +
        collisions.map(conflictLine).join('\n')
    );
  }

  if (depConflicts.length > 0) {
    process.exitCode = 1;
    p.log.warn(
      `${depConflicts.length} dependency conflict(s) — not staged, needs your decision:\n` +
        depConflicts
          .map((d) => `  ${d.name}: you have ${d.userRange}, toolcrib needs ${d.requiredRange} (${d.reason})`)
          .join('\n')
    );
  }
  if (removedPeers.length > 0) {
    p.log.info(
      `No longer required by toolcrib (left in package.json; remove them if your own code doesn't use them): ${removedPeers.join(', ')}`
    );
  }

  p.outro(changes.isEmpty() ? 'No changes to apply.' : 'Review ./toolcrib-patches/, then run `toolcrib apply`.');
}
