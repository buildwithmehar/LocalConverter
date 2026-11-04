import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { createApp } from '../server/app.js';
let instance, root, png, pdfA, pdfB;
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'everyday-api-'));
  instance = await createApp({ dataRoot: root, port: 3000, maxBytes: 65536, maxJobs: 3 });
  png = await sharp({ create: { width: 40, height: 30, channels: 3, background: 'red' } })
    .png()
    .toBuffer();
  const a = await PDFDocument.create();
  a.addPage([200, 300]);
  pdfA = Buffer.from(await a.save());
  const b = await PDFDocument.create();
  b.addPage([210, 300]);
  b.addPage([220, 300]);
  pdfB = Buffer.from(await b.save());
});
after(async () => {
  await instance?.close();
  await fs.rm(root, { recursive: true, force: true });
});
const host = (req) => req.set('Host', '127.0.0.1:3000');
async function session() {
  const client = request.agent(instance.app);
  const { token } = (await host(client.get('/api/session'))).body;
  return { client, token };
}
function submit(client, token, tool, files, options = {}) {
  let req = host(client.post(`/api/tools/${tool}/jobs`))
    .set('X-Local-Token', token)
    .field('options', JSON.stringify(options));
  for (const [name, buffer] of files) req = req.attach('files', buffer, name);
  return req;
}
async function wait(client, id) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const job = (await host(client.get(`/api/jobs/${id}`))).body.job;
    if (['completed', 'failed', 'cancelled'].includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  assert.fail('Tool job did not finish');
}
function binary(res, done) {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => done(null, Buffer.concat(chunks)));
}

test('tool API uses owned queued jobs and produces one PDF in the chosen document order', async () => {
  const { client, token } = await session(),
    other = await session();
  const response = await submit(client, token, 'merge-pdf', [
    ['b.pdf', pdfB],
    ['a.pdf', pdfA],
  ]).expect(201);
  const job = await wait(client, response.body.job.id);
  assert.equal(job.status, 'completed', job.error);
  assert.equal(job.operation, 'merge-pdf');
  assert.equal(job.inputCount, 2);
  assert.equal(job.details.pages, 3);
  await host(other.client.get(`/api/jobs/${job.id}/download`)).expect(404);
  const download = await host(client.get(`/api/jobs/${job.id}/download`))
    .buffer(true)
    .parse(binary)
    .expect(200);
  const doc = await PDFDocument.load(download.body);
  assert.deepEqual(
    doc.getPages().map((page) => page.getWidth()),
    [210, 220, 200],
  );
  await host(client.post('/api/clear')).set('X-Local-Token', token).expect(204);
});

test('tool uploads reject unsupported options and aggregate oversize batches without staging leftovers', async () => {
  const { client, token } = await session();
  await submit(client, token, 'unknown', [['a.png', png]]).expect(404);
  await submit(client, token, 'merge-pdf', [['a.pdf', pdfA]]).expect(400);
  await submit(client, token, 'resize-image', [['a.png', png]], { width: 0 }).expect(400);
  await submit(client, token, 'resize-image', [['a.pdf', pdfA]]).expect(400);
  await submit(client, token, 'merge-pdf', [
    ['a.pdf', Buffer.alloc(40000)],
    ['b.pdf', Buffer.alloc(40000)],
  ]).expect(413);
  assert.deepEqual(await fs.readdir(path.join(root, 'staging')), []);
});

test('multi-file jobs count every input toward the session limit and release capacity on removal', async () => {
  const { client, token } = await session();
  const first = await submit(client, token, 'images-to-pdf', [
    ['a.png', png],
    ['b.png', png],
  ]).expect(201);
  await submit(client, token, 'images-to-pdf', [
    ['c.png', png],
    ['d.png', png],
  ]).expect(429);
  const single = await submit(client, token, 'compress-image', [['c.png', png]]).expect(201);
  await submit(client, token, 'compress-image', [['d.png', png]]).expect(429);
  assert.equal((await wait(client, first.body.job.id)).status, 'completed');
  assert.equal((await wait(client, single.body.job.id)).status, 'completed');
  await host(client.delete(`/api/jobs/${first.body.job.id}`))
    .set('X-Local-Token', token)
    .expect(204);
  const next = await submit(client, token, 'images-to-pdf', [
    ['d.png', png],
    ['e.png', png],
  ]).expect(201);
  assert.equal((await wait(client, next.body.job.id)).status, 'completed');
});

test('cancel and retry retain all inputs of a combined tool job', async () => {
  const { client, token } = await session();
  const added = await submit(client, token, 'merge-pdf', [
      ['a.pdf', pdfA],
      ['b.pdf', pdfB],
    ]).expect(201),
    id = added.body.job.id;
  const cancelled = await host(client.post(`/api/jobs/${id}/cancel`))
    .set('X-Local-Token', token)
    .expect(200);
  assert.equal(cancelled.body.job.status, 'cancelled');
  await host(client.post(`/api/jobs/${id}/retry`))
    .set('X-Local-Token', token)
    .expect(200);
  const finished = await wait(client, id);
  assert.equal(finished.status, 'completed', finished.error);
  assert.equal(finished.details.pages, 3);
});
