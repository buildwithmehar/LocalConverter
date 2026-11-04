// Shared browser utilities. User bytes never leave this process.
import { zipSync, inflateSync, Gunzip, gzipSync } from 'fflate';
export const encoder = new TextEncoder();
export const fail = (message) => {
  throw new Error(message);
};
export const abort = (signal) => {
  if (signal?.aborted) fail('Conversion cancelled.');
};
export const textBytes = (value) => encoder.encode(value);
export function decode(bytes, max = 8 * 1024 * 1024) {
  if (bytes.length > max) fail('Text input exceeds its size limit.');
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    fail('Input is not valid UTF-8 text.');
  }
}
export function safeObject(value, depth = 0, state = { nodes: 0 }) {
  if (depth > 60 || ++state.nodes > 100000) fail('Structured data is too large or deeply nested.');
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => safeObject(v, depth + 1, state));
  if (value && typeof value === 'object') {
    const out = Object.create(null);
    for (const [k, v] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(k)) fail('Reserved object key.');
      out[k] = safeObject(v, depth + 1, state);
    }
    return out;
  }
  if (typeof value === 'number' && !Number.isFinite(value))
    fail('Data contains a non-finite number.');
  return value;
}
export function checkedJson(text) {
  if (text.length > 1048576) fail('JSON accepts up to 1 MB.');
  return safeObject(JSON.parse(text));
}
export function result(value, extension = 'json', details = {}) {
  return {
    bytes:
      typeof value === 'string'
        ? textBytes(value)
        : value instanceof Uint8Array
          ? value
          : textBytes(JSON.stringify(value, null, 2)),
    extension,
    mime:
      {
        json: 'application/json',
        xml: 'application/xml',
        zip: 'application/zip',
        pdf: 'application/pdf',
        png: 'image/png',
        svg: 'image/svg+xml',
        html: 'text/html',
        csv: 'text/csv',
      }[extension] || 'text/plain',
    details,
  };
}
export function base64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 32768)
    out += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(out);
}
export function unbase64(value, url = false) {
  let s = value.replace(/\s/g, '');
  if (url) s = s.replace(/-/g, '+').replace(/_/g, '/');
  if (!s || s.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) fail('Invalid Base64 data.');
  let bytes;
  try {
    bytes = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  } catch {
    fail('Invalid Base64 data.');
  }
  if (base64(bytes).replace(/=+$/, '') !== s.replace(/=+$/, ''))
    fail('Invalid Base64 padding or content.');
  return bytes;
}
export async function digest(bytes, algorithm = 'sha256', secret) {
  const name = { sha256: 'SHA-256', sha512: 'SHA-512' }[algorithm];
  if (!name) fail('Choose SHA-256 or SHA-512.');
  let value;
  if (secret !== undefined) {
    if (!secret) fail('Enter a nonempty HMAC secret.');
    const key = await crypto.subtle.importKey(
      'raw',
      textBytes(secret),
      { name: 'HMAC', hash: name },
      false,
      ['sign'],
    );
    value = await crypto.subtle.sign('HMAC', key, bytes);
  } else value = await crypto.subtle.digest(name, bytes);
  return [...new Uint8Array(value)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function safeEntry(raw) {
  const name = raw.replace(/\\/g, '/');
  if (
    !name ||
    name.startsWith('/') ||
    /^[a-z]:/i.test(name) ||
    /[\x00-\x1f\x7f:]/.test(name) ||
    name.split('/').some((p) => p === '..' || p === '.') ||
    name.length > 1024
  )
    fail('Unsafe archive path.');
  return name;
}
const MAX = 100 * 1024 * 1024;
function validateFiles(files) {
  let total = 0;
  if (Object.keys(files).length > 1000) fail('Archive exceeds 1,000 entries.');
  for (const [name, b] of Object.entries(files)) {
    safeEntry(name);
    total += b.length;
    if (total > MAX) fail('Archive exceeds 100 MB expanded.');
  }
  return files;
}
const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  let n = i;
  for (let b = 0; b < 8; b++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0);
  return n >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
export function safeUnzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) fail('Invalid ZIP directory.');
  const count = view.getUint16(end + 10, true),
    offset = view.getUint32(end + 16, true),
    directoryEnd = offset + view.getUint32(end + 12, true);
  if (
    count > 1000 ||
    count === 65535 ||
    view.getUint16(end + 8, true) !== count ||
    view.getUint16(end + 4, true) ||
    view.getUint16(end + 6, true) ||
    directoryEnd > end
  )
    fail('ZIP exceeds supported entry limits or has invalid directory bounds.');
  let cursor = offset,
    total = 0;
  const files = Object.create(null);
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > directoryEnd || view.getUint32(cursor, true) !== 0x02014b50)
      fail('Invalid ZIP directory entry.');
    const flags = view.getUint16(cursor + 8, true),
      method = view.getUint16(cursor + 10, true),
      checksum = view.getUint32(cursor + 16, true),
      compressed = view.getUint32(cursor + 20, true),
      size = view.getUint32(cursor + 24, true),
      n = view.getUint16(cursor + 28, true),
      extra = view.getUint16(cursor + 30, true),
      comment = view.getUint16(cursor + 32, true),
      attrs = view.getUint32(cursor + 38, true),
      local = view.getUint32(cursor + 42, true),
      entryType = (attrs >>> 16) & 0xf000;
    if (flags & 1 || ![0, 8].includes(method))
      fail('Encrypted ZIP archives or this compression method are unsupported.');
    if (![0, 0x8000, 0x4000].includes(entryType))
      fail('Archive links and special entries are unsupported.');
    total += size;
    if (
      total > MAX ||
      compressed === 0xffffffff ||
      cursor + 46 + n + extra + comment > directoryEnd
    )
      fail('ZIP exceeds expansion limits or is malformed.');
    const name = safeEntry(decode(bytes.subarray(cursor + 46, cursor + 46 + n)));
    if (Object.hasOwn(files, name)) fail('Duplicate archive member.');
    if (local + 30 > offset || view.getUint32(local, true) !== 0x04034b50)
      fail('Invalid ZIP local header.');
    const localNameLength = view.getUint16(local + 26, true),
      start = local + 30 + localNameLength + view.getUint16(local + 28, true);
    if (
      start + compressed > offset ||
      decode(bytes.subarray(local + 30, local + 30 + localNameLength)) !== name
    )
      fail('Invalid ZIP member bounds or name.');
    const packed = bytes.subarray(start, start + compressed);
    let data;
    try {
      data = method === 0 ? packed.slice() : inflateSync(packed, { out: new Uint8Array(size + 1) });
    } catch {
      fail('Corrupt ZIP member data.');
    }
    if (data.length !== size || crc32(data) !== checksum)
      fail('ZIP entry checksum or size mismatch.');
    files[name] = data;
    cursor += 46 + n + extra + comment;
  }
  return validateFiles(files);
}
export function gunzip(bytes) {
  if (bytes.length < 18 || bytes[0] !== 31 || bytes[1] !== 139) fail('Invalid GZIP signature.');
  const trailer = new DataView(bytes.buffer, bytes.byteOffset + bytes.length - 8, 8);
  if (trailer.getUint32(4, true) > MAX) fail('Compressed file exceeds expansion limits.');
  let total = 0;
  const pieces = [];
  const stream = new Gunzip((chunk) => {
    total += chunk.length;
    if (total > MAX) fail('Compressed file exceeds 100 MB expanded.');
    pieces.push(chunk);
  });
  for (let i = 0; i < bytes.length; i += 65536)
    stream.push(bytes.subarray(i, i + 65536), i + 65536 >= bytes.length);
  const out = new Uint8Array(total);
  let n = 0;
  for (const chunk of pieces) {
    out.set(chunk, n);
    n += chunk.length;
  }
  if (total !== trailer.getUint32(4, true) || crc32(out) !== trailer.getUint32(0, true))
    fail('GZIP checksum or size mismatch. Concatenated members are unsupported.');
  return out;
}
const readField = (bytes, start, length) =>
  decode(bytes.subarray(start, start + length))
    .replace(/\0.*$/s, '')
    .trim();
function octal(text) {
  if (!/^[0-7]*$/.test(text)) fail('Unsupported or malformed TAR numeric field.');
  return parseInt(text || '0', 8);
}
export function untar(bytes) {
  if (bytes.length < 512 || bytes.length % 512) fail('Invalid or truncated TAR archive.');
  const files = Object.create(null);
  let cursor = 0,
    total = 0;
  while (cursor + 512 <= bytes.length) {
    const header = bytes.subarray(cursor, cursor + 512);
    if (header.every((x) => x === 0)) break;
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : header[i];
    if (octal(readField(header, 148, 8)) !== sum) fail('Invalid TAR checksum.');
    const prefix = readField(header, 345, 155);
    let name = safeEntry((prefix ? prefix + '/' : '') + readField(header, 0, 100));
    const size = octal(readField(header, 124, 12)),
      type = String.fromCharCode(header[156] || 48);
    if (!['0', '5'].includes(type)) fail('TAR links and special entries are unsupported.');
    if (type === '5' && !name.endsWith('/')) name += '/';
    total += size;
    if (total > MAX || Object.keys(files).length >= 1000 || cursor + 512 + size > bytes.length)
      fail('TAR exceeds expansion limits or is truncated.');
    if (Object.hasOwn(files, name)) fail('Duplicate archive member.');
    files[name] = bytes.slice(cursor + 512, cursor + 512 + size);
    cursor += 512 + Math.ceil(size / 512) * 512;
  }
  return validateFiles(files);
}
export function tar(files) {
  validateFiles(files);
  const chunks = [];
  let total = 1024;
  for (const [name, b] of Object.entries(files)) {
    const header = new Uint8Array(512),
      write = (s, p, n) => {
        const v = textBytes(s);
        if (v.length > n) fail('TAR path or field is too long.');
        header.set(v, p);
      },
      number = (v, p, n) => write(v.toString(8).padStart(n - 1, '0') + '\0', p, n);
    let basename = name,
      prefix = '';
    if (textBytes(name).length > 100) {
      const split = name.lastIndexOf('/');
      if (split < 0) fail('TAR member name exceeds 100 bytes.');
      prefix = name.slice(0, split);
      basename = name.slice(split + 1);
    }
    write(basename, 0, 100);
    number(name.endsWith('/') ? 493 : 420, 100, 8);
    number(0, 108, 8);
    number(0, 116, 8);
    number(b.length, 124, 12);
    number(0, 136, 12);
    header.fill(32, 148, 156);
    header[156] = name.endsWith('/') ? 53 : 48;
    write('ustar\0', 257, 6);
    write('00', 263, 2);
    write(prefix, 345, 155);
    number(
      header.reduce((n, v) => n + v, 0),
      148,
      8,
    );
    chunks.push(header, b, new Uint8Array((512 - (b.length % 512)) % 512));
    total += 512 + Math.ceil(b.length / 512) * 512;
  }
  const out = new Uint8Array(total);
  let n = 0;
  for (const c of chunks) {
    out.set(c, n);
    n += c.length;
  }
  return out;
}
export function unpack(input) {
  let b = input.bytes,
    source = input.source;
  if (source === 'zip') return safeUnzip(b);
  if (['gz', 'tar.gz'].includes(source)) {
    b = gunzip(b);
    if (source === 'gz' && String.fromCharCode(...b.subarray(257, 262)) !== 'ustar')
      return { [safeEntry(input.name.replace(/\.gz$/i, '') || 'unpacked')]: b };
    source = 'tar';
  }
  if (source === 'tar') return untar(b);
  fail(
    'This browser supports ZIP, TAR and gzip archives. This archive format needs a codec that is unavailable in the browser.',
  );
}
export function pack(files, format = 'zip') {
  if (!Object.keys(files).length) fail('No files match these settings.');
  validateFiles(files);
  if (format === 'zip') return result(zipSync(files, { level: 5 }), 'zip');
  if (format === 'tar') return { ...result(tar(files), 'tar'), mime: 'application/x-tar' };
  if (format === 'tar.gz')
    return { ...result(gzipSync(tar(files)), 'tar.gz'), mime: 'application/gzip' };
  fail(
    'This browser creates ZIP, TAR and TAR.GZ archives. The selected compression codec is unavailable.',
  );
}
export function jsonChanges(a, b, base = '') {
  if (Object.is(a, b)) return [];
  if (
    a &&
    b &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    Array.isArray(a) === Array.isArray(b)
  )
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) => {
      const path = base + '/' + k.replace(/~/g, '~0').replace(/\//g, '~1');
      return !Object.hasOwn(b, k)
        ? [{ path, kind: 'removed', before: a[k] }]
        : !Object.hasOwn(a, k)
          ? [{ path, kind: 'added', after: b[k] }]
          : jsonChanges(a[k], b[k], path);
    });
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
