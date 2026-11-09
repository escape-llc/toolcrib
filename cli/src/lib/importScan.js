/**
 * Dependency-free import scanning, shared by the release build
 * (scripts/build-release.js) and the CLI's own tooling so both see imports
 * identically. Deliberately imports nothing: this file ships inside the
 * published `toolcrib` npm package, and must work with zero dependencies.
 *
 * Pure string handling only. Not a parser: it will not see imports produced
 * by macros, and an import-looking phrase inside a string literal is still
 * matched (comments are the only thing stripped).
 */

/**
 * Remove `//` line comments and `/* *\/` block comments from JS/TS source,
 * leaving string literals ('...', "...", `...`, with backslash escapes)
 * untouched. Newlines inside removed block comments are kept so line
 * structure is roughly preserved. Backslash escapes in code are skipped
 * as a pair so a regex literal like `/\/\//` isn't mistaken for a comment.
 *
 * @param {string} source
 * @returns {string}
 */
export function stripComments(source) {
  const n = source.length;
  let out = '';
  let i = 0;
  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === '/' && next === '/') {
      i += 2;
      while (i < n && source[i] !== '\n') i++;
      continue;
    }

    if (ch === '/' && next === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
      continue;
    }

    if (ch === '\\') {
      out += source.slice(i, i + 2);
      i += 2;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < n && source[j] !== ch) {
        if (source[j] === '\\') {
          j += 2;
          continue;
        }
        // Single/double-quoted strings cannot span lines; stop at the newline
        // so an apostrophe in JSX text can't swallow the rest of the file.
        if (ch !== '`' && source[j] === '\n') break;
        j++;
      }
      j = Math.min(j, n);
      const closed = j < n && source[j] === ch;
      const end = closed ? j + 1 : j;
      out += source.slice(i, end);
      i = end;
      continue;
    }

    out += ch;
    i++;
  }
  return out;
}

/**
 * Module specifiers referenced by a source file, in source order, after
 * comments are stripped. Covers static `import`/`export ... from`, bare
 * side-effect `import 'x'`, `import type`, `export * as ns from`, and
 * dynamic `import('x')` with a string-literal argument.
 *
 * @param {string} source
 * @returns {string[]}
 */
export function extractImports(source) {
  const code = stripComments(source);
  const re = /\b(?:(?:import|export)\s+(?:[^'";]*?\sfrom\s+)?|import\s*\(\s*)['"]([^'"]+)['"]/g;
  const specifiers = [];
  let match;
  while ((match = re.exec(code))) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

/**
 * Resolve a relative import (`./` or `../` only) against the directory of
 * the importing file, trying exact path, then the TS/JS extensions, then
 * index files. Path handling is done by hand with forward slashes, never
 * path.join/resolve, so the result is identical on Windows.
 *
 * @param {string} fromRelPath  importing file, forward-slash, relative to the root (e.g. `components/Card/Card.tsx`)
 * @param {string} specifier    the import specifier as written
 * @param {(relPath: string) => boolean} fileExists  caller-supplied existence check, same root-relative form
 * @returns {string | null} the first existing root-relative path, or null (non-relative, missing, or escaping the root)
 */
export function resolveRelativeImport(fromRelPath, specifier, fileExists) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return null;

  const segments = fromRelPath.split('/').slice(0, -1).filter((s) => s !== '');
  for (const part of specifier.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (segments.length === 0) return null;
      segments.pop();
    } else {
      segments.push(part);
    }
  }

  const base = segments.join('/');
  if (base === '') return null; // `./` alone names the root directory, not a file
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    `${base}/index.js`,
  ];
  for (const candidate of candidates) {
    if (fileExists(candidate)) return candidate;
  }
  return null;
}
