import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// Reads the committed manifest directly rather than importing extract.js's
// own generator functions -- under Vitest's Vite-based transform,
// extract.js's `import.meta.url`-based ROOT resolution throws ("The URL
// must be of scheme file"), the same cross-tool quirk toon.test.js's own
// comment documents. `npm test`/`vitest run` always run from the repo
// root, so process.cwd() is a safe, simple anchor here.
function readCommittedManifest() {
  const manifestPath = path.resolve(process.cwd(), 'ai-docs', 'component-manifest.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
}

describe('findComponentDeclarations -- React.forwardRef prop extraction', () => {
  // Regression test for a real bug: `export const Button = React.forwardRef<
  // Elem, ButtonProps>(...)` has no type annotation on the variable itself
  // (the props type lives in the forwardRef call's own type arguments), so
  // the extractor's `propsInterfaceNameFromType(decl.type)` alone always
  // returned null for it -- Button's manifest entry had a description but
  // a completely empty props table, silently, for every prop including
  // `size`. Fixed by also checking a forwardRef call initializer's second
  // type argument when the declaration itself has no type annotation.
  it('extracts a forwardRef-declared component\'s props (Button), not just React.FC-declared ones', () => {
    const manifest = readCommittedManifest();
    const button = manifest.components.find(c => c.name === 'Button');

    expect(button).toBeDefined();
    expect(button.props).toBeDefined();
    expect(Object.keys(button.props).length).toBeGreaterThan(0);
    expect(button.props.size).toEqual({
      type: "'sm' | 'md' | 'lg'",
      default: "'md'",
      description: 'Button size controlling padding and font-size.',
    });
    expect(button.props.variant).toBeDefined();
    expect(button.props.subtheme).toBeDefined();
  });
});
