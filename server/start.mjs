import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { createApi } from './api.mjs';
const api = createApi(),
  root = resolve('dist'),
  port = Number(process.env.PORT || 4173);
if (!existsSync(root + '/index.html')) throw Error('Run npm run build first.');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};
createServer((req, res) =>
  api(req, res, () => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    let path;
    try {
      path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://ndx.local').pathname));
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    if (!existsSync(path) || !statSync(path).isFile()) {
      if (extname(path)) {
        res.writeHead(404).end();
        return;
      }
      path = root + '/index.html';
    }
    res.writeHead(200, {
      'Content-Type': mime[extname(path)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(path).pipe(res);
  }),
).listen(port, '0.0.0.0', () => console.log('NDX Flight Disaster listening on port ' + port));
