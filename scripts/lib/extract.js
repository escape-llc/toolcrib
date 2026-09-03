/**
 * Shared TS-Compiler-API extraction logic for both `generate-manifest.js`
 * (JSON output) and `generate-docs.js` (rendered `ai-docs/CORE.md`). Kept
 * in one place so the two generators can't read source differently and
 * silently disagree with each other — each script only assembles/renders
 * the data this module already extracted, it never re-parses source
 * itself.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const SRC = path.join(ROOT, 'src');
export const COMPONENTS_DIR = path.join(SRC, 'components');
export const THEME_DIR = path.join(SRC, 'theme');

// Components whose curated import line intentionally bundles multiple
// related exports (a usage-pattern judgment call, not something derivable
// from a single component's own source).
export const MANUAL_IMPORT_OVERRIDES = {
  Form: "import { Form, FormField, FormError, Input, Select, Checkbox, Switch, Textarea, RadioGroup, Slider, SubmitButton, Button } from '#toolcrib'",
};

// The fixed category vocabulary every `@manifestCategory` tag must use —
// matches ai-docs/CORE.md's Component Reference grouping. A closed set
// (not free text) so a typo becomes a hard generation error instead of a
// silently-uncategorized or newly-invented group.
export const VALID_CATEGORIES = ['Layout Primitives', 'Containers', 'Overlays', 'Data Display', 'Form Controls'];

// Filename-safe slug per category — used by generate-manifest.js to name
// the per-category manifest split files, and by generate-docs.js to link
// to them from CORE.md's Component Reference. Kept here, not in either
// generator, so the two can't independently invent different slugs for the
// same category.
export const CATEGORY_SLUGS = {
  'Layout Primitives': 'layout-primitives',
  Containers: 'containers',
  Overlays: 'overlays',
  'Data Display': 'data-display',
  'Form Controls': 'form-controls',
};

// -------------------------------------------------------------------------
// Generic TS AST helpers
// -------------------------------------------------------------------------

// Preflight: scripts/lib/extract.js depends on the classic TS Compiler API
// (ts.createSourceFile, ts.ScriptTarget, ...), which TypeScript 7's package
// export dropped entirely (reduced to { version, versionMajorMinor }) — see
// root AGENTS.md's "TypeScript" section for the full story. scripts/ pins
// its own typescript@6.0.3 in scripts/package.json specifically so this
// works, but Node only resolves it from scripts/node_modules if that's
// actually been installed — a fresh clone or a root-only `npm install`
// leaves scripts/node_modules empty, and Node then falls back to whatever
// `typescript` root has (currently 7.x), silently handing this module the
// wrong version. Checked once at import time, right where the dependency is
// actually used, so the failure points here instead of surfacing many
// frames deep as a bare "Cannot read properties of undefined (reading
// 'Latest')" the first time parse() runs.
if (typeof ts.createSourceFile !== 'function' || !ts.ScriptTarget) {
  throw new Error(
    'scripts/lib/extract.js needs the classic TypeScript Compiler API ' +
      '(ts.createSourceFile, ts.ScriptTarget), which is missing from the ' +
      '"typescript" module Node just resolved. This almost always means ' +
      'scripts/node_modules was never installed (or is stale) and Node ' +
      'fell back to root\'s typescript@7.x, whose package export dropped ' +
      'the classic API entirely.\n\n' +
      'Fix: run `npm install` inside scripts/ (separately from root\'s own ' +
      '`npm install`) — see root AGENTS.md\'s "TypeScript" section for why ' +
      'these are two independent installs.'
  );
}

export function parse(filePath) {
  // Normalize line endings up front so every downstream .getText()/.text
  // read from this source file is already \n-only, regardless of whether
  // the checkout has \r\n (see jsDocCommentText's comment for why this
  // matters — core.autocrlf makes the same commit check out differently
  // on Windows vs Linux CI).
  const text = fs.readFileSync(filePath, 'utf-8').replace(/\r\n?/g, '\n');
  return ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, /* setParentNodes */ true);
}

export function listSourceFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(listSourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) results.push(full);
  }
  return results;
}

export function leadingJsDoc(node) {
  const docs = node.jsDoc;
  if (!docs || docs.length === 0) return null;
  return docs[docs.length - 1];
}

export function jsDocCommentText(comment) {
  if (comment == null) return '';
  // Normalize line endings before anything downstream sees this text — the
  // AST's `.text` segments carry whatever bytes are literally in the
  // checked-out file, and `core.autocrlf=true` (a common Windows Git
  // default) means the same commit checks out as \r\n on Windows and \n on
  // Linux CI. Without normalizing here, whichever OS last ran the
  // generator bakes its own line ending into the committed JSON/docs, and
  // the *other* OS's --check then reports false drift.
  if (typeof comment === 'string') return comment.replace(/\r\n?/g, '\n');
  return comment.map((c) => c.text ?? '').join('').replace(/\r\n?/g, '\n');
}

export function jsDocTag(doc, tagName) {
  if (!doc || !doc.tags) return null;
  const tag = doc.tags.find((t) => t.tagName.text === tagName);
  return tag ? jsDocCommentText(tag.comment).trim() : null;
}

export function findTopLevel(sourceFile, predicate) {
  let found = null;
  ts.forEachChild(sourceFile, (node) => {
    if (predicate(node)) found = node;
  });
  return found;
}

// -------------------------------------------------------------------------
// zIndexScale <- src/theme/zIndex.ts
// -------------------------------------------------------------------------

export function generateZIndexScale() {
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

export function generateSupportedHarmonies() {
  const sourceFile = parse(path.join(THEME_DIR, 'harmonies.ts'));
  const alias = findTopLevel(
    sourceFile,
    (n) => ts.isTypeAliasDeclaration(n) && n.name.text === 'HarmonyMode' && ts.isUnionTypeNode(n.type)
  );
  if (!alias) throw new Error('HarmonyMode union type not found in theme/harmonies.ts');
  return alias.type.types.filter(ts.isLiteralTypeNode).map((t) => t.literal.text);
}

export function generateCssVariables() {
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

export function resolveModuleFile(basePathNoExt) {
  for (const ext of ['.ts', '.tsx']) {
    const candidate = basePathNoExt + ext;
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Could not resolve module file for '${basePathNoExt}' (tried .ts/.tsx)`);
}

/**
 * Every `globalThemeSliceRegistry.register(X)` call in themeContext.tsx,
 * in registration order, resolved to each `X`'s own `id`/`name` fields —
 * read from wherever `X` is actually declared (each slice lives in its own
 * file under src/theme/ or alongside the component it themes), not
 * hand-copied.
 */
export function generateThemeSlices() {
  const themeContextPath = path.join(THEME_DIR, 'themeContext.tsx');
  const sourceFile = parse(themeContextPath);

  // local identifier -> resolved absolute path (no extension) it was imported from
  const importedFrom = new Map();
  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return;
    const bindings = node.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) return;
    const resolvedBase = path.resolve(THEME_DIR, node.moduleSpecifier.text);
    for (const el of bindings.elements) {
      importedFrom.set(el.name.text, resolvedBase);
    }
  });

  const registeredIdentifiers = [];
  (function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(sourceFile) === 'globalThemeSliceRegistry' &&
      node.expression.name.text === 'register' &&
      node.arguments[0] &&
      ts.isIdentifier(node.arguments[0])
    ) {
      registeredIdentifiers.push(node.arguments[0].text);
      return;
    }
    ts.forEachChild(node, visit);
  })(sourceFile);

  return registeredIdentifiers.map((identifier) => {
    const resolvedBase = importedFrom.get(identifier);
    if (!resolvedBase) {
      throw new Error(`generateThemeSlices: '${identifier}' is registered but not imported in themeContext.tsx`);
    }
    const sliceFile = resolveModuleFile(resolvedBase);
    const sliceSourceFile = parse(sliceFile);
    const stmt = findTopLevel(
      sliceSourceFile,
      (n) => ts.isVariableStatement(n) && n.declarationList.declarations.some((d) => d.name.getText() === identifier)
    );
    if (!stmt) throw new Error(`generateThemeSlices: '${identifier}' not declared in ${sliceFile}`);
    const decl = stmt.declarationList.declarations.find((d) => d.name.getText() === identifier);
    let obj = decl.initializer;
    while (obj && (ts.isAsExpression(obj) || ts.isSatisfiesExpression(obj))) obj = obj.expression;
    if (!obj || !ts.isObjectLiteralExpression(obj)) {
      throw new Error(`generateThemeSlices: '${identifier}' in ${sliceFile} is not an object literal`);
    }

    const idProp = obj.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === 'id');
    const nameProp = obj.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === 'name');
    if (!idProp || !ts.isStringLiteralLike(idProp.initializer)) {
      throw new Error(`generateThemeSlices: '${identifier}' in ${sliceFile} is missing a string 'id' field`);
    }
    if (!nameProp || !ts.isStringLiteralLike(nameProp.initializer)) {
      throw new Error(`generateThemeSlices: '${identifier}' in ${sliceFile} is missing a string 'name' field`);
    }
    return { id: idProp.initializer.text, name: nameProp.initializer.text };
  });
}

// -------------------------------------------------------------------------
// eventBus <- src/eventBus/eventBus.ts (+ src/eventBus/useAIEvent.ts)
// -------------------------------------------------------------------------

export function verifyExportExists(filePath, name) {
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

export function generateEventBusMeta() {
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
export function normalizeTypeText(text) {
  return text
    .replace(/\/\*\*[\s\S]*?\*\//g, '') // strip /** ... */ comments
    .replace(/\s+/g, ' ')
    .replace(/\{\s+/g, '{ ')
    .replace(/\s+\}/g, ' }')
    .replace(/;\s+/g, '; ')
    .trim();
}

export function generateEventChannels() {
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

export function generateHelperMethods() {
  const sourceFile = parse(path.join(SRC, 'eventBus', 'eventBus.ts'));
  const classDecl = findTopLevel(sourceFile, (n) => ts.isClassDeclaration(n) && n.name?.text === 'AIEventBus');
  if (!classDecl) throw new Error('AIEventBus class not found in eventBus/eventBus.ts');

  const methods = [];
  for (const member of classDecl.members) {
    if (!ts.isMethodDeclaration(member) || !ts.isIdentifier(member.name)) continue;
    const isPrivate = member.modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword);
    if (isPrivate) continue;
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

/**
 * `export const X = React.forwardRef<Elem, XProps>((props, ref) => ...)` (or
 * a bare `forwardRef<...>` call) has no type annotation on the variable
 * itself — its type comes from the call's own type arguments instead, so
 * `propsInterfaceNameFromType(decl.type)` alone always misses it (`decl.type`
 * is `undefined`). Found for real: `Button` (`FormComponents.tsx`) uses this
 * exact shape and had a completely propless manifest entry as a result —
 * `@manifest`/`@manifestCategory` still registered the component, but every
 * prop (`variant`, `size`, `subtheme`, ...) was silently absent.
 */
function propsNameFromForwardRefInitializer(initializer) {
  if (!initializer || !ts.isCallExpression(initializer)) return null;
  const callee = initializer.expression;
  const calleeName = ts.isPropertyAccessExpression(callee)
    ? callee.name.text
    : ts.isIdentifier(callee)
      ? callee.text
      : null;
  if (calleeName !== 'forwardRef') return null;
  const typeArgs = initializer.typeArguments;
  if (!typeArgs || typeArgs.length < 2) return null;
  return baseTypeName(typeArgs[1]);
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
export function findComponentDeclarations(sourceFile) {
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
          propsName: propsInterfaceNameFromType(decl.type) ?? propsNameFromForwardRefInitializer(decl.initializer),
          description: manifestDesc,
          constraints: jsDocTag(doc, 'manifestConstraints'),
          children: jsDocTag(doc, 'manifestChildren'),
          category: jsDocTag(doc, 'manifestCategory'),
          antiPatternAvoid: jsDocTag(doc, 'manifestAntiPatternAvoid'),
          antiPatternInstead: jsDocTag(doc, 'manifestAntiPatternInstead'),
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
        category: jsDocTag(doc, 'manifestCategory'),
        antiPatternAvoid: jsDocTag(doc, 'manifestAntiPatternAvoid'),
        antiPatternInstead: jsDocTag(doc, 'manifestAntiPatternInstead'),
      });
    }
  });

  return found;
}

function findInterface(sourceFile, name) {
  return findTopLevel(sourceFile, (n) => ts.isInterfaceDeclaration(n) && n.name.text === name);
}

// -------------------------------------------------------------------------
// Cross-file named type resolution
// -------------------------------------------------------------------------
//
// extractProps previously took `member.type.getText()` at face value: for
// a prop typed as an inline union (VStack's `gap: 'xs' | 'sm' | ...`)
// that's already the full, useful answer, but for a prop typed as a bare
// reference to a *named* exported type declared in another file
// (`paddingMode?: PaddingMode`, from theme/padding.ts) it produced only
// the opaque name "PaddingMode" — correct, but not something an AI
// consuming only this manifest (per CORE.md: "consult the manifest, don't
// guess") could act on without also reading theme/padding.ts's source.
// Two real, reported cases of exactly this: an invalid `paddingMode="loose"`
// (PaddingMode's real values were never listed anywhere in the manifest)
// and a DataTable `columns` entry using `{ key, header }` instead of the
// actual `Column<T>` shape's `{ key, title, render?, sortable?, width? }`
// (the manifest listed only the array's element type name, never Column's
// own members). This section closes that gap for both shapes of named
// type: a type alias resolving to a union of string literals is expanded
// inline; an interface (standalone or array-wrapped, e.g. `Column<T>[]`)
// has its own members captured once into a shared `defs` accumulator,
// surfaced by generate-manifest.js as the manifest's top-level `$defs` --
// consistent with the JSON Schema draft this manifest already declares.

let _typeIndexCache = null;

/** "Column<T>[]" -> "Column", "PaddingMode" -> "PaddingMode". Strips a
 * trailing array suffix and any generic type arguments, leaving the bare
 * identifier a reference is actually naming. */
function baseIdentifierFromTypeText(typeText) {
  return typeText.replace(/\[\]$/, '').replace(/<.*>$/, '').trim();
}

/** One pass over every source file under SRC, indexing every top-level
 * `export type X = ...` and `export interface X { ... }` by name — so a
 * prop can be resolved against a type declared in a completely different
 * file than the component using it, which is the common case for this
 * toolkit's own shared PaddingMode/MarginMode/CornerRadiusMode aliases. */
function buildTypeIndex() {
  if (_typeIndexCache) return _typeIndexCache;
  const aliases = new Map(); // name -> expanded literal-union text, or null if not that simple case
  const interfaces = new Map(); // name -> { interfaceDecl, sourceFile }

  for (const filePath of listSourceFiles(SRC)) {
    const sourceFile = parse(filePath);
    ts.forEachChild(sourceFile, (node) => {
      const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (!isExported) return;

      if (ts.isTypeAliasDeclaration(node)) {
        // Only the common case this manifest actually needs: a union of
        // string-literal types. Anything else (mapped types, generics,
        // object shapes) is left unresolved rather than guessed at --
        // the original opaque name is a more honest answer than a wrong
        // expansion would be.
        const isStringLiteralUnion =
          ts.isUnionTypeNode(node.type) &&
          node.type.types.every((t) => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal));
        aliases.set(node.name.text, isStringLiteralUnion ? node.type.getText(sourceFile) : null);
      } else if (ts.isInterfaceDeclaration(node)) {
        if (!interfaces.has(node.name.text)) {
          interfaces.set(node.name.text, { interfaceDecl: node, sourceFile });
        }
      }
    });
  }

  _typeIndexCache = { aliases, interfaces };
  return _typeIndexCache;
}

/**
 * Resolve a prop's raw `.getText()` type string against the cross-file
 * type index, if it's a bare reference to something the index knows about.
 * Returns null for anything else (primitives, inline unions, unresolvable
 * aliases) -- callers keep the original raw text unchanged in that case.
 */
function resolveNamedType(typeText) {
  const { aliases, interfaces } = buildTypeIndex();
  const base = baseIdentifierFromTypeText(typeText);
  if (aliases.has(base)) {
    const resolved = aliases.get(base);
    return resolved ? { kind: 'literal-union', text: resolved } : null;
  }
  if (interfaces.has(base)) {
    return { kind: 'interface', name: base };
  }
  return null;
}
/**
 * Extract {name, type, default?, description?, required?} for every own
 * property of an interface. Does not follow `extends` clauses — inherited
 * props aren't re-listed, matching how the manifest already treats them.
 * `children` is skipped: implicit on every React component, never
 * documented per-component in this manifest's existing style.
 *
 * A prop's `type` field is more than `.getText()`'s raw output where that
 * text is a bare reference to another named, exported type — see the
 * "Cross-file named type resolution" section above for what gets expanded
 * and why.
 */
function extractProps(interfaceDecl, sourceFile, defs = {}) {
  const props = {};
  for (const member of interfaceDecl.members) {
    if (!ts.isPropertySignature(member) || !ts.isIdentifier(member.name)) continue;
    if (member.name.text === 'children') continue;

    const doc = leadingJsDoc(member);
    const entry = {};
    if (member.type) {
      const rawText = member.type.getText(sourceFile);
      entry.type = rawText;
      const resolved = resolveNamedType(rawText);
      if (resolved?.kind === 'literal-union') {
        entry.type = resolved.text;
      } else if (resolved?.kind === 'interface' && !defs[resolved.name]) {
        // Reserve the key before recursing, so a self- or mutually-
        // referential interface can't recurse into itself forever.
        defs[resolved.name] = null;
        const { interfaceDecl: refDecl, sourceFile: refFile } = buildTypeIndex().interfaces.get(resolved.name);
        defs[resolved.name] = extractProps(refDecl, refFile, defs);
      }
    }
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

/**
 * Find a top-level `const X: React.FC<XProps> = ...` (or plain
 * `const X: XProps = ...`) declaration and return its Props interface name,
 * so a slot assigned from a named identifier (e.g. `TabStrip.Panel =
 * TabPanel`, where `TabPanel: React.FC<TabPanelProps>`) can have its own
 * props resolved the same way a root component's can.
 */
function findPropsNameForIdentifier(sourceFile, identifierName) {
  let propsName = null;
  ts.forEachChild(sourceFile, (node) => {
    if (propsName || !ts.isVariableStatement(node)) return;
    for (const decl of node.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === identifierName) {
        propsName = propsInterfaceNameFromType(decl.type) ?? propsNameFromForwardRefInitializer(decl.initializer);
      }
    }
  });
  return propsName;
}

/**
 * Scan a source file's top-level statements for `ComponentName.Slot = ...`
 * assignments. Returns `{ name, propsName }` per slot — `propsName` is the
 * slot's own Props interface, resolved when the RHS is a named identifier
 * (e.g. `TabStrip.Panel = TabPanel`); `null` when it's an inline arrow
 * function with no separately-declared Props type to point at.
 */
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
      const name = expr.left.name.text;
      const propsName = ts.isIdentifier(expr.right) ? findPropsNameForIdentifier(sourceFile, expr.right.text) : null;
      slots.push({ name, propsName });
    }
  });
  return slots;
}

function generateComponentEntry(sourceFile, decl, defs) {
  const entry = {
    name: decl.name,
    import: MANUAL_IMPORT_OVERRIDES[decl.name] ?? `import { ${decl.name} } from '#toolcrib'`,
  };

  const slots = findSlots(sourceFile, decl.name);
  if (slots.length > 0) {
    entry.slots = slots.map((s) => s.name);

    // Resolve each slot's own props (e.g. `<TabStrip.Panel>`'s `value`/
    // `groupId`) so an AI agent isn't left guessing them from the parent
    // component's prop table, which only ever describes the root element.
    const slotProps = {};
    for (const slot of slots) {
      if (!slot.propsName) continue;
      const slotInterface = findInterface(sourceFile, slot.propsName);
      if (slotInterface) slotProps[slot.name] = extractProps(slotInterface, sourceFile, defs);
    }
    if (Object.keys(slotProps).length > 0) entry.slotProps = slotProps;
  }

  if (decl.propsName) {
    const interfaceDecl = findInterface(sourceFile, decl.propsName);
    if (interfaceDecl) entry.props = extractProps(interfaceDecl, sourceFile, defs);
  }

  if (decl.children) {
    entry.childComponents = decl.children.split(',').map((s) => s.trim());
  }
  if (decl.constraints) entry.constraints = decl.constraints;
  if (decl.category) entry.category = decl.category;
  // Both or neither -- one tag without its pair is a JSDoc mistake, not a
  // valid partial anti-pattern row (see AGENTS.md/generate-docs.js's own
  // assembleAntiPatternRows for how this feeds CORE.md's §3 table).
  if (decl.antiPatternAvoid && decl.antiPatternInstead) {
    entry.antiPatternAvoid = decl.antiPatternAvoid;
    entry.antiPatternInstead = decl.antiPatternInstead;
  }
  entry.description = decl.description;
  return entry;
}

/**
 * Named, CI-visible backstop for the `style`/`className` type-level
 * removal (see theme/safeProps.ts, AGENTS.md's "Theme overrides" section):
 * fails generation outright if a component's own Props interface members
 * (exactly what extractProps() reads — inherited/extends-clause members
 * are invisible to it either way, so this specifically catches a
 * component re-declaring `style`/`className` as an explicit own member,
 * the actual shape every pre-refactor component had) include either name.
 */
export function validateNoForbiddenProps(components) {
  const offenders = components.filter((c) => c.props && ('style' in c.props || 'className' in c.props));
  if (offenders.length > 0) {
    throw new Error(
      `Component(s) re-declare a forbidden 'style'/'className' prop: ${offenders.map((c) => c.name).join(', ')}. ` +
        `Extend StyleFree<T>/StyleFreeAttributes<T> (theme/safeProps.ts) instead — see AGENTS.md.`
    );
  }
}

/**
 * Every `@manifest`-tagged component must also carry a valid
 * `@manifestCategory` — enforced here (throws, failing generation outright
 * in both --check and --write mode) rather than left as a passive gap that
 * only shows up as a manifest diff, since a diff is easy to `--write` over
 * without noticing the new entry has no category at all.
 */
export function validateCategories(components) {
  const missing = components.filter((c) => !c.category).map((c) => c.name);
  if (missing.length > 0) {
    throw new Error(
      `Missing @manifestCategory on: ${missing.join(', ')}. ` +
        `Every @manifest-tagged component needs one of: ${VALID_CATEGORIES.join(', ')}.`
    );
  }
  const invalid = components.filter((c) => !VALID_CATEGORIES.includes(c.category));
  if (invalid.length > 0) {
    throw new Error(
      invalid.map((c) => `'${c.name}' has invalid @manifestCategory '${c.category}'`).join('; ') +
        `. Must be one of: ${VALID_CATEGORIES.join(', ')}.`
    );
  }
}

// Populated by generateComponents() as a side effect and read back by
// generate-manifest.js immediately afterward (both run synchronously in
// the same process/script invocation). Kept separate from
// generateComponents()'s own return value -- which stays a plain array,
// exactly as before -- so generate-docs.js's existing
// `const components = generateComponents();` call keeps working
// unmodified; it has no use for $defs and shouldn't need to know this
// exists.
let _lastCollectedDefs = {};

/** The `$defs` accumulated during the most recent generateComponents()
 * call -- every named interface (Column, etc.) referenced by any
 * component or slot prop, keyed by name, each resolved via the same
 * extractProps() logic used for a component's own root props. */
export function getCollectedTypeDefs() {
  return _lastCollectedDefs;
}

export function generateComponents() {
  const components = [];
  const defs = {};
  for (const filePath of listSourceFiles(COMPONENTS_DIR)) {
    const sourceFile = parse(filePath);
    for (const decl of findComponentDeclarations(sourceFile)) {
      components.push(generateComponentEntry(sourceFile, decl, defs));
    }
  }
  components.sort((a, b) => a.name.localeCompare(b.name));
  validateCategories(components);
  validateNoForbiddenProps(components);
  _lastCollectedDefs = defs;
  return components;
}

// -------------------------------------------------------------------------
// src/index.ts (the public `#toolcrib` barrel)
// -------------------------------------------------------------------------

/**
 * Whether a source file has at least one exported declaration tagged
 * `@manifest` or `@barrelExport` — the signal generateBarrelExports() uses
 * to decide the whole file belongs in the public barrel. Deliberately a
 * whole-file question, not per-declaration: the barrel re-exports whole
 * modules (`export * from './x'`), so one qualifying declaration is enough
 * to pull in everything else that file exports alongside it (e.g. a
 * component's own Props interface doesn't need its own tag).
 *
 * Opt-in by design, not opt-out: nothing ships in the public API surface
 * without an explicit marker. `@manifest` already means "this is a public
 * component" for the manifest's own purposes, so it doubles as the barrel
 * signal too rather than requiring components to carry two tags that would
 * always agree. `@barrelExport` exists for the rest of the public surface
 * that isn't a manifest component — hooks, Slice definitions, context
 * types, shared utilities.
 */
function hasBarrelTag(sourceFile) {
  let found = false;
  const check = (node) => {
    if (found) return;
    const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!isExported) return;
    const isTaggableDeclaration =
      ts.isVariableStatement(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isClassDeclaration(node);
    if (!isTaggableDeclaration) return;
    const doc = leadingJsDoc(node);
    if (jsDocTag(doc, 'manifest') !== null || jsDocTag(doc, 'barrelExport') !== null) {
      found = true;
    }
  };
  ts.forEachChild(sourceFile, check);
  return found;
}

/**
 * Every vendored module (theme/, eventBus/, observer/, components/**)
 * that should be re-exported from src/index.ts, grouped by top-level
 * vendored directory (matching build-release.js's own VENDOR_DIRS) and
 * sorted alphabetically within each group. Returns module specifiers
 * relative to src/ (e.g. './theme/hsv'), extension-stripped, matching
 * index.ts's existing `export * from '...'` style.
 */
export function generateBarrelExports() {
  const groups = [
    { key: 'theme', dir: THEME_DIR },
    { key: 'eventBus', dir: path.join(SRC, 'eventBus') },
    { key: 'observer', dir: path.join(SRC, 'observer') },
    { key: 'components', dir: COMPONENTS_DIR },
  ];

  const result = {};
  for (const { key, dir } of groups) {
    const specifiers = [];
    for (const filePath of listSourceFiles(dir)) {
      const sourceFile = parse(filePath);
      if (!hasBarrelTag(sourceFile)) continue;
      const relPath = path.relative(SRC, filePath).split(path.sep).join('/').replace(/\.tsx?$/, '');
      specifiers.push(`./${relPath}`);
    }
    specifiers.sort();
    result[key] = specifiers;
  }
  return result;
}
