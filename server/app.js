import { operationPages } from './page-content.js';
import { siteSettings, metadataFor, renderPage, sitemap } from './page-seo.js';
import { discoveryFiles, robotsText } from '../shared/site-discovery.js';
import express from 'express';

import multer from 'multer';

import { randomBytes, timingSafeEqual } from 'node:crypto';

import { readFile, rm } from 'node:fs/promises';

import { resolve, join } from 'node:path';

import { fileURLToPath } from 'node:url';

import { zipSync } from 'fflate';

import { JobStore } from './jobs.js';

import { getRegistry } from './conversion/index.js';

import { toolById, sourceFromName } from '../shared/everyday-tools.js';

import { validateToolOptions } from './conversion/everyday.js';

import { toolUploadStorage } from './tool-upload.js';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

export async function createApp(options = {}) {
  const port = Number(options.port || process.env.PORT || 3000);

  const store = new JobStore({
    dataRoot: options.dataRoot || join(projectRoot, '.local-data'),
    ...options,
  });
  await store.init();

  let registry;
  try {
    registry = await getRegistry();
  } catch (error) {
    await store.close();
    throw error;
  }

  const app = express(),
    sessions = new Map();
  app.disable('x-powered-by');

  const limits = {
    maxBytes: store.maxBytes,
    maxFiles: store.maxJobs,
    timeoutSeconds: store.jobTimeoutMs / 1000,
    retentionMinutes: store.ttlMs / 60000,
  };

  const publicRegistry = { ...registry, limits };
  let pages, site;
  try {
    pages = operationPages(publicRegistry);
    site = siteSettings({ siteUrl: options.siteUrl, port });
  } catch (error) {
    await store.close();
    throw error;
  }
  app.use((req, res, next) => {
    const host = req.get('host')?.toLowerCase();
    const allowed = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);

    if (!allowed.has(host))
      return res
        .status(403)
        .json({ error: 'This service accepts only its own localhost address.' });

    const origin = req.get('origin');

    if (
      (origin && !new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]).has(origin)) ||
      req.get('sec-fetch-site') === 'cross-site'
    )
      return res.status(403).json({ error: 'Cross-origin access is not allowed.' });

    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });

    // Development Vite needs inline styles/HMR; production assets are all same-origin.

    res.set(
      'Content-Security-Policy',
      `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'${options.dev ? " 'unsafe-inline'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'${options.dev ? ' ws://127.0.0.1:' + port + ' ws://localhost:' + port : ''}; media-src 'self' blob:; worker-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`,
    );

    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/session', (req, res) => {
    const old = req.headers.cookie?.match(/(?:^|;\s*)lc_session=([a-f0-9]{64})(?:;|$)/)?.[1];

    let id = old && sessions.has(old) ? old : null;

    if (!id) {
      id = randomBytes(32).toString('hex');
      sessions.set(id, { token: randomBytes(32).toString('hex'), lastSeen: Date.now() });
    }

    sessions.get(id).lastSeen = Date.now();

    res.cookie('lc_session', id, { httpOnly: true, sameSite: 'strict', path: '/' });
    res.json({ token: sessions.get(id).token });
  });

  app.get('/api/registry', (_req, res) => res.json({ ...registry, limits }));

  app.get('/api/health', (_req, res) =>
    res.json({ ok: true, local: true, dependencies: registry.dependencies }),
  );

  app.get('/api/pages/:slug', (req, res) => {
    const page = pages.get('/' + req.params.slug);
    if (!page) return res.status(404).json({ error: 'Tool guide not found.' });
    res.json({ ...page, seo: metadataFor(page.path, page, site) });
  });
  app.get('/sitemap.xml', (_req, res) =>
    res.type('application/xml').send(sitemap(pages, site, publicRegistry)),
  );
  app.get('/robots.txt', (_req, res) => res.type('text/plain').send(robotsText(site)));
  for (const name of ['llms.txt', 'llms-full.txt', 'humans.txt'])
    app.get('/' + name, (_req, res) =>
      res
        .set('X-Robots-Tag', 'noindex')
        .type('text/plain')
        .send(discoveryFiles(site, publicRegistry, pages).get(name)),
    );

  app.use('/api', (req, res, next) => {
    const id = req.headers.cookie?.match(/(?:^|;\s*)lc_session=([a-f0-9]{64})(?:;|$)/)?.[1];

    const session = sessions.get(id);
    if (!session) return res.status(401).json({ error: 'Open the app to start a local session.' });

    req.localSession = id;
    session.lastSeen = Date.now();

    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const given = Buffer.from(req.get('x-local-token') || ''),
        expected = Buffer.from(session.token);

      if (given.length !== expected.length || !timingSafeEqual(given, expected))
        return res.status(403).json({ error: 'Invalid local session token. Refresh this page.' });
    }

    next();
  });

  app.use('/api', express.json({ limit: '32kb' }));

  const upload = multer({
    dest: store.stagingDir,
    limits: { fileSize: store.maxBytes, files: 1, fields: 5, fieldSize: 16384 },
  }).single('file');

  app.post('/api/jobs', upload, async (req, res, next) => {
    try {
      if (!req.file) throw Object.assign(new Error('Select a file first.'), { status: 400 });

      const source = String(req.body.source || '').toLowerCase(),
        target = String(req.body.target || '').toLowerCase();

      if (!registry.pairs.some((p) => p.source === source && p.target === target))
        throw Object.assign(
          new Error(`Unsupported conversion: ${source || '?'} → ${target || '?'}.`),
          { status: 400 },
        );

      let settings;
      try {
        settings = JSON.parse(req.body.options || '{}');
      } catch {
        throw Object.assign(new Error('Conversion settings must be valid JSON.'), { status: 400 });
      }

      if (!settings || typeof settings !== 'object' || Array.isArray(settings))
        throw Object.assign(new Error('Conversion settings must be an object.'), { status: 400 });

      if (!req.file.size)
        throw Object.assign(new Error('The selected file is empty.'), { status: 400 });

      const job = await store.add({
        session: req.localSession,
        file: req.file,
        source,
        target,
        options: settings,
      });
      res.status(201).json({ job: store.public(job) });
    } catch (error) {
      if (req.file) await rm(req.file.path, { force: true }).catch(() => {});
      next(error);
    }
  });

  const toolUpload = multer({
    storage: toolUploadStorage(store.stagingDir, store.maxBytes),
    limits: { fileSize: store.maxBytes, files: 20, fields: 1, fieldSize: 16384 },
  }).array('files', 20);

  app.post('/api/tools/:tool/jobs', toolUpload, async (req, res, next) => {
    try {
      const tool = toolById(req.params.tool),
        files = req.files || [];

      if (!tool) throw Object.assign(new Error('Tool not found.'), { status: 404 });

      if (files.length < (tool.minFiles || 1) || files.length > (tool.multiple ? 20 : 1))
        throw Object.assign(
          new Error(
            `Choose ${tool.multiple ? `${tool.minFiles || 1} to 20 files` : 'one file'} for this tool.`,
          ),
          { status: 400 },
        );

      if (files.reduce((sum, file) => sum + file.size, 0) > store.maxBytes)
        throw Object.assign(
          new Error(
            `Selected files together must fit within ${Math.round(store.maxBytes / 1024 / 1024)} MB.`,
          ),
          { status: 413 },
        );

      for (const file of files) {
        file.source = sourceFromName(file.originalname);
        if (!file.size || (!tool.accept.includes('*') && !tool.accept.includes(file.source)))
          throw Object.assign(new Error('Choose a supported, nonempty file for this tool.'), {
            status: 400,
          });
      }

      let settings;

      try {
        settings = validateToolOptions(tool.id, JSON.parse(req.body.options || '{}'));
      } catch (error) {
        throw Object.assign(error, { status: 400 });
      }

      const target =
        settings.output ||
        settings.format ||
        (tool.engine ? 'file' : null) ||
        (tool.id === 'split-pdf' && settings.mode === 'separate' ? 'zip' : 'pdf');

      const job = await store.add({
        session: req.localSession,
        files,
        operation: tool.id,
        label: tool.title,
        source: files[0].source,
        target,
        options: settings,
      });

      res.status(201).json({ job: store.public(job) });
    } catch (error) {
      await Promise.all(
        (req.files || []).map((file) => rm(file.path, { force: true }).catch(() => {})),
      );
      next(error);
    }
  });

  app.get('/api/jobs', (req, res) => res.json({ jobs: store.list(req.localSession) }));

  const owned = (req, res, next) => {
    req.job = store.owned(req.params.id, req.localSession);
    if (!req.job) return res.status(404).json({ error: 'File not found in this local session.' });
    next();
  };

  app.get('/api/jobs/:id', owned, (req, res) => res.json({ job: store.public(req.job) }));

  app.post('/api/jobs/:id/cancel', owned, async (req, res) =>
    res.json({ job: store.public(await store.cancel(req.job)) }),
  );

  app.post('/api/jobs/:id/retry', owned, async (req, res) =>
    res.json({ job: store.public(await store.retry(req.job)) }),
  );

  app.delete('/api/jobs/:id', owned, async (req, res) => {
    await store.remove(req.job);
    res.sendStatus(204);
  });

  app.post('/api/clear', async (req, res) => {
    await store.clear(req.localSession);
    res.sendStatus(204);
  });

  app.get('/api/jobs/:id/download', owned, (req, res) => {
    if (req.job.status !== 'completed')
      return res.status(409).json({ error: 'This conversion has no completed output.' });

    req.job.touchedAt = Date.now();
    res.type(req.job.outputMime);
    res.download(req.job.outputPath, req.job.outputName, { dotfiles: 'allow' });
  });

  app.get('/api/download-all', async (req, res) => {
    const { source, target } = req.query;

    if (
      (source !== undefined || target !== undefined) &&
      !registry.pairs.some((pair) => pair.source === source && pair.target === target)
    )
      return res.status(400).json({ error: 'Choose a supported conversion for this download.' });

    const ready = [...store.jobs.values()].filter(
      (j) =>
        j.session === req.localSession &&
        j.status === 'completed' &&
        (source === undefined || (j.source === source && j.target === target)),
    );

    if (!ready.length)
      return res.status(409).json({ error: 'There are no finished files to download.' });

    if (ready.reduce((n, j) => n + j.outputSize, 0) > 150 * 1024 * 1024)
      return res
        .status(413)
        .json({ error: 'Combined download exceeds 150 MB. Download files individually.' });

    const entries = {};
    for (const [i, j] of ready.entries()) {
      let name = j.outputName;
      if (entries[name]) name = `${i + 1}-${name}`;
      entries[name] = new Uint8Array(await readFile(j.outputPath));
    }

    res
      .set('Content-Disposition', 'attachment; filename="converted-files.zip"')
      .type('application/zip')
      .send(Buffer.from(zipSync(entries, { level: 0 })));
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Local API endpoint not found.' }));

  let vite;

  if (options.dev) {
    const { createServer } = await import('vite');
    vite = await createServer({
      root: projectRoot,
      server: {
        middlewareMode: true,
        ws: options.httpServer ? { server: options.httpServer } : false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(join(projectRoot, 'dist'), { index: false }));

    app.get('/{*path}', async (req, res, next) => {
      try {
        const page = pages.get(req.path),
          meta = metadataFor(req.path, page, site, publicRegistry);
        const html = await readFile(join(projectRoot, 'dist', 'index.html'), 'utf8');
        res
          .status(meta.known ? 200 : 404)
          .type('html')
          .send(renderPage(html, { page, meta, registry: publicRegistry, site }));
      } catch (error) {
        next(error);
      }
    });
  }

  app.use(async (error, req, res, _next) => {
    if (res.headersSent) return;

    const status =
      error.code === 'LIMIT_FILE_SIZE'
        ? 413
        : error instanceof multer.MulterError
          ? 400
          : error.status || 500;

    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? `File exceeds the ${Math.round(store.maxBytes / 1024 / 1024)} MB limit.`
        : error.message || 'Local processing failed.';

    if (req.file?.path) await rm(req.file.path, { force: true }).catch(() => {});

    await Promise.all(
      (req.files || []).map((file) => rm(file.path, { force: true }).catch(() => {})),
    );

    res.status(status).json({ error: message });
  });

  const sessionSweep = setInterval(() => {
    for (const [id, s] of sessions)
      if (Date.now() - s.lastSeen > 8 * 3600000) {
        sessions.delete(id);
        void store.clear(id);
      }
  }, 60000);
  sessionSweep.unref();

  return {
    app,
    close: async () => {
      clearInterval(sessionSweep);
      await store.close();
      await vite?.close();
    },
  };
}
