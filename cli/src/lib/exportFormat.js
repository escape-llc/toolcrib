/**
 * Pure rendering for `toolcrib export-patches`: the per-contribution
 * SUMMARY.md (whose YAML metadata block is parsed back later, so its shape is
 * machine-stable), the top-level README.md index, and patch file naming.
 * No fs, no network.
 */

export const INTENT_PLACEHOLDER = 'unspecified';
const INTENT_COMMENT = 'bug-fix | missing-feature | customization';

/** Folder name for contribution `index` (0-based) — `NN-<name>`, NN 1-based. */
export function contributionFolder(index, name) {
  const safe = name.replace(/[^A-Za-z0-9._-]/g, '-');
  return `${String(index + 1).padStart(2, '0')}-${safe}`;
}

/** Patch file name: `NNNN-<upstream path with / replaced by ->.patch`. */
export function patchFileName(index, upstreamPath) {
  return `${String(index + 1).padStart(4, '0')}-${upstreamPath.replace(/[/\\]/g, '-')}.patch`;
}

/**
 * Emit a YAML scalar, double-quoted when a plain scalar would be misread:
 * empty, contains `: ` / `#` / flow punctuation, starts with an indicator
 * character, has edge whitespace, or would parse as a non-string.
 */
export function yamlScalar(value) {
  const s = String(value);
  const needsQuote =
    s === '' ||
    /: |#|[,[\]{}]/.test(s) ||
    /:$/.test(s) ||
    /^[&*!|>'"%@`]/.test(s) ||
    /^[-?:](\s|$)/.test(s) ||
    /^\s|\s$/.test(s) ||
    /^(?:true|false|null|yes|no|on|off|~)$/i.test(s) ||
    /^[-+]?(?:\d[\d_]*\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(s);
  return needsQuote ? `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : s;
}

function yamlFlowList(items) {
  return items.length === 0 ? '[]' : `[${items.map(yamlScalar).join(', ')}]`;
}

/** Backtick fence long enough that the content can't close it early. */
function fenceFor(text) {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  return '`'.repeat(longest + 1);
}

function describeContribution(c, baseVersion) {
  const count = (change) => c.files.filter((f) => f.change === change && f.hunks === undefined).length;
  const shared = c.files.filter((f) => f.hunks !== undefined);
  const parts = [];
  const added = count('added');
  const modified = count('modified');
  const deleted = count('deleted');
  const fileBits = [];
  if (added) fileBits.push(`${added} file(s) added`);
  if (modified) fileBits.push(`${modified} file(s) modified`);
  if (deleted) fileBits.push(`${deleted} file(s) deleted`);
  if (fileBits.length) parts.push(`${fileBits.join(', ')}.`);
  if (shared.length) {
    parts.push(
      `Shared-file hunks: ${shared.map((f) => `${f.relPath} (${f.hunks})`).join(', ')}.`
    );
  }
  if (c.dependsOn.length) parts.push(`Depends on contribution(s): ${c.dependsOn.join(', ')}.`);
  if (c.missingDependencies.length) {
    parts.push(
      `Missing dependencies (changed locally but not exportable, so this will not compile upstream without them): ${c.missingDependencies.join(', ')}.`
    );
  }
  return parts.join(' ');
}

/**
 * @param {object} args
 * @param {object} args.contribution one entry of analyzeExport().contributions
 * @param {string} args.baseVersion installed toolkit version the patches apply to
 * @param {string} args.cliVersion this CLI's own package version
 * @param {{relPath:string}[]} args.notExported
 * @param {string[]} args.regeneratedUpstream
 * @param {{ file: object, fileName: string }[]} args.patches the contribution's exported patch files, in order
 */
export function renderSummary({ contribution: c, baseVersion, cliVersion, notExported, regeneratedUpstream, patches }) {
  const yaml = [
    'kind: consumer-patch',
    'schema: 1',
    `base_version: ${yamlScalar(baseVersion)}`,
    `cli_version: ${yamlScalar(cliVersion)}`,
    `contribution: ${yamlScalar(c.name)}`,
    `type: ${c.type}`,
    'files:',
  ];
  for (const f of c.files) {
    yaml.push(`  - path: ${yamlScalar(f.upstreamPath)}`);
    yaml.push(`    change: ${f.change}`);
    if (f.hunks !== undefined) yaml.push(`    hunks: ${f.hunks}`);
    yaml.push(`    intent: ${INTENT_PLACEHOLDER}  # ${INTENT_COMMENT}`);
  }
  yaml.push(`depends_on: ${yamlFlowList(c.dependsOn)}`);
  yaml.push(`missing_dependencies: ${yamlFlowList(c.missingDependencies)}`);
  yaml.push(`not_exported: ${yamlFlowList(notExported.map((n) => n.relPath))}`);
  yaml.push(`regenerated_upstream: ${yamlFlowList(regeneratedUpstream)}`);
  yaml.push('checklist:');
  for (const [key, { status }] of Object.entries(c.checklist)) yaml.push(`  ${key}: ${status}`);

  const lines = [
    '<details><summary>Patch metadata</summary>',
    '',
    '```yaml',
    ...yaml,
    '```',
    '',
    '</details>',
    '',
    `## ${c.name} (${c.type}, base v${baseVersion})`,
    '',
    describeContribution(c, baseVersion),
    '',
    '### Readiness checklist',
    '',
    '| Check | Result | Details |',
    '|---|---|---|',
  ];
  for (const [key, { status, details }] of Object.entries(c.checklist)) {
    const cell = details.map((d) => d.replace(/\|/g, '\\|')).join('; ');
    lines.push(cell ? `| ${key} | ${status} | ${cell} |` : `| ${key} | ${status} | |`);
  }
  lines.push('', '### Patches', '');
  for (const { file } of patches) {
    const fence = fenceFor(file.patch);
    lines.push(`#### ${file.upstreamPath}`, '', `${fence}diff`, file.patch.replace(/\n$/, ''), fence, '');
  }
  return lines.join('\n');
}

/** Read the `intent:` values back out of a SUMMARY.md's YAML block, in file order. */
export function parseIntents(summaryText) {
  const block = /```yaml\r?\n([\s\S]*?)\r?\n```/.exec(summaryText);
  if (!block) return [];
  const intents = [];
  for (const line of block[1].split(/\r?\n/)) {
    const m = /^\s+intent:\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[1];
    const quoted = /^"((?:[^"\\]|\\.)*)"/.exec(value);
    if (quoted) value = quoted[1].replace(/\\(.)/g, '$1');
    else value = value.replace(/\s+#.*$/, '').trim();
    intents.push(value);
  }
  return intents;
}

function diffBlock(text) {
  const fence = fenceFor(text);
  return `${fence}diff\n${text}\n${fence}`;
}

/**
 * @param {object} args
 * @param {string} args.baseVersion
 * @param {{ folder: string, contribution: object }[]} args.entries
 * @param {{relPath:string, change:string}[]} args.notExported
 * @param {string[]} args.regeneratedUpstream
 * @param {{relPath:string, hunkText:string}[]} args.appSpecific
 * @param {{relPath:string, hunkText:string, candidates:string[]}[]} args.ambiguous
 */
export function renderReadme({ baseVersion, entries, notExported, regeneratedUpstream, appSpecific, ambiguous }) {
  const lines = [
    '# toolcrib upstream export',
    '',
    `Base version: v${baseVersion}. Each contribution folder's patches apply with \`git apply\` to a checkout of the \`v${baseVersion}\` tag, independently of the others.`,
    '',
    "Fill in each contribution's `intent:` lines in its SUMMARY.md before posting.",
    '',
    '## Contributions',
    '',
  ];
  if (entries.length === 0) lines.push('None.', '');
  else {
    lines.push('| Folder | Name | Type | Files |', '|---|---|---|---|');
    for (const { folder, contribution: c } of entries) {
      lines.push(`| ${folder} | ${c.name} | ${c.type} | ${c.files.length} |`);
    }
    lines.push('');
  }

  lines.push('## Not exported', '');
  if (notExported.length === 0) lines.push('None.', '');
  else {
    lines.push('Changed outside the exportable directories (components, theme, eventBus, observer), or a shared file that was added or deleted:', '');
    for (const n of notExported) lines.push(`- ${n.relPath} (${n.change})`);
    lines.push('');
  }

  lines.push('## Regenerated upstream', '');
  if (regeneratedUpstream.length === 0) lines.push('None.', '');
  else {
    lines.push('Generated upstream from source tags, so your edit is expected and not exported:', '');
    for (const r of regeneratedUpstream) lines.push(`- ${r}`);
    lines.push('');
  }

  lines.push('## App-specific shared-file changes', '');
  if (appSpecific.length === 0) lines.push('None.', '');
  else {
    lines.push('Hunks in shared files that no contribution owns. Not exported.', '');
    for (const a of appSpecific) lines.push(`### ${a.relPath}`, '', diffBlock(a.hunkText), '');
  }

  lines.push('## Ambiguous shared-file changes', '');
  if (ambiguous.length === 0) lines.push('None.', '');
  else {
    lines.push('Hunks that more than one contribution could own. Not exported; split them by hand.', '');
    for (const a of ambiguous) {
      lines.push(`### ${a.relPath}`, '', `Candidates: ${a.candidates.join(', ')}`, '', diffBlock(a.hunkText), '');
    }
  }
  return lines.join('\n');
}
