// The real end-to-end Windows integration test .plans/toolcrib-defect-
// pindown-plan.md's P0.4 item was waiting on: every historical Windows
// bug in this CLI (CRLF-vs-LF breaking git apply, backslash path
// separators, a UTF-8 BOM breaking JSON.parse -- see AGENTS.md's
// PowerShell-gotchas section) was found by someone running the real
// pipeline by hand on a real Windows machine, because ubuntu-latest CI
// cannot reproduce any of it structurally. This automates that: a real
// toolcrib init/apply, against a real mock GitHub server, on whatever git
// config/line-ending behavior the actual Windows host has (nothing here
// forces CRLF or LF -- the point is to observe what a real Windows git
// checkout naturally does and confirm toolcrib handles it correctly
// either way).
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
// Usage: node cli/integration-test/run-windows-integration.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import crossSpawn from 'cross-spawn';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ENTRY = path.join(__dirname, '../src/index.js');

const env = {
  ...process.env,
  TOOLCRIB_API_BASE: process.env.TOOLCRIB_API_BASE ?? 'http://localhost:9999/api',
  TOOLCRIB_RELEASES_BASE: process.env.TOOLCRIB_RELEASES_BASE ?? 'http://localhost:9999/releases',
};

function run(args, cwd) {
  console.log(`\n$ node cli/src/index.js ${args.join(' ')}  (cwd: ${cwd})`);
  const result = crossSpawn.sync('node', [CLI_ENTRY, ...args], { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`toolcrib ${args.join(' ')} exited with code ${result.status}`);
  }
}

// A UTF-8 BOM prefix on the target project's own package.json --
// PowerShell's `Out-File`/`>` redirection adds this by default (unless
// `-Encoding utf8NoBOM` is given), so a Windows user hand-editing
// package.json via PowerShell is a realistic, not contrived, way to end
// up with one. This is the exact shape of the historical "BOM breaks
// JSON.parse outright" bug (see project.js's/release.js's stripBOM).
const BOM = '﻿';

function assertNoBOM(filePath) {
  const buf = fs.readFileSync(filePath);
  assert.ok(
    !(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf),
    `${filePath} starts with a UTF-8 BOM -- something re-wrote it without stripping the one this test deliberately introduced, or introduced a new one.`
  );
}

function assertValidJSON(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  JSON.parse(text); // throws with a useful message if this regresses
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-windows-integration-'));
console.log(`Working directory: ${tmpDir}`);

try {
  fs.writeFileSync(
    path.join(tmpDir, 'package.json'),
    BOM + JSON.stringify({ name: 'toolcrib-windows-integration-test', version: '1.0.0' }, null, 2) + '\n'
  );

  run(['init'], tmpDir);
  run(['apply'], tmpDir);

  // 1. package.json survived a real git apply (which rewrites it to add
  // peerDependencies/the #toolcrib imports field) starting from a BOM'd
  // original -- proving the BOM-strip fix still works against a real
  // Windows file read/write path, not just a synthetic unit-test string.
  const packageJsonPath = path.join(tmpDir, 'package.json');
  assertNoBOM(packageJsonPath);
  assertValidJSON(packageJsonPath);
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  assert.ok(pkg.imports && pkg.imports['#toolcrib'], 'package.json is missing the #toolcrib imports field apply should have added.');

  // 2. The lock file real `apply` wrote is itself valid, BOM-free JSON.
  const lockPath = path.join(tmpDir, 'toolcrib', '.toolcrib-lock.json');
  assertNoBOM(lockPath);
  assertValidJSON(lockPath);

  // 3. The managed AGENTS.md fence block survived a real Windows git
  // apply and is still correctly parseable -- whatever line ending the
  // host's real git config produced (autocrlf=true is a common Windows
  // default -- see AGENTS.md's PowerShell-gotchas section), the \r?\n
  // -tolerant regex fences.js already uses must still match. This is the
  // actual end-to-end version of what that regex's own unit tests can
  // only check with a synthetic CRLF string.
  const agentsPath = path.join(tmpDir, 'AGENTS.md');
  const agentsRaw = fs.readFileSync(agentsPath, 'utf-8');
  const hasCRLF = agentsRaw.includes('\r\n');
  console.log(`AGENTS.md line endings written by this real git apply: ${hasCRLF ? 'CRLF' : 'LF'} (informational -- either is valid depending on the host's git config; the fence regex must handle both).`);
  const fenceMatch = /<!-- toolcrib:managed:core:start version=(\S+) -->\r?\n([\s\S]*?)<!-- toolcrib:managed:core:end -->\r?\n?/.exec(agentsRaw);
  assert.ok(fenceMatch, 'AGENTS.md is missing a well-formed toolcrib:managed:core fence block after a real apply.');
  assert.ok(fenceMatch[2].trim().length > 0, 'The managed "core" fence block in AGENTS.md is empty.');

  // 4. `doctor` can read everything apply just wrote without crashing --
  // the strongest single end-to-end signal that nothing above is merely
  // "looks right to this script's own checks" but actually self-consistent
  // from the CLI's own perspective too.
  run(['doctor'], tmpDir);

  console.log('\nWindows integration checks passed: real init/apply/doctor succeeded, no BOM corruption, fence blocks intact.');
} finally {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (cleanupErr) {
    console.error(`Warning: failed to remove ${tmpDir}: ${cleanupErr.message}`);
  }
}
