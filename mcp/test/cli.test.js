import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { parseArgs, run } from '../src/lib/cli.js';
import { buildFakeProject, cleanupFakeProject } from './fixtures.js';

describe('parseArgs', () => {
  it('parses --root and its value', () => {
    expect(parseArgs(['--root', './toolcrib'])).toEqual({ root: './toolcrib' });
  });

  it('defaults root to undefined when not given', () => {
    expect(parseArgs([])).toEqual({ root: undefined });
  });

  it('ignores an unrecognized flag rather than misreading it as --root\'s value', () => {
    expect(parseArgs(['--verbose'])).toEqual({ root: undefined });
  });
});

describe('run', () => {
  it('logs a clean message and returns exit code 1 when no vendored install is found, instead of throwing', async () => {
    const log = vi.fn();
    const code = await run(['--root', '/definitely/not/a/toolcrib/install'], { log });
    expect(code).toBe(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('could not find a vendored toolcrib install'));
  });

  it('logs a compatibility warning before "ready" when the vendored version is outside the verified range', async () => {
    let projectRoot;
    try {
      ({ projectRoot } = buildFakeProject({ version: '0.99.0' }));
      const vendoredRoot = path.join(projectRoot, 'toolcrib');
      const [, serverTransport] = InMemoryTransport.createLinkedPair();
      const log = vi.fn();
      await run(['--root', vendoredRoot], { log, transport: serverTransport });
      expect(log).toHaveBeenCalledWith(expect.stringContaining('0.99.0'));
      expect(log).toHaveBeenCalledWith('toolcrib-mcp: ready.');
    } finally {
      if (projectRoot) cleanupFakeProject(projectRoot);
    }
  });

  it('connects the server over the given transport, logs ready, and returns exit code 0', async () => {
    let projectRoot;
    try {
      ({ projectRoot } = buildFakeProject());
      const vendoredRoot = path.join(projectRoot, 'toolcrib');
      const [, serverTransport] = InMemoryTransport.createLinkedPair();
      const log = vi.fn();
      const code = await run(['--root', vendoredRoot], { log, transport: serverTransport });
      expect(code).toBe(0);
      expect(log).toHaveBeenCalledWith('toolcrib-mcp: ready.');
    } finally {
      if (projectRoot) cleanupFakeProject(projectRoot);
    }
  });
});
