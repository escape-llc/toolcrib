import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as p from '@clack/prompts';
import { fetchRelease } from '../lib/release.js';
import { readLock } from '../lib/project.js';
import { listFilesRecursive } from '../lib/zip.js';
import { analyzeExport } from '../lib/exportPatches.js';
import {
  contributionFolder,
  patchFileName,
  renderSummary,
  renderReadme,
  parseIntents,
  INTENT_PLACEHOLDER,
} from '../lib/exportFormat.js';
import {
  defaultRunGh,
  ghLogin,
  createDiscussion,
  addDiscussionComment,
  buildPostPlan,
  CATEGORY_URL,
  MAX_BODY,
} from '../lib/discussions.js';

const TOOLKIT_DIR = 'toolcrib';
const DEFAULT_OUT = './toolcrib-upstream';
const MARKER = '.toolcrib-export';
// Meta-configuration the CLI itself writes, never toolkit source.
const SKIP_LOCAL = new Set(['.toolcrib-lock.json', '.toolcrib-tests-config.json']);

const cliVersion = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;

function readLocalFiles(projectRoot) {
  const root = path.join(projectRoot, TOOLKIT_DIR);
  const files = new Map();
  for (const relPath of listFilesRecursive(root)) {
    if (SKIP_LOCAL.has(relPath)) continue;
    files.set(relPath, fs.readFileSync(path.join(root, relPath), 'utf-8'));
  }
  return files;
}

/** Refuse to clear a directory this command didn't create. Returns an error string, or null when safe. */
function checkOutDir(outDir) {
  if (!fs.existsSync(outDir)) return null;
  if (!fs.statSync(outDir).isDirectory()) return `${outDir} exists and is not a directory.`;
  const entries = fs.readdirSync(outDir);
  if (entries.length > 0 && !entries.includes(MARKER)) {
    return `${outDir} is not empty and was not created by \`toolcrib export-patches\` (no ${MARKER} marker). Choose another --out, or remove it yourself.`;
  }
  return null;
}

/** Upstream path of a patch, from its `+++ b/` header (or `--- a/` for a deletion). */
function upstreamPathOf(patchText) {
  const plus = /^\+\+\+ b\/(.+)$/m.exec(patchText);
  if (plus) return plus[1].trim();
  const minus = /^--- a\/(.+)$/m.exec(patchText);
  return minus ? minus[1].trim() : null;
}

async function postExport(options) {
  const projectRoot = process.cwd();
  const runGh = options.runGh ?? defaultRunGh;
  const confirm = options.confirm ?? p.confirm;
  const isTTY = options.isTTY ?? Boolean(process.stdin.isTTY);
  p.intro('toolcrib export-patches --post');

  const outDir = path.resolve(projectRoot, options.out ?? DEFAULT_OUT);
  if (!fs.existsSync(path.join(outDir, MARKER))) {
    p.log.error(`No export found at ${outDir}; run \`toolcrib export-patches\` first.`);
    process.exitCode = 1;
    return;
  }

  const folders = fs
    .readdirSync(outDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const plans = [];
  for (const folder of folders) {
    const dir = path.join(outDir, folder);
    const postedFile = path.join(dir, 'posted.json');
    if (fs.existsSync(postedFile)) {
      let url = '';
      try {
        url = JSON.parse(fs.readFileSync(postedFile, 'utf8')).url ?? '';
      } catch {
        // unreadable record: still treat as posted
      }
      p.log.info(`${folder}: already posted${url ? ` (${url})` : ''}; skipping.`);
      continue;
    }
    const summaryPath = path.join(dir, 'SUMMARY.md');
    if (!fs.existsSync(summaryPath)) continue;
    const summaryText = fs.readFileSync(summaryPath, 'utf8');
    const patches = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.patch'))
      .sort()
      .map((fileName) => {
        const text = fs.readFileSync(path.join(dir, fileName), 'utf8');
        return { fileName, upstreamPath: upstreamPathOf(text) ?? fileName, text };
      });
    plans.push({ folder, dir, summaryText, plan: buildPostPlan({ summaryText, patches }) });
  }

  if (plans.length === 0) {
    p.outro('Nothing to post.');
    return;
  }

  const unspecified = plans.filter((x) => parseIntents(x.summaryText).includes(INTENT_PLACEHOLDER));
  if (unspecified.length) {
    p.log.warn(
      `These contributions still have \`intent: ${INTENT_PLACEHOLDER}\` in SUMMARY.md: ${unspecified.map((x) => x.folder).join(', ')}`
    );
  }

  const login = ghLogin(runGh);
  if (!login) {
    p.log.info(
      `gh CLI not found or not logged in. To post by hand: open ${CATEGORY_URL}, start a new discussion, use the title below and paste SUMMARY.md as the body (and each patch as a comment if the body is over ${MAX_BODY.toLocaleString('en-US')} characters).\n` +
        plans.map((x) => `  ${x.folder}: ${x.plan.title}`).join('\n')
    );
    p.outro('Not posted.');
    return;
  }

  p.log.info(
    plans
      .map((x) => `${x.plan.title}\n  body ${x.plan.body.length} chars, ${x.plan.comments.length} comment(s)`)
      .join('\n') + `\nPosting as @${login} to escape-llc/toolcrib → Consumer Patches`
  );

  if (!options.yes) {
    if (!isTTY) {
      p.log.info('Not an interactive terminal; re-run with --yes to post.');
      p.outro('Not posted.');
      return;
    }
    const answer = await confirm({ message: `Post ${plans.length} discussion(s)?`, initialValue: false });
    if (p.isCancel(answer) || !answer) {
      p.outro('Not posted.');
      return;
    }
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-post-'));
  try {
    let n = 0;
    for (const { folder, dir, plan } of plans) {
      try {
        const write = (text) => {
          const file = path.join(tmp, `${++n}.md`);
          fs.writeFileSync(file, text);
          return file;
        };
        const { id, url } = createDiscussion(runGh, { title: plan.title, bodyFile: write(plan.body) });
        const commentUrls = [];
        for (const c of plan.comments) {
          commentUrls.push(addDiscussionComment(runGh, { discussionId: id, bodyFile: write(c) }));
        }
        fs.writeFileSync(
          path.join(dir, 'posted.json'),
          JSON.stringify({ url, id, postedAt: new Date().toISOString(), comments: commentUrls }, null, 2) + '\n'
        );
        p.log.success(`${folder}: ${url}`);
      } catch (err) {
        p.log.error(`${folder}: ${err.message}`);
        process.exitCode = 1;
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  p.outro(process.exitCode === 1 ? 'Finished with errors.' : 'Posted.');
}

export async function exportPatchesCommand(options = {}) {
  if (options.post) return postExport(options);
  const projectRoot = process.cwd();
  p.intro('toolcrib export-patches');

  const lock = readLock(projectRoot);
  if (!lock) {
    p.log.error('No toolcrib install found (missing .toolcrib-lock.json). Run `toolcrib init` first.');
    process.exitCode = 1;
    return;
  }

  const outDir = path.resolve(projectRoot, options.out ?? DEFAULT_OUT);
  const outError = checkOutDir(outDir);
  if (outError) {
    p.log.error(outError);
    process.exitCode = 1;
    return;
  }

  const spinner = p.spinner();
  spinner.start(`Fetching installed release (v${lock.version})`);
  let release;
  try {
    release = await fetchRelease(lock.version);
  } catch (err) {
    spinner.stop('Failed to fetch release');
    throw err;
  }
  spinner.stop(`Comparing ./${TOOLKIT_DIR}/ against v${release.version}`);

  let analysis;
  try {
    const releaseFiles = new Map();
    for (const relPath of release.allFiles()) releaseFiles.set(relPath, release.readFile(relPath));
    analysis = analyzeExport({ releaseFiles, localFiles: readLocalFiles(projectRoot) });
  } finally {
    await release.cleanup();
  }

  if (!analysis.hasChanges) {
    p.log.info('No changes to vendored toolkit source.');
    p.outro('Nothing to export.');
    return;
  }

  const baseVersion = release.version;
  const entries = analysis.contributions.map((contribution, i) => ({
    folder: contributionFolder(i, contribution.name),
    contribution,
  }));

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, MARKER), 'Created by `toolcrib export-patches`; safe to replace.\n');

  for (const { folder, contribution } of entries) {
    const dir = path.join(outDir, folder);
    fs.mkdirSync(dir, { recursive: true });
    const patches = contribution.files
      .filter((f) => f.patch)
      .map((file, i) => ({ file, fileName: patchFileName(i, file.upstreamPath) }));
    for (const { file, fileName } of patches) fs.writeFileSync(path.join(dir, fileName), file.patch);
    fs.writeFileSync(
      path.join(dir, 'SUMMARY.md'),
      renderSummary({
        contribution,
        baseVersion,
        cliVersion,
        notExported: analysis.notExported,
        regeneratedUpstream: analysis.regeneratedUpstream,
        patches,
      })
    );
  }
  fs.writeFileSync(
    path.join(outDir, 'README.md'),
    renderReadme({
      baseVersion,
      entries,
      notExported: analysis.notExported,
      regeneratedUpstream: analysis.regeneratedUpstream,
      appSpecific: analysis.appSpecific,
      ambiguous: analysis.ambiguous,
    })
  );

  p.log.success(
    `${entries.length} contribution(s) written to ${outDir}` +
      `\n  ${analysis.notExported.length} file(s) not exported` +
      `\n  ${analysis.appSpecific.length} app-specific shared-file hunk(s)` +
      `\n  ${analysis.ambiguous.length} ambiguous shared-file hunk(s)`
  );
  const outArg = options.out ? ` --out ${options.out}` : '';
  p.outro(
    `Fill in each contribution's \`intent:\` lines in its SUMMARY.md, review, then run \`toolcrib export-patches --post${outArg}\`.`
  );
}
