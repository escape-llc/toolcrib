import path from 'node:path';
import * as p from '@clack/prompts';
import { fetchRelease } from '../lib/release.js';
import { PendingChanges } from '../lib/patches.js';
import { resolveDependencyDecisions, buildProposedPackageJson } from '../lib/deps.js';
import { readJsonIfExists, readTextIfExists, proposeGitignore, proposeLockUpdate } from '../lib/project.js';

const TOOLKIT_DIR = './toolcrib';

export async function initCommand(options) {
  const projectRoot = process.cwd();

  p.intro('toolcrib init');

  const spinner = p.spinner();
  spinner.start(`Resolving version "${options.version}"`);
  let release;
  try {
    release = await fetchRelease(options.version);
  } catch (err) {
    spinner.stop(`Failed to resolve/download version "${options.version}"`);
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
    changes.propose(path.join(TOOLKIT_DIR, relPath), currentContent, proposedContent, relPath);
  }

  // 2. package.json — propose only the additions, never touch existing entries.
  const pkgPath = path.join(projectRoot, 'package.json');
  const userPkg = readJsonIfExists(pkgPath);
  if (!userPkg) {
    p.log.error('No package.json found in the current directory. Run this from your project root.');
    process.exitCode = 1;
    await release.cleanup();
    return;
  }

  const depDecisions = resolveDependencyDecisions(userPkg, release.config.peerDependencies);
  if (depDecisions.toAdd.length > 0) {
    const proposedPkg = buildProposedPackageJson(userPkg, depDecisions.toAdd);
    changes.propose(
      'package.json',
      readTextIfExists(pkgPath),
      JSON.stringify(proposedPkg, null, 2) + '\n',
      'package.json'
    );
  }

  // 3. .gitignore — same propose() mechanism, no special-casing required.
  const gitignoreChange = proposeGitignore(projectRoot);
  if (gitignoreChange) {
    changes.propose(gitignoreChange.relPath, gitignoreChange.current, gitignoreChange.proposed, '.gitignore');
  }

  // 4. Version lockfile — the only piece of state persisted between runs.
  const lockChange = proposeLockUpdate(projectRoot, release.version);
  changes.propose(lockChange.relPath, lockChange.current, lockChange.proposed, '.toolcrib-lock.json');

  await release.cleanup();

  if (changes.isEmpty()) {
    p.outro('Nothing to do — already up to date with this version.');
    return;
  }

  const written = await changes.writeAll(projectRoot);
  p.log.success(`Staged ${changes.count()} change(s):\n${changes.summarize()}`);

  reportConflicts(depDecisions);

  p.outro(
    `Review the patches in ./toolcrib-patches/, then run:\n` +
      `  toolcrib apply\n\n` +
      `Once applied, integrate AI context:\n` +
      `  See ./toolcrib/ai-docs/ for files to merge into AGENTS.md / CLAUDE.md\n` +
      `  (or ask your AI assistant to do it for you)`
  );
}

function reportConflicts(depDecisions) {
  if (depDecisions.conflicts.length === 0) return;
  p.log.warn(
    `${depDecisions.conflicts.length} dependency conflict(s) — not staged, needs your decision:\n` +
      depDecisions.conflicts
        .map((c) => `  ${c.name}: you have ${c.userRange}, toolcrib needs ${c.requiredRange} (${c.reason})`)
        .join('\n')
  );
}
