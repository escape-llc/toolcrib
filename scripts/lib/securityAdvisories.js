/**
 * Pure logic for scripts/generate-security-advisories.js, split out the
 * same way extract.js is split from generate-manifest.js/generate-docs.js
 * -- so it's unit-testable with plain fixtures, without the generator
 * script's own network/auth dependency (fetching real code-scanning
 * alerts and release data) ever entering the picture.
 */

// Matches build-release.js's own VENDOR_DIRS (theme/eventBus/observer/
// components, all under src/) plus ai-docs/ and eslint-rules/ (ship as-is,
// see AGENTS.md's "Distribution & path handling"), plus the two
// independently-published npm packages' own source (cli/src, mcp/src) --
// everything a consumer, in one form or another, actually receives.
export const SHIPPED_PATH_PREFIXES = [
  'src/theme/',
  'src/eventBus/',
  'src/observer/',
  'src/components/',
  'ai-docs/',
  'eslint-rules/',
  'cli/src/',
  'mcp/src/',
];

// CodeQL's own query severity, used only when a rule carries no CVSS-
// derived security_severity_level (informational/best-practice rules
// mostly don't) -- an approximation, not a substitute for the real band.
export const SEVERITY_FALLBACK = { error: 'high', warning: 'medium', note: 'low' };

export function isShippedPath(location) {
  return typeof location === 'string' && SHIPPED_PATH_PREFIXES.some((prefix) => location.startsWith(prefix));
}

export function resolveSeverity(rule) {
  return rule.security_severity_level || SEVERITY_FALLBACK[rule.severity] || 'medium';
}

/**
 * `sortedReleases` must already be sorted oldest-first by publishedAt.
 * Returns the earliest release published at or after `fixedAt`, or null
 * if no qualifying release exists yet (fixed on main, not released) --
 * the caller drops these rather than emitting a null fixedIn.
 */
export function resolveFixedIn(fixedAt, sortedReleases) {
  const found = sortedReleases.find((r) => new Date(r.publishedAt) >= new Date(fixedAt));
  return found ? found.version : null;
}

/**
 * `alerts` are already filtered to state=fixed by the caller's API query
 * (see generate-security-advisories.js) -- this still drops any that
 * carry a dismissed_reason as a defensive second check, since a dismissed
 * alert was a real, human-made "not a real issue" call and must never
 * produce an advisory regardless of what state the query filter reports.
 */
export function buildAdvisoryEntries(alerts, sortedReleases) {
  const entries = [];
  for (const alert of alerts) {
    if (alert.dismissed_reason) continue;

    const location = alert.most_recent_instance?.location?.path;
    if (!isShippedPath(location)) continue;

    const fixedIn = resolveFixedIn(alert.fixed_at, sortedReleases);
    if (!fixedIn) continue;

    entries.push({
      alertNumber: alert.number,
      rule: alert.rule.id,
      severity: resolveSeverity(alert.rule),
      summary: alert.rule.description,
      location,
      fixedIn,
      url: alert.html_url,
    });
  }

  entries.sort((a, b) => a.alertNumber - b.alertNumber);
  return entries;
}
