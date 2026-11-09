import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildPostPlan,
  createDiscussion,
  addDiscussionComment,
  ghLogin,
  MAX_BODY,
  REPO_ID,
  CATEGORY_ID,
} from '../src/lib/discussions.js';

function summary({ name = 'Card', type = 'bug-fix', base = '1.2.3', quote = false, patchesText = '' } = {}) {
  const q = (s) => (quote ? `"${s}"` : s);
  return [
    '<details><summary>Patch metadata</summary>',
    '',
    '```yaml',
    'kind: consumer-patch',
    `base_version: ${q(base)}`,
    `contribution: ${q(name)}`,
    `type: ${type}`,
    '```',
    '',
    '</details>',
    '',
    `## ${name}`,
    '',
    '### Patches',
    '',
    patchesText,
  ].join('\n');
}

function makePatch(upstreamPath, hunkCount, linesPerHunk) {
  const out = [`--- a/${upstreamPath}`, `+++ b/${upstreamPath}`];
  for (let h = 0; h < hunkCount; h++) {
    out.push(`@@ -${h * 1000 + 1},${linesPerHunk} +${h * 1000 + 1},${linesPerHunk} @@`);
    for (let i = 0; i < linesPerHunk; i++) out.push(`+line ${h}-${i} ${'x'.repeat(60)}`);
  }
  return out.join('\n') + '\n';
}

const patchesFor = (...ps) => ps.map((text, i) => ({ fileName: `000${i + 1}.patch`, upstreamPath: `src/f${i}.ts`, text }));

describe('buildPostPlan', () => {
  it('parses the title from the yaml block, including quoted values', () => {
    const plain = buildPostPlan({ summaryText: summary(), patches: [] });
    expect(plain.title).toBe('[consumer-patch] Card (bug-fix, base v1.2.3)');
    const quoted = buildPostPlan({ summaryText: summary({ name: 'Gauge', base: '1.0.0', quote: true }), patches: [] });
    expect(quoted.title).toBe('[consumer-patch] Gauge (bug-fix, base v1.0.0)');
  });

  it('passes a small summary through unchanged with no comments', () => {
    const text = summary({ patchesText: 'small' });
    const plan = buildPostPlan({ summaryText: text, patches: patchesFor(makePatch('src/a.ts', 1, 2)) });
    expect(plan.body).toBe(text);
    expect(plan.comments).toEqual([]);
  });

  it('moves patches into comments when the summary is too large', () => {
    const p1 = makePatch('src/a.ts', 1, 5);
    const p2 = makePatch('src/b.ts', 1, 5);
    const big = summary({ patchesText: 'z'.repeat(MAX_BODY) });
    const plan = buildPostPlan({
      summaryText: big,
      patches: [
        { fileName: '1.patch', upstreamPath: 'src/a.ts', text: p1 },
        { fileName: '2.patch', upstreamPath: 'src/b.ts', text: p2 },
      ],
    });
    expect(plan.body).toContain('### Patches\n\nPosted as 2 comment(s) below, in order.');
    expect(plan.body).not.toContain('zzzz');
    expect(plan.comments).toHaveLength(2);
    expect(plan.comments[0].startsWith('#### src/a.ts\n\n```diff\n')).toBe(true);
    expect(plan.comments[1]).toContain('+line 0-0');
    expect(plan.body.length).toBeLessThanOrEqual(MAX_BODY);
  });

  it('splits one oversized patch at hunk boundaries, repeating headers', () => {
    const patch = makePatch('src/huge.ts', 20, 200); // ~ 20 * 200 * 70 bytes
    expect(patch.length).toBeGreaterThan(MAX_BODY * 2);
    const plan = buildPostPlan({
      summaryText: summary({ patchesText: patch }),
      patches: [{ fileName: '1.patch', upstreamPath: 'src/huge.ts', text: patch }],
    });
    expect(plan.comments.length).toBeGreaterThan(1);
    const n = plan.comments.length;
    plan.comments.forEach((c, i) => {
      expect(c.length).toBeLessThanOrEqual(MAX_BODY);
      expect(c.startsWith(`#### src/huge.ts (part ${i + 1}/${n})\n\n`)).toBe(true);
      expect(c).toContain('--- a/src/huge.ts\n+++ b/src/huge.ts\n@@ ');
    });
    // No hunk line lost.
    const joined = plan.comments.join('\n');
    for (let h = 0; h < 20; h++) expect(joined).toContain(`+line ${h}-199 `);
  });

  it('splits a single hunk that is too large on its own, at line boundaries', () => {
    const patch = makePatch('src/one.ts', 1, 3000);
    expect(patch.length).toBeGreaterThan(MAX_BODY);
    const plan = buildPostPlan({
      summaryText: summary({ patchesText: patch }),
      patches: [{ fileName: '1.patch', upstreamPath: 'src/one.ts', text: patch }],
    });
    expect(plan.comments.length).toBeGreaterThan(1);
    for (const c of plan.comments) expect(c.length).toBeLessThanOrEqual(MAX_BODY);
    const joined = plan.comments.join('\n');
    expect(joined).toContain('+line 0-0 ');
    expect(joined).toContain('+line 0-2999 ');
  });

  it('uses a fence longer than any backtick run inside the patch', () => {
    const patch = '--- a/x.md\n+++ b/x.md\n@@ -1 +1 @@\n+````` five\n';
    const plan = buildPostPlan({
      summaryText: summary({ patchesText: 'z'.repeat(MAX_BODY) }),
      patches: [{ fileName: '1.patch', upstreamPath: 'x.md', text: patch }],
    });
    expect(plan.comments[0]).toContain('``````diff\n');
    expect(plan.comments[0].trimEnd().endsWith('``````')).toBe(true);
  });

  it('keeps every body and comment within MAX_BODY', () => {
    const patch = makePatch('src/huge.ts', 10, 400);
    const plan = buildPostPlan({
      summaryText: summary({ patchesText: patch }),
      patches: [{ fileName: '1.patch', upstreamPath: 'src/huge.ts', text: patch }],
    });
    expect(plan.body.length).toBeLessThanOrEqual(MAX_BODY);
    for (const c of plan.comments) expect(c.length).toBeLessThanOrEqual(MAX_BODY);
  });

  it('throws when the summary is too large even without its patches', () => {
    const text = summary().replace('## Card', `## Card\n\n${'y'.repeat(MAX_BODY)}`);
    expect(() => buildPostPlan({ summaryText: text, patches: [] })).toThrow(/too large/);
  });
});

function stub(responses) {
  const calls = [];
  const runGh = (args) => {
    const files = {};
    args.forEach((a, i) => {
      const m = /^body=@(.+)$/.exec(a);
      if (args[i - 1] === '-F' && m && fs.existsSync(m[1])) files[m[1]] = fs.readFileSync(m[1], 'utf8');
    });
    calls.push({ args, files });
    return responses.shift();
  };
  return { runGh, calls };
}

describe('createDiscussion / addDiscussionComment', () => {
  it('sends the body only via -F body=@file and parses the result', () => {
    const f = new URL('./_body.tmp.md', import.meta.url);
    fs.writeFileSync(f, 'multi\n\nparagraph `body`');
    try {
      const file = fileURLToPath(f);
      const { runGh, calls } = stub([
        { status: 0, stdout: JSON.stringify({ data: { createDiscussion: { discussion: { id: 'D_1', url: 'https://x/1' } } } }), stderr: '' },
      ]);
      const r = createDiscussion(runGh, { title: 'T', bodyFile: file });
      expect(r).toEqual({ id: 'D_1', url: 'https://x/1' });
      const { args, files } = calls[0];
      expect(args.slice(0, 3)).toEqual(['api', 'graphql', '-f']);
      expect(args).toContain(`repo=${REPO_ID}`);
      expect(args).toContain(`cat=${CATEGORY_ID}`);
      expect(args).toContain('title=T');
      expect(args[args.indexOf(`body=@${file}`) - 1]).toBe('-F');
      expect(args.some((a) => a.startsWith('body=') && !a.startsWith('body=@'))).toBe(false);
      expect(files[file]).toBe('multi\n\nparagraph `body`');
    } finally {
      fs.rmSync(f, { force: true });
    }
  });

  it('adds a comment and returns its url', () => {
    const f = new URL('./_comment.tmp.md', import.meta.url);
    fs.writeFileSync(f, 'c');
    try {
      const file = fileURLToPath(f);
      const { runGh, calls } = stub([
        { status: 0, stdout: JSON.stringify({ data: { addDiscussionComment: { comment: { url: 'https://x/c' } } } }), stderr: '' },
      ]);
      expect(addDiscussionComment(runGh, { discussionId: 'D_1', bodyFile: file })).toBe('https://x/c');
      expect(calls[0].args).toContain('id=D_1');
      expect(calls[0].args).toContain('-F');
    } finally {
      fs.rmSync(f, { force: true });
    }
  });

  it('throws with stderr on a non-zero exit', () => {
    const { runGh } = stub([{ status: 1, stdout: '', stderr: 'boom' }]);
    expect(() => createDiscussion(runGh, { title: 't', bodyFile: 'nope' })).toThrow(/boom/);
  });

  it('throws on GraphQL errors', () => {
    const { runGh } = stub([{ status: 0, stdout: JSON.stringify({ errors: [{ message: 'Could not resolve' }] }), stderr: '' }]);
    expect(() => createDiscussion(runGh, { title: 't', bodyFile: 'nope' })).toThrow(/Could not resolve/);
  });
});

describe('ghLogin', () => {
  it('returns the login', () => {
    expect(ghLogin(() => ({ status: 0, stdout: 'octo\n', stderr: '' }))).toBe('octo');
  });
  it('is null when gh is missing', () => {
    expect(ghLogin(() => ({ status: null, stdout: '', stderr: '', error: Object.assign(new Error('x'), { code: 'ENOENT' }) }))).toBeNull();
  });
  it('is null when unauthenticated', () => {
    expect(ghLogin(() => ({ status: 1, stdout: '', stderr: 'not logged in' }))).toBeNull();
  });
});
