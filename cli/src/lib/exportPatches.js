import { structuredPatch } from 'diff';
import { normalize, buildPatch } from './patches.js';
import { stripComments, extractImports, resolveRelativeImport } from './importScan.js';

/**
 * Pure analysis for `toolcrib export-patches`: given the installed release's
 * files and the consumer's local copy of the vendored tree (both as in-memory
 * Maps of forward-slash relPath -> text, relative to the toolkit root), decide
 * what can go upstream, group it into contributions, split the shared
 * registry files by hunk, and run a static readiness checklist. No fs, no
 * network, so every rule here is unit-testable with plain fixtures.
 */

/** Top-level vendored source directories eligible for export. */
export const ALLOWLIST = ['components', 'theme', 'eventBus', 'observer'];

/**
 * Files every contribution edits (event channels, slice registry, editor
 * controls). Import-following can't reach them, and exporting one whole would
 * drag along other contributions' and the app's own edits, so they are split
 * by hunk instead.
 */
export const SHARED_FILES = [
  'eventBus/eventBus.ts',
  'theme/registerThemeSlices.ts',
  'components/ThemeEditor/sliceEditorControls.tsx',
];

export const VALID_CATEGORIES = ['Layout Primitives', 'Containers', 'Overlays', 'Data Display', 'Form Controls'];

const INFRA_DIRS = ['theme', 'eventBus', 'observer'];
const CODE_FILE = /\.[cm]?[jt]sx?$/;
const TS_FILE = /\.tsx?$/;
const MANIFEST_BLOCK_RE = /\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*export\s+(?:const|function)\s+(\w+)/g;
const EXPORT_DECL_RE = /\bexport\s+(?:declare\s+)?(?:abstract\s+)?(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
const USE_CLIENT_TRIGGER_RE =
  /\buse[A-Z]\w*\s*\(|\bcreateContext\s*\(|\b(?:document|window)\.|extends\s+(?:React\.)?(?:Pure)?Component\b/;

/**
 * Local content is diffed to produce patches for the UPSTREAM repo, which is
 * LF with no BOM. This is the opposite of project.js's readTextIfExists,
 * which must keep a BOM because its output becomes the "before" side of a
 * patch that git apply matches byte-for-byte against the consumer's own file.
 */
function toUpstreamText(content) {
  const noBom = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  return normalize(noBom);
}

function toNormalizedMap(files) {
  const out = new Map();
  for (const [relPath, content] of files) out.set(relPath, toUpstreamText(content));
  return out;
}

function topSegment(relPath) {
  return relPath.includes('/') ? relPath.split('/')[0] : null;
}

function baseName(relPath) {
  return relPath.split('/').pop().replace(/\.[^.]+$/, '');
}

/** Component unit a path belongs to: components/<Folder>/... or components/<File>.ext. */
function unitKeyOf(relPath) {
  const parts = relPath.split('/');
  if (parts[0] !== 'components' || parts.length < 2) return null;
  if (parts.length >= 3) return parts[1];
  return parts[1].replace(/\.[^.]+$/, '');
}

/** `@manifest`-tagged exported components: [{ name, body }] (body = JSDoc text). */
function manifestComponents(content) {
  const out = [];
  for (const m of content.matchAll(MANIFEST_BLOCK_RE)) {
    if (/@manifest(?=\s)/.test(m[1])) out.push({ name: m[2], body: m[1] });
  }
  return out;
}

function exportedNames(content) {
  const code = stripComments(content);
  return [...code.matchAll(EXPORT_DECL_RE)].map((m) => m[1]);
}

function sliceIds(content) {
  const code = stripComments(content);
  if (!/:\s*ThemeSlice</.test(code)) return [];
  return [...code.matchAll(/\bid:\s*'([^']+)'/g)].map((m) => m[1]);
}

function hunkHeaderText(h) {
  return `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@\n${h.lines.join('\n')}`;
}

/** Tokens a hunk's added AND removed lines expose for attribution. */
function hunkTokens(hunk, sharedRelPath, localHas) {
  const changed = hunk.lines.filter((l) => l[0] === '+' || l[0] === '-').map((l) => l.slice(1));
  const text = changed.join('\n');

  const channels = [];
  for (const m of text.matchAll(/'(([a-z0-9]+):[A-Za-z0-9_:-]+)'\s*[:?]/g)) {
    channels.push({ full: m[1], prefix: m[2] });
  }

  const specifiers = new Set(extractImports(text));
  // A multi-line import's `} from './x'` tail has no import keyword in the hunk.
  for (const m of text.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) specifiers.add(m[1]);
  const imports = new Set();
  for (const spec of specifiers) {
    const resolved = resolveRelativeImport(sharedRelPath, spec, localHas);
    if (resolved) imports.add(resolved);
  }

  const identifiers = new Set(text.match(/\b[A-Z][A-Za-z0-9_]{3,}\b/g) ?? []);
  const keys = new Set();
  for (const line of changed) {
    const m = /^\s*([a-z][a-z0-9]*)\s*:/.exec(line);
    if (m) keys.add(m[1]);
  }
  const addedChannelPrefixes = [];
  for (const l of hunk.lines) {
    if (l[0] !== '+') continue;
    for (const m of l.matchAll(/'(([a-z0-9]+):[A-Za-z0-9_:-]+)'\s*[:?]/g)) addedChannelPrefixes.push(m[2]);
  }
  return { channels, imports, identifiers, keys, addedChannelPrefixes };
}

/**
 * Apply only the selected zero-context hunks to `original`. structuredPatch
 * (diff v9) reports oldStart as the 1-based line the hunk starts at, and for
 * a pure insertion (oldLines 0) the 1-based line it goes BEFORE, so
 * `oldStart - 1` is the 0-based splice index in both cases.
 */
function applyHunks(original, hunks) {
  let lines = original.split('\n');
  const endsWithNewline = lines[lines.length - 1] === '';
  if (endsWithNewline) lines = lines.slice(0, -1);

  const sorted = [...hunks].sort((a, b) => a.oldStart - b.oldStart);
  const out = [];
  let cursor = 0;
  for (const h of sorted) {
    const start = h.oldStart - 1;
    for (; cursor < start; cursor++) out.push(lines[cursor]);
    for (const l of h.lines) {
      if (l[0] === '+') out.push(l.slice(1));
    }
    cursor = start + h.oldLines;
  }
  for (; cursor < lines.length; cursor++) out.push(lines[cursor]);
  return out.join('\n') + (endsWithNewline ? '\n' : '');
}

class UnionFind {
  constructor(items) {
    this.parent = new Map(items.map((i) => [i, i]));
  }
  find(x) {
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root);
    this.parent.set(x, root);
    return root;
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
}

/**
 * @param {{ releaseFiles: Map<string,string>, localFiles: Map<string,string> }} input
 *   relPaths are relative to the toolkit root (`components/Card/Card.tsx`).
 */
export function analyzeExport({ releaseFiles, localFiles }) {
  const rel = toNormalizedMap(releaseFiles);
  const loc = toNormalizedMap(localFiles);
  const localHas = (p) => loc.has(p);

  // ---- classify every differing file ----
  const notExported = [];
  const regeneratedUpstream = [];
  const changed = new Map(); // allowlisted, non-shared: relPath -> 'added'|'modified'|'deleted'
  const sharedModified = [];
  let anyDifference = false;

  const allPaths = [...new Set([...rel.keys(), ...loc.keys()])].sort();
  for (const relPath of allPaths) {
    const inRel = rel.has(relPath);
    const inLoc = loc.has(relPath);
    if (inRel && inLoc && rel.get(relPath) === loc.get(relPath)) continue;
    anyDifference = true;
    const change = inRel && inLoc ? 'modified' : inLoc ? 'added' : 'deleted';

    if (relPath === 'index.ts') {
      regeneratedUpstream.push(relPath);
      continue;
    }
    const seg = topSegment(relPath);
    if (!seg || !ALLOWLIST.includes(seg)) {
      notExported.push({ relPath, change });
      continue;
    }
    if (SHARED_FILES.includes(relPath)) {
      if (change === 'modified') sharedModified.push(relPath);
      else notExported.push({ relPath, change });
      continue;
    }
    changed.set(relPath, change);
  }

  if (!anyDifference) {
    return { hasChanges: false, contributions: [], notExported, regeneratedUpstream, appSpecific: [], ambiguous: [] };
  }

  // ---- import graph over the consumer's whole tree ----
  const depCache = new Map();
  const deps = (relPath) => {
    if (depCache.has(relPath)) return depCache.get(relPath);
    const out = new Set();
    const content = loc.get(relPath);
    if (content !== undefined && CODE_FILE.test(relPath)) {
      for (const spec of extractImports(content)) {
        const resolved = resolveRelativeImport(relPath, spec, localHas);
        if (resolved) out.add(resolved);
      }
    }
    depCache.set(relPath, out);
    return out;
  };

  // ---- 1. component units ----
  const releaseUnitKeys = new Set([...rel.keys()].map(unitKeyOf).filter(Boolean));
  const units = new Map(); // key -> contribution
  const unitOf = new Map(); // relPath -> unit key
  for (const [relPath] of changed) {
    const key = unitKeyOf(relPath);
    if (!key) continue;
    if (!units.has(key)) {
      units.set(key, {
        name: key,
        type: releaseUnitKeys.has(key) ? 'change' : 'new-component',
        isUnit: true,
        paths: [],
        dependsOn: [],
        missingDependencies: [],
      });
    }
    units.get(key).paths.push(relPath);
    unitOf.set(relPath, key);
  }

  // ---- 2. import following ----
  const isInfraCandidate = (p) => changed.has(p) && INFRA_DIRS.includes(topSegment(p)) && !unitOf.has(p);
  const reachedBy = new Map(); // candidate relPath -> Set(unit key)
  const reachedPerUnit = new Map();
  for (const [key, unit] of units) {
    const seen = new Set(unit.paths);
    const stack = [...unit.paths];
    const reached = new Set();
    const missing = new Set();
    while (stack.length) {
      const f = stack.pop();
      for (const d of deps(f)) {
        if (seen.has(d)) continue;
        seen.add(d);
        if (SHARED_FILES.includes(d)) continue;
        const owner = unitOf.get(d);
        if (owner !== undefined && owner !== key) continue; // another unit's own files
        if (isInfraCandidate(d)) reached.add(d);
        else if (changed.has(d) === false && loc.has(d) && rel.get(d) !== loc.get(d) && d !== 'index.ts') {
          if (!ALLOWLIST.includes(topSegment(d) ?? '')) missing.add(d);
        }
        stack.push(d);
      }
    }
    reachedPerUnit.set(key, reached);
    unit.missingDependencies = [...missing].sort();
    for (const d of reached) {
      if (!reachedBy.has(d)) reachedBy.set(d, new Set());
      reachedBy.get(d).add(key);
    }
  }
  for (const [d, owners] of reachedBy) {
    if (owners.size === 1) {
      const key = [...owners][0];
      units.get(key).paths.push(d);
      unitOf.set(d, key);
    }
  }

  // ---- 3. infrastructure contributions ----
  const pool = [...changed.keys()].filter((p) => !unitOf.has(p) && INFRA_DIRS.includes(topSegment(p))).sort();
  const uf = new UnionFind(pool);
  const poolSet = new Set(pool);
  for (const f of pool) {
    for (const d of deps(f)) if (poolSet.has(d)) uf.union(f, d);
  }
  const groups = new Map();
  for (const f of pool) {
    const root = uf.find(f);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(f);
  }
  const usedNames = new Set(units.keys());
  const infra = [];
  const infraOfFile = new Map();
  for (const members of groups.values()) {
    members.sort();
    let name = baseName(members[0]);
    while (usedNames.has(name)) name += '-infra';
    usedNames.add(name);
    const contribution = {
      name,
      type: members.some((m) => changed.get(m) === 'added') ? 'infrastructure' : 'change',
      isUnit: false,
      paths: members,
      dependsOn: [],
      missingDependencies: [],
    };
    infra.push(contribution);
    for (const m of members) infraOfFile.set(m, contribution);
  }
  infra.sort((a, b) => a.name.localeCompare(b.name));
  for (const [key, unit] of units) {
    const names = new Set();
    for (const d of reachedPerUnit.get(key)) {
      if (infraOfFile.has(d)) names.add(infraOfFile.get(d).name);
    }
    unit.dependsOn = [...names].sort();
  }

  const contributions = [...[...units.values()].sort((a, b) => a.name.localeCompare(b.name)), ...infra];

  // ---- per-contribution facts used for hunk attribution ----
  for (const c of contributions) {
    c.paths.sort();
    const live = c.paths.filter((p) => loc.has(p));
    const text = live.map((p) => loc.get(p)).join('\n');
    c.manifest = [];
    c.exports = new Set();
    c.prefixes = new Set();
    c.sliceIds = [];
    for (const p of live) {
      for (const m of manifestComponents(loc.get(p))) {
        c.manifest.push(m);
        c.prefixes.add(m.name.toLowerCase());
      }
      for (const n of exportedNames(loc.get(p))) c.exports.add(n);
      for (const id of sliceIds(loc.get(p))) {
        c.sliceIds.push(id);
        c.prefixes.add(id);
      }
    }
    if (c.isUnit) c.prefixes.add(c.name.toLowerCase());
    c.text = text;
    c.fileSet = new Set(c.paths);
    c.hunksByFile = new Map(); // shared relPath -> [{ hunk, tokens }]
  }

  // ---- shared files: split by hunk ----
  const appSpecific = [];
  const ambiguous = [];
  for (const relPath of sharedModified) {
    const patch = structuredPatch(relPath, relPath, rel.get(relPath), loc.get(relPath), '', '', { context: 0 });
    for (const hunk of patch.hunks) {
      const tokens = hunkTokens(hunk, relPath, localHas);
      const matches = contributions.filter((c) => {
        for (const ch of tokens.channels) {
          if (c.prefixes.has(ch.prefix)) return true;
          if (c.text.includes(`'${ch.full}'`) || c.text.includes(`"${ch.full}"`)) return true;
        }
        for (const i of tokens.imports) if (c.fileSet.has(i)) return true;
        for (const id of tokens.identifiers) if (c.exports.has(id)) return true;
        for (const k of tokens.keys) if (c.prefixes.has(k)) return true;
        return false;
      });
      if (matches.length === 1) {
        const c = matches[0];
        if (!c.hunksByFile.has(relPath)) c.hunksByFile.set(relPath, []);
        c.hunksByFile.get(relPath).push({ hunk, tokens });
      } else if (matches.length === 0) {
        appSpecific.push({ relPath, hunkText: hunkHeaderText(hunk) });
      } else {
        ambiguous.push({ relPath, hunkText: hunkHeaderText(hunk), candidates: matches.map((c) => c.name) });
      }
    }
  }

  // ---- build file records + patches ----
  for (const c of contributions) {
    const files = [];
    for (const p of c.paths) {
      const change = changed.get(p);
      const upstream = `src/${p}`;
      files.push({
        relPath: p,
        upstreamPath: upstream,
        change,
        patch: buildPatch(upstream, rel.get(p) ?? '', loc.get(p) ?? ''),
      });
    }
    for (const [p, entries] of c.hunksByFile) {
      const original = rel.get(p);
      const partial = applyHunks(original, entries.map((e) => e.hunk));
      files.push({
        relPath: p,
        upstreamPath: `src/${p}`,
        change: 'modified',
        hunks: entries.length,
        patch: buildPatch(`src/${p}`, original, partial),
      });
    }
    files.sort((a, b) => a.relPath.localeCompare(b.relPath));
    c.files = files;
  }

  // ---- readiness checklist ----
  const changedTestFiles = notExported.map((n) => n.relPath).filter((p) => p.startsWith('__tests__/'));
  for (const c of contributions) {
    c.checklist = buildChecklist(c, loc, changedTestFiles);
  }

  const outContributions = contributions.map((c) => ({
    name: c.name,
    type: c.type,
    files: c.files,
    dependsOn: c.dependsOn,
    missingDependencies: c.missingDependencies,
    checklist: c.checklist,
  }));

  notExported.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return { hasChanges: true, contributions: outContributions, notExported, regeneratedUpstream, appSpecific, ambiguous };
}

// ---------------------------------------------------------------------------
// Readiness checklist
// ---------------------------------------------------------------------------

const result = (status, details = []) => ({ status, details });

function buildChecklist(c, loc, changedTestFiles) {
  const live = c.paths.filter((p) => loc.has(p));
  const codeFiles = live.filter((p) => TS_FILE.test(p));
  const checks = {};

  const useClient = () => {
    const offenders = [];
    for (const p of codeFiles) {
      const content = loc.get(p);
      // A hook *declaration* is not a hook call.
      const code = stripComments(content).replace(/\bfunction\s+use[A-Z]\w*/g, 'function _');
      if (!USE_CLIENT_TRIGGER_RE.test(code)) continue;
      if (!/^\s*(['"])use client\1/.test(stripComments(content))) offenders.push(p);
    }
    return result(offenders.length ? 'fail' : 'pass', offenders);
  };
  const selfImport = () => {
    const offenders = live.filter((p) =>
      CODE_FILE.test(p) && extractImports(loc.get(p)).some((s) => s === '#toolcrib' || s.startsWith('#toolcrib/'))
    );
    return result(offenders.length ? 'fail' : 'pass', offenders);
  };
  const processEnv = () => {
    const offenders = live.filter((p) => CODE_FILE.test(p) && /\bprocess\.env\b/.test(stripComments(loc.get(p))));
    return result(offenders.length ? 'fail' : 'pass', offenders.map((p) => `${p} (use isDevBuild())`));
  };

  if (c.type === 'new-component') {
    checks.manifest = c.manifest.length
      ? result('pass', c.manifest.map((m) => m.name))
      : result('fail', ['no exported component carries a @manifest tag']);

    if (c.manifest.length === 0) {
      checks.manifest_category = result('n/a');
    } else {
      const bad = [];
      for (const m of c.manifest) {
        const cat = /@manifestCategory[ \t]+([^\r\n]*)/.exec(m.body)?.[1].trim();
        if (!cat) bad.push(`${m.name}: missing @manifestCategory`);
        else if (!VALID_CATEGORIES.includes(cat)) bad.push(`${m.name}: invalid category "${cat}"`);
      }
      checks.manifest_category = result(bad.length ? 'fail' : 'pass', bad);
    }

    const styleBad = [];
    let sawStyleFree = false;
    for (const p of codeFiles) {
      const code = stripComments(loc.get(p));
      if (/extends\s+(?:React\.)?\w*HTMLAttributes</.test(code)) styleBad.push(`${p}: extends raw HTMLAttributes`);
      if (/^\s*(?:readonly\s+)?(?:style|className)\??\s*:[^\n]*;\s*$/m.test(code)) styleBad.push(`${p}: declares style/className`);
      if (/StyleFree/.test(code)) sawStyleFree = true;
    }
    checks.style_free = styleBad.length ? result('fail', styleBad) : sawStyleFree ? result('pass') : result('n/a');

    checks.use_client = useClient();
    checks.toolcrib_self_import = selfImport();
    checks.process_env = processEnv();

    const badPrefix = [];
    let sawChannel = false;
    for (const entries of c.hunksByFile.values()) {
      for (const { tokens } of entries) {
        for (const prefix of tokens.addedChannelPrefixes) {
          sawChannel = true;
          if (!c.prefixes.has(prefix)) badPrefix.push(`channel prefix "${prefix}:" is not one of ${[...c.prefixes].join(', ')}`);
        }
      }
    }
    checks.event_prefix = !sawChannel ? result('n/a') : result(badPrefix.length ? 'fail' : 'pass', badPrefix);

    if (c.sliceIds.length === 0) {
      checks.theme_slice = result('n/a');
    } else {
      const missing = [];
      if (!c.hunksByFile.has('theme/registerThemeSlices.ts')) missing.push('no hunk in theme/registerThemeSlices.ts');
      if (!c.hunksByFile.has('components/ThemeEditor/sliceEditorControls.tsx')) {
        missing.push('no hunk in components/ThemeEditor/sliceEditorControls.tsx');
      }
      checks.theme_slice = result(missing.length ? 'fail' : 'pass', missing);
    }

    const formControls = c.manifest.filter((m) => /@manifestCategory[ \t]+Form Controls\b/.test(m.body));
    if (formControls.length === 0) {
      checks.form_controls = result('n/a');
    } else {
      const noStates = formControls.filter((m) => !/@manifestStates\b/.test(m.body)).map((m) => `${m.name}: missing @manifestStates`);
      checks.form_controls = result(noStates.length ? 'fail' : 'pass', [
        ...noStates,
        'add to src/__tests__/formControlContract.test.tsx CONTROLS upstream',
      ]);
    }

    checks.tests = testsCheck(c.manifest.map((m) => m.name), changedTestFiles);
  } else if (c.type === 'infrastructure') {
    const added = c.files.filter((f) => f.change === 'added');
    if (added.length === 0) {
      checks.barrel_export = result('n/a');
    } else {
      const tagged = added.some((f) => /@barrelExport\b/.test(loc.get(f.relPath) ?? ''));
      checks.barrel_export = tagged ? result('pass') : result('fail', ['no added file carries a @barrelExport tag, so it would not be reachable via #toolcrib']);
    }
    checks.use_client = useClient();
    checks.toolcrib_self_import = selfImport();
    checks.process_env = processEnv();
    checks.tests = testsCheck(c.paths.map(baseName), changedTestFiles);
  } else {
    checks.use_client = useClient();
    checks.toolcrib_self_import = selfImport();
    checks.process_env = processEnv();
  }
  return checks;
}

function testsCheck(names, testFiles) {
  const found = testFiles.filter((t) => {
    const file = t.split('/').pop();
    return names.some((n) => file.includes(n));
  });
  return found.length ? result('pass', found) : result('fail', ['no tests found']);
}
