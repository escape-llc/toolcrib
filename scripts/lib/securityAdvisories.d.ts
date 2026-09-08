// Hand-written type declarations for securityAdvisories.js -- scripts/ is
// excluded from root tsconfig's own `include` (it's a separate, isolated
// TS 6.x project, see AGENTS.md's TypeScript section), so a .ts test file
// under src/__tests__/ importing this plain .js module needs a declaration
// file to type-check at all, since `allowJs` isn't enabled at root.

export interface CodeScanningRule {
  severity?: string;
  security_severity_level?: string;
  id?: string;
  description?: string;
}

export interface CodeScanningAlert {
  number: number;
  dismissed_reason?: string | null;
  fixed_at: string;
  html_url: string;
  rule: CodeScanningRule;
  most_recent_instance?: { location?: { path?: string } };
}

export interface PublishedRelease {
  version: string;
  publishedAt: string;
}

export interface AdvisoryEntry {
  alertNumber: number;
  rule?: string;
  severity: string;
  summary?: string;
  location: string;
  fixedIn: string;
  url: string;
}

export const SHIPPED_PATH_PREFIXES: string[];
export const SEVERITY_FALLBACK: Record<string, string>;

export function isShippedPath(location: unknown): boolean;
export function resolveSeverity(rule: CodeScanningRule): string;
export function resolveFixedIn(fixedAt: string, sortedReleases: PublishedRelease[]): string | null;
export function buildAdvisoryEntries(alerts: CodeScanningAlert[], sortedReleases: PublishedRelease[]): AdvisoryEntry[];
