import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../theme/themeContext';
import { captureThemeSnapshot, applyThemeSnapshot, isThemeSnapshotLike } from '../theme/themePersistence';

function renderTheme() {
  return renderHook(() => useTheme(), { wrapper: ThemeProvider });
}

describe('isThemeSnapshotLike', () => {
  it('accepts a minimal valid snapshot', () => {
    expect(isThemeSnapshotLike({ schemaVersion: 1 })).toBe(true);
  });

  it('accepts a snapshot with parameters and slice states', () => {
    expect(
      isThemeSnapshotLike({
        schemaVersion: 1,
        parameters: { baseColor: { h: 1, s: 2, v: 3 } },
        tableState: { density: 'compact' },
      })
    ).toBe(true);
  });

  it('rejects non-objects', () => {
    expect(isThemeSnapshotLike(null)).toBe(false);
    expect(isThemeSnapshotLike(undefined)).toBe(false);
    expect(isThemeSnapshotLike('a string')).toBe(false);
    expect(isThemeSnapshotLike(42)).toBe(false);
  });

  it('rejects a missing or wrong schemaVersion', () => {
    expect(isThemeSnapshotLike({})).toBe(false);
    expect(isThemeSnapshotLike({ schemaVersion: 2 })).toBe(false);
    expect(isThemeSnapshotLike({ schemaVersion: '1' })).toBe(false);
  });

  it('rejects a known field that is present but not an object', () => {
    expect(isThemeSnapshotLike({ schemaVersion: 1, tableState: 'not an object' })).toBe(false);
    expect(isThemeSnapshotLike({ schemaVersion: 1, parameters: 'nope' })).toBe(false);
  });
});

describe('captureThemeSnapshot / applyThemeSnapshot round trip', () => {
  it('captures the live theme state and re-applies it correctly after a reset', () => {
    const { result } = renderTheme();

    act(() => {
      result.current.setBaseColor({ h: 42, s: 60, v: 70 });
      result.current.setTableState({ density: 'compact' });
    });

    const snapshot = captureThemeSnapshot(result.current, 'My Theme');
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.name).toBe('My Theme');
    expect(snapshot.parameters?.baseColor).toEqual({ h: 42, s: 60, v: 70 });
    expect(snapshot.tableState?.density).toBe('compact');

    act(() => {
      result.current.setBaseColor({ h: 0, s: 0, v: 0 });
      result.current.setTableState({ density: 'spacious' });
    });
    expect(result.current.parameters.baseColor).toEqual({ h: 0, s: 0, v: 0 });

    act(() => {
      applyThemeSnapshot(result.current, snapshot);
    });

    expect(result.current.parameters.baseColor).toEqual({ h: 42, s: 60, v: 70 });
    expect(result.current.tableState.density).toBe('compact');
  });

  it('a partial snapshot (e.g. a preset with only parameters) leaves other slice states untouched', () => {
    const { result } = renderTheme();

    act(() => {
      result.current.setTableState({ density: 'compact' });
    });

    act(() => {
      applyThemeSnapshot(result.current, {
        schemaVersion: 1,
        parameters: { baseColor: { h: 200, s: 50, v: 50 } },
      });
    });

    expect(result.current.parameters.baseColor).toEqual({ h: 200, s: 50, v: 50 });
    expect(result.current.tableState.density).toBe('compact'); // untouched by the partial snapshot
  });

  it('applying an empty snapshot changes nothing', () => {
    const { result } = renderTheme();

    act(() => {
      result.current.setBaseColor({ h: 99, s: 40, v: 40 });
    });
    const before = result.current.parameters.baseColor;

    act(() => {
      applyThemeSnapshot(result.current, { schemaVersion: 1 });
    });

    expect(result.current.parameters.baseColor).toEqual(before);
  });
});
