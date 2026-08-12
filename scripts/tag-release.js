#!/usr/bin/env node
/**
 * Tags the current commit with `v<package.json version>` and pushes it —
 * the exact tag shape release.yml requires (it derives the expected
 * version by stripping a leading "v" off GITHUB_REF_NAME and comparing
 * against package.json). Reading the version from package.json instead of
 * typing it by hand at tag time is what keeps the two from drifting apart.
 *
 * Refuses to tag unless the working tree is clean AND the current branch
 * matches its upstream exactly (no unpushed local commits, nothing to
 * pull) — a tag is supposed to identify a specific commit everyone else
 * can see; tagging local-only or uncommitted state would make the tag a
 * lie the moment someone else checks it out.
 *
 * Usage:
 *   node scripts/tag-release.js            create + push the tag
 *   node scripts/tag-release.js --dry-run  print what would happen, do nothing
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DRY_RUN = process.argv.includes('--dry-run');

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf-8' }).trim();
}

function readVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
  if (!pkg.version) throw new Error('package.json has no "version" field.');
  return pkg.version;
}

function main() {
  // A dirty tree means the tag might not point at what package.json's
  // version claims it does — e.g. an uncommitted bump, or unrelated
  // in-progress work. Refuse rather than guess.
  const status = git(['status', '--porcelain']);
  if (status) {
    throw new Error(`Working tree is not clean — commit or stash before tagging:\n${status}`);
  }

  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);

  let upstream;
  try {
    upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  } catch {
    throw new Error(`Branch "${branch}" has no upstream configured — can't verify it matches origin.`);
  }

  // Fetch first so the comparison below reflects origin's actual current
  // state, not a stale local view of it from the last fetch/pull.
  git(['fetch', 'origin']);

  const localHead = git(['rev-parse', 'HEAD']);
  const upstreamHead = git(['rev-parse', upstream]);
  if (localHead !== upstreamHead) {
    const ahead = git(['rev-list', '--count', `${upstream}..HEAD`]);
    const behind = git(['rev-list', '--count', `HEAD..${upstream}`]);
    throw new Error(
      `"${branch}" and "${upstream}" have diverged (${ahead} commit(s) ahead, ${behind} behind) — ` +
        `push/pull to sync before tagging.`
    );
  }

  const version = readVersion();
  const tag = `v${version}`;

  const existingLocal = git(['tag', '--list', tag]);
  if (existingLocal) {
    throw new Error(`Tag ${tag} already exists locally. Bump package.json's version first.`);
  }

  const existingRemote = git(['ls-remote', '--tags', 'origin', tag]);
  if (existingRemote) {
    throw new Error(`Tag ${tag} already exists on origin. Bump package.json's version first.`);
  }

  const shortHead = git(['rev-parse', '--short', 'HEAD']);

  if (DRY_RUN) {
    console.log(`[dry run] Would tag ${shortHead} as ${tag} and push it to origin.`);
    return;
  }

  git(['tag', '-a', tag, '-m', `Release ${tag}`]);
  git(['push', 'origin', tag]);

  console.log(`Tagged ${shortHead} as ${tag} and pushed it to origin.`);
}

main();
