import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { checkRootProviderWired } from '../src/lib/rootProvider.js';

describe('checkRootProviderWired', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeSrcFile(relPath, content) {
    const full = path.join(tmpDir, 'src', relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }

  it('reports not found when there is no src/ directory at all', () => {
    expect(checkRootProviderWired(tmpDir)).toEqual({ found: false, via: null });
  });

  it('reports not found when src/ exists but wires nothing', () => {
    writeSrcFile('App.tsx', 'export const App = () => <div>hello</div>;\n');
    expect(checkRootProviderWired(tmpDir)).toEqual({ found: false, via: null });
  });

  it('finds <ToolcribProvider> directly', () => {
    writeSrcFile(
      'main.tsx',
      "import { ToolcribProvider } from '#toolcrib';\n<ToolcribProvider><App /></ToolcribProvider>;\n"
    );
    expect(checkRootProviderWired(tmpDir)).toEqual({ found: true, via: 'ToolcribProvider' });
  });

  it('finds the manual three-provider composition when all three are present', () => {
    writeSrcFile(
      'main.tsx',
      '<ThemeProvider><ToastProvider><App /><ToastContainer /></ToastProvider></ThemeProvider>;\n'
    );
    expect(checkRootProviderWired(tmpDir)).toEqual({ found: true, via: 'manual' });
  });

  it('does not report the manual composition found when only two of the three are present', () => {
    writeSrcFile('main.tsx', '<ThemeProvider><ToastProvider><App /></ToastProvider></ThemeProvider>;\n');
    expect(checkRootProviderWired(tmpDir)).toEqual({ found: false, via: null });
  });

  it('recognizes the manual composition split across multiple files', () => {
    writeSrcFile('providers/Theme.tsx', '<ThemeProvider>{children}</ThemeProvider>;\n');
    writeSrcFile('providers/Toast.tsx', '<ToastProvider>{children}<ToastContainer /></ToastProvider>;\n');
    expect(checkRootProviderWired(tmpDir)).toEqual({ found: true, via: 'manual' });
  });

  it('ignores node_modules entirely, even if it contains matching text', () => {
    const nodeModulesFile = path.join(tmpDir, 'src', 'node_modules', 'some-lib', 'index.js');
    fs.mkdirSync(path.dirname(nodeModulesFile), { recursive: true });
    fs.writeFileSync(nodeModulesFile, '<ToolcribProvider>');
    expect(checkRootProviderWired(tmpDir)).toEqual({ found: false, via: null });
  });

  it('ignores the vendored toolcrib/ directory itself, whose own source legitimately mentions these', () => {
    writeSrcFile('../toolcrib/theme/themeContext.tsx', 'export const ThemeProvider = () => null;\n');
    // (checkRootProviderWired scans from <root>/src when present; this
    // file lives at <root>/toolcrib, outside src/, so this case mainly
    // documents that the vendored dir is excluded even if a project's
    // layout put src/ at the root alongside it.)
    fs.mkdirSync(path.join(tmpDir, 'toolcrib'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'toolcrib', 'demo.tsx'),
      '<ThemeProvider><ToastProvider><ToastContainer /></ToastProvider></ThemeProvider>;\n'
    );
    expect(checkRootProviderWired(tmpDir)).toEqual({ found: false, via: null });
  });

  it('falls back to scanning the project root when there is no src/ directory', () => {
    fs.writeFileSync(path.join(tmpDir, 'main.jsx'), '<ToolcribProvider><App /></ToolcribProvider>;\n');
    expect(checkRootProviderWired(tmpDir)).toEqual({ found: true, via: 'ToolcribProvider' });
  });
});
