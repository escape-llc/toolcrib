import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = 9999;

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
      tag_name: 'v1.0.0',
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
        tag_name: 'v1.0.0',
        published_at: '2026-08-01T00:00:00Z',
        prerelease: false,
        draft: false,
      },
    ]));
    return;
  }

  // Mimics: GET /releases/latest/download/{asset} and /releases/download/v{x}/{asset}
  if (req.url.startsWith('/releases/')) {
    const assetName = req.url.split('/').pop();

    // `.split('/').pop()` only strips '/'-delimited segments — on Windows,
    // `path.join`/`path.resolve` (the native, non-posix module) also treats
    // backslash as a separator, so a segment like `..\..\Windows\System32\...`
    // survives the split intact and would otherwise escape `releasesDir`.
    // Rejecting anything whose basename differs from itself catches that,
    // plus any other embedded separator.
    if (!assetName || path.basename(assetName) !== assetName) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }

    const releasesDir = path.resolve(DIR, 'releases');
    const filePath = path.resolve(releasesDir, assetName);
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
