#!/usr/bin/env node
/**
 * Builds a release: assembles ./dist with the vendorable toolkit source
 * plus a generated toolcrib.config.json, ready to be zipped and attached
 * to a GitHub Release by the workflow.
 *
 * Layout assumptions specific to this repo (escape-llc/toolcrib):
 *  - Vendorable source lives in src/theme, src/eventBus, src/observer,
 *    and src/components/** (each component in its own folder).
 *  - src/App.tsx, src/main.tsx, src/index.html, src/index.css, and the
 *    root AGENTS.md are the repo's own dev/demo harness and contributor
 *    instructions — NOT shipped to consumers.
 *  - ai-docs/ already contains real AI-facing docs (CORE.md, NEW_APP.md,
 *    REFACTOR_APP.md, component-manifest.json) and ships as-is.
 *  - src/__tests__/ is excluded here entirely — it's packaged separately
 *    by build-tests-release.js as the optional test-suite artifact.
 *
 * package.json is AI-managed, not hand-curated — an AI adding a new
 * component can use a new Radix primitive and forget to declare it, or
 * add something to the wrong dependency bucket. Trusting "dependencies"
 * wholesale (the previous version of this script) works only as long as
 * nothing has drifted, which isn't a safe assumption for a file an AI
 * edits routinely. Instead: SCAN the vendored source's actual import
 * statements as ground truth, and verify package.json declares exactly
 * that set — nothing missing, nothing stale. Fail the build loudly on
 * either kind of mismatch rather than silently shipping a wrong
 * peerDependencies list to consumers.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

const VENDOR_DIRS = ['theme', 'eventBus', 'observer', 'components'];
// The barrel file — the single import surface consumers actually use
// (`import { Card } from '#toolcrib'`, wired to ./toolcrib/index.ts via the
// package.json "imports" field the CLI proposes). Vendoring the directories
// without this leaves no entry point at all.
const INDEX_FILE = 'index.ts';
const AI_DOCS_DIR = path.join(ROOT, 'ai-docs');

// Node builtins and anything else that should never appear as a
// peerDependency even if imported (e.g. types-only or ambient imports).
const IGNORE_PACKAGES = new Set(['react/jsx-runtime']);

function loadRootPackageJson() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
}

/**
 * Extract the external (non-relative) package name from an import/export
 * specifier, collapsing scoped-package subpaths to the package root
 * (e.g. "@radix-ui/react-dialog/foo" -> "@radix-ui/react-dialog",
 * "react-dom/client" -> "react-dom").
 */
function packageNameFromSpecifier(spec) {
  if (spec.startsWith('.') || spec.startsWith('/')) return null; // relative import, not external
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** Scan a single file's text for import/export ... from '...' specifiers. */
function extractImportsFromFile(content) {
  const specifiers = [];
  const re = /(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = re.exec(content))) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

/**
 * Scan every vendored source file for external package imports.
 * This is the ground truth for what peerDependencies MUST contain —
 * derived from actual code, not from whatever happens to be listed in
 * package.json at the moment (which may be stale or wrong).
 */
function scanRequiredPackages(vendorFilePaths, srcRoot) {
  const found = new Set();
  for (const relPath of vendorFilePaths) {
    if (!/\.(ts|tsx)$/.test(relPath)) continue;
    const content = fs.readFileSync(path.join(srcRoot, relPath), 'utf-8');
    for (const spec of extractImportsFromFile(content)) {
      const pkgName = packageNameFromSpecifier(spec);
      if (pkgName && !IGNORE_PACKAGES.has(pkgName)) found.add(pkgName);
    }
  }
  return found;
}

/**
 * Cross-check scanned imports against package.json's declared
 * dependencies. Fails loudly on either direction of drift:
 *  - imported but not declared anywhere (AI forgot to add it)
 *  - imported but only in devDependencies (AI put a runtime dep in the
 *    wrong bucket — consumers need it, dev-only deps don't ship to them)
 * A dependency present in "dependencies" but never imported is reported
 * as a warning, not a failure — it's dead weight, not a correctness bug.
 */
function validateAgainstPackageJson(requiredPackages, rootPkg) {
  const declared = new Set(Object.keys(rootPkg.dependencies || {}));
  const devOnly = new Set(Object.keys(rootPkg.devDependencies || {}));

  const missing = [];
  const misplaced = [];

  for (const pkg of requiredPackages) {
    if (declared.has(pkg)) continue;
    if (devOnly.has(pkg)) {
      misplaced.push(pkg);
    } else {
      missing.push(pkg);
    }
  }

  if (missing.length > 0 || misplaced.length > 0) {
    const lines = ['Dependency validation failed — vendored source imports packages package.json does not correctly declare:'];
    if (missing.length) lines.push(`  Not declared anywhere: ${missing.join(', ')}`);
    if (misplaced.length) lines.push(`  In devDependencies but imported by vendored source (move to "dependencies"): ${misplaced.join(', ')}`);
    throw new Error(lines.join('\n'));
  }

  const unused = [...declared].filter((pkg) => !requiredPackages.has(pkg));
  if (unused.length > 0) {
    console.warn(`Warning: declared in "dependencies" but not imported anywhere in vendored source: ${unused.join(', ')}`);
  }
}

/**
 * Recursively list files under dir, returning paths relative to base.
 * Always forward-slash, regardless of host OS — these relPaths end up in
 * toolcrib.config.json and, on the CLI side, in git patch header paths,
 * which reject backslash-separated paths outright (see the matching fix
 * and comment in cli/src/lib/zip.js).
 */
function listFilesRecursive(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(listFilesRecursive(full, base));
    } else {
      results.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return results.sort();
}

function copyPreservingStructure(relPaths, srcBase, destBase) {
  for (const relPath of relPaths) {
    const destPath = path.join(destBase, relPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(path.join(srcBase, relPath), destPath);
  }
}

function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const rootPkg = loadRootPackageJson();

  // Vendorable source: theme/, eventBus/, observer/, components/** — copied
  // with structure preserved so component subfolders (Card/, Form/, etc.)
  // survive intact in the vendored output.
  const filesByDir = {};
  const allVendorRelPaths = [];
  for (const dirName of VENDOR_DIRS) {
    const files = listFilesRecursive(path.join(SRC, dirName));
    if (files.length === 0) {
      throw new Error(`No files found under src/${dirName} — check repo layout before releasing.`);
    }
    filesByDir[dirName] = files.map((f) => `${dirName}/${f}`);
    allVendorRelPaths.push(...filesByDir[dirName]);
    copyPreservingStructure(files, path.join(SRC, dirName), path.join(DIST, dirName));
  }

  if (!fs.existsSync(path.join(SRC, INDEX_FILE))) {
    throw new Error(`src/${INDEX_FILE} not found — the barrel entry point must ship with every release.`);
  }
  allVendorRelPaths.push(INDEX_FILE);
  fs.copyFileSync(path.join(SRC, INDEX_FILE), path.join(DIST, INDEX_FILE));

  // peerDependencies: derived from what the vendored source actually
  // imports, then validated against package.json — not trusted wholesale.
  // See header note on why (AI-managed package.json can drift).
  const requiredPackages = scanRequiredPackages(allVendorRelPaths, SRC);
  validateAgainstPackageJson(requiredPackages, rootPkg);

  const peerDependencies = {};
  for (const pkg of requiredPackages) {
    peerDependencies[pkg] = rootPkg.dependencies[pkg];
  }

  // ai-docs/ ships as-is, whatever's actually there.
  const aiDocFiles = listFilesRecursive(AI_DOCS_DIR);
  copyPreservingStructure(aiDocFiles, AI_DOCS_DIR, path.join(DIST, 'ai-docs'));

  const config = {
    version: rootPkg.version,
    generatedAt: new Date().toISOString(),
    peerDependencies,
    files: {
      root: [INDEX_FILE],
      ...filesByDir,
      aiDocs: aiDocFiles.map((f) => `ai-docs/${f}`),
    },
  };

  fs.writeFileSync(path.join(DIST, 'toolcrib.config.json'), JSON.stringify(config, null, 2) + '\n');

  const totalFiles = Object.values(filesByDir).flat().length + aiDocFiles.length + 1;
  console.log(`Built release v${rootPkg.version}: ${totalFiles} file(s) staged in ./dist`);
  console.log(`  root: 1 (${INDEX_FILE})`);
  for (const [dir, files] of Object.entries(filesByDir)) {
    console.log(`  ${dir}: ${files.length}`);
  }
  console.log(`  ai-docs: ${aiDocFiles.length}`);
  console.log(`  peerDependencies: ${Object.keys(peerDependencies).join(', ')}`);
}

main();
