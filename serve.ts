// serve.ts — a tiny static file server for playing Neon Bay locally.
// Run `node serve.ts`, then open http://localhost:8080. The root path
// redirects to /game/index.html keeping the query string, so a screenshot
// URL like /?shot=chase&seed=1337 still reaches the game and its relative
// module imports resolve. Only files under this directory are served.

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  // The root redirects to the game, keeping ?shot= and &seed= intact.
  if (url.pathname === '/') {
    res.writeHead(302, { Location: '/game/index.html' + url.search });
    res.end();
    return;
  }
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
  const full = join(root, rel);
  if (!full.startsWith(root) || !existsSync(full) || !statSync(full).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(full)] || 'application/octet-stream' });
  createReadStream(full).pipe(res);
});

server.listen(port, () => {
  console.log('Neon Bay at http://localhost:' + port + ' (root redirects to /game/index.html)');
});
