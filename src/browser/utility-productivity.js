import {
  checkedJson,
  decode,
  result,
  fail,
  abort,
  digest,
  jsonChanges,
  statistics,
  unbase64,
  textBytes,
} from './utility-common.js';
import { ulid } from 'ulid';
import { wordlist } from '@scure/bip39/wordlists/english.js';
const randomUUID = () => crypto.randomUUID();
function randomInt(max) {
  if (!Number.isInteger(max) || max < 1 || max > 0x100000000) fail('Invalid random range.');
  const cutoff = Math.floor(0x100000000 / max) * max,
    x = new Uint32Array(1);
  do {
    crypto.getRandomValues(x);
  } while (x[0] >= cutoff);
  return x[0] % max;
}
const textInput = decode,
  checkAbort = abort;
async function bounded(operation, text, options) {
  if (operation === 'regex') {
    if (
      !/^[dgimsuvy]*$/.test(options.flags) ||
      new Set(options.flags).size !== options.flags.length
    )
      fail('Choose valid, unique JavaScript regex flags.');
    const regex = new RegExp(options.pattern, options.flags),
      matches = [];
    let match;
    while ((match = regex.exec(text)) && matches.length < 1000) {
      matches.push({
        index: match.index,
        end: match.index + match[0].length,
        value: match[0],
        groups: match.slice(1),
        namedGroups: match.groups || {},
      });
      if (!regex.global && !regex.sticky) break;
      if (!match[0])
        regex.lastIndex +=
          (regex.unicode || regex.unicodeSets) && text.codePointAt(regex.lastIndex) > 65535 ? 2 : 1;
    }
    return { matches, truncated: matches.length === 1000 };
  }
  const { default: Ajv } = await import('ajv');
  const ajv = new Ajv({
    allErrors: false,
    strict: false,
    validateFormats: false,
    ownProperties: true,
    loopRequired: 50,
    loopEnum: 50,
  });
  const validate = ajv.compile(checkedJson(options.schema)),
    valid = validate(checkedJson(text));
  return { valid, errors: validate.errors || [] };
}
async function formatCode(text, o) {
  if (o.mode === 'format') {
    const [{ format }, html, postcss, babel, estree] = await Promise.all([
      import('prettier/standalone'),
      import('prettier/plugins/html'),
      import('prettier/plugins/postcss'),
      import('prettier/plugins/babel'),
      import('prettier/plugins/estree'),
    ]);
    return format(text, {
      parser: { html: 'html', css: 'css', javascript: 'babel' }[o.language],
      plugins: [html.default, postcss.default, babel.default, estree.default],
    });
  }
  if (o.language === 'javascript') {
    const { minify } = await import('./utility-javascript.js');
    return (await minify(text, { compress: false, mangle: false, format: { comments: false } }))
      .code;
  }
  if (o.language === 'css') {
    const { minify } = await import('csso');
    return minify(text, { restructure: false }).css;
  }
  const { minify } = await import('html-minifier-terser/dist/htmlminifier.esm.bundle');
  return minify(text, {
    collapseWhitespace: true,
    removeComments: true,
    minifyJS: false,
    minifyCSS: false,
  });
}
export async function markdownHtml(text) {
  const { default: MarkdownIt } = await import('markdown-it');
  return new MarkdownIt({ html: false, linkify: true, typographer: true }).render(text);
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
    const parse = (x) => checkedJson(textInput(unbase64(x, true))),
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
    const { CronExpressionParser } = await import('cron-parser/dist/CronExpressionParser.js');
    const { default: cronstrue } = await import('cronstrue');
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
    value = {
      algorithm: o.algorithm,
      mode: o.mode,
      digest: await digest(textBytes(text), o.algorithm, o.mode === 'hmac' ? o.secret : undefined),
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
    const { diffLines } = await import('diff');
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
    const { JSONPath } = await import('jsonpath-plus');
    value = JSONPath({ path: o.query, json: checkedJson(text), eval: false, wrap: true });
  } else if (operation === 'validate-json-schema') {
    checkedJson(text);
    checkedJson(o.schema);
    value = await bounded('schema', text, o, signal);
  } else if (operation === 'format-sql') {
    const { format: sqlFormat } = await import('sql-formatter');
    value = sqlFormat(text, { language: o.dialect, keywordCase: 'upper' });
    extension = 'sql';
  } else if (operation === 'format-code') {
    extension = { html: 'html', css: 'css', javascript: 'js' }[o.language];
    value = await formatCode(text, o);
  } else if (operation === 'markdown-editor') {
    extension = o.format;
    value = o.format === 'md' ? text : await markdownHtml(text);
  } else fail('Unsupported productivity tool.');
  return result(value, extension);
}
