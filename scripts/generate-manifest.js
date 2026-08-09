#!/usr/bin/env node
/**
 * Generates the ENTIRE ai-docs/component-manifest.json from source, using
 * the TypeScript Compiler API to read structure and JSDoc directly off the
 * source of truth — the same motivation as build-release.js's
 * peerDependency scan: a hand-maintained manifest drifts from an
 * AI-edited codebase silently, this doesn't.
 *
 * Section -> source of truth:
 *  - name/version:        root package.json
 *  - $schema/description: fixed constants below (describe the manifest
 *                          itself, not derived from application source)
 *  - themeSystem.colorSpace: fixed constant (an architectural fact with no
 *                          single canonical source location to derive from)
 *  - themeSystem.supportedHarmonies: the `HarmonyMode` union type in
 *                          src/theme/harmonies.ts
 *  - themeSystem.cssVariables: every `--ai-*` custom property referenced
 *                          anywhere under src/theme/ or src/components/
 *  - zIndexScale:          the `Z_INDEX` object in src/theme/zIndex.ts
 *  - eventBus.singleton/hookName: verified (not just assumed) to exist as
 *                          `aiBus`/`useAIEvent` exports
 *  - eventBus.channels:    the `AIEventMap` interface in src/eventBus/eventBus.ts
 *  - eventBus.helperMethods: public methods on the `AIEventBus` class
 *                          (excluding on/off/emit) — "emits" is read from
 *                          the first `this.emit(...)` call in the method
 *                          body, "returns" from an `@manifestReturns` tag
 *  - components:           every `export const X: React.FC<...>` /
 *                          `export function X(...)` carrying an
 *                          `@manifest <description>` JSDoc tag. See the
 *                          per-component extraction functions below for
 *                          what's read from there (props, slots, etc.)
 *
 * See ai-docs/CORE.md / AGENTS.md for the JSDoc tag conventions a new
 * component needs to show up here at all (`@manifest` is the load-bearing
 * one — no tag, no manifest entry, silently).
 *
 * Usage:
 *   node scripts/generate-manifest.js            # check mode (default) — exits 1 on drift
 *   node scripts/generate-manifest.js --check     # same, explicit
 *   node scripts/generate-manifest.js --write     # regenerate ai-docs/component-manifest.json in full
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const SRC = path.join(ROOT, 'src');
const COMPONENTS_DIR = path.join(SRC, 'components');
const THEME_DIR = path.join(SRC, 'theme');
const MANIFEST_PATH = path.join(ROOT, 'ai-docs', 'component-manifest.json');

// Meta-descriptive text about the manifest document itself — not a
// property of application source, so there's nothing to derive this from.
const SCHEMA_URL = 'https://json-schema.org/draft/2020-12/schema';
const MANIFEST_DESCRIPTION = 'AI-consumable component manifest for React UI toolkit. All units are rem unless noted.';
// An architectural fact ("this toolkit computes color in HSV"), not a
// value that lives at any single, extractable source location.
const COLOR_SPACE = 'HSV';

// Components whose curated import line intentionally bundles multiple
// related exports (a usage-pattern judgment call, not something derivable
// from a single component's own source) — see header comment.
const MANUAL_IMPORT_OVERRIDES = {
  Form: "import { Form, FormField, FormError, Input, Select, Checkbox, Switch, Textarea, RadioGroup, Slider, SubmitButton, Button } from '#toolcrib'",
};

// -------------------------------------------------------------------------
// Generic TS AST helpers
// -------------------------------------------------------------------------

function parse(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  return ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, /* setParentNodes */ true);
}

function listSourceFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(listSourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) results.push(full);
  }
  return results;
}

function leadingJsDoc(node) {
  const docs = node.jsDoc;
  if (!docs || docs.length === 0) return null;
  return docs[docs.length - 1];
}

function jsDocCommentText(comment) {
  if (comment == null) return '';
  if (typeof comment === 'string') return comment;
  return comment.map((c) => c.text ?? '').join('');
}

function jsDocTag(doc, tagName) {
  if (!doc || !doc.tags) return null;
  const tag = doc.tags.find((t) => t.tagName.text === tagName);
  return tag ? jsDocCommentText(tag.comment).trim() : null;
}

function findTopLevel(sourceFile, predicate) {
  let found = null;
  ts.forEachChild(sourceFile, (node) => {
    if (predicate(node)) found = node;
  });
  return found;
}

// -------------------------------------------------------------------------
// zIndexScale <- src/theme/zIndex.ts
// -------------------------------------------------------------------------

function generateZIndexScale() {
  const sourceFile = parse(path.join(THEME_DIR, 'zIndex.ts'));
  const stmt = findTopLevel(
    sourceFile,
    (n) => ts.isVariableStatement(n) && n.declarationList.declarations.some((d) => d.name.getText() === 'Z_INDEX')
  );
  if (!stmt) throw new Error('Z_INDEX not found in theme/zIndex.ts');
  const decl = stmt.declarationList.declarations.find((d) => d.name.getText() === 'Z_INDEX');
  let obj = decl.initializer;
  while (ts.isAsExpression(obj) || ts.isSatisfiesExpression(obj)) obj = obj.expression;
  if (!ts.isObjectLiteralExpression(obj)) throw new Error('Z_INDEX is not an object literal');

  const scale = {};
  for (const prop of obj.properties) {
    if (ts.isPropertyAssignment(prop) && ts.isNumericLiteral(prop.initializer)) {
      scale[prop.name.getText()] = Number(prop.initializer.text);
    }
  }
  return scale;
}

// -------------------------------------------------------------------------
// themeSystem <- src/theme/harmonies.ts + a scan for --ai-* custom properties
// -------------------------------------------------------------------------

function generateSupportedHarmonies() {
  const sourceFile = parse(path.join(THEME_DIR, 'harmonies.ts'));
  const alias = findTopLevel(
    sourceFile,
    (n) => ts.isTypeAliasDeclaration(n) && n.name.text === 'HarmonyMode' && ts.isUnionTypeNode(n.type)
  );
  if (!alias) throw new Error('HarmonyMode union type not found in theme/harmonies.ts');
  return alias.type.types.filter(ts.isLiteralTypeNode).map((t) => t.literal.text);
}

function generateCssVariables() {
  const found = new Set();
  // Each hyphen-separated segment must have at least one alphanumeric char,
  // or a template literal like `--ai-margin-${key}` matches a garbage
  // `--ai-margin-` (trailing hyphen, nothing after it) — confirmed by
  // running this against real source before this constraint was added.
  const pattern = /--ai-[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*/g;
  for (const dir of [THEME_DIR, COMPONENTS_DIR]) {
    for (const filePath of listSourceFiles(dir)) {
      const text = fs.readFileSync(filePath, 'utf-8');
      for (const match of text.matchAll(pattern)) {
        // A hyphen immediately after the match means the regex stopped
        // short of a template-literal interpolation (`--ai-margin-${key}`)
        // rather than reaching the end of a real, complete variable name —
        // confirmed by real matches like `--ai-margin` (missing its actual
        // `-gap`/`-sm`/etc. suffix) showing up before this check was added.
        if (text[match.index + match[0].length] === '-') continue;
        found.add(match[0]);
      }
    }
  }
  return [...found].sort();
}

// -------------------------------------------------------------------------
// eventBus <- src/eventBus/eventBus.ts (+ src/eventBus/useAIEvent.ts)
// -------------------------------------------------------------------------

function verifyExportExists(filePath, name) {
  const sourceFile = parse(filePath);
  let found = false;
  ts.forEachChild(sourceFile, (node) => {
    const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!isExported) return;
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some((d) => d.name.getText() === name)) {
      found = true;
    } else if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name?.text === name) {
      found = true;
    }
  });
  return found;
}

function generateEventBusMeta() {
  const eventBusFile = path.join(SRC, 'eventBus', 'eventBus.ts');
  const useAIEventFile = path.join(SRC, 'eventBus', 'useAIEvent.ts');
  if (!verifyExportExists(eventBusFile, 'aiBus')) throw new Error("'aiBus' export not found in eventBus/eventBus.ts");
  if (!verifyExportExists(useAIEventFile, 'useAIEvent')) {
    throw new Error("'useAIEvent' export not found in eventBus/useAIEvent.ts");
  }
  return { singleton: 'aiBus', hookName: 'useAIEvent' };
}

/**
 * Most AIEventMap payload types are single-line object type literals, but a
 * couple (theme:changed) are written multi-line with an inline JSDoc
 * comment per field for readability in the source. `.getText()` returns
 * that verbatim, comments and newlines included — collapse it to the same
 * single-line shape as everything else so the manifest stays uniform and
 * doesn't leak source-formatting comments into a payload description.
 */
function normalizeTypeText(text) {
  return text
    .replace(/\/\*\*[\s\S]*?\*\//g, '') // strip /** ... */ comments
    .replace(/\s+/g, ' ')
    .replace(/\{\s+/g, '{ ')
    .replace(/\s+\}/g, ' }')
    .replace(/;\s+/g, '; ')
    .trim();
}

function generateEventChannels() {
  const sourceFile = parse(path.join(SRC, 'eventBus', 'eventBus.ts'));
  const iface = findTopLevel(sourceFile, (n) => ts.isInterfaceDeclaration(n) && n.name.text === 'AIEventMap');
  if (!iface) throw new Error('AIEventMap interface not found in eventBus/eventBus.ts');

  const channels = [];
  for (const member of iface.members) {
    if (!ts.isPropertySignature(member) || !member.type) continue;
    const name = member.name.getText(sourceFile).replace(/^['"]|['"]$/g, '');
    channels.push({ name, payload: normalizeTypeText(member.type.getText(sourceFile)) });
  }
  return channels;
}

function findFirstThisEmitArg(node) {
  let result = null;
  function visit(n) {
    if (result) return;
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
      n.expression.name.text === 'emit' &&
      n.arguments[0] &&
      ts.isStringLiteralLike(n.arguments[0])
    ) {
      result = n.arguments[0].text;
      return;
    }
    ts.forEachChild(n, visit);
  }
  visit(node);
  return result;
}

// Convenience methods only — the generic on/off/emit primitives aren't
// "helper methods" in the manifest's sense (they're the base API every
// other channel interaction is built on, documented in full elsewhere).
const EVENT_BUS_CORE_METHODS = new Set(['on', 'off', 'emit', 'constructor']);

function generateHelperMethods() {
  const sourceFile = parse(path.join(SRC, 'eventBus', 'eventBus.ts'));
  const classDecl = findTopLevel(sourceFile, (n) => ts.isClassDeclaration(n) && n.name?.text === 'AIEventBus');
  if (!classDecl) throw new Error('AIEventBus class not found in eventBus/eventBus.ts');

  const methods = [];
  for (const member of classDecl.members) {
    if (!ts.isMethodDeclaration(member) || !ts.isIdentifier(member.name)) continue;
    const methodName = member.name.text;
    if (EVENT_BUS_CORE_METHODS.has(methodName)) continue;

    const params = member.parameters.map((p) => {
      const isOptional = !!p.questionToken || !!p.initializer;
      const paramName = p.name.getText(sourceFile);
      return isOptional ? `${paramName}?` : paramName;
    });

    const entry = { method: `aiBus.${methodName}(${params.join(', ')})` };
    const emits = findFirstThisEmitArg(member);
    if (emits) entry.emits = emits;
    const returns = jsDocTag(leadingJsDoc(member), 'manifestReturns');
    if (returns) entry.returns = returns;
    methods.push(entry);
  }
  return methods;
}

// -------------------------------------------------------------------------
// components <- src/components/**
// -------------------------------------------------------------------------

/** Unwrap `React.FC<X>`, `React.FC<X> & {...}`, or a plain type reference, returning "X". */
function propsInterfaceNameFromType(typeNode) {
  if (!typeNode) return null;
  if (ts.isIntersectionTypeNode(typeNode)) {
    for (const member of typeNode.types) {
      const found = propsInterfaceNameFromType(member);
      if (found) return found;
    }
    return null;
  }
  if (ts.isTypeReferenceNode(typeNode)) {
    const name = typeNode.typeName.getText();
    if ((name === 'React.FC' || name === 'FC') && typeNode.typeArguments?.length) {
      return baseTypeName(typeNode.typeArguments[0]);
    }
    return baseTypeName(typeNode);
  }
  return null;
}

function baseTypeName(typeNode) {
  if (ts.isTypeReferenceNode(typeNode)) return typeNode.typeName.getText();
  return typeNode.getText();
}

/** `FormProps<T>` -> `FormProps` (strip generic type arguments for the interface lookup). */
function unwrapGeneric(typeNode) {
  if (ts.isTypeReferenceNode(typeNode)) return ts.factory.createTypeReferenceNode(typeNode.typeName, undefined);
  return typeNode;
}

/**
 * Every top-level `export const X: React.FC<...> = ...` or
 * `export function X(...)` carrying an `@manifest` tag — the tag is what
 * makes a declaration a "component" for manifest purposes, not its shape.
 */
function findComponentDeclarations(sourceFile) {
  const found = [];

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isVariableStatement(node)) {
      const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (!isExported) return;
      const doc = leadingJsDoc(node);
      const manifestDesc = jsDocTag(doc, 'manifest');
      if (!manifestDesc) return;
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        found.push({
          name: decl.name.text,
          propsName: propsInterfaceNameFromType(decl.type),
          description: manifestDesc,
          constraints: jsDocTag(doc, 'manifestConstraints'),
          children: jsDocTag(doc, 'manifestChildren'),
        });
      }
    } else if (ts.isFunctionDeclaration(node)) {
      const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (!isExported || !node.name) return;
      const doc = leadingJsDoc(node);
      const manifestDesc = jsDocTag(doc, 'manifest');
      if (!manifestDesc) return;
      const firstParam = node.parameters[0];
      const propsName = firstParam?.type ? baseTypeName(unwrapGeneric(firstParam.type)) : null;
      found.push({
        name: node.name.text,
        propsName,
        description: manifestDesc,
        constraints: jsDocTag(doc, 'manifestConstraints'),
        children: jsDocTag(doc, 'manifestChildren'),
      });
    }
  });

  return found;
}

function findInterface(sourceFile, name) {
  return findTopLevel(sourceFile, (n) => ts.isInterfaceDeclaration(n) && n.name.text === name);
}

/**
 * Extract {name, type, default?, description?, required?} for every own
 * property of an interface. Does not follow `extends` clauses — inherited
 * props aren't re-listed, matching how the manifest already treats them.
 * `children` is skipped: implicit in every React component, never
 * documented per-component in this manifest's existing style.
 */
function extractProps(interfaceDecl, sourceFile) {
  const props = {};
  for (const member of interfaceDecl.members) {
    if (!ts.isPropertySignature(member) || !ts.isIdentifier(member.name)) continue;
    if (member.name.text === 'children') continue;

    const doc = leadingJsDoc(member);
    const entry = {};
    if (member.type) entry.type = member.type.getText(sourceFile);
    if (!member.questionToken) entry.required = true;
    const defaultTag = jsDocTag(doc, 'default');
    if (defaultTag) entry.default = defaultTag;
    const description = doc ? jsDocCommentText(doc.comment).trim() : '';
    if (description) entry.description = description;
    props[member.name.text] = entry;
  }
  return props;
}

// Standard React statics assigned the same way as a real slot
// (`Component.Foo = ...`) but not a slot — confirmed via a real run where
// `CardSimple.displayName = 'CardSimple'` was picked up as a bogus "slot".
const NON_SLOT_STATICS = new Set(['displayName', 'propTypes', 'defaultProps']);

/** Scan a source file's top-level statements for `ComponentName.Slot = ...` assignments. */
function findSlots(sourceFile, componentName) {
  const slots = [];
  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isExpressionStatement(node)) return;
    const expr = node.expression;
    if (
      ts.isBinaryExpression(expr) &&
      expr.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(expr.left) &&
      expr.left.expression.getText() === componentName &&
      !NON_SLOT_STATICS.has(expr.left.name.text)
    ) {
      slots.push(expr.left.name.text);
    }
  });
  return slots;
}

function generateComponentEntry(sourceFile, decl) {
  const entry = {
    name: decl.name,
    import: MANUAL_IMPORT_OVERRIDES[decl.name] ?? `import { ${decl.name} } from '#toolcrib'`,
  };

  const slots = findSlots(sourceFile, decl.name);
  if (slots.length > 0) entry.slots = slots;

  if (decl.propsName) {
    const interfaceDecl = findInterface(sourceFile, decl.propsName);
    if (interfaceDecl) entry.props = extractProps(interfaceDecl, sourceFile);
  }

  if (decl.children) {
    entry.childComponents = decl.children.split(',').map((s) => s.trim());
  }
  if (decl.constraints) entry.constraints = decl.constraints;
  entry.description = decl.description;
  return entry;
}

function generateComponents() {
  const components = [];
  for (const filePath of listSourceFiles(COMPONENTS_DIR)) {
    const sourceFile = parse(filePath);
    for (const decl of findComponentDeclarations(sourceFile)) {
      components.push(generateComponentEntry(sourceFile, decl));
    }
  }
  components.sort((a, b) => a.name.localeCompare(b.name));
  return components;
}

// -------------------------------------------------------------------------
// Assembly
// -------------------------------------------------------------------------

function generateManifest() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
  const eventBusMeta = generateEventBusMeta();

  return {
    $schema: SCHEMA_URL,
    name: pkg.name,
    version: pkg.version,
    description: MANIFEST_DESCRIPTION,
    themeSystem: {
      colorSpace: COLOR_SPACE,
      supportedHarmonies: generateSupportedHarmonies(),
      cssVariables: generateCssVariables(),
    },
    zIndexScale: generateZIndexScale(),
    eventBus: {
      singleton: eventBusMeta.singleton,
      hookName: eventBusMeta.hookName,
      channels: generateEventChannels(),
      helperMethods: generateHelperMethods(),
    },
    components: generateComponents(),
  };
}

function main() {
  const mode = process.argv.includes('--write') ? 'write' : 'check';
  const generated = generateManifest();

  if (mode === 'write') {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(generated, null, 2) + '\n');
    console.log(
      `Wrote ai-docs/component-manifest.json: ${generated.components.length} component(s), ` +
        `${generated.eventBus.channels.length} event channel(s), ${generated.eventBus.helperMethods.length} helper method(s), ` +
        `${generated.themeSystem.cssVariables.length} CSS variable(s).`
    );
    return;
  }

  const current = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  const a = JSON.stringify(current, null, 2);
  const b = JSON.stringify(generated, null, 2);
  if (a === b) {
    console.log('component-manifest.json matches source exactly.');
    return;
  }

  console.error('component-manifest.json drift detected — generated output differs from the committed file.');
  console.error(`Run 'node scripts/generate-manifest.js --write' to regenerate, then review the diff.`);
  process.exitCode = 1;
}

main();
