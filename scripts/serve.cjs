// Dependency-free, loopback-only static server. Never serves the repository root.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const port = Number(process.env.PORT || 8080);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1–65535');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  const finish = (status, text) => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }); res.end(text); };
  if (!['GET', 'HEAD'].includes(req.method)) return finish(405, 'Method not allowed');
  try {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (name.includes('\\') || name.includes('\0') || name.split('/').some(s => s.startsWith('.'))) return finish(403, 'Forbidden');
    const file = await fs.realpath(path.resolve(root, '.' + (name === '/' ? '/index.html' : name)));
    if (!file.startsWith(root + path.sep)) return finish(403, 'Forbidden');
    if (!(await fs.stat(file)).isFile()) return finish(404, 'Not found');
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': data.length, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (e) { finish(e.code === 'ENOENT' || e.code === 'ENOTDIR' ? 404 : 400, 'Not found or invalid request'); }
}).listen(port, '127.0.0.1', () => console.log(`Pixel Rush: http://127.0.0.1:${port} (Ctrl+C to stop)`)).on('error', e => { console.error(e.message); process.exitCode = 1; });
