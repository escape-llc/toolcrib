#!/usr/bin/env node
/**
 * Pulls the four free, already-existing usage signals for this repo/package
 * — no telemetry, no new infrastructure, nothing vendored into consumer
 * projects. Run it periodically (`npm run usage-report`) to build a real
 * time series instead of eyeballing one-off numbers:
 *
 *  - npm downloads for the `toolcrib` CLI package (last 30 days) — the
 *    noisiest of the four. New npm packages routinely see large single-day
 *    spikes from registry mirrors and automated dependency/vulnerability
 *    scanners that have nothing to do with real installs; don't read the
 *    total at face value, look at the day-by-day shape for spikes like that.
 *  - npm downloads for the `toolcrib-mcp` package (last 30 days) — added
 *    2026-09-04, once that package existed to track. Same noise caveat as
 *    the CLI's own number, but a meaningfully different population: nobody
 *    gets `toolcrib-mcp` from `npx toolcrib init` alone -- it only gets
 *    pulled when someone deliberately wires it into an MCP host's own
 *    config (`.mcp.json`/`.cursor/mcp.json`/etc.), which is closer to real
 *    engagement than a bare CLI install that may never get used again.
 *  - This repo's release asset downloads (`toolcrib.zip`, summed across
 *    every published release) — the most precise signal of the four: it
 *    only increments when the CLI's `init`/`merge` actually fetches a real
 *    release (cli/src/lib/release.js's fetchRelease -> downloadReleaseZip),
 *    not on every npm install or `--version` check.
 *  - GitHub repo traffic (views/clones, stars/forks/watchers) — clones
 *    specifically track git-protocol fetches of the repo's source, a
 *    different population than "people running the CLI" (source readers,
 *    crawlers, AI training/indexing bots) — kept separate from the release
 *    download count for exactly that reason, not summed together.
 *
 * Traffic views/clones are a 14-day rolling window (GitHub doesn't expose
 * anything longer via this endpoint) -- that's the actual reason to run
 * this on a cadence and keep history, not just check it once: a single
 * snapshot can't show a trend, and the window itself would silently roll
 * past anything not captured.
 *
 * Every number here can currently include the maintainer's own dev/test
 * traffic (repeated `npm install`/`init`/`merge` runs across sessions,
 * repo clones for new sessions to work from) with no way to separate that
 * from real outside usage — confirmed, not assumed. That's exactly why
 * this script computes and highlights the DELTA since the last saved
 * report as the headline, not the absolute totals: once a baseline is
 * established, sustained movement above whatever the maintainer's own
 * background activity produces is the actual signal to watch for.
 *
 * History is saved to .plans/usage-reports.jsonl (gitignored -- this is
 * private tracking data, not shipped content, same boundary as every other
 * .plans/ file) as one JSON object per run, oldest first. Requires `gh`
 * CLI, already authenticated (this script shells out to it rather than
 * managing its own token) -- the traffic/views and traffic/clones
 * endpoints specifically need push access to the repo, so this only works
 * run as the maintainer.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO = 'escape-llc/toolcrib';
const NPM_PACKAGE = 'toolcrib';
const NPM_PACKAGE_MCP = 'toolcrib-mcp';
const RELEASE_ASSET_NAME = 'toolcrib.zip';
const HISTORY_PATH = path.join(process.cwd(), '.plans', 'usage-reports.jsonl');

function gh(apiPath) {
  const out = execSync(`gh api ${apiPath}`, { encoding: 'utf-8' });
  return JSON.parse(out);
}

async function fetchNpmDownloads(days, packageName) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const fmt = d => d.toISOString().slice(0, 10);
  const url = `https://api.npmjs.org/downloads/range/${fmt(start)}:${fmt(end)}/${packageName}`;
  const res = await fetch(url);
  // A brand-new package with zero downloads on the range's start date
  // returns a 404 (no per-package record exists yet) rather than a
  // zero-filled range -- not a real error, just "no data yet."
  if (!res.ok) return { total: 0, maxDay: null };
  const data = await res.json();
  const total = data.downloads.reduce((sum, d) => sum + d.downloads, 0);
  const maxDay = data.downloads.reduce((max, d) => (d.downloads > (max?.downloads ?? -1) ? d : max), null);
  return { total, maxDay };
}

function fetchReleaseDownloads() {
  const releases = gh(`repos/${REPO}/releases`);
  let total = 0;
  const perRelease = releases.map(r => {
    const asset = r.assets.find(a => a.name === RELEASE_ASSET_NAME);
    const downloads = asset ? asset.download_count : 0;
    total += downloads;
    return { tag: r.tag_name, downloads };
  });
  return { total, perRelease };
}

function fetchRepoTraffic() {
  const views = gh(`repos/${REPO}/traffic/views`);
  const clones = gh(`repos/${REPO}/traffic/clones`);
  const repo = gh(`repos/${REPO}`);
  return {
    views: { count: views.count, uniques: views.uniques },
    clones: { count: clones.count, uniques: clones.uniques },
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    watchers: repo.subscribers_count,
  };
}

function loadHistory() {
  if (!fs.existsSync(HISTORY_PATH)) return [];
  return fs
    .readFileSync(HISTORY_PATH, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function appendHistory(entry) {
  fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
  fs.appendFileSync(HISTORY_PATH, JSON.stringify(entry) + '\n');
}

// Signed delta string against the previous saved report, or a "first
// report" note when there's nothing to compare against yet -- the
// no-history case matters enough to say explicitly rather than silently
// printing a bare number with no marker that it isn't a delta at all.
function deltaStr(curr, prev) {
  if (prev == null) return '(first report — no baseline yet)';
  const d = curr - prev;
  if (d === 0) return '(no change)';
  return `(${d > 0 ? '+' : ''}${d} since last report)`;
}

async function main() {
  const history = loadHistory();
  const previous = history.length > 0 ? history[history.length - 1] : null;

  const [npm, npmMcp, releases, traffic] = await Promise.all([
    fetchNpmDownloads(30, NPM_PACKAGE),
    fetchNpmDownloads(30, NPM_PACKAGE_MCP),
    Promise.resolve(fetchReleaseDownloads()),
    Promise.resolve(fetchRepoTraffic()),
  ]);

  const timestamp = new Date().toISOString();
  const report = {
    timestamp,
    npmDownloads30d: npm.total,
    mcpNpmDownloads30d: npmMcp.total,
    releaseDownloadsTotal: releases.total,
    releaseDownloadsPerTag: releases.perRelease,
    trafficViews14d: traffic.views.count,
    trafficViewsUniques14d: traffic.views.uniques,
    trafficClones14d: traffic.clones.count,
    trafficClonesUniques14d: traffic.clones.uniques,
    stars: traffic.stars,
    forks: traffic.forks,
    watchers: traffic.watchers,
  };

  console.log(`toolcrib usage report — ${timestamp}`);
  if (previous) {
    console.log(`(previous report: ${previous.timestamp})`);
  }
  console.log('');
  console.log(`npm downloads (${NPM_PACKAGE}), last 30d:     ${report.npmDownloads30d} ${previous ? deltaStr(report.npmDownloads30d, previous.npmDownloads30d) : ''}`);
  if (npm.maxDay && npm.maxDay.downloads > 0) {
    console.log(`  largest single day:            ${npm.maxDay.downloads} on ${npm.maxDay.day} — verify this isn't a scanner/mirror spike before reading the total as real installs`);
  }
  console.log(`npm downloads (${NPM_PACKAGE_MCP}), last 30d: ${report.mcpNpmDownloads30d} ${previous ? deltaStr(report.mcpNpmDownloads30d, previous.mcpNpmDownloads30d ?? null) : ''}`);
  if (npmMcp.maxDay && npmMcp.maxDay.downloads > 0) {
    console.log(`  largest single day:            ${npmMcp.maxDay.downloads} on ${npmMcp.maxDay.day} — same scanner/mirror caveat applies`);
  }
  console.log(`release asset (${RELEASE_ASSET_NAME}) downloads, all-time: ${report.releaseDownloadsTotal} ${previous ? deltaStr(report.releaseDownloadsTotal, previous.releaseDownloadsTotal) : ''}`);
  console.log(`  the precise "someone ran init/merge for real" count -- see this file's own header comment for why`);
  console.log(`repo traffic, last 14d:          ${report.trafficViews14d} views (${report.trafficViewsUniques14d} unique) ${previous ? deltaStr(report.trafficViewsUniques14d, previous.trafficViewsUniques14d) : ''}`);
  console.log(`repo clones, last 14d:           ${report.trafficClones14d} (${report.trafficClonesUniques14d} unique) ${previous ? deltaStr(report.trafficClonesUniques14d, previous.trafficClonesUniques14d) : ''}`);
  console.log(`stars / forks / watchers:        ${report.stars} / ${report.forks} / ${report.watchers}`);
  console.log('');
  console.log('Reading these numbers: every source above can include the maintainer\'s own');
  console.log('dev/test traffic (repeated installs, fresh clones for new sessions), with no');
  console.log('way to separate that from real outside usage. Absolute totals mean less than');
  console.log('the deltas shown above once a few reports exist -- sustained movement beyond');
  console.log('normal background activity is the actual signal.');

  appendHistory(report);
  console.log(`\nSaved to ${path.relative(process.cwd(), HISTORY_PATH)} (${history.length + 1} report(s) total).`);
}

main().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});
