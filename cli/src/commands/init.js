import path from 'node:path';
import * as p from '@clack/prompts';
import { fetchRelease, fetchTestsRelease } from '../lib/release.js';
import { resolveVersion } from '../lib/github.js';
import { PendingChanges, joinPatchPath } from '../lib/patches.js';
import { resolveDependencyDecisions, buildProposedPackageJson, mergeImportsField } from '../lib/deps.js';
import { readJsonIfExists, readTextIfExists, fileExists, proposeGitignore, proposeLockUpdate } from '../lib/project.js';
import { MANAGED_DOCS, DEFAULT_TARGET_FILE, KNOWN_TARGET_FILES, upsertManagedBlock } from '../lib/managedDocs.js';

const TOOLKIT_DIR = './toolcrib';
// The subpath-imports entry that gives consumer code a stable, file-location-
// independent way to import the toolkit (`import { Card } from '#toolcrib'`),
// bundler-agnostic per Node's package.json "imports" resolution. Must match
// TOOLKIT_DIR — see build-release.js's INDEX_FILE for the vendored entry point.
const TOOLKIT_IMPORTS_ENTRY = { '#toolcrib': './toolcrib/index.ts' };

// docIds always written, plus the situational one --situation selects.
const SITUATION_TO_DOC_ID = { new: 'new-app', refactor: 'refactor-app' };

/**
 * Which instruction file to write the managed block into. Mirrors what
 * doctor/merge already scan (KNOWN_TARGET_FILES) rather than always
 * defaulting to AGENTS.md — a project that already has a CLAUDE.md (e.g.
 * an existing Claude Code setup) and no AGENTS.md would otherwise get a
 * brand-new AGENTS.md sitting unused next to the file its own assistant
 * actually reads, while merge/doctor go on dutifully tracking blocks in
 * both. First existing file wins; DEFAULT_TARGET_FILE only applies when
 * neither is present yet.
 */
function resolveTargetFile(projectRoot) {
  for (const file of KNOWN_TARGET_FILES) {
    if (readTextIfExists(path.join(projectRoot, file))) return file;
  }
  return DEFAULT_TARGET_FILE;
}

export async function initCommand(options) {
  const projectRoot = process.cwd();

  p.intro('toolcrib init');

  const spinner = p.spinner();
  spinner.start(`Resolving version "${options.version}"`);
  // Resolved once here, then passed as a concrete version string to both
  // fetchRelease and (when --with-tests is set) fetchTestsRelease below —
  // each independently resolving "latest" would risk a real, if narrow,
  // race: a new release publishing between the two calls could pair a
  // core zip from one version with a tests zip from another. Neither
  // fetch function re-resolves once given an already-concrete version
  // (see github.js's resolveVersion), so this costs no extra network call
  // versus before.
  let resolvedVersion, release, testsRelease;
  try {
    resolvedVersion = await resolveVersion(options.version);
    release = await fetchRelease(resolvedVersion);
    if (options.withTests) {
      testsRelease = await fetchTestsRelease(resolvedVersion);
    }
  } catch (err) {
    spinner.stop(`Failed to resolve/download version "${options.version}"`);
    // Real, found-by-review gap: if fetchRelease succeeded but
    // fetchTestsRelease then threw, release's own temp directory was never
    // cleaned up before this rethrow -- a real leak specifically on the
    // --with-tests failure path. .catch(() => {}) on the cleanup itself:
    // a cleanup failure here must never mask the original, more relevant
    // error being thrown below it.
    if (release) await release.cleanup().catch(() => {});
    throw err;
  }
  spinner.stop(`Resolved "${options.version}" → v${release.version}`);

  const changes = new PendingChanges();

  // 1. Every vendored file becomes a propose() call — new-file and
  //    modified-file cases are handled identically (see PendingChanges),
  //    so init and merge share this exact loop shape.
  for (const relPath of release.allFiles()) {
    const proposedContent = release.readFile(relPath);
    const targetPath = path.join(projectRoot, TOOLKIT_DIR, relPath);
    const currentContent = readTextIfExists(targetPath);
    // targetPath above is a real filesystem path (correctly OS-native);
    // this one becomes a patch header and must stay forward-slash — see
    // joinPatchPath's docstring.
    changes.propose(joinPatchPath(TOOLKIT_DIR, relPath), currentContent, proposedContent, relPath);
  }

  // 1b. --with-tests: the optional test-suite artifact, staged the exact
  //     same way as core files above — every path testsRelease.allFiles()
  //     returns is already `__tests__/`-prefixed (see
  //     scripts/build-tests-release.js's own output layout), so proposing
  //     it into TOOLKIT_DIR lands it at ./toolcrib/__tests__/... alongside
  //     core source, one single vendored root rather than a second one.
  if (testsRelease) {
    for (const relPath of testsRelease.allFiles()) {
      const proposedContent = testsRelease.readFile(relPath);
      const targetPath = path.join(projectRoot, TOOLKIT_DIR, relPath);
      const currentContent = readTextIfExists(targetPath);
      changes.propose(joinPatchPath(TOOLKIT_DIR, relPath), currentContent, proposedContent, relPath);
    }
  }

  // 2. package.json — propose only the additions, never touch existing entries.
  const pkgPath = path.join(projectRoot, 'package.json');
  const userPkg = readJsonIfExists(pkgPath);
  if (!userPkg) {
    p.log.error('No package.json found in the current directory. Run this from your project root.');
    process.exitCode = 1;
    await release.cleanup();
    if (testsRelease) await testsRelease.cleanup();
    return;
  }

  const depDecisions = resolveDependencyDecisions(userPkg, release.config.peerDependencies);
  const pkgWithDeps = depDecisions.toAdd.length > 0
    ? buildProposedPackageJson(userPkg, depDecisions.toAdd)
    : userPkg;

  // --with-tests: the test suite's own peerDependencies (vitest,
  // testing-library, jsdom — see toolcrib-tests.config.json) go into
  // devDependencies, not dependencies — dev tooling, not something a
  // consumer's production bundle should carry. Applied on top of
  // pkgWithDeps (core deps already merged), not a separate patch — see
  // the "combined into one patch" note below.
  const testsDepDecisions = testsRelease
    ? resolveDependencyDecisions(pkgWithDeps, testsRelease.config.peerDependencies)
    : null;
  const pkgWithAllDeps = testsDepDecisions?.toAdd.length > 0
    ? buildProposedPackageJson(pkgWithDeps, testsDepDecisions.toAdd, 'devDependencies')
    : pkgWithDeps;

  // Combined into one patch against package.json — a second propose() call
  // for the same relPath would produce two independent diffs both based on
  // the original file, which can't both apply cleanly (see PendingChanges).
  const importsResult = mergeImportsField(pkgWithAllDeps, TOOLKIT_IMPORTS_ENTRY);
  if (depDecisions.toAdd.length > 0 || testsDepDecisions?.toAdd.length > 0 || importsResult.changed) {
    changes.propose(
      'package.json',
      readTextIfExists(pkgPath),
      JSON.stringify(importsResult.pkg, null, 2) + '\n',
      'package.json'
    );
  }

  // 3. .gitignore — same propose() mechanism, no special-casing required.
  const gitignoreChange = proposeGitignore(projectRoot, release.version);
  if (gitignoreChange) {
    changes.propose(gitignoreChange.relPath, gitignoreChange.current, gitignoreChange.proposed, '.gitignore');
  }

  // 4. Version lockfile — the only piece of state persisted between runs.
  //    testsVersion is recorded alongside version only when --with-tests
  //    was actually passed — this is what lets merge later auto-detect
  //    "was the test suite installed" and keep it in sync without needing
  //    its own flag on every subsequent merge.
  const lockChange = proposeLockUpdate(
    projectRoot,
    release.version,
    testsRelease ? { testsVersion: testsRelease.version } : {}
  );
  changes.propose(lockChange.relPath, lockChange.current, lockChange.proposed, '.toolcrib-lock.json');

  // 4b. --with-tests: also vendor toolcrib-tests.config.json's own content
  // (as .toolcrib-tests-config.json, alongside the lock file) -- not just
  // the test files themselves. release.js's allFiles() deliberately
  // excludes this filename from the file loop above (same reason
  // fetchRelease's own allFiles() excludes toolcrib.config.json), since
  // it's fetch-time metadata, not vendored source -- but its
  // peerDependencies are the one piece of that metadata a later consumer
  // (a toolcrib-mcp get_test_source tool, e.g.) has no other way to ever
  // see, since toolcrib-mcp only ever reads what's already on disk in a
  // vendored install, never a live fetch. Proposed unconditionally, like
  // the lock file itself -- this is meta-configuration a consumer has no
  // reason to hand-edit, not vendored source meant to be customized.
  if (testsRelease) {
    const testsConfigPath = 'toolcrib/.toolcrib-tests-config.json';
    const proposedTestsConfig = JSON.stringify(testsRelease.config, null, 2) + '\n';
    changes.propose(
      testsConfigPath,
      readTextIfExists(path.join(projectRoot, testsConfigPath)),
      proposedTestsConfig,
      '.toolcrib-tests-config.json'
    );
  }

  // 5. AI instruction file — always propose the "core" managed block. The
  //    situational docs (new-app / refactor-app) need --situation since the
  //    CLI can't infer which applies; without it, the outro just tells the
  //    user which flag to re-run with (or to add the block manually,
  //    wrapped in the same fence, for `doctor`/`merge` to still track it).
  const situationDocId = SITUATION_TO_DOC_ID[options.situation];
  const docIdsToWrite = situationDocId ? ['core', situationDocId] : ['core'];

  const agentsFileExisted = fileExists(path.join(projectRoot, 'AGENTS.md'));
  const claudeFileExisted = fileExists(path.join(projectRoot, 'CLAUDE.md'));

  const targetFile = resolveTargetFile(projectRoot);
  const agentsPath = path.join(projectRoot, targetFile);
  const originalAgentsContent = readTextIfExists(agentsPath);
  let proposedAgentsContent = originalAgentsContent;
  for (const docId of docIdsToWrite) {
    const docContent = release.readFile(`ai-docs/${MANAGED_DOCS[docId]}`);
    proposedAgentsContent = upsertManagedBlock(proposedAgentsContent, docId, release.version, docContent);
  }
  if (proposedAgentsContent !== originalAgentsContent) {
    changes.propose(targetFile, originalAgentsContent, proposedAgentsContent, targetFile);
  }

  // 5b. Claude Code discovery: Claude Code reads CLAUDE.md by default, not
  // AGENTS.md (this repo's own root CLAUDE.md is a one-line `@AGENTS.md`
  // import for exactly that reason). resolveTargetFile() only falls back to
  // AGENTS.md when NEITHER file existed yet — in that specific case, a
  // Claude Code user would otherwise get instructions their own tool never
  // discovers. Scoped strictly to that case: an existing AGENTS.md-only
  // setup (even without a CLAUDE.md) reflects a choice already made and
  // shouldn't be second-guessed uninvited. Staged as its own independent
  // patch (see PendingChanges.propose), so a non-Claude-Code user can just
  // delete that one patch file before `toolcrib apply` and keep everything
  // else.
  const claudeStubProposed = !agentsFileExisted && !claudeFileExisted && targetFile === 'AGENTS.md';
  if (claudeStubProposed) {
    changes.propose('CLAUDE.md', '', '@AGENTS.md\n', 'CLAUDE.md');
  }

  await release.cleanup();
  if (testsRelease) await testsRelease.cleanup();

  if (changes.isEmpty()) {
    p.outro('Nothing to do — already up to date with this version.');
    return;
  }

  const written = await changes.writeAll(projectRoot);
  p.log.success(`Staged ${changes.count()} change(s):\n${changes.summarize()}`);

  reportConflicts([...depDecisions.conflicts, ...(testsDepDecisions?.conflicts ?? [])]);

  const missingSituation = !situationDocId
    ? `\n\nThis staged a "core" block in ${targetFile}, but not a situational one — re-run with ` +
      `--situation new (greenfield project) or --situation refactor (adopting into an existing app) to add it, ` +
      `or add it by hand wrapped in the same <!-- toolcrib:managed:... --> fence so 'toolcrib merge' can still ` +
      `track it. See ./toolcrib/ai-docs/NEW_APP.md / REFACTOR_APP.md.`
    : '';

  const claudeStubNote = claudeStubProposed
    ? `\n\nAlso staged a minimal CLAUDE.md (\`@AGENTS.md\`) since neither file existed yet — Claude Code reads ` +
      `CLAUDE.md by default, not AGENTS.md, so this is what makes the staged instructions visible to it. Not ` +
      `using Claude Code? Delete the CLAUDE.md patch under ./toolcrib-patches/ before running 'toolcrib apply' ` +
      `and everything else still applies cleanly.`
    : '';

  // testsRelease is real, runnable Vitest + Testing Library source if this
  // project already matches that stack (the low-friction default for a
  // Vite-scaffolded project — see NEW_APP.md). If it doesn't — most
  // commonly an existing Jest setup adopted via REFACTOR_APP.md — a broad
  // test-runner glob could auto-discover these files and fail on missing
  // Vitest globals; exclude ./toolcrib/__tests__/ from that config first.
  const withTestsNote = testsRelease
    ? `\n\nAlso staged the real component test suite under ./toolcrib/__tests__/ (Vitest + Testing Library). ` +
      `If this project already uses Vitest, these run as-is. If it uses a different test runner (e.g. Jest), ` +
      `exclude ./toolcrib/__tests__/ from that runner's own config before running your test suite, or it may ` +
      `try to auto-discover these files and fail on missing Vitest globals — then adapt what you need by hand.`
    : '';

  p.outro(
    `Review the patches in ./toolcrib-patches/, then run:\n` +
      `  toolcrib apply${missingSituation}${claudeStubNote}${withTestsNote}`
  );
}

function reportConflicts(conflicts) {
  if (conflicts.length === 0) return;
  // Matches doctor.js/merge.js: both set process.exitCode = 1 for their own
  // "needs a human/AI decision" states. init.js previously didn't, which
  // meant a real dependency conflict (e.g. a React major outside toolcrib's
  // supported range) and a fully clean init were indistinguishable to
  // anything checking the exit code — a script, CI step, or an agent
  // deciding whether to proceed unattended. The warning text alone isn't
  // enough if nothing downstream ever inspects stdout for it.
  process.exitCode = 1;
  p.log.warn(
    `${conflicts.length} dependency conflict(s) — not staged, needs your decision:\n` +
      conflicts
        .map((c) => `  ${c.name}: you have ${c.userRange}, toolcrib needs ${c.requiredRange} (${c.reason})`)
        .join('\n')
  );
}
