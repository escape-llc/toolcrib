import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { computeSchemaFingerprint } from '../src/lib/schemaFingerprint.js';
import { buildFakeProject, cleanupFakeProject } from './fixtures.js';

describe('computeSchemaFingerprint', () => {
  let projectRoot;

  afterEach(() => cleanupFakeProject(projectRoot));

  it('is deterministic — the same real content produces the same fingerprint every time', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    expect(computeSchemaFingerprint(built.vendoredRoot)).toBe(computeSchemaFingerprint(built.vendoredRoot));
  });

  it('is unaffected by ordinary content growth — more components/channels/examples with the same real shape', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    const before = computeSchemaFingerprint(built.vendoredRoot);

    const manifestPath = path.join(built.vendoredRoot, 'ai-docs', 'component-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.components.push({ name: 'Toast', category: 'Overlays', description: 'Transient notification.', props: {} });
    manifest.eventBus.channels.push({ name: 'toast:shown', payload: '{ id: string }' });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    fs.writeFileSync(
      path.join(built.vendoredRoot, 'ai-docs', 'examples', 'second-example.md'),
      '# Second Example\n\nSome real content here.\n'
    );

    expect(computeSchemaFingerprint(built.vendoredRoot)).toBe(before);
  });

  it('is unaffected by real structural additions this server never reads ($defs, manifestSplit, constraints)', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    const before = computeSchemaFingerprint(built.vendoredRoot);

    const manifestPath = path.join(built.vendoredRoot, 'ai-docs', 'component-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.$defs = { SomeType: { type: 'string' } };
    manifest.manifestSplit = { categories: ['Overlays'] };
    manifest.components[0].constraints = 'Requires exactly 2 children';
    manifest.components[0].props = { extra: { type: 'string' } };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    expect(computeSchemaFingerprint(built.vendoredRoot)).toBe(before);
  });

  it('changes when a component is missing name/category/description', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    const before = computeSchemaFingerprint(built.vendoredRoot);

    const manifestPath = path.join(built.vendoredRoot, 'ai-docs', 'component-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    delete manifest.components[0].category;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    expect(computeSchemaFingerprint(built.vendoredRoot)).not.toBe(before);
  });

  it('changes when an event channel is missing name', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    const before = computeSchemaFingerprint(built.vendoredRoot);

    const manifestPath = path.join(built.vendoredRoot, 'ai-docs', 'component-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    delete manifest.eventBus.channels[0].name;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    expect(computeSchemaFingerprint(built.vendoredRoot)).not.toBe(before);
  });

  it('changes when a CORE.md heading is renamed', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    const before = computeSchemaFingerprint(built.vendoredRoot);

    const corePath = path.join(built.vendoredRoot, 'ai-docs', 'CORE.md');
    const core = fs.readFileSync(corePath, 'utf8').replace('## 1. Root Setup', '## 1. Getting Started');
    fs.writeFileSync(corePath, core);

    expect(computeSchemaFingerprint(built.vendoredRoot)).not.toBe(before);
  });

  it('is unaffected by more prose under an existing CORE.md heading — content growth, not a heading change', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    const before = computeSchemaFingerprint(built.vendoredRoot);

    const corePath = path.join(built.vendoredRoot, 'ai-docs', 'CORE.md');
    const core = fs.readFileSync(corePath, 'utf8') + '\n\nSome more real prose added under the last existing heading.\n';
    fs.writeFileSync(corePath, core);

    expect(computeSchemaFingerprint(built.vendoredRoot)).toBe(before);
  });

  it('changes when an example file has only a heading, no real content line', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    const before = computeSchemaFingerprint(built.vendoredRoot);

    fs.writeFileSync(path.join(built.vendoredRoot, 'ai-docs', 'examples', 'empty-example.md'), '# Just A Heading\n');

    expect(computeSchemaFingerprint(built.vendoredRoot)).not.toBe(before);
  });

  it('does not throw when the examples/ directory does not exist at all', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    fs.rmSync(path.join(built.vendoredRoot, 'ai-docs', 'examples'), { recursive: true, force: true });

    expect(() => computeSchemaFingerprint(built.vendoredRoot)).not.toThrow();
  });

  it('throws when component-manifest.json itself is missing (a real, distinct failure the caller must handle)', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    fs.rmSync(path.join(built.vendoredRoot, 'ai-docs', 'component-manifest.json'));

    expect(() => computeSchemaFingerprint(built.vendoredRoot)).toThrow();
  });

  it('does not throw when components is missing from the manifest entirely, rather than just empty', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    const manifestPath = path.join(built.vendoredRoot, 'ai-docs', 'component-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    delete manifest.components;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    expect(() => computeSchemaFingerprint(built.vendoredRoot)).not.toThrow();
  });

  it('does not throw when eventBus.channels is missing from the manifest entirely', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    const manifestPath = path.join(built.vendoredRoot, 'ai-docs', 'component-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    delete manifest.eventBus.channels;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    expect(() => computeSchemaFingerprint(built.vendoredRoot)).not.toThrow();
  });
});
