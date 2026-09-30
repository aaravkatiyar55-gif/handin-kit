import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
const root = resolve(process.argv.includes('--dist') ? 'dist' : '.');
const portIndex = process.argv.indexOf('--port');
const port = Number(portIndex >= 0 ? process.argv[portIndex + 1] : 4190);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Use a valid development port from 1024 to 65535.');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    const relative = path.slice(root.length + 1).split(sep);
    if (!path.startsWith(root + sep) || relative.some(part => part.startsWith('.')) || !mime[extname(path)]) { response.writeHead(404); response.end(); return; }
    const body = await readFile(path);
    response.writeHead(200, { 'Content-Type': mime[extname(path)], 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Hand-in Kit: http://127.0.0.1:${port}`));
