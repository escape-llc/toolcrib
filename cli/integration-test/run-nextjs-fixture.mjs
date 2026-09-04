// Real Next.js App Router smoke build: copies nextjs-fixture/ to a temp
// dir, layers in the repo's own demo/App.tsx as the fixture's page content
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
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const FIXTURE_SRC = path.join(__dirname, 'nextjs-fixture');
const CLI_ENTRY = path.join(__dirname, '../src/index.js');

const env = {
  ...process.env,
  TOOLCRIB_API_BASE: process.env.TOOLCRIB_API_BASE ?? 'http://localhost:9999/api',
  TOOLCRIB_RELEASES_BASE: process.env.TOOLCRIB_RELEASES_BASE ?? 'http://localhost:9999/releases',
};

function run(cmd, args, cwd) {
  console.log(`\n$ ${cmd} ${args.join(' ')}  (cwd: ${cwd})`);
  if (cmd === 'node') {
    execFileSync(cmd, args, { cwd, env, stdio: 'inherit' });
    return;
  }
  // npm/npx resolve to .cmd shims on Windows -- spawning a .cmd file
  // directly (even by name) fails with EINVAL; it can only be run through
  // a shell (see AGENTS.md's PowerShell-gotchas section). execSync's
  // single command-line string is the documented-safe way to do that,
  // vs. execFileSync's shell:true + args array, which triggers Node's own
  // DEP0190 warning about unescaped argument concatenation.
  const quotedArgs = args.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a));
  execSync([cmd, ...quotedArgs].join(' '), { cwd, env, stdio: 'inherit' });
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-nextjs-fixture-'));
console.log(`Fixture working directory: ${tmpDir}`);

try {
  fs.cpSync(FIXTURE_SRC, tmpDir, { recursive: true });

  // Layer the real demo source in as this fixture's page content. The icon
  // is served from public/ as a plain URL string instead of kept as a
  // relative asset import: Vite's default PNG import yields a string, but
  // Next.js's yields a StaticImageData object, which fails typechecking
  // against demo/App.tsx's own <img src={toolcribIcon}> (a string prop) --
  // a real Vite/Next.js static-asset difference, not an RSC one. Only the
  // copy is rewritten; demo/App.tsx itself is untouched.
  const ICON_IMPORT = "import toolcribIcon from './toolcrib-256x256.png';";
  const demoAppSrc = fs
    .readFileSync(path.join(REPO_ROOT, 'demo/App.tsx'), 'utf-8')
    .replace(ICON_IMPORT, "const toolcribIcon = '/toolcrib-256x256.png';");
  if (!demoAppSrc.includes("const toolcribIcon = '/toolcrib-256x256.png';")) {
    throw new Error(
      `demo/App.tsx no longer contains the expected icon import (${ICON_IMPORT}) -- update this script's replacement to match.`
    );
  }
  fs.writeFileSync(path.join(tmpDir, 'app/DemoApp.tsx'), `'use client';\n\n${demoAppSrc}`);
  fs.copyFileSync(path.join(REPO_ROOT, 'demo/index.css'), path.join(tmpDir, 'app/demo.css'));
  fs.mkdirSync(path.join(tmpDir, 'public'), { recursive: true });
  fs.copyFileSync(
    path.join(REPO_ROOT, 'demo/toolcrib-256x256.png'),
    path.join(tmpDir, 'public/toolcrib-256x256.png')
  );
  fs.writeFileSync(
    path.join(tmpDir, 'app/page.tsx'),
    "import DemoApp from './DemoApp';\n\nexport default function Page() {\n  return <DemoApp />;\n}\n"
  );

  run('node', [CLI_ENTRY, 'init'], tmpDir);
  run('node', [CLI_ENTRY, 'apply'], tmpDir);
  run('npm', ['install'], tmpDir);
  run('npx', ['next', 'build'], tmpDir);

  console.log('\nNext.js App Router smoke build succeeded.');
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
