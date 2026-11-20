// Neon Bay — a tiny static server for local testing (port 8080).
// Serves the repository root so /game/index.html plays offline.
// `node serve.ts`, then open http://localhost:8080/game/index.html
// (or http://localhost:8080, which redirects to the game, keeping ?shot=).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 8080);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    if (url.pathname === '/') {
      res.writeHead(302, { Location: `/game/index.html${url.search}` });
      res.end();
      return;
    }
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
    const file = join(root, rel);
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (err) {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(port, () => {
  console.log(`Neon Bay serving at http://localhost:${port}/game/index.html`);
});
