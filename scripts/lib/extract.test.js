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

describe('extractProps -- quoted property names (#780)', () => {
  // `'aria-label': string` is a string-literal property name, not an
  // identifier, and the extractor's `ts.isIdentifier(member.name)` filter
  // dropped it: Progress and Meter's one required prop never reached the
  // manifest, so an AI reading it never learned a name is required.
  it.each(['Progress', 'Meter'])('%s lists its required quoted aria-label prop', name => {
    const component = readCommittedManifest().components.find(c => c.name === name);

    expect(component.props['aria-label']).toMatchObject({ type: 'string', required: true });
    expect(component.props['aria-label'].description).toMatch(/\S/);
  });

  it('every component that declares a quoted prop in source has it in the manifest', () => {
    const quoted = /^\s+'([a-z][\w-]*)'\??:/gm;
    const manifest = readCommittedManifest();
    const missing = [];
    for (const component of manifest.components) {
      const dir = path.resolve(process.cwd(), 'src', 'components', component.name);
      const file = fs.existsSync(path.join(dir, `${component.name}.tsx`)) ? path.join(dir, `${component.name}.tsx`) : null;
      if (!file) continue;
      const source = fs.readFileSync(file, 'utf-8');
      const props = source.slice(source.indexOf(`export interface ${component.name}Props`));
      const end = props.indexOf('\n}\n');
      for (const [, key] of (end > 0 ? props.slice(0, end) : props).matchAll(quoted)) {
        if (!(key in component.props)) missing.push(`${component.name}.${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
