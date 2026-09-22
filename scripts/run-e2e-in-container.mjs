#!/usr/bin/env node
/**
 * Runs the real e2e suite (e2e/) inside Microsoft's official Playwright
 * Docker image, matching this repo's CI runner (ubuntu-latest, Ubuntu
 * 24.04 "noble") as closely as a local machine can. Works with either
 * Docker Desktop (`docker`) or Podman (`podman`) -- whichever is on PATH,
 * or force one via CONTAINER_ENGINE=docker|podman.
 *
 * Why this exists: this repo's e2e suite runs against real Chromium/WebKit,
 * and font-metric/layout rendering genuinely differs between a contributor's
 * own OS (Windows, macOS) and CI's Linux runner -- confirmed directly
 * (issue #542/PR #543): a fix that measurably worked on a real local
 * Windows browser produced byte-identical CI failures, because the actual
 * discrepancy was Linux-only and had nothing to do with the code under
 * test at all being reasoned about correctly, just an unavailable local
 * repro. Iterating by push-and-wait-for-CI cost real time AND (since
 * gemini-review.yml also fires on every push) real Gemini API spend
 * against a monthly cap. This script closes that gap: the exact same
 * browser/OS combination CI uses, runnable locally in a few seconds per
 * iteration instead of a multi-minute CI round trip.
 *
 * The Playwright image tag is derived from this repo's own installed
 * @playwright/test version (never hand-typed) -- `mcr.microsoft.com/
 * playwright:v<version>-noble` always matches whatever this repo's
 * package.json/lockfile actually pins, so a future Playwright bump can't
 * silently leave this script pointing at a stale, mismatched image.
 *
 * A named volume (not a bind mount, and not an anonymous one) shadows
 * node_modules inside the container -- the host's own node_modules (built
 * for Windows/macOS) must never be overwritten with Linux-built native
 * bindings via a plain bind mount, and a NAMED volume (keyed by Playwright
 * version) persists real npm-install work across runs instead of paying
 * for a fresh `npm ci` every single invocation the way an anonymous
 * volume would.
 *
 * CI=true is set inside the container deliberately -- this repo's own
 * playwright.config.ts branches on it (retries, forbidOnly,
 * reuseExistingServer), and reproducing CI's *exact* behavior, not just
 * its OS/browser, is the whole point.
 *
 * Usage:
 *   node scripts/run-e2e-in-container.mjs [-- <playwright test args>]
 *   npm run test:e2e:linux -- e2e/datatable-density.spec.ts --project=chromium
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

function detectEngine() {
  const forced = process.env.CONTAINER_ENGINE;
  const candidates = forced ? [forced] : ['docker', 'podman'];
  for (const engine of candidates) {
    try {
      execFileSync(engine, ['version'], { stdio: 'ignore' });
      return engine;
    } catch {
      // Not on PATH, or the daemon/machine isn't running -- try the next one.
    }
  }
  console.error(
    `No working container engine found (tried: ${candidates.join(', ')}). ` +
      'Install Docker Desktop or Podman, make sure it is actually running ' +
      '(Docker Desktop open, or `podman machine start`), or set ' +
      'CONTAINER_ENGINE=docker|podman explicitly.'
  );
  process.exit(1);
}

function playwrightVersion() {
  const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'node_modules/@playwright/test/package.json'), 'utf8'));
  return pkg.version;
}

const engine = detectEngine();
const version = playwrightVersion();
const image = `mcr.microsoft.com/playwright:v${version}-noble`;
const volumeName = `toolcrib-e2e-node-modules-${version}`;

// Real bug Gemini's review of this PR caught: a plain `.join(' ')` loses
// each argument's own boundaries the moment any one of them contains a
// space or shell-significant character (`npm run test:e2e:linux -- -g
// "grid nav"`, e.g.) -- the string gets handed to `bash -lc` below, which
// re-splits it on whitespace with no memory of which spaces were meant to
// stay inside one argument. Single-quoting each argument (and escaping
// any single quote already inside it, the standard POSIX-shell technique)
// preserves exactly the same argv `bash -lc` will parse regardless of
// what characters an argument contains.
const extraArgs = process.argv.slice(2);
const quoteForShell = (arg) => `'${arg.replace(/'/g, `'\\''`)}'`;
const testCommand = ['npm', 'ci', '&&', 'npx', 'playwright', 'test', ...extraArgs.map(quoteForShell)].join(' ');

console.log(`Using ${engine}, image ${image}`);

const runArgs = [
  'run',
  '--rm',
  '-t',
  '-e',
  'CI=true',
  '-v',
  `${repoRoot}:/work`,
  '-v',
  `${volumeName}:/work/node_modules`,
  '-w',
  '/work',
  image,
  'bash',
  '-lc',
  testCommand,
];

const result = spawnSync(engine, runArgs, { stdio: 'inherit' });
process.exit(result.status ?? 1);
