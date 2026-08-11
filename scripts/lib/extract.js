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

// -------------------------------------------------------------------------
// Generic TS AST helpers
// -------------------------------------------------------------------------

export function parse(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
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
  if (typeof comment === 'string') return comment;
  return comment.map((c) => c.text ?? '').join('');
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
          propsName: propsInterfaceNameFromType(decl.type),
          description: manifestDesc,
          constraints: jsDocTag(doc, 'manifestConstraints'),
          children: jsDocTag(doc, 'manifestChildren'),
          category: jsDocTag(doc, 'manifestCategory'),
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
 * `children` is skipped: implicit on every React component, never
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
  if (decl.category) entry.category = decl.category;
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

export function generateComponents() {
  const components = [];
  for (const filePath of listSourceFiles(COMPONENTS_DIR)) {
    const sourceFile = parse(filePath);
    for (const decl of findComponentDeclarations(sourceFile)) {
      components.push(generateComponentEntry(sourceFile, decl));
    }
  }
  components.sort((a, b) => a.name.localeCompare(b.name));
  validateCategories(components);
  validateNoForbiddenProps(components);
  return components;
}
