import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Builds a real temp directory shaped like a consumer project with a
 * vendored toolcrib install: `<root>/toolcrib/.toolcrib-lock.json` plus a
 * minimal but realistic `ai-docs/` tree. Mirrors cli/test's fake-project-
 * directory pattern (real fs.mkdtempSync, not mocked fs) so the code under
 * test exercises real file I/O.
 */
export function buildFakeProject({ version = '0.12.0', withTests = false } = {}) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-mcp-test-'));
  const vendoredRoot = path.join(projectRoot, 'toolcrib');
  const aiDocsRoot = path.join(vendoredRoot, 'ai-docs');
  const examplesDir = path.join(aiDocsRoot, 'examples');
  fs.mkdirSync(examplesDir, { recursive: true });

  fs.writeFileSync(
    path.join(vendoredRoot, '.toolcrib-lock.json'),
    JSON.stringify(withTests ? { version, testsVersion: version } : { version })
  );

  // A real vendored install always sits alongside the consumer's own
  // package.json (one directory up) -- written here so tests exercising
  // anything that reads it (e.g. get_test_dependencies_patch) have a real
  // file to find, the same "real fs, not mocked" principle this fixture
  // already follows for everything else.
  fs.writeFileSync(
    path.join(projectRoot, 'package.json'),
    JSON.stringify({ name: 'fake-consumer-app', dependencies: { react: '^19.0.0' } }, null, 2) + '\n'
  );

  // --with-tests-shaped install: real, if minimal, __tests__/ content plus
  // the sibling .toolcrib-tests-config.json (see cli/src/commands/init.js's
  // step 4b) -- only written when a test explicitly asks for it, matching
  // the feature's own opt-in shape.
  if (withTests) {
    const testsDir = path.join(vendoredRoot, '__tests__');
    fs.mkdirSync(path.join(testsDir, 'testUtils'), { recursive: true });
    fs.writeFileSync(path.join(testsDir, 'Button.test.tsx'), "import { Button } from '#toolcrib';\nexpect(1).toBe(1);\n");
    fs.writeFileSync(path.join(testsDir, 'testUtils', 'axe.ts'), 'export const axe = {};\n');
    fs.writeFileSync(
      path.join(vendoredRoot, '.toolcrib-tests-config.json'),
      JSON.stringify({
        version,
        requiresToolkitVersion: version,
        peerDependencies: { vitest: '^4.0.0', '@testing-library/react': '^16.0.0' },
      })
    );
  }

  const manifest = {
    $schema: 'https://example.test/schema',
    name: 'toolcrib',
    version,
    themeSystem: { colorSpace: 'HSV', supportedHarmonies: ['analogous', 'complementary'], cssVariables: ['--ai-color-primary'], slices: ['CardSlice'] },
    zIndexScale: { MODAL: 200 },
    eventBus: {
      singleton: 'aiBus',
      hookName: 'useAIEvent',
      channels: [
        { name: 'modal:shown', payload: '{ id: string }' },
        { name: 'modal:hidden', payload: '{ id: string }' },
      ],
      helperMethods: ['openModal', 'closeModal'],
    },
    components: [
      {
        name: 'Modal',
        import: "import { Modal } from '#toolcrib'",
        category: 'Overlays',
        description: 'Dialog overlay with focus trap, backdrop, and slot composition',
        props: { isOpen: { type: 'boolean', required: false } },
        slots: ['Header', 'Body'],
      },
      {
        name: 'AlertDialog',
        import: "import { AlertDialog } from '#toolcrib'",
        category: 'Overlays',
        description: 'Blocking confirmation dialog that cannot be light-dismissed',
        props: { isOpen: { type: 'boolean', required: false } },
      },
      {
        name: 'Card',
        import: "import { Card } from '#toolcrib'",
        category: 'Containers',
        description: 'Slot-based container with automatic layout domain corner squaring',
        props: {},
      },
    ],
  };
  fs.writeFileSync(path.join(aiDocsRoot, 'component-manifest.json'), JSON.stringify(manifest));

  const coreMd = [
    '# Toolcrib — Core Reference & System Prompt',
    '',
    '> Reading strategy callout.',
    '',
    '## 1. Root Setup',
    '',
    'Wrap your app root in `<ToolcribProvider>`.',
    '',
    '## 2. Core Principles',
    '',
    'No prop-drilling.',
    '',
    '### Overlays',
    '',
    'Full prop detail: ai-docs/manifest/overlays.json',
  ].join('\n');
  fs.writeFileSync(path.join(aiDocsRoot, 'CORE.md'), coreMd);

  fs.writeFileSync(
    path.join(examplesDir, 'router-integration.md'),
    '# Router Integration\n\nBridge aiBus navigate events to a real router.\n'
  );

  return { projectRoot, vendoredRoot };
}

export function cleanupFakeProject(projectRoot) {
  fs.rmSync(projectRoot, { recursive: true, force: true });
}
