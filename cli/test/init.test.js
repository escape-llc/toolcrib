import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// initCommand imports fetchRelease directly from lib/release.js — mock it
// at the module level, same approach as merge.test.js, so no real network
// call happens.
vi.mock('../src/lib/release.js', () => ({
  fetchRelease: vi.fn(),
}));

import { fetchRelease } from '../src/lib/release.js';
import { initCommand } from '../src/commands/init.js';

/** Matches the real shape returned by lib/release.js's fetchRelease. */
function fakeRelease(version, files, peerDependencies = {}) {
  return {
    version,
    config: { peerDependencies },
    readFile: (relPath) => {
      if (files[relPath] === undefined) throw new Error(`no such file in fake release: ${relPath}`);
      return files[relPath];
    },
    allFiles: () => Object.keys(files).filter((f) => f !== 'toolcrib.config.json'),
    cleanup: async () => {},
  };
}

const CORE_MD = 'Core rules for using toolcrib.';

function baseFiles() {
  return {
    'index.ts': 'export {};\n',
    'ai-docs/CORE.md': CORE_MD,
    'ai-docs/NEW_APP.md': 'New app guide.',
    'ai-docs/REFACTOR_APP.md': 'Refactor guide.',
  };
}

describe('initCommand — instruction file targeting', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-init-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'x', dependencies: {} }, null, 2) + '\n');
    vi.resetAllMocks();
    fetchRelease.mockImplementation((v) => Promise.resolve(fakeRelease(v === 'latest' ? '1.0.0' : v, baseFiles())));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes the managed block into an existing CLAUDE.md instead of creating a new AGENTS.md', async () => {
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '# My existing Claude Code instructions\n');

    await initCommand({ version: 'latest', situation: 'new' });

    const patchDir = path.join(tmpDir, 'toolcrib-patches');
    const patchFiles = fs.readdirSync(patchDir);

    expect(patchFiles.some((f) => f.includes('CLAUDE.md'))).toBe(true);
    expect(patchFiles.some((f) => f.includes('AGENTS.md'))).toBe(false);
  });

  it('writes into an existing AGENTS.md when present and no CLAUDE.md exists', async () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# My existing instructions\n');

    await initCommand({ version: 'latest', situation: 'new' });

    const patchDir = path.join(tmpDir, 'toolcrib-patches');
    const patchFiles = fs.readdirSync(patchDir);

    expect(patchFiles.some((f) => f.includes('AGENTS.md'))).toBe(true);
    expect(patchFiles.some((f) => f.includes('CLAUDE.md'))).toBe(false);
  });

  it('prefers AGENTS.md when both AGENTS.md and CLAUDE.md already exist', async () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# Existing AGENTS.md\n');
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '# Existing CLAUDE.md\n');

    await initCommand({ version: 'latest', situation: 'new' });

    const patchDir = path.join(tmpDir, 'toolcrib-patches');
    const patchFiles = fs.readdirSync(patchDir);

    expect(patchFiles.some((f) => f.includes('AGENTS.md'))).toBe(true);
    expect(patchFiles.some((f) => f.includes('CLAUDE.md'))).toBe(false);
  });

  it('falls back to creating a new AGENTS.md when neither file exists', async () => {
    await initCommand({ version: 'latest', situation: 'new' });

    const patchDir = path.join(tmpDir, 'toolcrib-patches');
    const patchFiles = fs.readdirSync(patchDir);

    expect(patchFiles.some((f) => f.includes('AGENTS.md'))).toBe(true);
  });

  it('also proposes a CLAUDE.md stub pointing at AGENTS.md when neither file existed yet, so Claude Code can discover it', async () => {
    await initCommand({ version: 'latest', situation: 'new' });

    const patchDir = path.join(tmpDir, 'toolcrib-patches');
    const patchFiles = fs.readdirSync(patchDir);
    const claudePatchFile = patchFiles.find((f) => f.includes('CLAUDE.md'));

    expect(claudePatchFile).toBeDefined();
    const claudePatchContent = fs.readFileSync(path.join(patchDir, claudePatchFile), 'utf-8');
    expect(claudePatchContent).toContain('@AGENTS.md');
  });
});

describe('initCommand — dependency conflict exit code', () => {
  let tmpDir;
  let originalCwd;
  let originalExitCode;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-init-conflict-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    vi.resetAllMocks();
    fetchRelease.mockImplementation((v) =>
      Promise.resolve(fakeRelease(v === 'latest' ? '1.0.0' : v, baseFiles(), { react: '^18.3.1 || ^19.0.0' }))
    );
    // process.exitCode is process-global state, not reset between tests by
    // vitest itself — save/restore it explicitly so a conflict asserted in
    // one test can't leak into the next test's assertion.
    originalExitCode = process.exitCode;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    process.exitCode = originalExitCode;
  });

  it('sets a non-zero exit code when a real dependency conflict is found — otherwise a caller checking $? cannot tell a conflicted init from a clean one', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'x', dependencies: { react: '^17.0.0' } }, null, 2) + '\n'
    );
    process.exitCode = 0;

    await initCommand({ version: 'latest', situation: 'new' });

    expect(process.exitCode).toBe(1);
  });

  it('leaves the exit code untouched when the consumer\'s declared range is compatible (e.g. React 19)', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'x', dependencies: { react: '^19.0.0' } }, null, 2) + '\n'
    );
    process.exitCode = 0;

    await initCommand({ version: 'latest', situation: 'new' });

    expect(process.exitCode).toBe(0);
  });
});
