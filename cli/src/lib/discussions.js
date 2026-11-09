/**
 * Posting `toolcrib export-patches` output to GitHub Discussions via the `gh`
 * CLI. Everything that touches `gh` takes an injectable `runGh(args)` so it is
 * testable without any network; the plan builder is pure.
 */
import { spawnSync } from 'node:child_process';

// Cached GraphQL node ids for escape-llc/toolcrib and its "Consumer Patches"
// discussion category. If a mutation fails with a not-found error, re-fetch
// them via `repository.discussionCategories` and update these.
export const REPO_ID = 'R_kgDOTwhGaA';
export const CATEGORY_ID = 'DIC_kwDOTwhGaM4DKwRA';
export const MAX_BODY = 65536;
export const CATEGORY_URL = 'https://github.com/escape-llc/toolcrib/discussions/categories/consumer-patches';

const CREATE_MUTATION =
  'mutation($repo:ID!,$cat:ID!,$title:String!,$body:String!){createDiscussion(input:{repositoryId:$repo,categoryId:$cat,title:$title,body:$body}){discussion{id url}}}';
const COMMENT_MUTATION =
  'mutation($id:ID!,$body:String!){addDiscussionComment(input:{discussionId:$id,body:$body}){comment{url}}}';

/** Run `gh` directly (no shell: gh.exe resolves on Windows). */
export function defaultRunGh(args) {
  const r = spawnSync('gh', args, { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error };
}

/** The authenticated GitHub login, or null when gh is missing or not logged in. */
export function ghLogin(runGh) {
  const r = runGh(['api', 'user', '--jq', '.login']);
  if (r.error || r.status !== 0) return null;
  const login = String(r.stdout ?? '').trim();
  return login || null;
}

function runGraphql(runGh, query, vars, bodyFile) {
  const args = ['api', 'graphql', '-f', `query=${query}`];
  for (const [k, v] of Object.entries(vars)) args.push('-f', `${k}=${v}`);
  args.push('-F', `body=@${bodyFile}`);
  const r = runGh(args);
  if (r.error) throw new Error(`gh failed to run: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`gh api graphql failed (exit ${r.status}): ${String(r.stderr).trim()}`);
  let json;
  try {
    json = JSON.parse(r.stdout);
  } catch {
    throw new Error(`gh api graphql returned non-JSON output: ${String(r.stdout).slice(0, 200)}`);
  }
  if (json.errors?.length) {
    throw new Error(`GitHub GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`);
  }
  return json.data;
}

export function createDiscussion(runGh, { title, bodyFile }) {
  const data = runGraphql(runGh, CREATE_MUTATION, { repo: REPO_ID, cat: CATEGORY_ID, title }, bodyFile);
  const d = data?.createDiscussion?.discussion;
  if (!d?.id) throw new Error('GitHub returned no discussion for createDiscussion.');
  return { id: d.id, url: d.url };
}

export function addDiscussionComment(runGh, { discussionId, bodyFile }) {
  const data = runGraphql(runGh, COMMENT_MUTATION, { id: discussionId }, bodyFile);
  const url = data?.addDiscussionComment?.comment?.url;
  if (!url) throw new Error('GitHub returned no comment for addDiscussionComment.');
  return url;
}

function yamlValue(summaryText, key) {
  const block = /```yaml\r?\n([\s\S]*?)\r?\n```/.exec(summaryText);
  if (!block) return undefined;
  const m = new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(block[1]);
  if (!m) return undefined;
  let v = m[1].replace(/\s+#.*$/, '').trim();
  const q = /^"((?:[^"\\]|\\.)*)"$/.exec(v);
  if (q) v = q[1].replace(/\\(.)/g, '$1');
  return v;
}

function fenceFor(text) {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  return '`'.repeat(longest + 1);
}

/** Slice an over-long string into pieces of at most `size` characters. */
function sliceBy(text, size) {
  const out = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

/**
 * Split a patch into text chunks each at most `budget` characters, at hunk
 * boundaries, repeating the file header at the top of every chunk.
 */
function splitPatch(text, budget) {
  if (text.length <= budget) return [text];
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const firstHunk = lines.findIndex((l) => l.startsWith('@@ '));
  const header = firstHunk === -1 ? '' : lines.slice(0, firstHunk).join('');
  const body = firstHunk === -1 ? lines : lines.slice(firstHunk);
  const hunks = [];
  for (const line of body) {
    if (line.startsWith('@@ ') || hunks.length === 0) hunks.push(line);
    else hunks[hunks.length - 1] += line;
  }
  const room = budget - header.length;
  if (room < 1000) throw new Error('A patch header is too large to split into discussion comments.');

  // Break any hunk that cannot fit by itself, at line boundaries.
  const units = [];
  for (const h of hunks) {
    if (h.length <= room) {
      units.push(h);
      continue;
    }
    let cur = '';
    for (const line of h.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
      for (const piece of line.length > room ? sliceBy(line, room) : [line]) {
        if (cur.length + piece.length > room) {
          units.push(cur);
          cur = '';
        }
        cur += piece;
      }
    }
    if (cur) units.push(cur);
  }

  const chunks = [];
  let cur = '';
  for (const u of units) {
    if (cur && cur.length + u.length > room) {
      chunks.push(header + cur);
      cur = '';
    }
    cur += u;
  }
  if (cur) chunks.push(header + cur);
  return chunks;
}

/**
 * Pure: turn a SUMMARY.md and its patches into a discussion title, body, and
 * (when the whole thing exceeds MAX_BODY) the follow-up comments carrying the
 * patches. Every returned body/comment is at most MAX_BODY characters.
 *
 * @param {{ summaryText: string, patches: { fileName: string, upstreamPath: string, text: string }[] }} input
 */
export function buildPostPlan({ summaryText, patches }) {
  const contribution = yamlValue(summaryText, 'contribution') ?? 'unnamed';
  const type = yamlValue(summaryText, 'type') ?? 'unknown';
  const base = yamlValue(summaryText, 'base_version') ?? 'unknown';
  const title = `[consumer-patch] ${contribution} (${type}, base v${base})`;

  if (summaryText.length <= MAX_BODY) return { title, body: summaryText, comments: [] };

  const idx = summaryText.search(/^### Patches\s*$/m);
  const prefix = idx === -1 ? summaryText.replace(/\s*$/, '\n\n') : summaryText.slice(0, idx);

  // Comment overhead: heading, blank line, two fences, "diff", and a part suffix.
  const comments = [];
  for (const { upstreamPath, text } of patches) {
    const body = text.replace(/\n$/, '');
    const fence = fenceFor(body);
    const title0 = `#### ${upstreamPath}`;
    const reserve = title0.length + 2 * (fence.length + 2) + 8 + 24;
    const chunks = splitPatch(body, MAX_BODY - reserve);
    chunks.forEach((chunk, i) => {
      const t = chunks.length > 1 ? `${title0} (part ${i + 1}/${chunks.length})` : title0;
      comments.push(`${t}\n\n${fence}diff\n${chunk}\n${fence}`);
    });
  }

  const n = comments.length;
  const body = `${prefix}### Patches\n\nPosted as ${n} comment(s) below, in order.\n`;
  if (body.length > MAX_BODY) {
    throw new Error(`SUMMARY.md is too large to post even without its patches (${body.length} > ${MAX_BODY} characters).`);
  }
  for (const c of comments) {
    if (c.length > MAX_BODY) throw new Error('Internal error: a patch comment exceeds the size limit.');
  }
  return { title, body, comments };
}
