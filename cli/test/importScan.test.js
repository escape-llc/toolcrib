import { describe, it, expect } from 'vitest';
import { stripComments, extractImports, resolveRelativeImport } from '../src/lib/importScan.js';

describe('extractImports', () => {
  it.each([
    ["import X from 'a';", ['a']],
    ['import { a, b } from "b";', ['b']],
    ["import * as n from 'c';", ['c']],
    ["import {\n  a,\n  b\n} from 'd';", ['d']],
    ["import type { T } from 'e';", ['e']],
    ["export type { T } from 'f';", ['f']],
    ["export { x } from 'g';", ['g']],
    ["export * from 'h';", ['h']],
    ["export * as ns from 'i';", ['i']],
    ["import 'j';", ['j']],
    ["const m = await import('k');", ['k']],
    ['const m = import("l");', ['l']],
    ['const m = import(variable);', []],
  ])('finds the specifier(s) in %j', (source, expected) => {
    expect(extractImports(source)).toEqual(expected);
  });

  it('returns specifiers in source order', () => {
    const source = "import a from 'first';\nexport * from 'second';\nconst x = import('third');";
    expect(extractImports(source)).toEqual(['first', 'second', 'third']);
  });

  it('ignores an import inside a line comment', () => {
    expect(extractImports("// import x from 'commented';\nimport y from 'real';")).toEqual(['real']);
  });

  it('ignores an import inside a block comment', () => {
    expect(extractImports("/* import x from 'blocked';\n */\nimport y from 'real';")).toEqual(['real']);
  });

  it('does not treat // inside a string as a comment', () => {
    const source = "const u = 'https://x.test/a';\nimport z from 'after-url';";
    expect(extractImports(source)).toEqual(['after-url']);
  });

  it('does not treat /* inside a string as a comment', () => {
    const source = 'const s = "a /* not a comment";\nimport w from \'after-block-str\';';
    expect(extractImports(source)).toEqual(['after-block-str']);
  });

  it('does not treat // inside a template literal as a comment', () => {
    const source = 'const t = `http://x // not comment ${1}`;\nimport v from \'after-template\';';
    expect(extractImports(source)).toEqual(['after-template']);
  });
});

describe('stripComments', () => {
  it('removes a line comment and keeps the string literal before it', () => {
    expect(stripComments("const u = 'http://x'; // gone")).toBe("const u = 'http://x'; ");
  });

  it('removes a block comment but keeps its newlines', () => {
    expect(stripComments('a/* x\ny */b')).toBe('a\nb');
  });

  it('leaves a regex literal with escaped slashes intact', () => {
    const source = 'const r = /\\/\\//;\nimport q from \'after-regex\';';
    expect(extractImports(source)).toEqual(['after-regex']);
  });
});

describe('resolveRelativeImport', () => {
  const from = 'components/Card/Card.tsx';
  const existsIn = (...paths) => {
    const set = new Set(paths);
    return (p) => set.has(p);
  };

  it('resolves a sibling file by inferring the extension', () => {
    expect(resolveRelativeImport(from, './Button', existsIn('components/Card/Button.tsx'))).toBe(
      'components/Card/Button.tsx',
    );
  });

  it('prefers .ts over .tsx when both exist (extension order)', () => {
    expect(
      resolveRelativeImport(from, './Button', existsIn('components/Card/Button.tsx', 'components/Card/Button.ts')),
    ).toBe('components/Card/Button.ts');
  });

  it('matches an exact path first', () => {
    expect(resolveRelativeImport(from, './data.json', existsIn('components/Card/data.json'))).toBe(
      'components/Card/data.json',
    );
  });

  it('resolves a parent-directory import with ../', () => {
    expect(resolveRelativeImport(from, '../Shared/util', existsIn('components/Shared/util.ts'))).toBe(
      'components/Shared/util.ts',
    );
  });

  it('resolves an index file in a directory', () => {
    expect(resolveRelativeImport(from, './Modal', existsIn('components/Card/Modal/index.tsx'))).toBe(
      'components/Card/Modal/index.tsx',
    );
  });

  it('normalizes ./ and ../ segments inside the specifier and returns forward slashes', () => {
    const result = resolveRelativeImport(from, './sub/../Button', existsIn('components/Card/Button.tsx'));
    expect(result).toBe('components/Card/Button.tsx');
    expect(result).not.toContain('\\');
  });

  it('returns null for a non-relative specifier', () => {
    expect(resolveRelativeImport(from, 'react', () => true)).toBeNull();
    expect(resolveRelativeImport(from, '#toolcrib', () => true)).toBeNull();
  });

  it('returns null when nothing exists', () => {
    expect(resolveRelativeImport(from, './nope', existsIn())).toBeNull();
  });

  it('returns null when the path escapes the root, even if a file would exist there', () => {
    expect(resolveRelativeImport('Card.tsx', '../x', () => true)).toBeNull();
    expect(resolveRelativeImport('a/b.ts', '../../../x', () => true)).toBeNull();
  });
});
