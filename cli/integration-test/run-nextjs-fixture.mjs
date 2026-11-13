// Real Next.js App Router smoke build: copies nextjs-fixture/ to a temp
// dir, layers in the repo's own demo/ source as the fixture's page content
// (see nextjs-fixture/README.md for why -- same 'use client' whole-graph
// coverage as a dedicated fixture, no second demo to maintain), runs the
// real toolcrib CLI init/apply against a mock GitHub server, npm installs,
// and `next build`s. Exits non-zero on any failure.
//
// Prerequisites (see cli/CONTRIBUTING.md's integration-test section):
//   1. A real release built and packaged at the repo root:
//        node scripts/build-release.js && node scripts/package-release.js
//   2. cli/integration-test/releases/ populated with that zip + checksum:
//        mkdir -p cli/integration-test/releases
//        cp toolcrib.zip toolcrib.zip.sha256 cli/integration-test/releases/
//   3. The mock server running in another process:
//        node cli/integration-test/mock-github-server.js
//
// Usage: node cli/integration-test/run-nextjs-fixture.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import crossSpawn from 'cross-spawn';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const FIXTURE_SRC = path.join(__dirname, 'nextjs-fixture');
const CLI_ENTRY = path.join(__dirname, '../src/index.js');

const env = {
  ...process.env,
  TOOLCRIB_API_BASE: process.env.TOOLCRIB_API_BASE ?? 'http://localhost:9999/api',
  TOOLCRIB_RELEASES_BASE: process.env.TOOLCRIB_RELEASES_BASE ?? 'http://localhost:9999/releases',
};

// npm/npx resolve to .cmd shims on Windows, which Node's own
// execFileSync/spawnSync can't invoke directly (EINVAL) without shell:true
// -- and shell:true plus a hand-built command string is exactly the
// incomplete-escaping shape CodeQL flags (confirmed for real: an earlier
// version of this function did that and tripped a real high-severity
// alert on PR #136, since the naive quoting didn't escape backslashes).
// cross-spawn is the standard fix for this exact, well-known problem (npm
// itself, Jest, and Vite all use it internally) -- it resolves the
// .cmd/.bat shim and encodes arguments correctly for Windows' CreateProcess
// without ever building a shell command string.
function run(cmd, args, cwd) {
  console.log(`\n$ ${cmd} ${args.join(' ')}  (cwd: ${cwd})`);
  // cross-spawn's default export is the *async* spawn() replacement --
  // .sync() is the spawnSync() one (easy to mix up: the async version
  // silently "succeeds" with every result field undefined, since nothing
  // has actually run yet when it returns).
  const result = crossSpawn.sync(cmd, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited with code ${result.status}`);
  }
}

const DEMO_DIR = path.join(REPO_ROOT, 'demo');

// Vite-only demo files that have no place in the Next.js app. Everything
// else under demo/ (*.ts, *.tsx, *.json) is copied automatically, so a new
// demo file doesn't need an edit here -- only a file that can't build under
// Next.js does. Anything copied that imports one of these fails the
// relative-import guard below, loudly.
const EXCLUDED_DEMO_FILES = new Set([
  'main.tsx', // Vite entry point (createRoot); Next's app/page.tsx replaces it.
  'vite-env.d.ts', // Vite's ambient types (import.meta.env, asset imports).
]);

// demo/App.tsx is the page content; page.tsx imports it under this name.
const RENAMED_DEMO_FILES = { 'App.tsx': 'DemoApp.tsx' };

// The icon is served from public/ as a plain URL string instead of kept as a
// relative asset import: Vite's default PNG import yields a string, but
// Next.js's yields a StaticImageData object, which fails typechecking
// against the demo's own <img src={toolcribIcon}> (a string prop) -- a real
// Vite/Next.js static-asset difference, not an RSC one.
const ICON_IMPORT = "import toolcribIcon from './toolcrib-256x256.png';";
const ICON_REPLACEMENT = "const toolcribIcon = '/toolcrib-256x256.png';";
// The demo reads the generated component manifest from ai-docs/, a relative
// path that doesn't exist from app/; the manifest is copied next to the demo
// files and the import repointed at the copy.
const MANIFEST_IMPORT = "import manifest from '../ai-docs/component-manifest.json';";
const MANIFEST_REPLACEMENT = "import manifest from './component-manifest.json';";

// Files that must keep containing a rewritten import: a silent no-op rewrite
// there would only surface as an obscure Next.js build error.
const REQUIRED_REWRITES = {
  'App.tsx': { find: ICON_IMPORT, label: 'icon' },
  'Catalog.tsx': { find: MANIFEST_IMPORT, label: 'manifest' },
  'stateExamples.tsx': { find: MANIFEST_IMPORT, label: 'manifest' },
};

// Static `import ... from './x'`, side-effect `import './x'` and
// `export ... from './x'` with a relative specifier. Anchored to the start of
// a line so code shown as text (the demo prints sample `export * from './App'`
// lines inside JSX) isn't mistaken for a real import.
const RELATIVE_IMPORT_RES = [
  /^[ \t]*(?:import|export)\s[^'";]*?\bfrom\s*['"](\.{1,2}\/[^'"]*)['"]/gm,
  /^[ \t]*import\s*['"](\.{1,2}\/[^'"]*)['"]/gm,
];

function assertRelativeImportsResolve(appDir, copiedFiles) {
  for (const file of copiedFiles) {
    if (!/\.tsx?$/.test(file)) continue;
    const source = fs.readFileSync(path.join(appDir, file), 'utf-8');
    for (const re of RELATIVE_IMPORT_RES) {
      for (const match of source.matchAll(re)) {
        const specifier = match[1];
        const base = path.resolve(appDir, specifier);
        const resolved = ['', '.ts', '.tsx', '.json'].some((ext) => {
          try {
            return fs.statSync(base + ext).isFile();
          } catch {
            return false;
          }
        });
        if (!resolved) {
          throw new Error(
            `Copied demo file app/${file} imports '${specifier}', which does not exist in the fixture's app/ directory. ` +
              `Add the file to demo/ (so it is copied automatically) or, if it is a Vite-only file, ` +
              `stop importing it from a copied file -- see EXCLUDED_DEMO_FILES in this script.`
          );
        }
      }
    }
  }
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-nextjs-fixture-'));
console.log(`Fixture working directory: ${tmpDir}`);

try {
  fs.cpSync(FIXTURE_SRC, tmpDir, { recursive: true });

  // Layer the real demo source in as this fixture's page content. Only the
  // copies are rewritten; demo/ itself is untouched.
  const appDir = path.join(tmpDir, 'app');
  const copiedFiles = [];
  for (const name of fs.readdirSync(DEMO_DIR).sort()) {
    if (EXCLUDED_DEMO_FILES.has(name)) continue;
    if (!fs.statSync(path.join(DEMO_DIR, name)).isFile()) continue;
    const isSource = /\.tsx?$/.test(name);
    if (!isSource && !name.endsWith('.json')) continue;

    let content = fs.readFileSync(path.join(DEMO_DIR, name), 'utf-8');
    const required = REQUIRED_REWRITES[name];
    if (required && !content.includes(required.find)) {
      throw new Error(
        `demo/${name} no longer contains the expected ${required.label} import (${required.find}) -- update this script's replacement to match.`
      );
    }
    content = content.replaceAll(ICON_IMPORT, ICON_REPLACEMENT).replaceAll(MANIFEST_IMPORT, MANIFEST_REPLACEMENT);

    // A demo file is not vendored source, but it uses hooks/browser APIs and
    // needs the directive to be a Client Component here.
    const outName = RENAMED_DEMO_FILES[name] ?? name;
    fs.writeFileSync(path.join(appDir, outName), isSource ? `'use client';\n\n${content}` : content);
    copiedFiles.push(outName);
  }
  fs.copyFileSync(path.join(REPO_ROOT, 'ai-docs/component-manifest.json'), path.join(appDir, 'component-manifest.json'));
  fs.copyFileSync(path.join(DEMO_DIR, 'index.css'), path.join(appDir, 'demo.css'));
  fs.mkdirSync(path.join(tmpDir, 'public'), { recursive: true });
  fs.copyFileSync(
    path.join(DEMO_DIR, 'toolcrib-256x256.png'),
    path.join(tmpDir, 'public/toolcrib-256x256.png')
  );
  fs.writeFileSync(
    path.join(appDir, 'page.tsx'),
    "import DemoApp from './DemoApp';\n\nexport default function Page() {\n  return <DemoApp />;\n}\n"
  );

  assertRelativeImportsResolve(appDir, copiedFiles);

  run('node', [CLI_ENTRY, 'init'], tmpDir);
  run('node', [CLI_ENTRY, 'apply'], tmpDir);
  run('npm', ['install'], tmpDir);
  run('npx', ['next', 'build'], tmpDir);

  console.log('\nNext.js App Router smoke build succeeded.');
} finally {
  // Never let a cleanup failure (e.g. a lingering file handle on Windows)
  // mask whatever error the try block actually threw -- throwing here
  // would silently replace it in Node's own unwind semantics.
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (cleanupErr) {
    console.error(`Warning: failed to remove ${tmpDir}: ${cleanupErr.message}`);
  }
}
