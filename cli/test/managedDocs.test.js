import { describe, it, expect } from 'vitest';
import {
  buildManagedBlock,
  extractManagedBlock,
  upsertManagedBlock,
  listManagedBlocks,
} from '../src/lib/managedDocs.js';

describe('buildManagedBlock', () => {
  it('wraps content in versioned start/end fence comments', () => {
    const block = buildManagedBlock('core', '0.1.0', 'Hello world');
    expect(block.startsWith('<!-- toolcrib:managed:core:start version=0.1.0 -->\n')).toBe(true);
    expect(block).toContain('Hello world');
    expect(block.endsWith('<!-- toolcrib:managed:core:end -->\n')).toBe(true);
    // Round-trip through extraction — the source of truth for "does this
    // actually work," not a hardcoded string that'd break every time the
    // banner wording changes.
    expect(extractManagedBlock(block, 'core')).toMatchObject({ version: '0.1.0', content: 'Hello world' });
  });

  it('includes a "do not edit" banner that extraction strips back out', () => {
    const block = buildManagedBlock('core', '0.1.0', 'Hello world');
    expect(block).toMatch(/do not edit/i);
    expect(extractManagedBlock(block, 'core').content).not.toMatch(/do not edit/i);
  });

  it('trims trailing whitespace from content before fencing', () => {
    const block = buildManagedBlock('core', '0.1.0', 'Hello world\n\n\n');
    expect(block).toContain('Hello world\n<!-- toolcrib:managed:core:end -->');
  });
});

describe('extractManagedBlock', () => {
  it('returns null when no block for this docId exists', () => {
    expect(extractManagedBlock('# My AGENTS.md\n\nSome instructions.\n', 'core')).toBeNull();
  });

  it('extracts version and content from an existing block', () => {
    const fileContent = '# My AGENTS.md\n\n' + buildManagedBlock('core', '0.2.0', 'Core rules here.');
    const block = extractManagedBlock(fileContent, 'core');
    expect(block).toMatchObject({ version: '0.2.0', content: 'Core rules here.' });
  });

  it('does not match a different docId\'s block', () => {
    const fileContent = buildManagedBlock('new-app', '0.1.0', 'New app notes.');
    expect(extractManagedBlock(fileContent, 'core')).toBeNull();
  });

  it('extracts the right block when multiple docIds are present', () => {
    const fileContent =
      buildManagedBlock('core', '0.1.0', 'Core content.') +
      '\n' +
      buildManagedBlock('refactor-app', '0.1.0', 'Refactor content.');
    expect(extractManagedBlock(fileContent, 'core')?.content).toBe('Core content.');
    expect(extractManagedBlock(fileContent, 'refactor-app')?.content).toBe('Refactor content.');
  });
});

describe('upsertManagedBlock', () => {
  it('appends a new block to an empty file', () => {
    const result = upsertManagedBlock('', 'core', '0.1.0', 'Core rules.');
    expect(result).toBe(buildManagedBlock('core', '0.1.0', 'Core rules.'));
  });

  it('appends a new block after existing hand-written content', () => {
    const result = upsertManagedBlock('# My instructions\n\nDo the thing.\n', 'core', '0.1.0', 'Core rules.');
    expect(result).toBe(
      '# My instructions\n\nDo the thing.\n\n' + buildManagedBlock('core', '0.1.0', 'Core rules.')
    );
  });

  it('replaces only the matching block, preserving everything else', () => {
    const original =
      '# My instructions\n\n' +
      buildManagedBlock('core', '0.1.0', 'Old core rules.') +
      '\nMy own hand-written note in the middle.\n\n' +
      buildManagedBlock('new-app', '0.1.0', 'New app notes.');

    const result = upsertManagedBlock(original, 'core', '0.2.0', 'New core rules.');

    expect(result).toContain('My own hand-written note in the middle.');
    expect(extractManagedBlock(result, 'core')).toMatchObject({ version: '0.2.0', content: 'New core rules.' });
    expect(extractManagedBlock(result, 'new-app')).toMatchObject({ version: '0.1.0', content: 'New app notes.' });
  });

  it('is idempotent: upserting identical content twice produces the same result', () => {
    const once = upsertManagedBlock('# Instructions\n', 'core', '0.1.0', 'Rules.');
    const twice = upsertManagedBlock(once, 'core', '0.1.0', 'Rules.');
    expect(twice).toBe(once);
  });
});

describe('listManagedBlocks', () => {
  it('returns an empty array when no managed blocks are present', () => {
    expect(listManagedBlocks('# Just my own instructions.\n')).toEqual([]);
  });

  it('lists every managed docId present, each with its version and content', () => {
    const fileContent =
      buildManagedBlock('core', '0.1.0', 'Core.') + '\n' + buildManagedBlock('new-app', '0.2.0', 'New app.');
    const blocks = listManagedBlocks(fileContent);
    expect(blocks).toHaveLength(2);
    expect(blocks).toContainEqual(expect.objectContaining({ docId: 'core', version: '0.1.0', content: 'Core.' }));
    expect(blocks).toContainEqual(
      expect.objectContaining({ docId: 'new-app', version: '0.2.0', content: 'New app.' })
    );
  });
});
