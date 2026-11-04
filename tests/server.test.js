import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import { unzipSync } from 'fflate';

let createApp;
try {
  ({ createApp } = await import('../server/app.js'));
} catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
}
test('local app exposes a usable job API', () => assert.equal(typeof createApp, 'function'));
let instance, root, baseRoot, png;
before(async () => {
  if (!createApp) return;
  baseRoot = await mkdtemp(join(tmpdir(), 'local-converter-api-test-'));
  root = join(baseRoot, '.local-data');
  instance = await createApp({ dataRoot: root, port: 3000, maxBytes: 1024 * 1024, ttlMs: 60_000 });
  png = await sharp({ create: { width: 32, height: 24, channels: 4, background: '#cc3322' } })
    .png()
    .toBuffer();
});
after(async () => {
  await instance?.close();
  if (baseRoot) await rm(baseRoot, { recursive: true, force: true });
});
const api = () => request.agent(instance.app);
const host = (r) => r.set('Host', '127.0.0.1:3000');
async function session(client) {
  return (await host(client.get('/api/session')).expect(200)).body.token;
}
function upload(
  client,
  token,
  name = 'image.png',
  source = 'png',
  target = 'jpg',
  bytes = png,
  options = {},
) {
  return host(client.post('/api/jobs'))
    .set('X-Local-Token', token)
    .field('source', source)
    .field('target', target)
    .field('options', JSON.stringify(options))
    .attach('file', bytes, name);
}
async function wait(client, id) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const r = await host(client.get('/api/jobs/' + id)).expect(200);
    if (['completed', 'failed', 'cancelled'].includes(r.body.job.status)) return r.body.job;
    await new Promise((r) => setTimeout(r, 40));
  }
  assert.fail('Job did not reach terminal state within 20 seconds');
}
test('blocks DNS rebinding hosts and cross-origin requests', { skip: !createApp }, async () => {
  await request(instance.app).get('/api/session').set('Host', 'attacker.example:3000').expect(403);
  await host(request(instance.app).get('/api/session'))
    .set('Origin', 'https://attacker.example')
    .expect(403);
  await host(request(instance.app).get('/api/session'))
    .set('Sec-Fetch-Site', 'cross-site')
    .expect(403);
});
test('requires session and CSRF token for writes', { skip: !createApp }, async () => {
  const c = api();
  await session(c);
  await host(c.post('/api/clear')).expect(403);
  await host(c.post('/api/clear')).set('X-Local-Token', 'wrong').expect(403);
});
test(
  'converts real image, applies resize and serves valid downloadable bytes',
  { skip: !createApp },
  async () => {
    const c = api(),
      token = await session(c);
    const r = await upload(c, token, 'photo.png', 'png', 'jpg', png, { width: 12 });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const job = await wait(c, r.body.job.id);
    assert.equal(job.status, 'completed', job.error);
    const d = await host(c.get('/api/jobs/' + job.id + '/download')).expect(200);
    const meta = await sharp(d.body).metadata();
    assert.equal(meta.format, 'jpeg');
    assert.equal(meta.width, 12);
    assert.match(d.headers['content-disposition'], /attachment/);
    await host(c.delete('/api/jobs/' + job.id))
      .set('X-Local-Token', token)
      .expect(204);
    await host(c.get('/api/jobs/' + job.id + '/download')).expect(404);
  },
);
test(
  'isolates session jobs and prevents cross-session download',
  { skip: !createApp },
  async () => {
    const a = api(),
      b = api(),
      token = await session(a);
    await session(b);
    const r = await upload(a, token);
    assert.equal(r.status, 201);
    await host(b.get('/api/jobs/' + r.body.job.id)).expect(404);
    await host(b.get('/api/jobs/' + r.body.job.id + '/download')).expect(404);
    const list = await host(b.get('/api/jobs')).expect(200);
    assert.equal(list.body.jobs.length, 0);
    await wait(a, r.body.job.id);
  },
);
test(
  'converter-page batch download includes only that conversion and its session',
  { skip: !createApp },
  async () => {
    const c = api(),
      other = api(),
      token = await session(c),
      otherToken = await session(other);
    const a = await upload(c, token, 'one.png', 'png', 'jpg');
    const b = await upload(c, token, 'two.png', 'png', 'webp');
    const foreign = await upload(other, otherToken, 'foreign.png', 'png', 'jpg');
    for (const result of [a, b]) assert.equal(result.status, 201);
    for (const result of [a, b])
      assert.equal((await wait(c, result.body.job.id)).status, 'completed');
    await wait(other, foreign.body.job.id);
    const archive = await host(c.get('/api/download-all?source=png&target=jpg'))
      .buffer(true)
      .parse((res, done) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    assert.deepEqual(Object.keys(unzipSync(archive.body)), ['one.jpg']);
    await host(c.get('/api/download-all?source=png&target=exe')).expect(400);
    await host(c.get('/api/download-all?source=png')).expect(400);
  },
);
test(
  'rejects unsupported pairs and malformed settings without keeping upload files',
  { skip: !createApp },
  async () => {
    const c = api(),
      token = await session(c);
    await upload(c, token, 'a.png', 'png', 'exe').expect(400);
    await host(c.post('/api/jobs'))
      .set('X-Local-Token', token)
      .field('source', 'png')
      .field('target', 'jpg')
      .field('options', '{')
      .attach('file', png, 'image.png')
      .expect(400);
    assert.deepEqual(await readdir(join(root, 'staging')), []);
  },
);
test('corrupted input reports failed and cannot be downloaded', { skip: !createApp }, async () => {
  const c = api(),
    token = await session(c);
  const r = await upload(c, token, 'bad.png', 'png', 'jpg', Buffer.from('This is not an image.'));
  assert.equal(r.status, 201);
  const job = await wait(c, r.body.job.id);
  assert.equal(job.status, 'failed');
  assert.ok(job.error);
  await host(c.get('/api/jobs/' + job.id + '/download')).expect(409);
  const retry = await host(c.post('/api/jobs/' + job.id + '/retry'))
    .set('X-Local-Token', token)
    .expect(200);
  assert.equal(retry.body.job.id, job.id);
  assert.equal((await wait(c, job.id)).status, 'failed');
});
test('oversized uploads are rejected and staging files removed', { skip: !createApp }, async () => {
  const c = api(),
    token = await session(c);
  await upload(c, token, 'large.png', 'png', 'jpg', Buffer.alloc(1024 * 1024 + 1)).expect(413);
  assert.deepEqual(await readdir(join(root, 'staging')), []);
});
test(
  'cancels waiting jobs and clear removes all owned temporary data',
  { skip: !createApp },
  async () => {
    const c = api(),
      token = await session(c);
    const first = await upload(c, token),
      second = await upload(c, token);
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    const cancel = await host(c.post('/api/jobs/' + second.body.job.id + '/cancel'))
      .set('X-Local-Token', token)
      .expect(200);
    assert.ok(['cancelled', 'completed'].includes(cancel.body.job.status));
    await host(c.post('/api/clear')).set('X-Local-Token', token).expect(204);
    const list = await host(c.get('/api/jobs')).expect(200);
    assert.deepEqual(list.body.jobs, []);
  },
);
test(
  'active cancellation stops worker, has no download and can be retried',
  { skip: !createApp },
  async () => {
    const c = api(),
      token = await session(c);
    const r = await upload(c, token);
    assert.equal(r.status, 201);
    const cancelled = await host(c.post('/api/jobs/' + r.body.job.id + '/cancel'))
      .set('X-Local-Token', token)
      .expect(200);
    assert.equal(cancelled.body.job.status, 'cancelled');
    await host(c.get('/api/jobs/' + r.body.job.id + '/download')).expect(409);
    await host(c.post('/api/jobs/' + r.body.job.id + '/retry'))
      .set('X-Local-Token', token)
      .expect(200);
    assert.equal((await wait(c, r.body.job.id)).status, 'completed');
  },
);
test(
  'job timeout returns actionable error and cleanup removes expired output',
  { skip: !createApp },
  async () => {
    const timeoutRoot = await mkdtemp(join(tmpdir(), 'local-timeout-test-'));
    const timed = await createApp({
      dataRoot: timeoutRoot,
      port: 3000,
      jobTimeoutMs: 1,
      ttlMs: 100,
    });
    try {
      const c = request.agent(timed.app),
        token = await session(c);
      const r = await upload(c, token);
      assert.equal(r.status, 201);
      const job = await wait(c, r.body.job.id);
      assert.equal(job.status, 'failed');
      assert.match(job.error, /timed out/i);
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline && (await host(c.get('/api/jobs'))).body.jobs.length)
        await new Promise((r) => setTimeout(r, 50));
      assert.equal((await host(c.get('/api/jobs'))).body.jobs.length, 0);
      assert.deepEqual(await readdir(join(timeoutRoot, 'jobs')), []);
    } finally {
      await timed.close();
      await rm(timeoutRoot, { recursive: true, force: true });
    }
  },
);
test(
  'second app instance cannot erase another running instance files',
  { skip: !createApp },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), 'local-lock-test-'));
    const a = await createApp({ dataRoot: dir, port: 3000 });
    let second;
    try {
      const sentinel = join(dir, 'jobs', 'retained-input');
      await writeFile(sentinel, 'keep');
      await assert.rejects(async () => {
        second = await createApp({ dataRoot: dir, port: 3001 });
      }, /already running|in use/i);
      assert.equal(await readFile(sentinel, 'utf8'), 'keep');
    } finally {
      await second?.close();
      await a.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
);
test(
  'parallel upload requests cannot exceed session admission limit',
  { skip: !createApp },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), 'local-admission-test-'));
    const limited = await createApp({ dataRoot: dir, port: 3000, maxJobs: 1 });
    try {
      const c = request.agent(limited.app),
        token = await session(c);
      const replies = await Promise.all([upload(c, token), upload(c, token)]);
      assert.deepEqual(replies.map((r) => r.status).sort(), [201, 429]);
      assert.equal((await host(c.get('/api/jobs'))).body.jobs.length, 1);
    } finally {
      await limited.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
);
test(
  'overlapping cancel retry and deletion never revives a removed job',
  { skip: !createApp },
  async () => {
    const c = api(),
      token = await session(c);
    const r = await upload(c, token);
    assert.equal(r.status, 201);
    const id = r.body.job.id;
    const [cancel, retry] = await Promise.all([
      host(c.post(`/api/jobs/${id}/cancel`)).set('X-Local-Token', token),
      host(c.post(`/api/jobs/${id}/retry`)).set('X-Local-Token', token),
    ]);
    assert.equal(cancel.status, 200);
    assert.ok([200, 409].includes(retry.status));
    await host(c.delete(`/api/jobs/${id}`))
      .set('X-Local-Token', token)
      .expect(204);
    await host(c.get(`/api/jobs/${id}`)).expect(404);
    const list = await host(c.get('/api/jobs')).expect(200);
    assert.equal(
      list.body.jobs.some((j) => j.id === id),
      false,
    );
  },
);
