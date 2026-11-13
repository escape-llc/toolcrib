import { describe, it, expect } from 'vitest';
import { mergeThreeWay, mergeThreeWayJs, isBinaryBuffer, detectEol, toEol } from '../src/lib/lineMerge.js';

const lines = (n, edit = {}) =>
  Array.from({ length: n }, (_, i) => `${edit[i + 1] ?? `line ${i + 1}`}\n`).join('');

// Each fixture is run through real `git merge-file` and through the JS
// fallback; both must agree on clean-vs-conflict and on the exact output.
const FIXTURES = {
  'far-apart edits merge cleanly': {
    base: lines(20),
    ours: lines(20, { 2: 'ours two' }),
    theirs: lines(20, { 18: 'theirs eighteen' }),
    conflicts: 0,
    merged: lines(20, { 2: 'ours two', 18: 'theirs eighteen' }),
  },
  'overlapping edits conflict with markers': {
    base: lines(10),
    ours: lines(10, { 5: 'ours five' }),
    theirs: lines(10, { 5: 'theirs five' }),
    conflicts: 1,
    contains: ['<<<<<<< local\nours five\n=======\ntheirs five\n>>>>>>> v2.0.0\n'],
  },
  'identical edits on both sides resolve': {
    base: lines(8),
    ours: lines(8, { 4: 'same' }),
    theirs: lines(8, { 4: 'same' }),
    conflicts: 0,
    merged: lines(8, { 4: 'same' }),
  },
  'adjacent edits conflict (touching hunks)': {
    base: lines(8),
    ours: lines(8, { 3: 'ours three' }),
    theirs: lines(8, { 4: 'theirs four' }),
    conflicts: 1,
  },
  'insertion on one side, edit far away on the other': {
    base: lines(12),
    ours: 'inserted at top\n' + lines(12),
    theirs: lines(12, { 11: 'theirs eleven' }),
    conflicts: 0,
    merged: 'inserted at top\n' + lines(12, { 11: 'theirs eleven' }),
  },
  'deletion on one side, edit far away on the other': {
    base: lines(12),
    ours: lines(12).replace('line 2\n', ''),
    theirs: lines(12, { 11: 'theirs eleven' }),
    conflicts: 0,
    merged: lines(12, { 11: 'theirs eleven' }).replace('line 2\n', ''),
  },
  'add/add with an empty base conflicts, sharing lines stay outside the markers': {
    base: '',
    ours: 'a\nb\nours\nz\n',
    theirs: 'a\nb\ntheirs\nz\n',
    conflicts: 1,
    merged: 'a\nb\n<<<<<<< local\nours\n=======\ntheirs\n>>>>>>> v2.0.0\nz\n',
  },
  'add/add with identical content resolves': {
    base: '',
    ours: 'same\n',
    theirs: 'same\n',
    conflicts: 0,
    merged: 'same\n',
  },
  'edit at the end of a file without a trailing newline': {
    base: 'a\nb\nc',
    ours: 'a\nb\nc\nd',
    theirs: 'A\nb\nc',
    conflicts: 0,
    merged: 'A\nb\nc\nd',
  },
};

describe.each(['git', 'js'])('mergeThreeWay (%s engine)', (engine) => {
  it.each(Object.entries(FIXTURES))('%s', async (_name, f) => {
    const result = await mergeThreeWay(f, { engine, newLabel: 'v2.0.0' });
    expect(result.engine).toBe(engine);
    expect(result.conflicts).toBe(f.conflicts);
    if (f.merged !== undefined) expect(result.merged).toBe(f.merged);
    for (const s of f.contains ?? []) expect(result.merged).toContain(s);
  });
});

describe('JS fallback parity with git merge-file', () => {
  it.each(Object.entries(FIXTURES))('%s: identical output', async (_name, f) => {
    const git = await mergeThreeWay(f, { engine: 'git', newLabel: 'v2.0.0' });
    const js = mergeThreeWayJs(f.base, f.ours, f.theirs, { ours: 'local', theirs: 'v2.0.0' });
    expect(git.engine).toBe('git');
    expect(js.conflicts).toBe(git.conflicts);
    expect(js.merged).toBe(git.merged);
  });
});

describe('isBinaryBuffer', () => {
  it('flags a NUL byte', () => {
    expect(isBinaryBuffer(Buffer.from([0x61, 0x00, 0x62]))).toBe(true);
  });
  it('flags invalid UTF-8', () => {
    expect(isBinaryBuffer(Buffer.from([0xff, 0xfe, 0x41]))).toBe(true);
  });
  it('accepts ordinary and multibyte UTF-8 text, with or without a BOM', () => {
    expect(isBinaryBuffer(Buffer.from('plain\n', 'utf8'))).toBe(false);
    expect(isBinaryBuffer(Buffer.from('café — ok', 'utf8'))).toBe(false);
    expect(isBinaryBuffer(Buffer.from('﻿bom text', 'utf8'))).toBe(false);
  });
});

describe('EOL helpers', () => {
  it('detects CRLF by majority and round-trips through toEol', () => {
    expect(detectEol('a\r\nb\r\n')).toBe('crlf');
    expect(detectEol('a\nb\n')).toBe('lf');
    expect(detectEol('a\r\nb\nc\n')).toBe('lf');
    expect(detectEol('no newline')).toBe('lf');
    expect(toEol('a\nb\n', 'crlf')).toBe('a\r\nb\r\n');
    expect(toEol('a\nb\n', 'lf')).toBe('a\nb\n');
  });
});
