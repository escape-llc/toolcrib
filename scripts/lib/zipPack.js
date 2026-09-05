/**
 * Cross-platform "zip the contents of a directory" — shared by
 * package-release.js and package-tests-release.js (previously each had
 * its own copy of this logic, Linux/Mac-only; extracted here so a future
 * fix lands once, not twice, on both real copies).
 *
 * Every relative path stored inside the produced zip must be
 * forward-slash, unconditionally — the same standing rule AGENTS.md's
 * Distribution & Path Handling section already states for git patch
 * headers (joinPatchPath()), for the identical reason: a consumer
 * extracting this archive on Linux/Mac uses the real `unzip`, which
 * treats a stored backslash as a literal filename character, not a path
 * separator — producing a broken flat file like `ai-docs\CORE.md`
 * instead of a nested `ai-docs/CORE.md`. Confirmed for real, at the raw
 * byte level (not assumed): both PowerShell's Compress-Archive *and*
 * .NET's ZipFile.CreateFromDirectory store literal backslashes for every
 * entry when run on Windows, and passing a forward-slash *source* path to
 * either makes no difference — the separator comes from .NET's own
 * internal directory-walk (Path.DirectorySeparatorChar), not from the
 * input path's own style. zipOnWindows() below sidesteps this entirely by
 * building each entry explicitly (ZipArchive.CreateEntry(name), not a
 * directory-level convenience method), so the stored name is always
 * exactly the forward-slash string this module computed, regardless of
 * host OS conventions.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function collectFiles(dir, baseDir = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(full, baseDir));
    } else {
      const rel = path.relative(baseDir, full).split(path.sep).join('/');
      out.push({ abs: full, rel });
    }
  }
  return out;
}

function zipOnWindows(sourceDir, zipPath) {
  const manifest = collectFiles(sourceDir).map(f => ({ abs: f.abs, rel: f.rel }));
  const manifestPath = path.join(os.tmpdir(), `toolcrib-zip-manifest-${Date.now()}.json`);
  const scriptPath = path.join(os.tmpdir(), `toolcrib-zip-script-${Date.now()}.ps1`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const script = `
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$manifest = Get-Content -Raw '${manifestPath}' | ConvertFrom-Json
if (Test-Path '${zipPath}') { Remove-Item '${zipPath}' -Force }
$zip = [System.IO.Compression.ZipFile]::Open('${zipPath}', [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($item in $manifest) {
    $entry = $zip.CreateEntry($item.rel, [System.IO.Compression.CompressionLevel]::Optimal)
    $entryStream = $entry.Open()
    try {
      $bytes = [System.IO.File]::ReadAllBytes($item.abs)
      $entryStream.Write($bytes, 0, $bytes.Length)
    } finally {
      $entryStream.Close()
    }
  }
} finally {
  $zip.Dispose()
}
`;
  fs.writeFileSync(scriptPath, script);
  try {
    execFileSync('powershell', ['-NoProfile', '-File', scriptPath], { stdio: 'inherit' });
  } finally {
    fs.rmSync(manifestPath, { force: true });
    fs.rmSync(scriptPath, { force: true });
  }
}

/**
 * Zips the *contents* of sourceDir (not the folder itself) into zipPath,
 * so extraction lands files at the archive's root — matches what
 * cli/src/lib/zip.js's extractZip() + release.js expect.
 */
export function zipDirectoryContents(sourceDir, zipPath) {
  fs.rmSync(zipPath, { force: true });

  if (process.platform === 'win32') {
    // Windows has no `zip` binary by default (confirmed for real on this
    // project's own Windows dev machine, not assumed).
    zipOnWindows(sourceDir, zipPath);
    return;
  }

  try {
    execFileSync('zip', ['-r', zipPath, '.'], { cwd: sourceDir, stdio: 'inherit' });
  } catch (err) {
    // A missing `zip` binary (common on minimal/CI images — it isn't part
    // of any Node install and many slim Docker bases don't include it)
    // surfaces from execFileSync as a bare "spawnSync zip ENOENT", giving
    // no indication it's the `zip` command specifically that's absent
    // rather than some deeper failure in this script. Caught here so the
    // real cause and fix are stated directly instead of a raw ENOENT.
    if (err.code === 'ENOENT') {
      throw new Error(
        `'zip' command not found on PATH. Install it and re-run — e.g. ` +
          `\`apt-get install -y zip\` (Debian/Ubuntu), \`apk add zip\` (Alpine), ` +
          `or \`brew install zip\` (macOS).`
      );
    }
    throw err;
  }
}
