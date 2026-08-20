import { type ThemeSnapshot, isThemeSnapshotLike } from './themePersistence';

/**
 * One of three independent theme *sources* (the others: presetThemes.ts —
 * bundled assets, themeLibrary.ts — localStorage). This file only knows how
 * to turn a `ThemeSnapshot` into a downloadable file, and a `File` (from a
 * file input or a drag-drop) back into a validated `ThemeSnapshot` — it
 * never imports `applyThemeSnapshot` or anything from themeContext.tsx.
 */

/**
 * Triggers a browser download of a snapshot as a `.json` file — pure
 * browser File/Blob APIs, no server round-trip.
 * @barrelExport
 */
export function downloadThemeSnapshot(snapshot: ThemeSnapshot, filename = 'toolcrib-theme.json'): void {
  const json = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Reads and validates a `File` (e.g. from `<input type="file">`) as a theme snapshot. Rejects with a human-readable message on invalid JSON or an unrecognized shape — never resolves with unvalidated data. */
export function readThemeSnapshotFromFile(file: File): Promise<ThemeSnapshot> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch {
        reject(new Error(`"${file.name}" is not valid JSON.`));
        return;
      }
      if (!isThemeSnapshotLike(parsed)) {
        reject(new Error(`"${file.name}" doesn't look like a toolcrib theme file (missing or unrecognized schemaVersion).`));
        return;
      }
      resolve(parsed);
    };
    reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
    reader.readAsText(file);
  });
}
