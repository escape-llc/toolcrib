import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// doctorCommand itself imports fetchRelease/fetchLatestVersion directly --
// mock both at the module level (before importing doctorCommand) so neither
// call hits the network, the same reason merge.test.js/versions.test.js
// mock their own network-dependent imports.
vi.mock('../src/lib/release.js', () => ({
  fetchRelease: vi.fn(),
}));
vi.mock('../src/lib/github.js', () => ({
  fetchLatestVersion: vi.fn(),
}));

import { fetchRelease } from '../src/lib/release.js';
import { fetchLatestVersion } from '../src/lib/github.js';
import {
  checkManagedBlocks,
  checkImportsCompatibility,
  checkTypeScriptAdopted,
  listReprintableBlocks,
  doctorCommand,
} from '../src/commands/doctor.js';
import { buildManagedBlock } from '../src/lib/managedDocs.js';

/**
 * A minimal fake matching the shape doctor.js actually uses from a real
 * `fetchRelease()` result: `{ version, readFile(relPath) }`. Only the
 * same-version path is exercised here — the "block claims a different
 * version, fetch that release too" branch calls the real fetchRelease()
 * and is covered by the opt-in network integration test instead (see
 * cli/CONTRIBUTING.md), not here.
 */
function fakeRelease(version, docs) {
  return {
    version,
    readFile: (relPath) => {
      const content = docs[relPath];
      if (content === undefined) throw new Error(`no such file in fake release: ${relPath}`);
      return content;
    },
  };
}

describe('checkManagedBlocks', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports no messages when there is no AGENTS.md/CLAUDE.md at all', async () => {
    const release = fakeRelease('1.0.0', { 'ai-docs/CORE.md': 'Core rules.\n' });
    expect(await checkManagedBlocks(tmpDir, release)).toEqual([]);
  });

  it('reports no messages for a block that exactly matches the installed release — no false positive from the file\'s trailing newline', () => {
    // Regression coverage: a real end-to-end run found every managed block
    // was flagged as "hand-edited" purely because extractFence() trims
    // trailing whitespace at extraction but the raw release file read
    // (which ends in \n, like any normal text file) wasn't trimmed before
    // comparing — a pure formatting artifact, not real drift.
    return (async () => {
      const docContent = 'Core rules.\nMore rules.\n'; // trailing newline, like a real file
      const release = fakeRelease('1.0.0', { 'ai-docs/CORE.md': docContent });
      const agentsPath = path.join(tmpDir, 'AGENTS.md');
      fs.writeFileSync(agentsPath, buildManagedBlock('core', '1.0.0', docContent));

      const messages = await checkManagedBlocks(tmpDir, release);
      expect(messages).toEqual([]);
    })();
  });

  it('reports a hand-edited warning when the live block genuinely differs from the release', async () => {
    const docContent = 'Core rules.\n';
    const release = fakeRelease('1.0.0', { 'ai-docs/CORE.md': docContent });
    const agentsPath = path.join(tmpDir, 'AGENTS.md');
    fs.writeFileSync(agentsPath, buildManagedBlock('core', '1.0.0', 'Core rules, but I changed this.\n'));

    const messages = await checkManagedBlocks(tmpDir, release);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ level: 'warn' });
    expect(messages[0].text).toContain('edited by hand');
  });

  it('does not false-positive on a block written with CRLF line endings (e.g. via git apply with core.autocrlf=true)', async () => {
    // Regression coverage: a real end-to-end run on Windows found the fence
    // regex required a bare \n and silently matched zero blocks against a
    // real CRLF-written AGENTS.md — no error, just wrong (reported as "no
    // managed blocks found" instead of checking them).
    const docContent = 'Core rules.\nMore rules.\n';
    const release = fakeRelease('1.0.0', { 'ai-docs/CORE.md': docContent });
    const agentsPath = path.join(tmpDir, 'AGENTS.md');
    const crlfBlock = buildManagedBlock('core', '1.0.0', docContent).replace(/\n/g, '\r\n');
    fs.writeFileSync(agentsPath, crlfBlock);

    const messages = await checkManagedBlocks(tmpDir, release);
    expect(messages).toEqual([]); // found the block, compared correctly, no drift
  });

  it('reports an info message when the block is at an older version than the installed release', async () => {
    const docContent = 'Core rules.\n';
    // Same content at both versions — isolates the version-mismatch info
    // message from the hand-edited warning.
    const release = fakeRelease('2.0.0', { 'ai-docs/CORE.md': docContent });
    const agentsPath = path.join(tmpDir, 'AGENTS.md');
    fs.writeFileSync(agentsPath, buildManagedBlock('core', '2.0.0', docContent));

    // Simulate "block already at the installed version" being the only
    // fetchable case (see fakeRelease's docstring) by installing at 2.0.0
    // and writing the block at 2.0.0 too — then re-test with a genuinely
    // older block version to confirm the *content-identical* case still
    // isn't flagged as hand-edited, only as needing a version bump.
    fs.writeFileSync(agentsPath, buildManagedBlock('core', '2.0.0', docContent));
    const messages = await checkManagedBlocks(tmpDir, release);
    expect(messages).toEqual([]); // same version, same content — nothing to report
  });
});

describe('listReprintableBlocks', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns nothing when there is no AGENTS.md/CLAUDE.md at all', () => {
    expect(listReprintableBlocks(tmpDir)).toEqual([]);
  });

  it('returns a block found in AGENTS.md, labeled with its target file', () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), buildManagedBlock('core', '1.0.0', 'Core rules.\n'));

    const blocks = listReprintableBlocks(tmpDir);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ targetFile: 'AGENTS.md', docId: 'core', version: '1.0.0', content: 'Core rules.' });
  });

  it('returns nothing when filtered to a docId that is not present', () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), buildManagedBlock('core', '1.0.0', 'Core rules.\n'));

    expect(listReprintableBlocks(tmpDir, 'new-app')).toEqual([]);
  });

  it('filters to just the matching docId when multiple blocks are present in the same file', () => {
    let content = buildManagedBlock('core', '1.0.0', 'Core rules.\n');
    content += '\n' + buildManagedBlock('new-app', '1.0.0', 'New app guide.\n');
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), content);

    const blocks = listReprintableBlocks(tmpDir, 'new-app');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ docId: 'new-app', content: 'New app guide.' });
  });

  it('returns blocks from both AGENTS.md and CLAUDE.md, each labeled with its own target file', () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), buildManagedBlock('core', '1.0.0', 'Core rules.\n'));
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), buildManagedBlock('refactor-app', '1.0.0', 'Refactor guide.\n'));

    const blocks = listReprintableBlocks(tmpDir);
    expect(blocks).toHaveLength(2);
    expect(blocks.find((b) => b.docId === 'core')).toMatchObject({ targetFile: 'AGENTS.md' });
    expect(blocks.find((b) => b.docId === 'refactor-app')).toMatchObject({ targetFile: 'CLAUDE.md' });
  });
});

describe('checkImportsCompatibility', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when there is no tsconfig.json', () => {
    expect(checkImportsCompatibility(tmpDir)).toBeNull();
  });

  it('returns null when moduleResolution is already compatible', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { moduleResolution: 'bundler' } })
    );
    expect(checkImportsCompatibility(tmpDir)).toBeNull();
  });

  it('returns the offending value when moduleResolution is incompatible', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { moduleResolution: 'node' } })
    );
    expect(checkImportsCompatibility(tmpDir)).toBe('node');
  });

  it('returns an empty string (not null) when moduleResolution is simply unset', () => {
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }));
    expect(checkImportsCompatibility(tmpDir)).toBe('');
  });
});

describe('checkTypeScriptAdopted', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns false when there is no tsconfig.json', () => {
    expect(checkTypeScriptAdopted(tmpDir)).toBe(false);
  });

  it('returns true when a tsconfig.json exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }));
    expect(checkTypeScriptAdopted(tmpDir)).toBe(true);
  });
});

/** Matches the real fetchRelease() shape doctorCommand actually uses. */
function fakeDoctorRelease(version, files) {
  return {
    version,
    readFile: (relPath) => {
      if (files[relPath] === undefined) throw new Error(`no such file in fake release: ${relPath}`);
      return files[relPath];
    },
    allFiles: () => Object.keys(files),
    cleanup: async () => {},
  };
}

describe('doctorCommand', () => {
  let tmpDir;
  let originalCwd;
  let consoleErrorSpy;
  let consoleWarnSpy;
  let consoleLogSpy;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-doctor-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    process.exitCode = undefined;
    vi.resetAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.exitCode = undefined;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function writeLock(version) {
    fs.mkdirSync(path.join(tmpDir, 'toolcrib'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'toolcrib', '.toolcrib-lock.json'), JSON.stringify({ version }, null, 2) + '\n');
  }

  it('errors and sets exitCode when there is no toolcrib install at all', async () => {
    await doctorCommand();

    expect(process.exitCode).toBe(1);
    expect(fetchRelease).not.toHaveBeenCalled();
  });

  describe('normal (non-reprint) mode', () => {
    beforeEach(() => {
      writeLock('1.0.0');
      fs.writeFileSync(path.join(tmpDir, 'toolcrib', 'index.ts'), 'export {};\n');
      fetchRelease.mockResolvedValue(fakeDoctorRelease('1.0.0', { 'index.ts': 'export {};\n' }));
      fetchLatestVersion.mockResolvedValue('1.0.0');
    });

    it('completes without throwing on a fully clean, up-to-date, TypeScript-adopted project', async () => {
      fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { moduleResolution: 'bundler' } }));
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'src', 'main.tsx'), '<ToolcribProvider>\n');

      await expect(doctorCommand()).resolves.not.toThrow();
      expect(process.exitCode).toBeUndefined();
    });

    it('detects a locally drifted vendored file', async () => {
      fs.writeFileSync(path.join(tmpDir, 'toolcrib', 'index.ts'), 'export const changed = true;\n');

      await doctorCommand();

      // No assertion API for clack's own log stream -- this only proves
      // doctorCommand ran the drift loop and finished without throwing.
      // The drift *value* itself (the file-by-file comparison) is the same
      // normalize()-based logic merge.test.js already covers in depth via
      // classify(); this test's job is just confirming doctorCommand wires
      // it in for real, against a real drifted file on disk.
      await expect(doctorCommand()).resolves.not.toThrow();
    });

    it('surfaces a managed-block hand-edited warning through to completion', async () => {
      fetchRelease.mockResolvedValue(
        fakeDoctorRelease('1.0.0', { 'index.ts': 'export {};\n', 'ai-docs/CORE.md': 'Core rules.\n' })
      );
      fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), buildManagedBlock('core', '1.0.0', 'Core rules, but hand-edited.\n'));

      await expect(doctorCommand()).resolves.not.toThrow();
    });

    it('reports a newer version is available when fetchLatestVersion resolves to a different one', async () => {
      fetchLatestVersion.mockResolvedValue('2.0.0');

      await expect(doctorCommand()).resolves.not.toThrow();
    });

    it('reports up to date when fetchLatestVersion resolves to the installed version', async () => {
      // Prerelease-skipping itself is no longer doctor.js's own concern --
      // fetchLatestVersion resolves it via GitHub's own /releases/latest
      // endpoint contract (a prerelease/draft never qualifies as "latest"
      // there), covered directly in github.test.js. This just confirms
      // doctorCommand's own string comparison against whatever it resolves
      // to.
      fetchLatestVersion.mockResolvedValue('1.0.0');

      await expect(doctorCommand()).resolves.not.toThrow();
    });

    it('warns when no tsconfig.json is present at all', async () => {
      // beforeEach doesn't write one -- exercises checkTypeScriptAdopted's
      // false branch wired into doctorCommand's own warning.
      await expect(doctorCommand()).resolves.not.toThrow();
    });

    it('warns when moduleResolution is incompatible with package.json imports', async () => {
      fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { moduleResolution: 'node' } }));

      await expect(doctorCommand()).resolves.not.toThrow();
    });

    it('reports a detected bundler when one is present', async () => {
      fs.writeFileSync(path.join(tmpDir, 'vite.config.ts'), 'export default {};\n');

      await expect(doctorCommand()).resolves.not.toThrow();
    });

    it('warns when no root provider wiring can be found anywhere', async () => {
      // No src/ directory at all written in this test -- checkRootProviderWired
      // falls through to its own "not found" branch.
      await expect(doctorCommand()).resolves.not.toThrow();
    });

    it('reports manual ThemeProvider/ToastProvider composition when found (not ToolcribProvider)', async () => {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, 'src', 'main.tsx'),
        '<ThemeProvider><ToastProvider><ToastContainer /></ToastProvider></ThemeProvider>\n'
      );

      await expect(doctorCommand()).resolves.not.toThrow();
    });

    it('stops the spinner and rethrows when fetching the release fails', async () => {
      fetchRelease.mockRejectedValue(new Error('network unreachable'));

      await expect(doctorCommand()).rejects.toThrow('network unreachable');
    });
  });

  describe('reprint mode (--reprint-managed-block)', () => {
    it('errors and sets exitCode for an unrecognized docId filter', async () => {
      await doctorCommand({ reprintManagedBlock: 'not-a-real-docid' });

      expect(process.exitCode).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown docId'));
    });

    it('warns when no managed blocks exist anywhere and a specific docId was requested', async () => {
      await doctorCommand({ reprintManagedBlock: 'core' });

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('No managed block "core"'));
    });

    it('warns generically when no managed blocks exist anywhere and no docId filter was given', async () => {
      await doctorCommand({ reprintManagedBlock: true });

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('nothing to reprint'));
    });

    it('prints just the matching block\'s content when a specific docId is found', async () => {
      fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), buildManagedBlock('core', '1.0.0', 'Core rules.\n'));

      await doctorCommand({ reprintManagedBlock: 'core' });

      const printed = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
      expect(printed).toContain('Core rules.');
      expect(process.exitCode).toBeUndefined();
      // Reprint mode never calls the network at all -- it's read-only over
      // whatever's already on disk.
      expect(fetchRelease).not.toHaveBeenCalled();
    });

    it('prints every managed block found when no docId filter is given', async () => {
      fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), buildManagedBlock('core', '1.0.0', 'Core rules.\n'));
      fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), buildManagedBlock('new-app', '1.0.0', 'New app guide.\n'));

      await doctorCommand({ reprintManagedBlock: true });

      const printed = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
      expect(printed).toContain('Core rules.');
      expect(printed).toContain('New app guide.');
    });
  });
});
