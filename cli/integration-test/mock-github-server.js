import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = 9999;

const server = http.createServer((req, res) => {
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
    if (!assetName || path.basename(assetName) !== assetName) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }

    const releasesDir = path.resolve(DIR, 'releases');
    const filePath = path.resolve(releasesDir, assetName);
    const relativePath = path.relative(releasesDir, filePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (!fs.existsSync(filePath)) {
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
