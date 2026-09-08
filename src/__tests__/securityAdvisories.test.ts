import { describe, it, expect } from 'vitest';
import {
  isShippedPath,
  resolveSeverity,
  resolveFixedIn,
  buildAdvisoryEntries,
} from '../../scripts/lib/securityAdvisories.js';

// Pure-logic tests only -- no network, no auth. The generator script that
// actually fetches real code-scanning-alert/release data
// (scripts/generate-security-advisories.js) is verified separately by
// running it live against this repo's own real alert history (see
// AGENTS.md's security-advisories section) rather than mocked here.

describe('isShippedPath', () => {
  it('accepts every real shipped-directory prefix', () => {
    expect(isShippedPath('src/theme/shadow.ts')).toBe(true);
    expect(isShippedPath('src/eventBus/eventBus.ts')).toBe(true);
    expect(isShippedPath('src/observer/foo.ts')).toBe(true);
    expect(isShippedPath('src/components/Modal/Modal.tsx')).toBe(true);
    expect(isShippedPath('ai-docs/CORE.md')).toBe(true);
    expect(isShippedPath('eslint-rules/no-unexplained-zindex.js')).toBe(true);
    expect(isShippedPath('cli/src/commands/doctor.js')).toBe(true);
    expect(isShippedPath('mcp/src/server.js')).toBe(true);
  });

  it('rejects the real dev-only file behind alerts #1/#2 (js/path-injection) -- confirms the filter would have excluded them', () => {
    expect(isShippedPath('cli/integration-test/mock-github-server.js')).toBe(false);
  });

  it('rejects other non-shipped locations (demo/, scripts/, workflow files)', () => {
    expect(isShippedPath('demo/App.tsx')).toBe(false);
    expect(isShippedPath('scripts/generate-manifest.js')).toBe(false);
    expect(isShippedPath('.github/workflows/ci.yml')).toBe(false);
  });

  it('rejects a path that merely contains a shipped prefix mid-string rather than starting with it', () => {
    expect(isShippedPath('vendor/src/components/Modal.tsx')).toBe(false);
  });

  it('handles a missing/undefined location without throwing', () => {
    expect(isShippedPath(undefined)).toBe(false);
    expect(isShippedPath(null)).toBe(false);
  });
});

describe('resolveSeverity', () => {
  it('prefers the CVSS-derived security_severity_level when present', () => {
    expect(resolveSeverity({ security_severity_level: 'critical', severity: 'warning' })).toBe('critical');
  });

  it('falls back to the query-severity mapping when no CVSS band exists', () => {
    expect(resolveSeverity({ severity: 'error' })).toBe('high');
    expect(resolveSeverity({ severity: 'warning' })).toBe('medium');
    expect(resolveSeverity({ severity: 'note' })).toBe('low');
  });

  it('falls back to medium for an unrecognized severity with no CVSS band', () => {
    expect(resolveSeverity({ severity: 'unknown-future-value' })).toBe('medium');
  });
});

describe('resolveFixedIn', () => {
  const releases = [
    { version: '0.10.0', publishedAt: '2026-07-01T00:00:00Z' },
    { version: '0.11.0', publishedAt: '2026-08-01T00:00:00Z' },
    { version: '0.12.0', publishedAt: '2026-09-01T00:00:00Z' },
  ];

  it('resolves to the earliest release published at or after the fix', () => {
    expect(resolveFixedIn('2026-07-15T00:00:00Z', releases)).toBe('0.11.0');
  });

  it('resolves to an exact-timestamp match', () => {
    expect(resolveFixedIn('2026-08-01T00:00:00Z', releases)).toBe('0.11.0');
  });

  it('returns null when nothing was fixed on main has shipped in a release yet', () => {
    expect(resolveFixedIn('2026-09-15T00:00:00Z', releases)).toBeNull();
  });
});

describe('buildAdvisoryEntries', () => {
  const releases = [{ version: '0.14.0', publishedAt: '2026-08-15T00:00:00Z' }];

  function makeAlert(overrides = {}) {
    return {
      number: 5,
      dismissed_reason: null,
      fixed_at: '2026-08-10T00:00:00Z',
      html_url: 'https://github.com/escape-llc/toolcrib/security/code-scanning/5',
      rule: { id: 'js/path-injection', severity: 'error', security_severity_level: 'high', description: 'User-controlled path.' },
      most_recent_instance: { location: { path: 'src/components/Modal/Modal.tsx' } },
      ...overrides,
    };
  }

  it('produces a full entry for a real, in-scope, released fix', () => {
    expect(buildAdvisoryEntries([makeAlert()], releases)).toEqual([
      {
        alertNumber: 5,
        rule: 'js/path-injection',
        severity: 'high',
        summary: 'User-controlled path.',
        location: 'src/components/Modal/Modal.tsx',
        fixedIn: '0.14.0',
        url: 'https://github.com/escape-llc/toolcrib/security/code-scanning/5',
      },
    ]);
  });

  it('excludes a dismissed alert even if it were somehow also marked fixed', () => {
    expect(buildAdvisoryEntries([makeAlert({ dismissed_reason: 'false positive' })], releases)).toEqual([]);
  });

  it('excludes an alert outside a shipped directory -- the real alerts #1/#2 shape', () => {
    const realShapeAlert = makeAlert({
      most_recent_instance: { location: { path: 'cli/integration-test/mock-github-server.js' } },
    });
    expect(buildAdvisoryEntries([realShapeAlert], releases)).toEqual([]);
  });

  it('excludes an alert fixed on main with no qualifying release yet', () => {
    const unreleased = makeAlert({ fixed_at: '2026-09-01T00:00:00Z' });
    expect(buildAdvisoryEntries([unreleased], releases)).toEqual([]);
  });

  it('sorts multiple entries by alert number', () => {
    const first = makeAlert({ number: 9 });
    const second = makeAlert({ number: 3 });
    const result = buildAdvisoryEntries([first, second], releases);
    expect(result.map((e: { alertNumber: number }) => e.alertNumber)).toEqual([3, 9]);
  });
});
