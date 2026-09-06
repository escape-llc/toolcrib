#!/usr/bin/env node
// Scans src/components/**/*.tsx for three specific defect shapes found by a
// real, source-level audit of toolcrib's own component set against its own
// documented anti-pattern rules (ai-docs/CORE.md §3) -- see
// .plans/toolcrib-gap-closure-plan.md §6b for the full account. This is
// deliberately narrow and regex-based (not a TS-Compiler-API pass like
// generate-manifest.js's extract.js) because it targets three exact,
// already-confirmed defect shapes rather than attempting general style
// linting -- a narrower, precise check that ships today beats a more
// general one that doesn't exist yet.
//
// 1. A `boxShadow` value that references neither the real, wired global
//    elevation scale (`var(--ai-shadow-sm|md|lg)`, src/theme/shadow.ts) nor
//    a per-component ThemeSlice's own shadow variable (the pattern
//    Toast/Popup/DropdownMenu/ContextMenu/HoverCard/Chart already use
//    correctly -- each defines its own `--ai-<component>-shadow` via a
//    `shadowDepth` field in its own `*Slice.tsx`). Both are legitimate,
//    wired theming mechanisms; only a bare literal with neither is a
//    violation. Found live: 13 components had a bare literal instead of
//    either, meaning nothing in the theme system could ever change their
//    shadow. Whether such a component *should* get its own Slice field
//    (matching Popup's pattern) or just use the global scale is a design
//    judgment call this script doesn't make -- it only flags the absence
//    of both.
// 2. A z-index literal of 3 or higher with no comment on the same or
//    preceding line -- found live: Toast.tsx had a bare `zIndex: 3000`
//    with no explanation, undocumented and inconsistent with the correctly
//    `Z_INDEX.TOAST`-scoped value elsewhere in the same file. Values of 0-2
//    are the established, legitimate pattern for ordering siblings within
//    a component's own local `position: relative` stacking context
//    (Carousel/Filmstrip/TabStrip/ViewerContent/UIGroup all do this
//    correctly) and are not flagged.
// 3. A `borderRadius` value containing a bare very-large px literal
//    (the "guaranteed fully round regardless of height" trick) that
//    doesn't reference `var(--ai-radius-`  -- found live, independently
//    duplicated in Combobox.tsx and ScrollArea.tsx.
//
// Usage: node scripts/check-theme-tokens.js [--fix-hint]
// Exits non-zero if any violation is found. No --write mode: unlike
// generate-manifest.js/generate-docs.js/generate-index.js, there is no
// single correct value to regenerate -- each finding needs a human (or
// agent) judgment call about which token/tier applies, the same way the
// three real fixes this check was modeled on each did.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const COMPONENTS_DIR = join(ROOT, 'src', 'components');

function walk(dir, files = [], predicate = (name) => name.endsWith('.tsx') && !name.endsWith('.test.tsx')) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files, predicate);
    } else if (predicate(entry)) {
      files.push(full);
    }
  }
  return files;
}

// Any CSS variable actually DEFINED as an object key somewhere in the theme
// system or a component's own Slice file is a real, wired theming hook,
// regardless of which of the two legitimate patterns (global scale vs.
// per-component Slice field) it belongs to.
function collectDefinedCSSVariables() {
  const defined = new Set();
  const sliceFiles = walk(COMPONENTS_DIR, [], (name) => name.endsWith('Slice.tsx'));
  const themeFiles = walk(join(ROOT, 'src', 'theme'), [], (name) => name.endsWith('.ts') || name.endsWith('.tsx'));
  for (const file of [...sliceFiles, ...themeFiles]) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/'(--ai-[\w-]+)':/g)) {
      defined.add(m[1]);
    }
  }
  return defined;
}

/** @returns {{file: string, line: number, rule: string, text: string}[]} */
function checkFile(path, definedVars) {
  const violations = [];
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const rel = relative(ROOT, path).replace(/\\/g, '/');

  lines.forEach((line, i) => {
    // Rule 1: boxShadow referencing neither the global elevation scale nor
    // a real, defined per-component Slice shadow variable.
    const shadowMatch = line.match(/boxShadow:\s*'([^']*)'/);
    if (shadowMatch) {
      const usesGlobalScale = /var\(--ai-shadow-(sm|md|lg)\b/.test(shadowMatch[1]);
      const referencedVar = shadowMatch[1].match(/var\((--ai-[\w-]+)/);
      const usesDefinedSliceVar = referencedVar && definedVars.has(referencedVar[1]);
      if (!usesGlobalScale && !usesDefinedSliceVar) {
        violations.push({
          file: rel,
          line: i + 1,
          rule: 'no-unscaled-boxshadow',
          text: `boxShadow value references neither var(--ai-shadow-sm|md|lg) nor a real, defined per-component Slice shadow variable -- nothing in the theme system can change this element's shadow. Either wrap it as a global-scale fallback (boxShadow: 'var(--ai-shadow-<sm|md|lg>, ${shadowMatch[1]})') or add a shadowDepth field to this component's own *Slice.tsx, matching Popup/Toast/DropdownMenu's pattern.`,
        });
      }
    }

    // Rule 2: an unexplained z-index literal >= 3.
    const zIndexMatch = line.match(/zIndex:\s*(-?\d+)/) ?? line.match(/z-index:\s*(-?\d+)/);
    if (zIndexMatch && Number(zIndexMatch[1]) >= 3) {
      const hasComment = /\/\//.test(line) || (i > 0 && /\/\//.test(lines[i - 1]));
      if (!hasComment) {
        violations.push({
          file: rel,
          line: i + 1,
          rule: 'unexplained-zindex',
          text: `zIndex: ${zIndexMatch[1]} has no comment explaining it. If this needs to compete at the page level, use Z_INDEX from theme/zIndex.ts. If it's scoped to this element's own local stacking context (a position: relative/absolute parent with positioned children), add a comment saying so -- see Carousel.tsx's zIndex: 1 for the pattern.`,
        });
      }
    }

    // Rule 3: a bare large-px borderRadius literal, not routed through the
    // real corner-radius scale (src/theme/radius.ts's --ai-radius-xl in
    // 'pill' mode achieves the same visual result for any element that
    // stays within a couple of rem of height, and responds to the user's
    // chosen cornerRadiusMode instead of always forcing a capsule shape).
    const radiusMatch = line.match(/borderRadius:\s*'(\d{3,}px)'/);
    if (radiusMatch && !line.includes('var(--ai-radius-')) {
      violations.push({
        file: rel,
        line: i + 1,
        rule: 'unscaled-pill-radius',
        text: `borderRadius: '${radiusMatch[1]}' doesn't reference var(--ai-radius-xl) -- this element won't respond to the user's chosen cornerRadiusMode. Use: borderRadius: 'var(--ai-radius-xl, ${radiusMatch[1]})'`,
      });
    }
  });

  return violations;
}

const files = walk(COMPONENTS_DIR);
const definedVars = collectDefinedCSSVariables();
const allViolations = files.flatMap((f) => checkFile(f, definedVars));

if (allViolations.length === 0) {
  console.log(`check-theme-tokens: clean (${files.length} files scanned)`);
  process.exit(0);
}

console.error(`check-theme-tokens: ${allViolations.length} violation(s) found in ${files.length} files scanned\n`);
for (const v of allViolations) {
  console.error(`${v.file}:${v.line} [${v.rule}]\n  ${v.text}\n`);
}
process.exit(1);
