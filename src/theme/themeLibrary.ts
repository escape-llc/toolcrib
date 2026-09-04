'use client';

import { type ThemeSnapshot, isThemeSnapshotLike } from './themePersistence';

/**
 * One of three independent theme *sources* (the others: presetThemes.ts —
 * bundled assets, themeFileTransfer.ts — downloaded/uploaded files). This
 * file only knows how to store and retrieve `ThemeSnapshot` data in
 * `localStorage` under a user-given name — it never imports
 * `applyThemeSnapshot` or anything from themeContext.tsx. The caller
 * decides what to do with a snapshot once it has one.
 */

const STORAGE_KEY = 'toolcrib-theme-library';

/** @barrelExport */
export interface SavedTheme {
  id: string;
  name: string;
  savedAt: string;
  snapshot: ThemeSnapshot;
}

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function readLibrary(): SavedTheme[] {
  if (!hasLocalStorage()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filters out anything that isn't recognizably a SavedTheme, rather
    // than letting one corrupted entry (e.g. hand-edited localStorage, a
    // future incompatible version) break the whole list.
    return parsed.filter(
      (entry): entry is SavedTheme =>
        !!entry &&
        typeof entry === 'object' &&
        typeof entry.id === 'string' &&
        typeof entry.name === 'string' &&
        typeof entry.savedAt === 'string' &&
        isThemeSnapshotLike(entry.snapshot)
    );
  } catch {
    return [];
  }
}

function writeLibrary(entries: SavedTheme[]): void {
  if (!hasLocalStorage()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `theme-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Lists every user-saved theme, most recently saved first.
 *
 * `savedAt` is millisecond-resolution (`toISOString()`), so two saves in
 * quick succession (a fast double-click, a scripted/automated save, or —
 * confirmed for real — a CI runner under load stretching what should be a
 * few milliseconds) can tie exactly. `Array.prototype.sort` is stable, so
 * a plain `.sort((a, b) => b.savedAt.localeCompare(a.savedAt))` on tied
 * entries silently preserves their *original* array order — which is
 * oldest-appended-first (`saveThemeToLibrary` always appends), the
 * opposite of "most recently saved first." Reversing before the sort
 * makes ties resolve to most-recently-appended-first instead, which is
 * the actually-intended tiebreak and doesn't depend on timestamp
 * precision at all.
 */
export function listSavedThemes(): SavedTheme[] {
  return readLibrary()
    .slice()
    .reverse()
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Saves a snapshot under a name, appending a new library entry (never overwrites an existing one by name — same name twice just means two entries). */
export function saveThemeToLibrary(name: string, snapshot: ThemeSnapshot): SavedTheme {
  const entry: SavedTheme = {
    id: generateId(),
    name,
    savedAt: new Date().toISOString(),
    snapshot: { ...snapshot, name },
  };
  writeLibrary([...readLibrary(), entry]);
  return entry;
}

/** Removes a saved theme by id. No-op if it doesn't exist. */
export function deleteThemeFromLibrary(id: string): void {
  writeLibrary(readLibrary().filter(entry => entry.id !== id));
}

/** Looks up a single saved theme by id. */
export function getThemeFromLibrary(id: string): SavedTheme | undefined {
  return readLibrary().find(entry => entry.id === id);
}
