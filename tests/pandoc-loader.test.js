import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { loadPandocWasm } from '../src/tool-runtime/pandoc-loader.js';
test('compressed Pandoc assets reconstruct valid wasm bytes without uploading input', async () => {
  const bytes = Uint8Array.from([0, 97, 115, 109, 1, 0, 0, 0]),
    requests = [];
  const actual = await loadPandocWasm(async (path) => {
    requests.push(path);
    return new Response(gzipSync(bytes));
  });
  assert.deepEqual(new Uint8Array(actual), bytes);
  assert.deepEqual(requests, ['/tool-runtime/pandoc.wasm.gz']);
  await WebAssembly.compile(actual);
});
test('Pandoc loader rejects missing, corrupt and non-wasm assets', async () => {
  await assert.rejects(
    loadPandocWasm(async () => new Response('', { status: 404 })),
    /could not load/,
  );
  await assert.rejects(
    loadPandocWasm(async () => new Response('HTML fallback')),
    /valid WebAssembly/,
  );
  await assert.rejects(
    loadPandocWasm(async () => new Response(Uint8Array.from([31, 139, 0]))),
    /damaged/,
  );
});
