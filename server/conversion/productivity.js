import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, randomInt, createHash, createHmac } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { ulid } from 'ulid';
import { CronExpressionParser } from 'cron-parser';
import cronstrue from 'cronstrue';
import { diffLines } from 'diff';
import { JSONPath } from 'jsonpath-plus';
import { format as sqlFormat } from 'sql-formatter';
import * as prettier from 'prettier';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { readInput, textInput, fail, checkAbort, LIMITS } from './common.js';

export function checkedJson(value) {
  if (value.length > 1_048_576) fail('JSON accepts up to 1 MB.');
  const parsed = JSON.parse(value);
  let nodes = 0;
  const visit = (v, d = 0) => {
    if (typeof v === 'number' && !Number.isFinite(v))
      fail('JSON number exceeds the supported finite range.');
    if (d > 50 || ++nodes > 50000) fail('JSON is too large or deeply nested.');
    if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if (['__proto__', 'prototype', 'constructor'].includes(k)) fail('Reserved JSON key.');
        visit(x, d + 1);
      }
  };
  visit(parsed);
  return parsed;
}
export async function bounded(operation, text, options, signal) {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./bounded-worker.js', import.meta.url), {
      workerData: { operation, text, options },
      resourceLimits: { maxOldGenerationSizeMb: 96 },
    });
    let done = false;
    const finish = (err, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      void worker.terminate();
      err ? reject(err) : resolve(value);
    };
    const timer = setTimeout(
        () => finish(new Error('Operation took too long; simplify the pattern or schema.')),
        operation === 'regex' ? 1000 : 3000,
      ),
      abort = () => finish(new Error('Conversion cancelled.'));
    signal?.addEventListener('abort', abort, { once: true });
    worker.once('message', (m) => finish(m.error ? new Error(m.error) : null, m.result));
    worker.once('error', (e) => finish(e));
    worker.once('exit', (code) => {
      if (!done) finish(new Error(`Worker stopped before producing a result (${code}).`));
    });
  });
}
export function jsonChanges(a, b, base = '') {
  if (Object.is(a, b)) return [];
  if (
    a &&
    b &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    Array.isArray(a) === Array.isArray(b)
  ) {
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) => {
      const p = base + '/' + k.replace(/~/g, '~0').replace(/\//g, '~1');
      return !Object.hasOwn(b, k)
        ? [{ path: p, kind: 'removed', before: a[k] }]
        : !Object.hasOwn(a, k)
          ? [{ path: p, kind: 'added', after: b[k] }]
          : jsonChanges(a[k], b[k], p);
    });
  }
  return [{ path: base || '/', kind: 'changed', before: a, after: b }];
}
export function statistics(text) {
  const words = [...new Intl.Segmenter('en', { granularity: 'word' }).segment(text)].filter(
    (x) => x.isWordLike,
  ).length;
  return {
    words,
    characters: [...text].length,
    charactersWithoutWhitespace: [...text.replace(/\s/g, '')].length,
    lines: text ? text.split(/\r?\n/).length : 0,
    paragraphs: text.trim() ? text.trim().split(/\n\s*\n/).length : 0,
    sentences: text.trim()
      ? [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)].filter((x) =>
          x.segment.trim(),
        ).length
      : 0,
    readingMinutes: Math.ceil(words / 200),
  };
}
const unitMap = {
  mm: ['length', 0.001],
  cm: ['length', 0.01],
  m: ['length', 1],
  km: ['length', 1000],
  in: ['length', 0.0254],
  ft: ['length', 0.3048],
  yd: ['length', 0.9144],
  mi: ['length', 1609.344],
  mg: ['mass', 0.000001],
  g: ['mass', 0.001],
  kg: ['mass', 1],
  oz: ['mass', 0.028349523125],
  lb: ['mass', 0.45359237],
  C: ['temperature', 1],
  F: ['temperature', 1],
  K: ['temperature', 1],
  m2: ['area', 1],
  km2: ['area', 1e6],
  ft2: ['area', 0.09290304],
  acre: ['area', 4046.8564224],
  ha: ['area', 10000],
  B: ['data', 1],
  KB: ['data', 1000],
  MB: ['data', 1e6],
  GB: ['data', 1e9],
  KiB: ['data', 1024],
  MiB: ['data', 1048576],
  GiB: ['data', 1073741824],
};
function dateValue(text, unit) {
  const v = text.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(v)) {
    const d = new Date(Number(v) * (unit === 'milliseconds' ? 1 : 1000));
    if (!Number.isFinite(d.getTime())) fail('Timestamp is out of range.');
    return d;
  }
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(v))
    fail('Use an ISO date or a date/time with an explicit Z or timezone offset.');
  const [year, month, day] = v.slice(0, 10).split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate())
    fail('Invalid calendar date.');
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) fail('Invalid date or timestamp.');
  return d;
}
export async function runProductivity(operation, text, o, signal) {
  let value,
    extension = 'json',
    mime = 'application/json';
  if (operation === 'generate-id') {
    value =
      Array.from({ length: o.count }, () => (o.kind === 'ulid' ? ulid() : randomUUID())).join(
        '\n',
      ) + '\n';
    extension = 'txt';
  } else if (operation === 'generate-password') {
    const pick = (s) => s[randomInt(s.length)];
    value =
      Array.from({ length: o.count }, () => {
        if (o.kind === 'passphrase')
          return Array.from({ length: o.words }, () => pick(wordlist)).join('-');
        const sets = [
            'abcdefghijklmnopqrstuvwxyz',
            ...(o.uppercase ? ['ABCDEFGHIJKLMNOPQRSTUVWXYZ'] : []),
            ...(o.digits ? ['0123456789'] : []),
            ...(o.symbols ? ['!@#$%^&*_-+=?'] : []),
          ],
          all = sets.join(''),
          chars = sets.map(pick);
        while (chars.length < o.length) chars.push(pick(all));
        for (let i = chars.length - 1; i > 0; i--) {
          const j = randomInt(i + 1);
          [chars[i], chars[j]] = [chars[j], chars[i]];
        }
        return chars.join('');
      }).join('\n') + '\n';
    extension = 'txt';
  } else if (operation === 'decode-jwt') {
    const parts = text.trim().split('.');
    if (parts.length !== 3 || parts.some((x, i) => (i < 2 && !x) || !/^[\w-]*$/.test(x)))
      fail('Enter a three-part Base64URL JWT.');
    const parse = (x) => checkedJson(textInput(Buffer.from(x, 'base64url'))),
      header = parse(parts[0]),
      payload = parse(parts[1]);
    if (
      !header ||
      !payload ||
      Array.isArray(header) ||
      Array.isArray(payload) ||
      typeof header !== 'object' ||
      typeof payload !== 'object'
    )
      fail('JWT header and payload must be JSON objects.');
    value = {
      header,
      payload,
      signatureVerified: false,
      ...(typeof payload.exp === 'number'
        ? {
            expired: payload.exp <= Date.now() / 1000,
            expiresAt: new Date(payload.exp * 1000).toISOString(),
          }
        : {}),
    };
  } else if (operation === 'convert-timestamp') {
    const d = dateValue(text, o.unit);
    value = {
      iso: d.toISOString(),
      seconds: d.getTime() / 1000,
      milliseconds: d.getTime(),
      timezone: o.timezone,
      local: new Intl.DateTimeFormat('en-GB', {
        timeZone: o.timezone,
        dateStyle: 'full',
        timeStyle: 'long',
        hourCycle: 'h23',
      }).format(d),
    };
  } else if (operation === 'explain-cron') {
    if (text.trim().split(/\s+/).length !== 5) fail('Use a five-field cron expression.');
    const start = o.start ? dateValue(o.start, 'seconds') : new Date();
    const cron = CronExpressionParser.parse(text.trim(), { currentDate: start, tz: o.timezone });
    value = {
      expression: text.trim(),
      description: cronstrue.toString(text.trim()),
      timezone: o.timezone,
      next: Array.from({ length: o.count }, () => cron.next().toISOString()),
    };
  } else if (operation === 'test-regex') value = await bounded('regex', text, o, signal);
  else if (operation === 'hash-text') {
    if (o.mode === 'hmac' && !o.secret) fail('Enter a nonempty HMAC secret.');
    value = {
      algorithm: o.algorithm,
      mode: o.mode,
      digest: (o.mode === 'hmac' ? createHmac(o.algorithm, o.secret) : createHash(o.algorithm))
        .update(text, 'utf8')
        .digest('hex'),
    };
  } else if (operation === 'inspect-url') {
    const u = new URL(text.trim());
    if (!['http:', 'https:'].includes(u.protocol)) fail('Use an HTTP or HTTPS URL.');
    value = {
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port,
      pathname: u.pathname,
      query: [...u.searchParams],
      fragment: u.hash.slice(1),
      username: u.username,
      passwordPresent: Boolean(u.password),
    };
  } else if (operation === 'query-string') {
    if (o.mode === 'parse') value = [...new URLSearchParams(text.trim().replace(/^\?/, ''))];
    else {
      const v = checkedJson(text);
      if (!v || typeof v !== 'object') fail('Use an object or array of [key,value] pairs.');
      const pairs = Array.isArray(v) ? v : Object.entries(v);
      if (
        pairs.some(
          (p) =>
            !Array.isArray(p) ||
            p.length !== 2 ||
            p.some((x) => typeof x !== 'string' && typeof x !== 'number' && typeof x !== 'boolean'),
        )
      )
        fail('Each query pair needs two scalar values.');
      value = new URLSearchParams(pairs).toString();
      extension = 'txt';
    }
  } else if (operation === 'number-base') {
    const v = text.trim(),
      negative = v.startsWith('-'),
      digits = v.replace(/^[+-]/, '');
    if (
      !digits ||
      digits.length > 4096 ||
      ![...digits.toLowerCase()].every((x) => /[0-9a-f]/.test(x) && parseInt(x, 16) < o.from)
    )
      fail('Invalid digits for the selected input base (maximum 4,096).');
    let n = 0n;
    for (const d of digits.toLowerCase()) n = n * BigInt(o.from) + BigInt(parseInt(d, 16));
    value = (negative ? -n : n).toString(o.to);
    extension = 'txt';
  } else if (operation === 'compare-text') {
    value = diffLines(text, o.second, { timeout: 1000, maxEditLength: 10000 });
    if (!value) fail('Text comparison is too complex. Compare smaller inputs.');
  } else if (operation === 'count-text') value = statistics(text);
  else if (operation === 'change-case') {
    const words =
        text
          .replace(/([\p{Ll}\d])([\p{Lu}])/gu, '$1 $2')
          .replace(/([\p{Lu}])([\p{Lu}][\p{Ll}])/gu, '$1 $2')
          .match(/[\p{L}\p{N}]+/gu) || [],
      lower = words.map((w) => w.toLowerCase()),
      cap = (w) => w.slice(0, 1).toUpperCase() + w.slice(1);
    value =
      o.style === 'lower'
        ? text.toLowerCase()
        : o.style === 'upper'
          ? text.toUpperCase()
          : o.style === 'title'
            ? lower.map(cap).join(' ')
            : o.style === 'camel'
              ? lower.map((w, i) => (i ? cap(w) : w)).join('')
              : o.style === 'pascal'
                ? lower.map(cap).join('')
                : lower.join(o.style === 'snake' ? '_' : '-');
    extension = 'txt';
  } else if (operation === 'clean-lines') {
    let lines = text.replace(/\r\n?/g, '\n').split('\n');
    if (o.trim) lines = lines.map((s) => s.trim());
    if (o.empty) lines = lines.filter((s) => s.trim());
    if (o.deduplicate) lines = [...new Set(lines)];
    if (o.sort !== 'none') lines.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    if (o.sort === 'descending') lines.reverse();
    value = lines.join('\n');
    extension = 'txt';
  } else if (operation === 'placeholder-text') {
    const words =
      'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(
        ' ',
      );
    const generate = (n) => Array.from({ length: n }, (_, i) => words[i % words.length]).join(' ');
    value =
      o.unit === 'words'
        ? generate(o.count)
        : Array.from({ length: o.count }, () => generate(60) + '.').join('\n\n');
    extension = 'txt';
  } else if (operation === 'convert-units') {
    const n = Number(text.trim()),
      a = unitMap[o.from],
      b = unitMap[o.to];
    if (!text.trim() || !Number.isFinite(n)) fail('Enter a finite number.');
    if (!a || !b || a[0] !== b[0]) fail('Choose units of the same dimension.');
    let result;
    if (a[0] === 'temperature') {
      const c = o.from === 'F' ? ((n - 32) * 5) / 9 : o.from === 'K' ? n - 273.15 : n;
      if (c < -273.15) fail('Temperature cannot be below absolute zero.');
      result = o.to === 'F' ? (c * 9) / 5 + 32 : o.to === 'K' ? c + 273.15 : c;
    } else result = (n * a[1]) / b[1];
    if (!Number.isFinite(result)) fail('Converted value is out of range.');
    value = { input: n, from: o.from, to: o.to, result };
  } else if (operation === 'compare-json')
    value = jsonChanges(checkedJson(text), checkedJson(o.second));
  else if (operation === 'query-json') {
    if (/[?()@]|__proto__|constructor|prototype|`/.test(o.query) || !o.query.startsWith('$'))
      fail('Use a non-executable property/index JSONPath query.');
    value = JSONPath({ path: o.query, json: checkedJson(text), eval: false, wrap: true });
  } else if (operation === 'validate-json-schema') {
    checkedJson(text);
    checkedJson(o.schema);
    value = await bounded('schema', text, o, signal);
  } else if (operation === 'format-sql') {
    value = sqlFormat(text, { language: o.dialect, keywordCase: 'upper' });
    extension = 'sql';
  } else if (operation === 'format-code') {
    extension = { html: 'html', css: 'css', javascript: 'js' }[o.language];
    if (o.mode === 'format')
      value = await prettier.format(text, {
        parser: { html: 'html', css: 'css', javascript: 'babel' }[o.language],
      });
    else if (o.language === 'javascript') {
      const { minify } = await import('terser');
      value = (await minify(text, { compress: false, mangle: false, format: { comments: false } }))
        .code;
    } else if (o.language === 'css') {
      const { default: CleanCSS } = await import('clean-css');
      const r = new CleanCSS({ rebase: false, inline: ['none'] }).minify(text);
      if (r.errors.length) fail(r.errors[0]);
      value = r.styles;
    } else {
      const { minify } = await import('html-minifier-terser');
      value = await minify(text, {
        collapseWhitespace: true,
        removeComments: true,
        minifyJS: false,
        minifyCSS: false,
      });
    }
  } else if (operation === 'markdown-editor') {
    extension = o.format;
    value = o.format === 'md' ? text : await markdownHtml(text);
  } else fail('Unsupported productivity tool.');
  return {
    buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value, null, 2)),
    extension,
    mime:
      extension === 'json'
        ? mime
        : extension === 'html'
          ? 'text/html; charset=utf-8'
          : 'text/plain; charset=utf-8',
  };
}
export async function markdownHtml(text) {
  const { default: MarkdownIt } = await import('markdown-it');
  const { default: sanitize } = await import('sanitize-html');
  return sanitize(new MarkdownIt({ html: false, linkify: true, typographer: true }).render(text), {
    allowedTags: [
      ...sanitize.defaults.allowedTags,
      'h1',
      'h2',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'pre',
      'code',
      's',
      'del',
    ],
    allowedAttributes: { a: ['href', 'title'], code: ['class'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    disallowedTagsMode: 'discard',
  });
}
export async function convertProductivity({ operation, inputs, outputDir, options, signal }) {
  if (['compare-text', 'compare-json'].includes(operation) && inputs.length > 2)
    fail('Compare at most two files, original first.');
  checkAbort(signal);
  const data = await readInput(inputs[0].path);
  if (data.length > 1048576) fail('Text tools accept up to 1 MB.');
  let text = textInput(data),
    o = { ...options };
  if (['compare-text', 'compare-json'].includes(operation) && inputs.length > 1) {
    const next = await readInput(inputs[1].path);
    if (next.length > 1048576) fail('Second text accepts up to 1 MB.');
    o.second = textInput(next);
  }
  const out = await runProductivity(operation, text, o, signal);
  if (out.buffer.length > LIMITS.outputBytes) fail('Output exceeds 200 MB.');
  checkAbort(signal);
  await fs.mkdir(outputDir, { recursive: true });
  const filename = `${operation}-${randomUUID().slice(0, 8)}.${out.extension}`,
    p = path.join(outputDir, filename);
  await fs.writeFile(p, out.buffer);
  const secret = ['generate-password'].includes(operation);
  return {
    path: p,
    filename,
    mime: out.mime,
    details: secret
      ? {}
      : {
          preview: out.buffer.toString('utf8', 0, 4000),
          previewTruncated: out.buffer.length > 4000,
        },
  };
}
