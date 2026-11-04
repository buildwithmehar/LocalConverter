import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { convertTool } from '../server/conversion/everyday.js';
import { toolDefaults } from '../shared/everyday-tools.js';

export async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lc-productivity-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  let i = 0;
  return async (id, text = 'Generate', options = {}, source = 'txt', second) => {
    const inputs = [];
    for (const value of [text, ...(second === undefined ? [] : [second])]) {
      const p = path.join(dir, `input-${++i}.${source}`),
        buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
      await fs.writeFile(p, buffer);
      inputs.push({ path: p, name: path.basename(p), source, size: buffer.length });
    }
    const out = await convertTool({
      operation: id,
      inputs,
      outputDir: dir,
      options: { ...toolDefaults(id), ...options },
    });
    const buffer = await fs.readFile(out.path);
    return { ...out, buffer, text: buffer.toString(), json: () => JSON.parse(buffer) };
  };
}
test('IDs and credentials generate usable independent values without user input', async (t) => {
  const run = await fixture(t);
  const ids = (await run('generate-id', 'Generate', { count: 20 })).text.trim().split('\n');
  assert.equal(new Set(ids).size, 20);
  for (const id of ids)
    assert.match(id, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
  assert.match(
    (await run('generate-id', 'Generate', { kind: 'ulid' })).text.trim(),
    /^[0-9A-HJKMNP-TV-Z]{26}$/,
  );
  const passwords = (await run('generate-password', 'Generate', { length: 24, count: 10 })).text
    .trim()
    .split('\n');
  assert.equal(new Set(passwords).size, 10);
  for (const p of passwords) {
    assert.equal(p.length, 24);
    assert.match(p, /[a-z]/);
    assert.match(p, /[A-Z]/);
    assert.match(p, /\d/);
    assert.match(p, /[^a-z0-9]/i);
  }
  const phrase = (
    await run('generate-password', 'Generate', { kind: 'passphrase', words: 6 })
  ).text.trim();
  assert.equal(phrase.split('-').length, 6);
});
test('JWT is decoded as unverified and malformed token is rejected', async (t) => {
  const run = await fixture(t),
    token =
      Buffer.from('{"alg":"HS256"}').toString('base64url') +
      '.' +
      Buffer.from('{"sub":"alice","exp":1}').toString('base64url') +
      '.abc';
  const value = (await run('decode-jwt', token)).json();
  assert.equal(value.payload.sub, 'alice');
  assert.equal(value.signatureVerified, false);
  assert.equal(value.expired, true);
  await assert.rejects(run('decode-jwt', 'not-a-token'));
});
test('timestamps and cron honor timezone and reject invalid dates', async (t) => {
  const run = await fixture(t);
  const a = (await run('convert-timestamp', '0', { timezone: 'Asia/Karachi' })).json();
  assert.equal(a.iso, '1970-01-01T00:00:00.000Z');
  assert.match(a.local, /05:00:00/);
  await assert.rejects(run('convert-timestamp', '2026-02-30'));
  await assert.rejects(run('convert-timestamp', '0', { timezone: 'No/Such_Zone' }));
  const cron = (
    await run('explain-cron', '0 9 * * *', {
      timezone: 'UTC',
      start: '2026-10-23T00:00:00Z',
      count: 2,
    })
  ).json();
  assert.deepEqual(cron.next, ['2026-10-23T09:00:00.000Z', '2026-10-24T09:00:00.000Z']);
});
test('regex matches include indices and capture groups and dangerous patterns time out', async (t) => {
  const run = await fixture(t);
  const r = (await run('test-regex', 'abc 123 def 45', { pattern: '(\\d+)', flags: 'g' })).json();
  assert.deepEqual(
    r.matches.map((x) => [x.index, x.groups[0]]),
    [
      [4, '123'],
      [12, '45'],
    ],
  );
  await assert.rejects(
    run('test-regex', 'a'.repeat(20000) + '!', { pattern: '(a+)+$', flags: '' }),
    /time|long/i,
  );
});
test('text hashes and HMAC match known vectors', async (t) => {
  const run = await fixture(t);
  assert.equal(
    (await run('hash-text', 'abc')).json().digest,
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
  assert.equal(
    (
      await run('hash-text', 'The quick brown fox jumps over the lazy dog', {
        mode: 'hmac',
        secret: 'key',
      })
    ).json().digest,
    'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8',
  );
});
test('URL and query tools preserve repeated keys and encoded Unicode', async (t) => {
  const run = await fixture(t);
  const u = (await run('inspect-url', 'https://example.com/a?tag=one&tag=two#part')).json();
  assert.equal(u.hostname, 'example.com');
  assert.deepEqual(u.query, [
    ['tag', 'one'],
    ['tag', 'two'],
  ]);
  const query = await run('query-string', '[["tag","one"],["tag","two"],["q","café"]]', {
    mode: 'build',
  });
  assert.equal(query.text, 'tag=one&tag=two&q=caf%C3%A9');
  assert.deepEqual((await run('query-string', query.text)).json(), [
    ['tag', 'one'],
    ['tag', 'two'],
    ['q', 'café'],
  ]);
  await assert.rejects(run('inspect-url', 'javascript:alert(1)'));
});
test('number bases preserve integers beyond JavaScript safe integer range', async (t) => {
  const run = await fixture(t);
  assert.equal(
    (await run('number-base', '9007199254740993', { from: 10, to: 16 })).text,
    '20000000000001',
  );
  assert.equal((await run('number-base', '-ff', { from: 16, to: 10 })).text, '-255');
  await assert.rejects(run('number-base', '102', { from: 2, to: 10 }));
});
test('text comparison, statistics, case and cleanup have visible correct results', async (t) => {
  const run = await fixture(t);
  const d = (await run('compare-text', 'one\ntwo', { second: 'one\nthree' })).json();
  assert.ok(d.some((x) => x.removed && x.value.includes('two')));
  assert.ok(d.some((x) => x.added && x.value.includes('three')));
  const s = (await run('count-text', 'Hello world.\n\nNext line!')).json();
  assert.equal(s.words, 4);
  assert.equal(s.paragraphs, 2);
  assert.equal(s.sentences, 2);
  assert.equal(
    (await run('change-case', 'Hello HTTP World', { style: 'snake' })).text,
    'hello_http_world',
  );
  assert.equal((await run('clean-lines', ' b \na\nb\n\n', { sort: 'ascending' })).text, 'a\nb');
  assert.equal(
    (await run('placeholder-text', 'Generate', { count: 17, unit: 'words' })).text
      .trim()
      .split(/\s+/).length,
    17,
  );
});
test('units use correct affine conversions and reject mixed dimensions', async (t) => {
  const run = await fixture(t);
  assert.equal((await run('convert-units', '32', { from: 'F', to: 'C' })).json().result, 0);
  assert.equal((await run('convert-units', '1', { from: 'MiB', to: 'KiB' })).json().result, 1024);
  await assert.rejects(run('convert-units', '1', { from: 'kg', to: 'm' }));
});
test('JSON comparison, queries and schema validation produce real reports without evaluating code', async (t) => {
  const run = await fixture(t);
  const diff = (await run('compare-json', '{"a":1,"b":2}', { second: '{"a":2,"c":3}' })).json();
  assert.ok(diff.some((x) => x.path === '/a' && x.before === 1 && x.after === 2));
  const q = (
    await run('query-json', '{"items":[{"name":"Alice"},{"name":"Bob"}]}', {
      query: '$.items[*].name',
    })
  ).json();
  assert.deepEqual(q, ['Alice', 'Bob']);
  const invalid = (
    await run('validate-json-schema', '{"age":"old"}', {
      schema: '{"type":"object","properties":{"age":{"type":"integer"}},"required":["age"]}',
    })
  ).json();
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.length);
  await assert.rejects(run('query-json', '{"a":1}', { query: '$[?(@.a && process.exit())]' }));
});
test('formatters produce parseable code and never execute it', async (t) => {
  const run = await fixture(t);
  assert.match(
    (await run('format-sql', 'select a,b from users where id=1')).text,
    /SELECT\s+a,\s+b\s+FROM/,
  );
  const code = await run('format-code', 'const x={a:1};', { language: 'javascript' });
  assert.match(code.text, /const x = \{ a: 1 \}/);
  const min = await run('format-code', 'function sum(a,b) { return a + b; }', {
    language: 'javascript',
    mode: 'minify',
  });
  assert.ok(min.text.length < 43);
  await assert.rejects(run('format-code', 'const = broken', { language: 'javascript' }));
});
test('Markdown export removes scripts and external active resources', async (t) => {
  const run = await fixture(t);
  const out = await run(
    'markdown-editor',
    '# Hello\n\n<script>alert(1)</script>\n\n![remote](https://example.com/a.png)',
  );
  assert.match(out.text, /<h1>Hello<\/h1>/);
  assert.doesNotMatch(out.text, /<script|https:\/\/example.com\/a.png/);
});
test('comparison rejects surplus files rather than silently ignoring them', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lc-three-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const inputs = [];
  for (let i = 0; i < 3; i++) {
    const p = path.join(dir, `${i}.txt`);
    await fs.writeFile(p, 'text');
    inputs.push({ path: p, name: `${i}.txt`, source: 'txt', size: 4 });
  }
  await assert.rejects(
    convertTool({
      operation: 'compare-text',
      inputs,
      outputDir: dir,
      options: toolDefaults('compare-text'),
    }),
    /two|2/i,
  );
});
test('JSON tools reject numeric overflow instead of silently emitting null or equality', async (t) => {
  const run = await fixture(t);
  for (const [id, options] of [
    ['compare-json', { second: '{"x":2e999}' }],
    ['query-json', { query: '$.x' }],
    ['validate-json-schema', { schema: '{"type":"object"}' }],
  ])
    await assert.rejects(run(id, '{"x":1e999}', options), /finite|range/i);
});
test('Unicode-set regex advances past a surrogate pair after empty matches', async (t) => {
  const run = await fixture(t),
    report = (await run('test-regex', '😀', { pattern: '(?:)', flags: 'gv' })).json();
  assert.deepEqual(
    report.matches.map((m) => m.index),
    [0, 2],
  );
  assert.equal(report.truncated, false);
});
