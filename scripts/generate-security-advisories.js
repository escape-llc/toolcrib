#!/usr/bin/env node
/**
 * Generates security-advisories.json from the toolcrib repo's own CodeQL
 * code-scanning alerts -- never hand-authored, for the same reason
 * component-manifest.json isn't: a human-typed entry drifts from real
 * state silently, this doesn't.
 *
 * The only human judgment call in this pipeline happens on GitHub itself,
 * before this script ever runs: a maintainer either dismisses a false
 * positive (recorded as the alert's own `dismissed_reason`) or leaves a
 * real one to be fixed (recorded as `state: "fixed"` once the fix lands
 * and CodeQL re-scans). Both outcomes are already structured data on the
 * alert -- this script reads that decision back out via the API rather
 * than asking anyone to re-record it by typing JSON.
 *
 * All the actual filtering/derivation logic lives in
 * scripts/lib/securityAdvisories.js (unit-tested directly, no network) --
 * this file is a thin orchestrator: fetch real alert/release data, hand
 * it to that pure logic, write or check the result. See that file's own
 * comments for exactly what each output field is derived from and why
 * (severity fallback, fixedIn resolution, the shipped-path scope filter).
 *
 * Auth: the code-scanning alerts API is not public even on a public repo
 * -- needs a token with `security_events: read` (a fine-grained PAT) or,
 * in this repo's own CI, the default GITHUB_TOKEN with that permission
 * granted in ci.yml's `test` job. Read from GITHUB_TOKEN locally too
 * (e.g. `GITHUB_TOKEN=$(gh auth token) node scripts/generate-security-advisories.js --check`).
 * This auth requirement is scoped to *running this generator* -- doctor's
 * own fetch of the already-generated file (cli/src/lib/github.js's
 * fetchSecurityAdvisories) is a plain, unauthenticated public read of a
 * committed repo file, same shape as everything else it already fetches.
 *
 * Usage:
 *   node scripts/generate-security-advisories.js            # check mode (default) -- exits 1 on drift
 *   node scripts/generate-security-advisories.js --check     # same, explicit
 *   node scripts/generate-security-advisories.js --write     # regenerate security-advisories.json in full
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAdvisoryEntries } from './lib/securityAdvisories.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = path.join(ROOT, 'security-advisories.json');
const REPO = 'escape-llc/toolcrib';
const API_BASE = 'https://api.github.com';

function authHeaders() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    throw new Error(
      'GITHUB_TOKEN (or GH_TOKEN) is not set -- the code-scanning alerts API needs a token with ' +
        "security_events: read, even on a public repo. Locally: GITHUB_TOKEN=$(gh auth token) node scripts/generate-security-advisories.js --check"
    );
  }
  return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
}

async function fetchAllPages(urlBase) {
  const results = [];
  let page = 1;
  for (;;) {
    const res = await fetch(`${urlBase}${urlBase.includes('?') ? '&' : '?'}per_page=100&page=${page}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch ${urlBase}: ${res.status} ${res.statusText}`);
    const batch = await res.json();
    results.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return results;
}

async function fetchFixedAlerts() {
  return fetchAllPages(`${API_BASE}/repos/${REPO}/code-scanning/alerts?state=fixed&tool_name=CodeQL`);
}

async function fetchSortedPublishedReleases() {
  const releases = await fetchAllPages(`${API_BASE}/repos/${REPO}/releases`);
  return releases
    .filter((r) => !r.draft && !r.prerelease)
    .map((r) => ({ version: r.tag_name.replace(/^v/, ''), publishedAt: r.published_at }))
    .sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));
}

async function main() {
  const mode = process.argv.includes('--write') ? 'write' : 'check';
  const [alerts, releases] = await Promise.all([fetchFixedAlerts(), fetchSortedPublishedReleases()]);
  const generated = buildAdvisoryEntries(alerts, releases);
  const serialized = JSON.stringify(generated, null, 2) + '\n';

  if (mode === 'write') {
    fs.writeFileSync(OUTPUT_PATH, serialized);
    console.log(`Wrote security-advisories.json: ${generated.length} advisory/advisories.`);
    return;
  }

  const current = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, 'utf-8') : null;
  if (current === serialized) {
    console.log('security-advisories.json matches real CodeQL alert state exactly.');
    return;
  }

  console.error('security-advisories.json is out of date with real CodeQL alert state.');
  console.error(`Run 'node scripts/generate-security-advisories.js --write' to regenerate, then review the diff.`);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
