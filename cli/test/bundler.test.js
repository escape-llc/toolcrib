import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { detectBundler } from '../src/lib/bundler.js';

describe('detectBundler', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when no signal is present', () => {
    expect(detectBundler(tmpDir, { dependencies: {}, devDependencies: {} })).toBeNull();
  });

  it('returns null when pkg is undefined and no config files exist', () => {
    expect(detectBundler(tmpDir, undefined)).toBeNull();
  });

  it('detects Vite via devDependency, with no note', () => {
    const result = detectBundler(tmpDir, { devDependencies: { vite: '^5.0.0' } });
    expect(result).toEqual({ id: 'vite', label: 'Vite', note: null });
  });

  it('detects Vite via config file alone, even with no matching dependency', () => {
    fs.writeFileSync(path.join(tmpDir, 'vite.config.ts'), 'export default {};\n');
    const result = detectBundler(tmpDir, { dependencies: {} });
    expect(result?.id).toBe('vite');
  });

  it('detects Next.js and includes the App Router client-component note', () => {
    const result = detectBundler(tmpDir, { dependencies: { next: '^14.0.0' } });
    expect(result.id).toBe('next');
    expect(result.note).toMatch(/use client/);
  });

  it('detects Create React App via react-scripts and includes the imports-subpath note', () => {
    const result = detectBundler(tmpDir, { dependencies: { 'react-scripts': '5.0.1' } });
    expect(result.id).toBe('cra');
    expect(result.note).toMatch(/imports/);
  });

  it('detects webpack and includes the version note', () => {
    const result = detectBundler(tmpDir, { devDependencies: { webpack: '^5.0.0' } });
    expect(result.id).toBe('webpack');
    expect(result.note).toMatch(/webpack 5/);
  });

  it('detects Parcel via config file', () => {
    fs.writeFileSync(path.join(tmpDir, '.parcelrc'), '{}\n');
    const result = detectBundler(tmpDir, { dependencies: {} });
    expect(result.id).toBe('parcel');
  });

  it('prioritizes Next.js over a generic webpack dependency', () => {
    const result = detectBundler(tmpDir, { dependencies: { next: '^14.0.0', webpack: '^5.0.0' } });
    expect(result.id).toBe('next');
  });

  it('prioritizes Create React App over a generic webpack dependency', () => {
    const result = detectBundler(tmpDir, { dependencies: { 'react-scripts': '5.0.1', webpack: '^5.0.0' } });
    expect(result.id).toBe('cra');
  });
});
