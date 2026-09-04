import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * A real `ThemeSlice` object existing in a component's own `*Slice.tsx` file
 * doesn't mean it's actually wired in — `registerThemeSlices.ts` has to
 * separately import it and call `globalThemeSliceRegistry.register(...)` on
 * it, or its *global* default theming is silently unreachable (per-instance
 * `overrides` still works, since that bypasses the registry entirely — see
 * `useSliceOverrides.ts`). Commit `9192624` found 9 real slices (Carousel,
 * Combobox, CommandPalette, FileUpload, Gallery, HoverCard, Label,
 * ScrollArea, Viewer) that had shipped this way, undiscovered until an
 * unrelated refactor happened to go looking. This test closes that gap
 * mechanically going forward: a new `*Slice.tsx` file that never gets
 * imported+registered now fails a test immediately, rather than waiting for
 * someone to notice its global defaults never respond to the Theme Editor.
 *
 * Registration used to live directly in `themeContext.tsx`; it moved to its
 * own `registerThemeSlices.ts` so `computeServerThemeCSS` (`serverThemeCSS.ts`)
 * could trigger the same registrations without importing anything
 * `'use client'` — see that module's header comment. This test now scans
 * the new file instead.
 *
 * Pure static-text scan, not a runtime import graph — this deliberately
 * mirrors the class of bug (missing wiring is a *textual* omission in
 * registerThemeSlices.ts), and avoids the overhead/fragility of dynamically
 * importing every component file just to inspect its exports.
 */

const SRC_ROOT = path.join(__dirname, '..');
const COMPONENTS_ROOT = path.join(SRC_ROOT, 'components');
const THEME_ROOT = path.join(SRC_ROOT, 'theme');
const REGISTER_THEME_SLICES_PATH = path.join(THEME_ROOT, 'registerThemeSlices.ts');

function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      files.push(fullPath);
    }
  }
  return files;
}

// Matches only an exported CONST object whose name ends in `ThemeSlice`
// (the established naming convention for every real slice in this repo) --
// not the `ThemeSlice` type itself, not `ThemeSliceRegistry`.
const SLICE_EXPORT_RE = /export const (\w+ThemeSlice)\b/g;

describe('Every exported *ThemeSlice is imported and registered in registerThemeSlices.ts', () => {
  const registerThemeSlicesSource = fs.readFileSync(REGISTER_THEME_SLICES_PATH, 'utf8');

  const candidateFiles = [
    ...collectSourceFiles(COMPONENTS_ROOT),
    ...fs
      .readdirSync(THEME_ROOT)
      .filter((f) => /\.tsx?$/.test(f) && !f.includes('.test.'))
      .map((f) => path.join(THEME_ROOT, f)),
  ].filter((f) => f !== REGISTER_THEME_SLICES_PATH);

  const foundSlices = new Map<string, string>();

  for (const file of candidateFiles) {
    const source = fs.readFileSync(file, 'utf8');
    let match: RegExpExecArray | null;
    SLICE_EXPORT_RE.lastIndex = 0;
    while ((match = SLICE_EXPORT_RE.exec(source)) !== null) {
      foundSlices.set(match[1], path.relative(path.join(SRC_ROOT, '..'), file));
    }
  }

  // Guards against a change to collectSourceFiles/the regex silently
  // making this whole suite a no-op (0 slices found == 0 tests run == a
  // vacuously "passing" gate that checks nothing).
  it('found a non-trivial number of *ThemeSlice exports to check', () => {
    expect(foundSlices.size).toBeGreaterThan(30);
  });

  for (const [sliceName, relPath] of foundSlices) {
    it(`${sliceName} (${relPath}) is registered`, () => {
      const importedOrReferenced = new RegExp(`\\b${sliceName}\\b`).test(registerThemeSlicesSource);
      expect(importedOrReferenced, `${sliceName} does not appear anywhere in registerThemeSlices.ts`).toBe(true);

      const registered = new RegExp(`globalThemeSliceRegistry\\.register\\(\\s*${sliceName}\\s*\\)`).test(registerThemeSlicesSource);
      expect(
        registered,
        `${sliceName} appears in registerThemeSlices.ts but is never passed to globalThemeSliceRegistry.register(...) -- its global theme defaults are silently unreachable (per-instance overrides still work). See commit 9192624 for the exact bug shape.`
      ).toBe(true);
    });
  }
});
