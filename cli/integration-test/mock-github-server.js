import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = 9999;

// The reported "latest" version, and (see the asset route below) which
// releases/ subfolder a bare, unversioned toolcrib.zip/.sha256 pair is
// treated as belonging to. Defaults to '1.0.0' to keep every existing use
// of this server (the documented init/apply flow in this directory's own
// README.md) working unchanged with the original flat
// releases/toolcrib.zip layout. Override to exercise `merge`'s real
// cross-version diff logic -- see "Multi-version fixtures" below.
const LATEST_VERSION = process.env.MOCK_LATEST_VERSION || '1.0.0';

const server = http.createServer((req, res) => {
  // Mimics: GET /api/repos/{repo}/releases/latest -> GitHub's single-release
  // JSON (a plain object, not an array) for the dedicated "latest" endpoint
  // resolveVersion/doctor actually call by default (see lib/github.js's
  // fetchLatestVersion) -- checked before the plain /releases route below
  // since that one matches on a mere endsWith('/releases') and this URL
  // doesn't end that way, but keeping the more specific route first avoids
  // relying on that being true forever.
  if (req.url.endsWith('/releases/latest') && req.url.startsWith('/api')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      tag_name: `v${LATEST_VERSION}`,
      published_at: '2026-08-01T00:00:00Z',
      prerelease: false,
      draft: false,
    }));
    return;
  }

  // Mimics: GET /api/repos/{repo}/releases  ->  GitHub's release-list JSON
  if (req.url.endsWith('/releases') && req.url.startsWith('/api')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([
      {
        tag_name: `v${LATEST_VERSION}`,
        published_at: '2026-08-01T00:00:00Z',
        prerelease: false,
        draft: false,
      },
    ]));
    return;
  }

  // Mimics: GET /api/repos/{repo}/contents/security-advisories.json?ref=main
  // -- doctor.js's fetchSecurityAdvisories call. Always empty here: no real
  // advisory fixture exists for this mock, and the point of this route is
  // just proving the real init/apply/doctor pipeline exercises the fetch
  // (and survives it) end to end, not exercising the advisory-rendering
  // logic itself (covered directly, with real data, in cli/test/doctor.test.js).
  if (req.url.includes('/contents/security-advisories.json') && req.url.startsWith('/api')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('[]');
    return;
  }

  // Mimics: GET /releases/latest/download/{asset} and /releases/download/v{x}/{asset}
  //
  // Multi-version fixtures: `merge` diffs an "old" release (whatever
  // `.toolcrib-lock.json` says is installed) against a "new" one (the
  // requested target) -- two *different* zips, fetched via two differently-
  // shaped URLs (see assetUrl() in cli/src/lib/github.js: `.../latest/
  // download/{asset}` vs `.../download/v{version}/{asset}`). The original
  // version of this route ignored that distinction entirely
  // (`req.url.split('/').pop()` reads only the trailing asset filename),
  // so every requested version -- old or new, "latest" or a specific tag --
  // silently received the exact same single fixture file. That's fine for
  // this directory's own documented init/apply walkthrough (which only
  // ever needs one release to exist), but it means `merge`'s actual
  // cross-version diff logic had no real E2E coverage at all: old and new
  // always compared identical content, so every file classified as either
  // 'unchanged' or 'keep-local', never a real 'safe-update' -- confirmed
  // directly, not assumed, running a real merge against this exact gap.
  //
  // Fixed by keying on the version segment when a matching versioned
  // fixture exists: drop a real release zip+checksum into
  // `releases/v0.12.0/` (for a `.../download/v0.12.0/{asset}` request) or
  // `releases/latest/` (for a `.../latest/download/{asset}` request), and
  // this route serves that specific pair instead of the flat one. Falls
  // back to the original flat `releases/{asset}` layout when no matching
  // versioned subfolder exists, so every contributor following this
  // directory's own README.md (which only ever populates the flat layout)
  // sees no behavior change at all.
  if (req.url.startsWith('/releases/')) {
    const segments = req.url.split('/').filter(Boolean); // ['releases', ...]
    const assetName = segments[segments.length - 1];

    // segments[1] is 'latest' (…/releases/latest/download/{asset}) or
    // 'download' (…/releases/download/v{x}/{asset}, version at index 2).
    const versionKey = segments[1] === 'latest' ? 'latest' : segments[1] === 'download' ? segments[2] : undefined;

    // `.split('/')` only strips '/'-delimited segments — on Windows,
    // `path.join`/`path.resolve` (the native, non-posix module) also treats
    // backslash as a separator, so a segment like `..\..\Windows\System32\...`
    // survives the split intact and would otherwise escape `releasesDir`.
    // Rejecting anything whose basename differs from itself catches that,
    // plus any other embedded separator — applied to both path components
    // now, not just the asset name, since versionKey is equally
    // attacker/typo-controlled input.
    if (!assetName || path.basename(assetName) !== assetName || (versionKey !== undefined && path.basename(versionKey) !== versionKey)) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }

    const releasesDir = path.resolve(DIR, 'releases');
    const versionedPath = versionKey ? path.resolve(releasesDir, versionKey, assetName) : undefined;
    const flatPath = path.resolve(releasesDir, assetName);
    const filePath = versionedPath && fs.existsSync(versionedPath) && fs.statSync(versionedPath).isFile()
      ? versionedPath
      : flatPath;
    const relativePath = path.relative(releasesDir, filePath);
    // Segment-aware containment check: a plain `startsWith('..')` would also
    // reject legitimate filenames that merely start with two dots (e.g.
    // `..backup.zip`), since that's a valid single path segment, not a
    // traversal. `isAbsolute` catches the Windows cross-drive case, where
    // `path.relative` can't express a relative path and returns the
    // absolute target instead.
    if (relativePath === '..' || relativePath.startsWith('..' + path.sep) || path.isAbsolute(relativePath)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    // `assetName === '.'` passes both checks above (it resolves to
    // `releasesDir` itself) — without this, `fs.createReadStream` on a
    // directory emits an unhandled `error` (EISDIR) and crashes the process.
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`Mock GitHub server listening on http://localhost:${PORT}`);
});
