import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

vi.mock('../src/lib/release.js', () => ({
  fetchRelease: vi.fn(),
  fetchTestsRelease: vi.fn(),
}));

import { fetchRelease } from '../src/lib/release.js';
import { exportPatchesCommand } from '../src/commands/exportPatches.js';
import { releaseFixture, localFixture } from './helpers/exportFixture.js';

function writeTree(root, files, prefix = '') {
  for (const [relPath, content] of Object.entries(files)) {
    const target = path.join(root, prefix, ...relPath.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}

/** A stub `gh`: records every call and the body file contents at call time. */
function makeGh({ login = 'octo', failTitle } = {}) {
  const calls = [];
  let discussionN = 0;
  let commentN = 0;
  const runGh = (args) => {
    if (args[0] === 'api' && args[1] === 'user') {
      if (login === null) return { status: null, stdout: '', stderr: '', error: Object.assign(new Error('nf'), { code: 'ENOENT' }) };
      return { status: 0, stdout: `${login}\n`, stderr: '' };
    }
    const query = args.find((a) => a.startsWith('query=')) ?? '';
    const bodyArg = args.find((a) => a.startsWith('body=@'));
    const body = fs.readFileSync(bodyArg.slice('body=@'.length), 'utf8');
    if (query.includes('createDiscussion')) {
      const title = args.find((a) => a.startsWith('title=')).slice(6);
      calls.push({ kind: 'create', title, body });
      if (failTitle && title.includes(failTitle)) return { status: 1, stdout: '', stderr: 'denied' };
      const n = ++discussionN;
      return { status: 0, stdout: JSON.stringify({ data: { createDiscussion: { discussion: { id: `D_${n}`, url: `https://gh/d/${n}` } } } }), stderr: '' };
    }
    calls.push({ kind: 'comment', id: args.find((a) => a.startsWith('id=')).slice(3), body });
    const n = ++commentN;
    return { status: 0, stdout: JSON.stringify({ data: { addDiscussionComment: { comment: { url: `https://gh/c/${n}` } } } }), stderr: '' };
  };
  return { runGh, calls };
}

describe('exportPatchesCommand --post', () => {
  let tmp;
  let project;
  let out;
  let originalCwd;

  beforeEach(async () => {
    vi.resetAllMocks();
    process.exitCode = 0;
    originalCwd = process.cwd();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-post-test-'));
    project = path.join(tmp, 'project');
    out = path.join(tmp, 'out');
    fs.mkdirSync(project);
    writeTree(project, localFixture(), 'toolcrib');
    fs.writeFileSync(path.join(project, 'toolcrib', '.toolcrib-lock.json'), JSON.stringify({ version: '1.0.0' }));
    process.chdir(project);
    fetchRelease.mockResolvedValue({
      version: '1.0.0',
      config: {},
      readFile: (r) => releaseFixture()[r],
      allFiles: () => Object.keys(releaseFixture()),
      cleanup: async () => {},
    });
    await exportPatchesCommand({ out });
    fetchRelease.mockClear();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.exitCode = 0;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const posted = (folder) => path.join(out, folder, 'posted.json');

  it('--yes posts every contribution in order and writes posted.json', async () => {
    const gh = makeGh();
    await exportPatchesCommand({ out, post: true, yes: true, runGh: gh.runGh });
    const creates = gh.calls.filter((c) => c.kind === 'create');
    expect(creates.map((c) => c.title)).toEqual([
      expect.stringContaining('Card'),
      expect.stringContaining('Gauge'),
      expect.stringContaining('useRetry'),
    ]);
    expect(creates[0].body).toBe(fs.readFileSync(path.join(out, '01-Card', 'SUMMARY.md'), 'utf8'));
    const rec = JSON.parse(fs.readFileSync(posted('01-Card'), 'utf8'));
    expect(rec.url).toBe('https://gh/d/1');
    expect(rec.id).toBe('D_1');
    expect(rec.comments).toEqual([]);
    expect(typeof rec.postedAt).toBe('string');
    expect(fs.existsSync(posted('03-useRetry'))).toBe(true);
    expect(process.exitCode).toBe(0);
    // no temp body files left behind
    expect(fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith('toolcrib-post-') && !f.startsWith('toolcrib-post-test-'))).toEqual([]);
  });

  it('lists each contribution\'s files and the public-repo notice before posting, even with --yes', async () => {
    let printed = '';
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      printed += String(chunk);
      return true;
    });
    try {
      await exportPatchesCommand({ out, post: true, yes: true, runGh: makeGh().runGh });
    } finally {
      spy.mockRestore();
    }
    expect(printed).toContain('files whose full contents will be posted');
    expect(printed).toMatch(/public GitHub repository/);
    const patchNames = fs.readdirSync(path.join(out, '01-Card')).filter((f) => f.endsWith('.patch'));
    expect(patchNames.length).toBeGreaterThan(0);
    expect(printed).toMatch(/src\/components\/Card/);
  });

  it('skips already-posted folders on a rerun', async () => {
    await exportPatchesCommand({ out, post: true, yes: true, runGh: makeGh().runGh });
    const gh = makeGh();
    await exportPatchesCommand({ out, post: true, yes: true, runGh: gh.runGh });
    expect(gh.calls).toEqual([]);
  });

  it('posts nothing when the confirmation is declined', async () => {
    const gh = makeGh();
    const confirm = vi.fn().mockResolvedValue(false);
    await exportPatchesCommand({ out, post: true, runGh: gh.runGh, confirm, isTTY: true });
    expect(confirm).toHaveBeenCalledOnce();
    expect(gh.calls).toEqual([]);
    expect(fs.existsSync(posted('01-Card'))).toBe(false);
  });

  it('posts when the confirmation is accepted', async () => {
    const gh = makeGh();
    await exportPatchesCommand({ out, post: true, runGh: gh.runGh, confirm: async () => true, isTTY: true });
    expect(gh.calls.filter((c) => c.kind === 'create')).toHaveLength(3);
  });

  it('posts nothing without a TTY and without --yes', async () => {
    const gh = makeGh();
    const confirm = vi.fn();
    await exportPatchesCommand({ out, post: true, runGh: gh.runGh, confirm, isTTY: false });
    expect(confirm).not.toHaveBeenCalled();
    expect(gh.calls).toEqual([]);
    expect(process.exitCode).toBe(0);
  });

  it('falls back to manual instructions when gh is missing', async () => {
    const gh = makeGh({ login: null });
    await exportPatchesCommand({ out, post: true, yes: true, runGh: gh.runGh });
    expect(gh.calls).toEqual([]);
    expect(fs.existsSync(posted('01-Card'))).toBe(false);
    expect(process.exitCode).not.toBe(1);
  });

  it('keeps going when one contribution fails, and exits 1', async () => {
    const gh = makeGh({ failTitle: 'Gauge' });
    await exportPatchesCommand({ out, post: true, yes: true, runGh: gh.runGh });
    expect(fs.existsSync(posted('01-Card'))).toBe(true);
    expect(fs.existsSync(posted('02-Gauge'))).toBe(false);
    expect(fs.existsSync(posted('03-useRetry'))).toBe(true);
    expect(process.exitCode).toBe(1);
  });

  it('errors when the export marker is missing', async () => {
    fs.rmSync(path.join(out, '.toolcrib-export'));
    const gh = makeGh();
    await exportPatchesCommand({ out, post: true, yes: true, runGh: gh.runGh });
    expect(gh.calls).toEqual([]);
    expect(process.exitCode).toBe(1);
  });

  it('does not fetch a release or re-analyze', async () => {
    await exportPatchesCommand({ out, post: true, yes: true, runGh: makeGh().runGh });
    expect(fetchRelease).not.toHaveBeenCalled();
  });
});
