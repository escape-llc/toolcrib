import fs from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
import { fetchRelease } from '../lib/release.js';
import { readLock } from '../lib/project.js';
import { listFilesRecursive } from '../lib/zip.js';
import { analyzeExport } from '../lib/exportPatches.js';
import { contributionFolder, patchFileName, renderSummary, renderReadme } from '../lib/exportFormat.js';

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

export async function exportPatchesCommand(options = {}) {
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
  p.outro("Fill in each contribution's `intent:` lines in its SUMMARY.md and review before posting.");
}
