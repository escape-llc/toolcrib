import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// initCommand imports fetchRelease/fetchTestsRelease directly from
// lib/release.js — mock the whole module, same approach as merge.test.js,
// so no real network call happens. resolveVersion (from lib/github.js) is
// mocked separately for the identical reason: initCommand now resolves
// 'latest' itself (once, up front — see init.js's own comment on why),
// and this repo's release.js mock below replaces the module that would
// otherwise re-export the real resolveVersion, so nothing here would
// short-circuit an unmocked real network call without this.
vi.mock('../src/lib/release.js', () => ({
  fetchRelease: vi.fn(),
  fetchTestsRelease: vi.fn(),
}));
vi.mock('../src/lib/github.js', () => ({
  resolveVersion: vi.fn(),
}));

import { fetchRelease, fetchTestsRelease } from '../src/lib/release.js';
import { resolveVersion } from '../src/lib/github.js';
import { initCommand } from '../src/commands/init.js';
import { proposeLockUpdate, proposeGitignore } from '../src/lib/project.js';
import { buildManagedBlock } from '../src/lib/managedDocs.js';

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
    resolveVersion.mockImplementation((v) => Promise.resolve(v === 'latest' ? '1.0.0' : v));
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
    resolveVersion.mockImplementation((v) => Promise.resolve(v === 'latest' ? '1.0.0' : v));
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

describe('initCommand — other early-exit and no-op paths', () => {
  let tmpDir;
  let originalCwd;
  let originalExitCode;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-init-edge-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    vi.resetAllMocks();
    originalExitCode = process.exitCode;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    process.exitCode = originalExitCode;
  });

  it('stops the spinner and rethrows when resolving/downloading the release fails', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'x', dependencies: {} }, null, 2) + '\n');
    fetchRelease.mockRejectedValue(new Error('network unreachable'));

    await expect(initCommand({ version: 'latest', situation: 'new' })).rejects.toThrow('network unreachable');
  });

  it('errors, sets exitCode, and cleans up the release when there is no package.json in the current directory', async () => {
    // Deliberately no package.json written -- readJsonIfExists returns null.
    // Vendored files ARE still proposed before this check runs (step 1
    // precedes step 2 in initCommand's own order), so readFile needs real
    // content, not a throw.
    let cleanedUp = false;
    fetchRelease.mockResolvedValue({
      version: '1.0.0',
      config: { peerDependencies: {} },
      readFile: () => 'export {};\n',
      allFiles: () => ['index.ts'],
      cleanup: async () => {
        cleanedUp = true;
      },
    });
    process.exitCode = 0;

    await initCommand({ version: 'latest', situation: 'new' });

    expect(process.exitCode).toBe(1);
    expect(cleanedUp).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'toolcrib-patches'))).toBe(false);
  });

  it('reports nothing to do when every proposed change already matches what is on disk', async () => {
    // Construct the "already fully installed" end state directly, using
    // the same lib/ helpers initCommand itself proposes with (rather than
    // duplicating their output format by hand), so this exercises the
    // real changes.isEmpty() early-return path rather than a hand-guessed
    // approximation of it.
    const files = { 'index.ts': 'export {};\n', 'ai-docs/CORE.md': 'Core rules.\n' };
    fetchRelease.mockImplementation(() =>
      Promise.resolve({
        version: '1.0.0',
        config: { peerDependencies: {} },
        readFile: (relPath) => files[relPath],
        allFiles: () => Object.keys(files).filter((f) => f !== 'toolcrib.config.json'),
        cleanup: async () => {},
      })
    );

    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'x', dependencies: {}, imports: { '#toolcrib': './toolcrib/index.ts' } }, null, 2) + '\n'
    );
    // allFiles() includes ai-docs/CORE.md too (a real release's vendored
    // payload does ship ai-docs/ as part of it -- see AGENTS.md's own "ships
    // as-is" note), so it needs a matching on-disk copy same as index.ts.
    fs.mkdirSync(path.join(tmpDir, 'toolcrib', 'ai-docs'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'toolcrib', 'index.ts'), files['index.ts']);
    fs.writeFileSync(path.join(tmpDir, 'toolcrib', 'ai-docs', 'CORE.md'), files['ai-docs/CORE.md']);

    const lockChange = proposeLockUpdate(tmpDir, '1.0.0');
    fs.mkdirSync(path.dirname(path.join(tmpDir, lockChange.relPath)), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, lockChange.relPath), lockChange.proposed);

    const gitignoreChange = proposeGitignore(tmpDir, '1.0.0');
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), gitignoreChange.proposed);

    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), buildManagedBlock('core', '1.0.0', files['ai-docs/CORE.md']) + '\n');

    await initCommand({ version: 'latest', situation: undefined });

    expect(fs.existsSync(path.join(tmpDir, 'toolcrib-patches'))).toBe(false);
  });
});

/** Matches the real shape returned by lib/release.js's fetchTestsRelease. */
function fakeTestsRelease(version, files, peerDependencies = {}) {
  return {
    version,
    config: { version, peerDependencies },
    readFile: (relPath) => {
      if (files[relPath] === undefined) throw new Error(`no such file in fake tests release: ${relPath}`);
      return files[relPath];
    },
    allFiles: () => Object.keys(files).filter((f) => f !== 'toolcrib-tests.config.json'),
    cleanup: async () => {},
  };
}

describe('initCommand — --with-tests', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-init-tests-flag-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'x', dependencies: {} }, null, 2) + '\n');
    vi.resetAllMocks();
    resolveVersion.mockImplementation((v) => Promise.resolve(v === 'latest' ? '1.0.0' : v));
    fetchRelease.mockImplementation((v) => Promise.resolve(fakeRelease(v === 'latest' ? '1.0.0' : v, baseFiles())));
    fetchTestsRelease.mockImplementation((v) =>
      Promise.resolve(
        fakeTestsRelease(v, { '__tests__/Button.test.tsx': 'export {};\n' }, { vitest: '^4.0.0' })
      )
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('never calls fetchTestsRelease when the flag is omitted', async () => {
    await initCommand({ version: 'latest', situation: 'new' });
    expect(fetchTestsRelease).not.toHaveBeenCalled();
  });

  it('stages the vendored test files under ./toolcrib/__tests__/ when the flag is passed', async () => {
    await initCommand({ version: 'latest', situation: 'new', withTests: true });

    expect(fetchTestsRelease).toHaveBeenCalledWith('1.0.0');
    const patchDir = path.join(tmpDir, 'toolcrib-patches');
    const patchFiles = fs.readdirSync(patchDir);
    expect(patchFiles.some((f) => f.includes('Button.test.tsx'))).toBe(true);
  });

  it('adds the test suite\'s peerDependencies to devDependencies, not dependencies', async () => {
    await initCommand({ version: 'latest', situation: 'new', withTests: true });

    const patchDir = path.join(tmpDir, 'toolcrib-patches');
    const pkgPatch = findPatchFor(patchDir, 'package.json');
    expect(pkgPatch).toBeDefined();
    const patchContent = fs.readFileSync(path.join(patchDir, pkgPatch), 'utf-8');
    expect(patchContent).toContain('devDependencies');
    expect(patchContent).toContain('vitest');
  });

  it('records testsVersion alongside version in the lock file', async () => {
    await initCommand({ version: 'latest', situation: 'new', withTests: true });

    const patchDir = path.join(tmpDir, 'toolcrib-patches');
    const lockPatch = findPatchFor(patchDir, 'toolcrib/.toolcrib-lock.json');
    expect(lockPatch).toBeDefined();
    const patchContent = fs.readFileSync(path.join(patchDir, lockPatch), 'utf-8');
    expect(patchContent).toContain('"testsVersion": "1.0.0"');
  });

  it('resolves "latest" exactly once and reuses the concrete version for both the core and tests fetch — no independent second resolution', async () => {
    await initCommand({ version: 'latest', situation: 'new', withTests: true });

    expect(resolveVersion).toHaveBeenCalledTimes(1);
    expect(fetchRelease).toHaveBeenCalledWith('1.0.0');
    expect(fetchTestsRelease).toHaveBeenCalledWith('1.0.0');
  });

  it('vendors .toolcrib-tests-config.json itself, not just the test files, so a local reader (e.g. toolcrib-mcp) can see the declared peerDependencies later', async () => {
    await initCommand({ version: 'latest', situation: 'new', withTests: true });

    const patchDir = path.join(tmpDir, 'toolcrib-patches');
    const configPatch = findPatchFor(patchDir, 'toolcrib/.toolcrib-tests-config.json');
    expect(configPatch).toBeDefined();
    const patchContent = fs.readFileSync(path.join(patchDir, configPatch), 'utf-8');
    expect(patchContent).toContain('"vitest": "^4.0.0"');
  });

  it('cleans up the already-fetched core release if fetchTestsRelease then fails (regression: this previously leaked it)', async () => {
    let cleanedUp = false;
    fetchRelease.mockImplementation((v) =>
      Promise.resolve({
        ...fakeRelease(v, baseFiles()),
        cleanup: async () => {
          cleanedUp = true;
        },
      })
    );
    fetchTestsRelease.mockRejectedValue(new Error('tests download failed'));

    await expect(initCommand({ version: 'latest', situation: 'new', withTests: true })).rejects.toThrow(
      'tests download failed'
    );
    expect(cleanedUp).toBe(true);
  });
});

/** Find the written patch for a given relPath among writeAll()'s numbered filenames. */
function findPatchFor(patchDir, relPath) {
  const safeName = relPath.replace(/[/\\]/g, '-');
  const files = fs.readdirSync(patchDir);
  return files.find((f) => f.endsWith(`${safeName}.patch`));
}
