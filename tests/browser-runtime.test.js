import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserRuntime } from '../src/browser/runtime.js';

const wait = async (fn) => {
  for (let i = 0; i < 100; i++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('Browser job did not settle');
};
test('browser jobs retain real output bytes and removal revokes only their own download', async () => {
  const revoked = [];
  let counter = 0;
  const runtime = createBrowserRuntime({
    registry: {
      tools: [{ id: 'echo', accept: ['txt'] }],
      pairs: [{ source: 'txt', target: 'txt' }],
      limits: { maxBytes: 1000, maxFiles: 20 },
    },
    convert: async ({ inputs }) => ({
      blob: new Blob([await inputs[0].file.text()]),
      filename: 'result.txt',
      mime: 'text/plain',
    }),
    createUrl: () => `blob:test-${++counter}`,
    revokeUrl: (url) => revoked.push(url),
  });
  const form = new FormData();
  form.append('files', new File(['Real content'], 'note.txt'));
  form.append('options', '{}');
  const { job } = await runtime.request('/api/tools/echo/jobs', { method: 'POST', body: form });
  await wait(() => runtime.jobs()[0].status === 'completed');
  assert.equal(await runtime.resultBlob(job.id).text(), 'Real content');
  assert.equal(runtime.downloadUrl(job.id), 'blob:test-1');
  await assert.rejects(
    runtime.request('/api/jobs/' + job.id + '/cancel', { method: 'POST' }),
    /queued or processing/,
  );
  await assert.rejects(
    runtime.request('/api/jobs/' + job.id + '/retry', { method: 'POST' }),
    /original input/,
  );
  await runtime.request('/api/jobs/' + job.id, { method: 'DELETE' });
  assert.deepEqual(runtime.jobs(), []);
  assert.deepEqual(revoked, ['blob:test-1']);
});
test('retained queued, failed and cancelled input bytes share one browser memory budget', async () => {
  let release;
  const runtime = createBrowserRuntime({
    registry: { tools: [{ id: 'slow' }], pairs: [], limits: { maxBytes: 5, maxFiles: 20 } },
    convert: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  const make = () => {
    const form = new FormData();
    form.append('files', new File(['123'], 'sample.txt'));
    form.append('options', '{}');
    return form;
  };
  const { job } = await runtime.request('/api/tools/slow/jobs', { method: 'POST', body: make() });
  await wait(() => release);
  await assert.rejects(
    runtime.request('/api/tools/slow/jobs', { method: 'POST', body: make() }),
    /memory is full/,
  );
  await runtime.request('/api/jobs/' + job.id + '/cancel', { method: 'POST' });
  await assert.rejects(
    runtime.request('/api/tools/slow/jobs', { method: 'POST', body: make() }),
    /memory is full/,
  );
  await runtime.request('/api/clear', { method: 'POST' });
  assert.deepEqual(runtime.jobs(), []);
});
test('cancelled or removed browser jobs cannot be revived by late engine completion', async () => {
  let finish;
  const runtime = createBrowserRuntime({
    registry: { tools: [{ id: 'slow' }], pairs: [], limits: { maxBytes: 1000, maxFiles: 20 } },
    convert: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    createUrl: () => {
      throw new Error('Cancelled output must not get a URL');
    },
  });
  const form = new FormData();
  form.append('files', new File(['x'], 'note.txt'));
  form.append('options', '{}');
  const { job } = await runtime.request('/api/tools/slow/jobs', { method: 'POST', body: form });
  await wait(() => finish);
  await runtime.request('/api/jobs/' + job.id + '/cancel', { method: 'POST' });
  finish({ blob: new Blob(['late']), filename: 'late.txt' });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(runtime.jobs()[0].status, 'cancelled');
  assert.equal(runtime.downloadUrl(job.id), '');
  await runtime.request('/api/jobs/' + job.id, { method: 'DELETE' });
  assert.deepEqual(runtime.jobs(), []);
});
test('browser input limits reject jobs before dispatch and results remain separate between runtimes', async () => {
  const options = {
    registry: { tools: [{ id: 'echo' }], pairs: [], limits: { maxBytes: 2, maxFiles: 1 } },
    convert: () => {
      throw new Error('Should not run');
    },
  };
  const first = createBrowserRuntime(options),
    second = createBrowserRuntime(options),
    form = new FormData();
  form.append('files', new File(['large'], 'note.txt'));
  form.append('options', '{}');
  await assert.rejects(
    first.request('/api/tools/echo/jobs', { method: 'POST', body: form }),
    /2|size|limit/i,
  );
  assert.deepEqual(first.jobs(), []);
  assert.deepEqual(second.jobs(), []);
});
