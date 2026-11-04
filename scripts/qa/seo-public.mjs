import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { chromium } from 'playwright';
const auditRoot = resolve(process.argv[2] || '.artifacts/qa/public'),
  root = resolve('dist-public'),
  out = join(auditRoot, 'screenshots');
await mkdir(out, { recursive: true });
const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
};
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname),
    file = resolve(
      root,
      '.' +
        (path === '/' ? '/index.html' : extname(path) ? path : path.replace(/\/$/, '') + '.html'),
    );
  if (!file.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const data = await readFile(file);
    res
      .writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' })
      .end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/html' }).end(await readFile(join(root, '404.html')));
  }
});
await new Promise((resolve) => server.listen(3112, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'chrome', headless: true }),
  results = [];
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({
        viewport: { width, height: 900 },
        javaScriptEnabled: false,
      }),
      page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const route of ['/', '/tools', '/archive-browser', '/png-to-jpg', '/how-it-works']) {
      const response = await page.goto('http://127.0.0.1:3112' + route);
      await page.evaluate(() => document.fonts.ready);
      const info = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        h1: document.querySelectorAll('h1').length,
        title: document.title,
        links: document.querySelectorAll('a[href]').length,
        css: [...document.styleSheets].length,
      }));
      if (
        response.status() !== 200 ||
        info.h1 !== 1 ||
        info.scrollWidth > width + 1 ||
        !info.css ||
        errors.length
      )
        throw new Error(JSON.stringify({ route, info, status: response.status(), errors }));
      results.push({ route, status: response.status(), ...info });
      if (route === '/' || route === '/archive-browser')
        await page.screenshot({
          path: join(out, `public-${route === '/' ? 'home' : 'archive'}-${width}.png`),
        });
    }
    await context.close();
  }
  await writeFile(
    join(auditRoot, 'public-browser-qa.json'),
    JSON.stringify(
      {
        mode: 'Local static preview, JavaScript disabled; not live-domain or field-performance data',
        results,
      },
      null,
      2,
    ),
  );
  console.log(
    `Public HTML/browser QA passed ${results.length} page/viewport checks without JavaScript.`,
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
