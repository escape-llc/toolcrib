#!/usr/bin/env node
/**
 * Resolves one of the 13 fixed audit segments (scripts/lib/auditSegments.js)
 * to a real, current list of source files, for `.github/workflows/gemini-audit.yml`
 * (issue #407 -- weekly scheduled Gemini codebase audit, rotating across
 * codebase segments) to bundle up and hand to Gemini.
 *
 * Deliberately does NOT hardcode a per-component file path anywhere -- a
 * component-shaped segment's file list is resolved by scanning
 * src/components/** with the exact same TypeScript-Compiler-API machinery
 * generate-manifest.js itself uses (scripts/lib/extract.js's
 * listSourceFiles/parse/findComponentDeclarations), matching a component
 * NAME (hand-maintained only where a category needs sub-splitting -- see
 * auditSegments.js's own header comment for why that part can't be
 * mechanically derived) to its real, current file. A directory-shaped
 * segment (theme engine, CLI, MCP, ...) is resolved via `git ls-files`,
 * scoped to tracked files only, so build artifacts/node_modules never leak
 * in even without an explicit exclude list.
 *
 * Usage:
 *   node scripts/audit-segment.js                       # this week's segment (ISO week number mod 13), JSON to stdout
 *   node scripts/audit-segment.js --segment <id>          # a specific segment, by id (workflow_dispatch manual override)
 *   node scripts/audit-segment.js --date 2026-09-15       # the segment for a specific date, instead of today (testing the rotation)
 *   node scripts/audit-segment.js --list                  # print every segment id + title, one per line, then exit
 *   node scripts/audit-segment.js --out <path>             # write the {id, title, fileCount, files} JSON result to a file instead of stdout
 *   node scripts/audit-segment.js --bundle-out <path>       # write every resolved file's real content, concatenated with `--- <path> ---` headers, to a file -- what gemini-audit.yml actually hands Gemini
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, COMPONENTS_DIR, listSourceFiles, parse, findComponentDeclarations } from './lib/extract.js';
import { SEGMENTS, SPLIT_CATEGORIES, getSegmentForDate, findSegmentById, findCategorySplitDrift } from './lib/auditSegments.js';

function toRepoRelativePosix(absPath) {
  return path.relative(ROOT, absPath).split(path.sep).join('/');
}

/** Every `@manifest`-tagged component in src/components/**, as {name, category, filePath} -- one pass, shared by every component-shaped segment plus the cross-category drift check. */
function buildComponentIndex() {
  const index = [];
  for (const filePath of listSourceFiles(COMPONENTS_DIR)) {
    const sourceFile = parse(filePath);
    for (const decl of findComponentDeclarations(sourceFile)) {
      if (!decl.category) continue; // validateCategories() (generate-manifest.js's own check) is the authority on this being an error; not this script's job to enforce
      index.push({ name: decl.name, category: decl.category, filePath: toRepoRelativePosix(filePath) });
    }
  }
  return index;
}

/** Tracked (git-known) files under a repo-relative dir -- never pulls in node_modules/build output, without needing an explicit exclude list for either. */
function gitLsFiles(repoRelativeDir) {
  const out = execFileSync('git', ['ls-files', '--', repoRelativeDir], { cwd: ROOT, encoding: 'utf-8' });
  return out.split('\n').filter(Boolean);
}

// A 'dirs'-kind segment walks a whole directory tree via git ls-files, which
// (unlike a component-kind segment's listSourceFiles(), already filtered to
// .ts/.tsx) picks up whatever's actually tracked there -- confirmed for
// real against this repo's own tree: demo/toolcrib-256x256.png (binary --
// fs.readFileSync(..., 'utf-8') on it produces garbage, not a helpful
// review target) and scripts/package-lock.json (65KB of auto-generated
// noise no review has any use for). Reviewable source/text only.
const REVIEWABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.css', '.yml', '.yaml', '.html']);
const EXCLUDED_BASENAMES = new Set(['package-lock.json']);

function isReviewable(repoRelativePath) {
  const basename = path.basename(repoRelativePath);
  if (EXCLUDED_BASENAMES.has(basename)) return false;
  return REVIEWABLE_EXTENSIONS.has(path.extname(basename));
}

function resolveSegmentFiles(segment, componentIndex) {
  let files;
  if (segment.kind === 'components') {
    const matches = componentIndex.filter((c) => c.category === segment.category && (!segment.names || segment.names.includes(c.name)));
    files = new Set(matches.map((c) => c.filePath));
    for (const extra of segment.extraFiles ?? []) files.add(extra);
  } else {
    files = new Set();
    for (const dir of segment.dirs) {
      for (const f of gitLsFiles(dir)) {
        if (isReviewable(f)) files.add(f);
      }
    }
    for (const excluded of segment.excludeFiles ?? []) files.delete(excluded);
  }
  return [...files].sort();
}

/** Warns (does not fail -- this is a best-effort audit job, not check-manifest) if a hand-maintained sub-split `names` list has drifted from the real, current manifest categories. */
function warnOnCategorySplitDrift(componentIndex) {
  for (const category of Object.values(SPLIT_CATEGORIES)) {
    const realNames = componentIndex.filter((c) => c.category === category).map((c) => c.name);
    const { unassigned, duplicated } = findCategorySplitDrift(category, realNames);
    if (unassigned.length > 0) {
      console.warn(
        `[audit-segment] "${category}" has ${unassigned.length} component(s) not assigned to either of its audit sub-segments (never reviewed by this rotation until scripts/lib/auditSegments.js is updated): ${unassigned.join(', ')}`
      );
    }
    if (duplicated.length > 0) {
      console.warn(
        `[audit-segment] "${category}" has component(s) assigned to more than one audit sub-segment: ${duplicated.map((d) => `${d.name} (${d.segmentIds.join(', ')})`).join('; ')}`
      );
    }
  }
}

function parseArgs(argv) {
  const args = { segment: null, date: null, list: false, out: null, bundleOut: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--segment') args.segment = argv[++i];
    else if (argv[i] === '--date') args.date = argv[++i];
    else if (argv[i] === '--list') args.list = true;
    else if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--bundle-out') args.bundleOut = argv[++i];
  }
  return args;
}

/**
 * Concatenates every resolved file's real content into one text file, each
 * prefixed with a `--- <repo-relative path> ---` header -- the same
 * "hand Gemini one FILE, not many individual read_file calls or embedded
 * text" shape gemini-review.yml already uses for a PR diff, and for the
 * same two reasons documented there: no per-call size surprises, and no
 * ambiguity about whether every file was actually included.
 */
function writeBundle(bundleOutPath, files) {
  const parts = files.map((f) => `--- ${f} ---\n${fs.readFileSync(path.join(ROOT, f), 'utf-8')}`);
  fs.writeFileSync(bundleOutPath, parts.join('\n\n') + '\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    for (const s of SEGMENTS) console.log(`${s.id}\t${s.title}`);
    return;
  }

  const componentIndex = buildComponentIndex();
  warnOnCategorySplitDrift(componentIndex);

  const segment = args.segment ? findSegmentById(args.segment) : getSegmentForDate(args.date ? new Date(args.date) : new Date());
  const files = resolveSegmentFiles(segment, componentIndex);

  if (files.length === 0) {
    throw new Error(`Segment "${segment.id}" resolved to zero files -- this almost always means a directory/name was renamed and auditSegments.js is now stale.`);
  }

  const result = { id: segment.id, title: segment.title, fileCount: files.length, files };

  if (args.bundleOut) {
    writeBundle(args.bundleOut, files);
    console.error(`Wrote segment "${segment.id}" (${files.length} file(s)) bundle to ${args.bundleOut}`);
  }

  if (args.out) {
    fs.writeFileSync(args.out, JSON.stringify(result, null, 2) + '\n');
    console.error(`Wrote segment "${segment.id}" (${files.length} file(s)) to ${args.out}`);
  } else if (!args.bundleOut) {
    console.log(JSON.stringify(result, null, 2));
  }
}

main();
