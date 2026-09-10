import path from 'node:path';
import semver from 'semver';
import * as p from '@clack/prompts';
import { fetchRelease, fetchTestsRelease } from '../lib/release.js';
import { normalize } from '../lib/patches.js';
import { readJsonIfExists, readLock, readTextIfExists, fileExists } from '../lib/project.js';
import { fetchLatestVersion, fetchSecurityAdvisories } from '../lib/github.js';
import { MANAGED_DOCS, KNOWN_TARGET_FILES, listManagedBlocks } from '../lib/managedDocs.js';
import { detectBundler } from '../lib/bundler.js';
import { checkRootProviderWired } from '../lib/rootProvider.js';

const TOOLKIT_DIR = './toolcrib';

// moduleResolution modes under which TypeScript actually reads package.json
// "imports" subpaths (what makes `import { Card } from '#toolcrib'`
// type-check, not just run). Anything else — including TS's own default —
// resolves the import at runtime via bundler/Node but reports a false
// "Cannot find module" in the editor and tsc.
const IMPORTS_COMPATIBLE_MODULE_RESOLUTIONS = new Set(['bundler', 'node16', 'nodenext']);

/**
 * Read-only check: will `import ... from '#toolcrib'` type-check under this
 * project's tsconfig? Returns null when there's nothing to warn about (no
 * tsconfig.json — e.g. a plain JS project — or an already-compatible
 * moduleResolution). Otherwise returns the offending value for the warning
 * message ('' meaning unset/default).
 */
export function checkImportsCompatibility(projectRoot) {
  const tsconfig = readJsonIfExists(path.join(projectRoot, 'tsconfig.json'));
  if (!tsconfig) return null;

  const moduleResolution = (tsconfig.compilerOptions?.moduleResolution || '').toLowerCase();
  if (IMPORTS_COMPATIBLE_MODULE_RESOLUTIONS.has(moduleResolution)) return null;

  return moduleResolution;
}

/**
 * Read-only heuristic: does this project appear to be a TypeScript project
 * at all? Absence of `tsconfig.json` is the same signal
 * `checkImportsCompatibility` already treats as "nothing to check here,
 * e.g. a plain JS project" — this check exists specifically to make that
 * case non-silent instead. toolcrib's own components are fully typed so
 * that an invalid prop value (a typo'd `variant`, a misspelled event name,
 * a prop that doesn't exist on that component) fails at compile time —
 * a `.jsx`/`.js` consumer gets none of that, since `tsc` doesn't
 * type-check plain JS by default. Confirmed as a real failure mode, not
 * hypothetical: a real consumer app passed `variant="solid"` — not a
 * value any toolcrib `Button` variant accepts — and it shipped invisibly
 * for the life of the project until it happened to visually collide with
 * an unrelated layout change and got noticed by eye.
 */
export function checkTypeScriptAdopted(projectRoot) {
  return fileExists(path.join(projectRoot, 'tsconfig.json'));
}

/**
 * Which vendored files (under TOOLKIT_DIR) differ from what `release`
 * actually shipped — shared by the core-toolkit drift check and the
 * --with-tests drift check below, since both are the exact same
 * "local vs. shipped, normalized" comparison over a different file set
 * (test relPaths are already `__tests__/`-prefixed, same as init.js/
 * merge.js's handling — see release.js's fetchTestsRelease).
 */
function computeDrift(projectRoot, release) {
  const drifted = [];
  for (const relPath of release.allFiles()) {
    const targetPath = path.join(projectRoot, TOOLKIT_DIR, relPath);
    const local = readTextIfExists(targetPath);
    const shipped = release.readFile(relPath);
    if (normalize(local) !== normalize(shipped)) {
      drifted.push(relPath);
    }
  }
  return drifted;
}

/**
 * Read-only drift check for managed <!-- toolcrib:managed:... --> blocks
 * inside AGENTS.md/CLAUDE.md — the same question the vendored-file drift
 * check above answers, but for content merged into files the CLI doesn't
 * otherwise own. `installedRelease` (already fetched for the vendored-file
 * check) is reused when a block's own recorded version matches the
 * installed one — the common case — rather than re-fetching.
 */
export async function checkManagedBlocks(projectRoot, installedRelease) {
  const messages = [];

  for (const targetFile of KNOWN_TARGET_FILES) {
    const content = readTextIfExists(path.join(projectRoot, targetFile));
    if (!content) continue;

    for (const block of listManagedBlocks(content)) {
      const docFile = MANAGED_DOCS[block.docId];

      let originalDocContent;
      try {
        if (block.version === installedRelease.version) {
          originalDocContent = installedRelease.readFile(`ai-docs/${docFile}`);
        } else {
          const atVersionRelease = await fetchRelease(block.version);
          originalDocContent = atVersionRelease.readFile(`ai-docs/${docFile}`);
          await atVersionRelease.cleanup();
        }
      } catch {
        messages.push({
          level: 'warn',
          text: `${targetFile}: managed block "${block.docId}" claims version ${block.version}, which no longer resolves to a release — can't verify drift.`,
        });
        continue;
      }

      // block.content was already trimEnd()'d at extraction (see
      // extractFence) — originalDocContent is a raw file read and still has
      // its trailing newline, so it must be trimmed the same way before
      // comparing, or every block would falsely register as drifted purely
      // from that trailing newline (confirmed via a real end-to-end run:
      // this fired for every managed block, not just hand-edited ones).
      if (normalize(block.content) !== normalize(originalDocContent).trimEnd()) {
        messages.push({
          level: 'warn',
          text: `${targetFile}: managed block "${block.docId}" (v${block.version}) was edited by hand — it's meant to be regenerated by 'toolcrib merge', not edited directly. Move your own notes outside the fence, then run 'toolcrib merge' to restore it.`,
        });
      }
      if (block.version !== installedRelease.version) {
        messages.push({
          level: 'info',
          text: `${targetFile}: managed block "${block.docId}" is at v${block.version}, installed toolkit is v${installedRelease.version} — run 'toolcrib merge' to update it too.`,
        });
      }
    }
  }

  return messages;
}

/**
 * Every managed block currently sitting in AGENTS.md/CLAUDE.md, available
 * to reprint on demand — no network access, no lockfile requirement, just
 * `listManagedBlocks` over whatever's already on disk. `docIdFilter`
 * narrows to one docId; omitted, every block found across both files is
 * returned. Doesn't validate `docIdFilter` against MANAGED_DOCS itself —
 * an unrecognized filter here would just silently produce `[]`, the wrong
 * failure mode for a typo'd docId, so that check lives in the caller.
 */
export function listReprintableBlocks(projectRoot, docIdFilter) {
  const results = [];
  for (const targetFile of KNOWN_TARGET_FILES) {
    const content = readTextIfExists(path.join(projectRoot, targetFile));
    if (!content) continue;
    for (const block of listManagedBlocks(content)) {
      if (docIdFilter && block.docId !== docIdFilter) continue;
      results.push({ targetFile, ...block });
    }
  }
  return results;
}

/**
 * Reports drift without staging any patches — a read-only diagnostic.
 * "No drift" here answers a different question than "are you on the
 * latest version," which is checked separately below; the two are
 * deliberately not conflated (see design notes).
 */
export async function doctorCommand(options = {}) {
  const projectRoot = process.cwd();

  // Reprint mode is a different question entirely from everything below —
  // "what's the current managed-block content" rather than "has anything
  // drifted" — so it branches before p.intro/readLock and skips both.
  // Left entirely clack-free (no p.log, no intro/outro): the block content
  // is meant to be re-fed into an agent's context, and clack's per-line
  // `│` decoration would corrupt copy/paste of multi-line Markdown: kept
  // the whole branch undecorated rather than just the payload lines, so
  // there's no orphaned p.log message with no intro/outro frame around it.
  if (options.reprintManagedBlock !== undefined) {
    const docIdFilter = options.reprintManagedBlock === true ? undefined : options.reprintManagedBlock;
    if (docIdFilter !== undefined && !MANAGED_DOCS[docIdFilter]) {
      console.error(`Unknown docId "${docIdFilter}" — expected one of: ${Object.keys(MANAGED_DOCS).join(', ')}`);
      process.exitCode = 1;
      return;
    }
    const blocks = listReprintableBlocks(projectRoot, docIdFilter);
    if (blocks.length === 0) {
      console.warn(
        docIdFilter
          ? `No managed block "${docIdFilter}" found in AGENTS.md/CLAUDE.md.`
          : 'No managed blocks found in AGENTS.md/CLAUDE.md — nothing to reprint.'
      );
      return;
    }
    for (const block of blocks) {
      console.log(`--- ${block.targetFile}: managed block "${block.docId}" (v${block.version}) ---`);
      console.log(block.content);
      console.log('');
    }
    return;
  }

  p.intro('toolcrib doctor');

  const lock = readLock(projectRoot);
  if (!lock) {
    p.log.error('No toolcrib install found. Run `toolcrib init` first.');
    process.exitCode = 1;
    return;
  }

  const spinner = p.spinner();
  spinner.start(`Checking against installed version v${lock.version}`);
  // Network-dependent section 1 of 2: drift check against the installed
  // release. A failure here (rate limit, network down, bad release asset)
  // should only skip *this* check, not abort bundler detection/root-provider
  // check/etc. below — those are 100% local and would otherwise succeed.
  // Also fetches the --with-tests artifact when lock.testsVersion is set —
  // same "only skip this one check" failure isolation, independently of
  // whether the core fetch itself succeeded.
  let release = null;
  let releaseFetchError = null;
  let testsRelease = null;
  let testsReleaseFetchError = null;
  try {
    release = await fetchRelease(lock.version);
  } catch (err) {
    releaseFetchError = err;
  }
  if (lock.testsVersion) {
    try {
      testsRelease = await fetchTestsRelease(lock.testsVersion);
    } catch (err) {
      testsReleaseFetchError = err;
    }
  }

  if (release) {
    const drifted = computeDrift(projectRoot, release);
    const managedBlockMessages = await checkManagedBlocks(projectRoot, release);
    await release.cleanup();
    spinner.stop('Drift check complete');

    if (drifted.length === 0) {
      p.log.success(`No local drift detected from v${lock.version}.`);
    } else {
      p.log.warn(
        `${drifted.length} file(s) differ from the shipped v${lock.version}:\n` +
          drifted.map((f) => `  ${f}`).join('\n')
      );
    }

    if (managedBlockMessages.length === 0) {
      p.log.success('No managed AGENTS.md/CLAUDE.md blocks found, or none have drifted.');
    } else {
      for (const message of managedBlockMessages) {
        p.log[message.level](message.text);
      }
    }
  } else {
    spinner.stop('Drift check skipped');
    p.log.warn(`Could not fetch v${lock.version} to check for drift: ${releaseFetchError.message}`);
  }

  // --with-tests drift check — only runs when lock.testsVersion is set
  // (i.e. the test suite was ever vendored via `toolcrib init --with-tests`
  // or kept in sync by a later `toolcrib merge`). Reported separately from
  // the core-drift block above, worded distinctly, so a reader can't
  // mistake test-source drift for core-toolkit drift or vice versa.
  if (lock.testsVersion) {
    if (testsRelease) {
      const testsDrifted = computeDrift(projectRoot, testsRelease);
      await testsRelease.cleanup();

      if (testsDrifted.length === 0) {
        p.log.success(`No local drift detected in the vendored test suite (v${lock.testsVersion}).`);
      } else {
        p.log.warn(
          `${testsDrifted.length} test-suite file(s) differ from the shipped v${lock.testsVersion}:\n` +
            testsDrifted.map((f) => `  ${f}`).join('\n')
        );
      }
    } else {
      p.log.warn(`Could not fetch test-suite v${lock.testsVersion} to check for drift: ${testsReleaseFetchError.message}`);
    }
  }

  // Network-dependent section 2 of 2: "is a newer version available."
  // Independent failure point from the drift check above (different
  // GitHub endpoint, same rate limit) — same rule applies: a failure here
  // shouldn't take out the local-only checks that follow.
  // fetchLatestVersion (GitHub's dedicated /releases/latest endpoint), not
  // listVersions — doctor only ever needs the single newest release to
  // compare against what's installed, not every release's full metadata.
  try {
    const newestVersion = await fetchLatestVersion();
    if (newestVersion !== lock.version) {
      p.log.info(`A newer version is available: v${newestVersion} (installed: v${lock.version}). Run 'toolcrib merge'.`);
    } else {
      p.log.info('You are on the latest release.');
    }
  } catch (err) {
    p.log.warn(`Could not check for a newer release: ${err.message}`);
  }

  // Network-dependent section 3 of 3: security advisories, generated from
  // real CodeQL findings (see scripts/generate-security-advisories.js).
  // Independent failure point from the version check above -- this file
  // always lives on the toolcrib repo's own main branch, never in a
  // consumer's vendored copy (a frozen snapshot that structurally can't
  // know about anything published after it), so it's fetched fresh on
  // every run for the same reason fetchLatestVersion is. Enriches the
  // version check above rather than replacing it: same underlying
  // question ("is there a newer version worth getting"), this just says
  // *why* when the answer is yes for a real, fixed vulnerability.
  try {
    const advisories = await fetchSecurityAdvisories();
    const relevant = advisories
      .filter((a) => semver.gt(a.fixedIn, lock.version))
      .sort((a, b) => semver.compare(b.fixedIn, a.fixedIn));
    for (const a of relevant) {
      p.log.warn(
        `Security: v${a.fixedIn} fixes a ${a.severity.toUpperCase()}-severity issue (installed: v${lock.version}) -- ` +
          `${a.summary}\n  ${a.url}\n  Run 'toolcrib merge' to update.`
      );
    }
  } catch (err) {
    p.log.warn(`Could not check for security advisories: ${err.message}`);
  }

  if (!checkTypeScriptAdopted(projectRoot)) {
    p.log.warn(
      'No tsconfig.json found — this project doesn\'t appear to be using TypeScript. ' +
        'Every toolcrib component ships a full, exact prop type specifically so an invalid value ' +
        '(a typo\'d variant, a misspelled event name, a prop that doesn\'t exist) fails at compile ' +
        'time instead of shipping silently — a plain JS/JSX project gets none of that protection. ' +
        'See NEW_APP.md\'s "Already started in JavaScript?" section to convert.'
    );
  }

  const badModuleResolution = checkImportsCompatibility(projectRoot);
  if (badModuleResolution !== null) {
    p.log.warn(
      `tsconfig.json's "moduleResolution" is ${badModuleResolution ? `"${badModuleResolution}"` : 'unset (defaulting to a legacy mode)'}, ` +
        `which doesn't type-check package.json "imports" subpaths. The toolkit's ` +
        `\`import { ... } from '#toolcrib'\` will still run correctly (bundlers and Node resolve it fine), ` +
        `but tsc/your editor may report "Cannot find module '#toolcrib'". ` +
        `Set "moduleResolution": "bundler" (or "node16"/"nodenext") in compilerOptions to fix the false error.`
    );
  }

  const pkg = readJsonIfExists(path.join(projectRoot, 'package.json'));
  const bundler = detectBundler(projectRoot, pkg);
  if (bundler?.note) {
    p.log.info(`Detected ${bundler.label} — ${bundler.note}`);
  }

  const rootProvider = checkRootProviderWired(projectRoot);
  if (rootProvider.found) {
    p.log.success(
      rootProvider.via === 'ToolcribProvider'
        ? 'Root providers: <ToolcribProvider> found.'
        : 'Root providers: manual <ThemeProvider>/<ToastProvider>/<ToastContainer> composition found.'
    );
  } else {
    p.log.warn(
      "Root providers: couldn't find <ToolcribProvider> or a manual <ThemeProvider>/<ToastProvider>/<ToastContainer> " +
        'composition anywhere under src/. Every toolcrib component throws or silently no-ops without one of these ' +
        "wrapping your app root — see CORE.md's Root Setup section. (Heuristic text scan — a false warning is possible if your root " +
        'setup uses an unusual file layout or a re-exported alias; verify directly if you believe it\'s already wired.)'
    );
  }

  p.outro('Done.');
}
