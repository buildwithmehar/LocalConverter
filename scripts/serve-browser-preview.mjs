import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
const production = process.argv.includes('--production'),
  root = resolve(
    process.env.BROWSER_PREVIEW_ROOT || (production ? 'dist-public' : '.artifacts/browser-website'),
  ),
  port = Number(process.env.PORT || (production ? 3000 : 3116));
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};
const rules = await readFile(join(root, '_headers'), 'utf8');
function headersFor(url) {
  const headers = {};
  let pattern = '';
  for (const line of rules.split(/\r?\n/)) {
    if (line.startsWith('/') || line.startsWith('https://')) pattern = line.trim();
    else if (line.startsWith('  ') && pattern) {
      const remove = line.trim().startsWith('! ');
      const expr =
          '^' +
          pattern
            .split(/(:[A-Za-z]\w*|\*)/)
            .map((part) =>
              part === '*'
                ? '.*'
                : part.startsWith(':')
                  ? '[^./]+'
                  : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            )
            .join('') +
          '$',
        candidate = pattern.startsWith('https://')
          ? 'https://' + url.hostname + url.pathname
          : url.pathname;
      if (new RegExp(expr).test(candidate)) {
        if (remove) {
          for (const key of Object.keys(headers))
            if (key.toLowerCase() === line.trim().slice(2).toLowerCase()) delete headers[key];
          continue;
        }
        const i = line.indexOf(':'),
          name = line.slice(2, i),
          value = line.slice(i + 1).trim();
        headers[name] = headers[name] ? headers[name] + ', ' + value : value;
      }
    }
  }
  return headers;
}
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'https://' + req.headers.host),
      path = decodeURIComponent(url.pathname);
    if (path.startsWith('/api/')) {
      res
        .writeHead(404, { 'Content-Type': 'application/json' })
        .end('{"error":"No backend exists in this browser-only preview"}');
      return;
    }
    let name = path === '/' ? 'index.html' : path.slice(1);
    if (!extname(name)) name += '.html';
    let file = resolve(root, name);
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    let status = 200;
    try {
      if (!(await stat(file)).isFile()) throw new Error('Not a file');
    } catch {
      file = join(root, '404.html');
      status = 404;
    }
    const bytes = await readFile(file);
    res
      .writeHead(status, {
        'Content-Type': mime[extname(file)] || 'application/octet-stream',
        ...headersFor(url),
      })
      .end(bytes);
  } catch {
    res.writeHead(404).end();
  }
});
server.listen(port, '127.0.0.1', () =>
  console.log(`Browser-only static preview: http://127.0.0.1:${port}`),
);
