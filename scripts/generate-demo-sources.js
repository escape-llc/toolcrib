#!/usr/bin/env node
/**
 * Generates demo/demoSources.generated.json: the exact source of every live
 * demo in the Catalog (issue #638), so each component's page can show
 * the code next to the running demo. Sliced straight out of demo/App.tsx
 * with the TypeScript Compiler API -- never hand-copied, so a snippet can't
 * drift from the demo it describes; `--check` (CI) fails if it does.
 *
 * What it reads, from demo/App.tsx:
 *  - `const componentDemos = { Name: <expr>, ... }` -- one snippet per
 *    property whose value is a live demo (JSX). `{ seeAlso }`/`{ pageFrame }`
 *    entries have no demo of their own and are skipped.
 *  - `const systemAreas = [{ id: '...', demo: <expr> }, ...]` -- one snippet
 *    per area with a `demo`.
 * Each snippet is the property's initializer text, minus a wrapping `( )`,
 * dedented so its least-indented line starts at column 0.
 *
 * Usage:
 *   node scripts/generate-demo-sources.js            # check mode (default) -- exits 1 on drift
 *   node scripts/generate-demo-sources.js --check     # same, explicit
 *   node scripts/generate-demo-sources.js --write     # regenerate
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_PATH = path.join(REPO_ROOT, 'demo/App.tsx');
const OUT_PATH = path.join(REPO_ROOT, 'demo/demoSources.generated.json');
const OUT_REL = 'demo/demoSources.generated.json';

function findVariable(sf, name) {
  let found;
  const visit = node => {
    if (found) return;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) {
      found = node.initializer;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!found) throw new Error(`generate-demo-sources: no \`const ${name} = ...\` found in demo/App.tsx`);
  return found;
}

function propName(prop) {
  if (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) return prop.name.text;
  throw new Error(`generate-demo-sources: unsupported property name at ${prop.name.getText()}`);
}

/**
 * Every comment inside `node`, as [start, end) ranges: comment trivia in code
 * positions, plus whole JSX `{/* ... *\/}` containers (a JsxExpression with no
 * expression). Found through the AST, never by text matching: JSX text is
 * content, and can legitimately contain `//` (a URL in a sentence).
 */
function commentRanges(sf, node) {
  const text = sf.text;
  const ranges = [];
  const add = r => {
    if (r && r.pos >= node.getStart(sf) && r.end <= node.getEnd()) ranges.push([r.pos, r.end]);
  };
  const visit = n => {
    if (ts.isJsxText(n)) return; // content, not trivia
    if (ts.isJsxExpression(n) && !n.expression) {
      ranges.push([n.getStart(sf), n.getEnd()]);
      return;
    }
    // Leading trivia of a JSX element child lives in the preceding JsxText,
    // so only code positions can carry comment trivia here.
    (ts.getLeadingCommentRanges(text, n.pos) ?? []).forEach(add);
    (ts.getTrailingCommentRanges(text, n.end) ?? []).forEach(add);
    // getChildren, not forEachChild: punctuation tokens carry trivia too (a
    // comment on its own line before `.catch(...)` belongs to the `.` token).
    n.getChildren(sf).forEach(visit);
  };
  node.getChildren(sf).forEach(visit);
  // Dedupe (a comment is both one node's trailing and the next one's leading trivia).
  return [...new Map(ranges.map(r => [`${r[0]}:${r[1]}`, r])).values()].sort((a, b) => a[0] - b[0]);
}

/**
 * The expression's own source text, starting at its real column so every
 * line can be dedented together, with comments removed (#678): the demo's
 * comments are notes to whoever maintains it, not part of the example a
 * viewer reads. A line left empty by a removal is dropped.
 */
function snippet(sf, expr) {
  const inner = ts.isParenthesizedExpression(expr) ? expr.expression : expr;
  const start = inner.getStart(sf);
  const column = sf.getLineAndCharacterOfPosition(start).character;
  const REMOVED = '\u0000';
  let body = '';
  let at = start;
  for (const [from, to] of commentRanges(sf, inner)) {
    if (from < at) continue; // nested inside a range already removed
    body += sf.text.slice(at, from) + REMOVED;
    at = to;
  }
  body += sf.text.slice(at, inner.getEnd());
  // Spaces before an inline comment go with it (`save() /* x */}` -> `save()}`).
  body = body.replace(/[ \t]+\u0000/g, REMOVED);
  const lines = (' '.repeat(column) + body)
    .split('\n')
    .filter(l => !(l.includes(REMOVED) && !l.replaceAll(REMOVED, '').trim()))
    .map(l => l.replaceAll(REMOVED, ''));
  const indents = lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length);
  const cut = Math.min(...indents);
  return lines.map(l => l.slice(cut).trimEnd()).join('\n');
}

/** A `{ seeAlso }` / `{ pageFrame }` marker, not a demo. */
function isMarker(expr) {
  return ts.isObjectLiteralExpression(expr) && expr.properties.some(p => p.name && ['seeAlso', 'pageFrame'].includes(p.name.getText()));
}

export function extractDemoSources(text) {
  const sf = ts.createSourceFile('App.tsx', text.replace(/\r\n?/g, '\n'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const components = {};
  const demos = findVariable(sf, 'componentDemos');
  if (!ts.isObjectLiteralExpression(demos)) throw new Error('generate-demo-sources: componentDemos is not an object literal');
  for (const prop of demos.properties) {
    if (!ts.isPropertyAssignment(prop) || isMarker(prop.initializer)) continue;
    components[propName(prop)] = snippet(sf, prop.initializer);
  }

  const systems = {};
  const areas = findVariable(sf, 'systemAreas');
  if (!ts.isArrayLiteralExpression(areas)) throw new Error('generate-demo-sources: systemAreas is not an array literal');
  for (const area of areas.elements) {
    if (!ts.isObjectLiteralExpression(area)) continue;
    const get = name => area.properties.find(p => ts.isPropertyAssignment(p) && propName(p) === name);
    const id = get('id');
    const demo = get('demo');
    if (!id || !demo || !ts.isStringLiteral(id.initializer)) continue;
    systems[id.initializer.text] = snippet(sf, demo.initializer);
  }

  const sorted = obj => Object.fromEntries(Object.keys(obj).sort((a, b) => a.localeCompare(b)).map(k => [k, obj[k]]));
  return {
    _comment: 'GENERATED by scripts/generate-demo-sources.js from demo/App.tsx -- do not edit. Run `npm run generate-demo-sources` after changing a demo.',
    components: sorted(components),
    systems: sorted(systems),
  };
}

function main() {
  const mode = process.argv.includes('--write') ? 'write' : 'check';
  const data = extractDemoSources(fs.readFileSync(APP_PATH, 'utf-8'));
  const generated = JSON.stringify(data, null, 2) + '\n';

  if (mode === 'write') {
    fs.writeFileSync(OUT_PATH, generated);
    console.log(`Wrote ${OUT_REL}: ${Object.keys(data.components).length} component demo(s), ${Object.keys(data.systems).length} system demo(s).`);
    return;
  }

  const current = fs.existsSync(OUT_PATH) ? fs.readFileSync(OUT_PATH, 'utf-8').replace(/\r\n?/g, '\n') : '';
  if (current === generated) {
    console.log(`${OUT_REL} matches demo/App.tsx exactly.`);
    return;
  }
  console.error(`${OUT_REL} drift detected -- generated output differs from the committed file.`);
  console.error(`Run 'node scripts/generate-demo-sources.js --write' to regenerate, then review the diff.`);
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
