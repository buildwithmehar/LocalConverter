import Papa from 'papaparse';
import YAML from 'yaml';
import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';
import { zipSync, gzipSync } from 'fflate';
import * as he from 'he';
import {
  safeObject,
  decode,
  result,
  fail,
  digest,
  base64,
  unbase64,
  pack,
  unpack,
  safeEntry,
  gunzip,
  textBytes,
} from './utility-common.js';
export function safeSvg(bytes) {
  const text = decode(bytes),
    reject = () =>
      fail(
        'SVG must be self-contained and contain no active content, CSS escapes, SMIL animation or external resources.',
      );
  // Run this before either XML parser, including in workers without a DOM.
  if (
    XMLValidator.validate(text) !== true ||
    /<!DOCTYPE|<!ENTITY|\\|@import|javascript\s*:|<\?(?!xml\s)/i.test(text)
  )
    reject();
  const forbidden = new Set([
    'script',
    'foreignobject',
    'iframe',
    'object',
    'embed',
    'style',
    'image',
    'use',
    'animate',
    'set',
    'animatetransform',
    'animatemotion',
    'animatecolor',
    'discard',
    'mpath',
    'feimage',
  ]);
  const attribute = (raw, value) => {
    const name = raw.toLowerCase(),
      local = name.split(':').pop(),
      v = he.decode(String(value)).trim();
    if (
      /^on/.test(local) ||
      local === 'base' ||
      ['href', 'src', 'srcset'].includes(local) ||
      /\\|url\s*\(|@import|(?:javascript|vbscript)\s*:/i.test(v)
    )
      reject();
    if (name === 'xmlns' && v !== 'http://www.w3.org/2000/svg') reject();
    if (
      name.startsWith('xmlns:') &&
      ![
        'http://www.w3.org/2000/svg',
        'http://www.w3.org/1999/xlink',
        'http://www.w3.org/XML/1998/namespace',
      ].includes(v)
    )
      reject();
  };
  const tree = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: true,
  }).parse(text);
  const roots = tree.flatMap((node) =>
    Object.keys(node).filter(
      (key) => ![':@', '#text', '#comment'].includes(key) && !key.startsWith('?'),
    ),
  );
  if (roots.length !== 1 || roots[0] !== 'svg') reject();
  let nodes = 0;
  const visit = (items, depth = 0) => {
    if (depth > 60) reject();
    for (const item of items) {
      if (++nodes > 100000) reject();
      for (const [key, value] of Object.entries(item)) {
        if (key === ':@') {
          for (const [name, v] of Object.entries(value)) attribute(name, v);
        } else if (Array.isArray(value)) {
          if (forbidden.has(key.split(':').pop().toLowerCase())) reject();
          visit(value, depth + 1);
        }
      }
    }
  };
  visit(tree);
  // Main-thread Base64 paths also use the browser's namespace-aware XML parser.
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (
      doc.doctype ||
      doc.getElementsByTagName('parsererror').length ||
      doc.documentElement?.localName !== 'svg'
    )
      reject();
    for (const element of doc.querySelectorAll('*')) {
      if (
        forbidden.has(element.localName.toLowerCase()) ||
        (element.namespaceURI && element.namespaceURI !== 'http://www.w3.org/2000/svg')
      )
        reject();
      for (const a of element.attributes) attribute(a.name, a.value);
    }
  }
  return bytes;
}
async function parseStructured(text, syntax) {
  if (syntax === 'json') return safeObject(JSON.parse(text));
  if (syntax === 'yaml')
    return safeObject(YAML.parse(text, { maxAliasCount: 20, uniqueKeys: true }));
  if (syntax === 'toml') {
    const { parse } = await import('smol-toml');
    return safeObject(parse(text));
  }
  if (syntax !== 'xml') fail('Unsupported structured data syntax.');
  if (/<!DOCTYPE|<!ENTITY/i.test(text))
    fail('XML document types and external entities are unsupported.');
  const valid = XMLValidator.validate(text);
  if (valid !== true) fail('Invalid XML: ' + valid.err.msg);
  return safeObject(
    new XMLParser({
      ignoreAttributes: false,
      parseTagValue: false,
      parseAttributeValue: false,
      processEntities: true,
    }).parse(text),
  );
}
async function structuredOutput(value, syntax, compact, source) {
  if (syntax === 'json') return JSON.stringify(value, null, compact ? 0 : 2);
  if (syntax === 'yaml')
    return YAML.stringify(value, { lineWidth: 0, collectionStyle: compact ? 'flow' : undefined });
  if (syntax === 'toml') {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      fail('TOML requires an object at its root.');
    const { stringify } = await import('smol-toml');
    return stringify(value);
  }
  if (syntax !== 'xml') fail('Unsupported output syntax.');
  const body = new XMLBuilder({
    ignoreAttributes: false,
    format: !compact,
    processEntities: true,
  }).build(source === 'xml' ? value : { root: value });
  if (XMLValidator.validate(body) !== true)
    fail('Object keys cannot be represented as XML element names.');
  return body;
}
function formatXml(text, compact) {
  const tree = new XMLParser({
    preserveOrder: true,
    trimValues: false,
    ignoreAttributes: false,
    parseTagValue: false,
    processEntities: true,
  }).parse(text);
  const mixed = (nodes) =>
    nodes.some((node) =>
      Object.entries(node).some(
        ([, v]) =>
          Array.isArray(v) &&
          ((v.some((x) => Object.hasOwn(x, '#text') && String(x['#text']).trim()) &&
            v.some((x) => Object.keys(x).some((k) => k !== '#text' && k !== ':@'))) ||
            mixed(v)),
      ),
    );
  return new XMLBuilder({
    preserveOrder: true,
    ignoreAttributes: false,
    format: !compact && !mixed(tree),
    processEntities: true,
  }).build(tree);
}
const labels = {
  utf8: 'utf-8',
  utf16le: 'utf-16le',
  utf16be: 'utf-16be',
  windows1252: 'windows-1252',
  windows1256: 'windows-1256',
  shiftjis: 'shift_jis',
};
const encodingMaps = new Map();
function encodeLegacy(text, encoding) {
  const label = labels[encoding];
  if (!label) fail('Unsupported character encoding.');
  if (encoding === 'utf8') return textBytes(text);
  if (encoding === 'utf16le' || encoding === 'utf16be') {
    const bytes = new Uint8Array(text.length * 2),
      view = new DataView(bytes.buffer);
    for (let i = 0; i < text.length; i++)
      view.setUint16(i * 2, text.charCodeAt(i), encoding === 'utf16le');
    return bytes;
  }
  let map = encodingMaps.get(encoding);
  if (!map) {
    map = new Map();
    const decoder = new TextDecoder(label, { fatal: true });
    for (let a = 0; a < 256; a++) {
      try {
        const s = decoder.decode(Uint8Array.of(a));
        if (s && !map.has(s)) map.set(s, [a]);
      } catch {}
    }
    if (encoding === 'shiftjis')
      for (let a = 0x81; a <= 0xfc; a++)
        if (a <= 0x9f || a >= 0xe0)
          for (let b = 0x40; b <= 0xfc; b++) {
            if (b === 0x7f) continue;
            try {
              const s = decoder.decode(Uint8Array.of(a, b));
              if ([...s].length === 1 && !map.has(s)) map.set(s, [a, b]);
            } catch {}
          }
    encodingMaps.set(encoding, map);
  }
  const out = [];
  for (const c of text) {
    const b = map.get(c);
    if (!b) fail('Some characters cannot be represented in the selected output encoding.');
    out.push(...b);
  }
  return Uint8Array.from(out);
}
function colour(text) {
  const v = text.trim();
  let rgb;
  if (/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(v)) {
    const h =
      v.length === 4
        ? v
            .slice(1)
            .split('')
            .map((x) => x + x)
            .join('')
        : v.slice(1);
    rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  } else if (/^rgb\(/i.test(v)) {
    const m = v.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (m) rgb = m.slice(1).map(Number);
  } else {
    const m = v.match(/^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i);
    if (m) {
      let [h, s, l] = m.slice(1).map(Number);
      if (![h, s, l].every(Number.isFinite) || h > 360 || s > 100 || l > 100)
        fail('HSL values are out of range.');
      s /= 100;
      l /= 100;
      const c = (1 - Math.abs(2 * l - 1)) * s,
        x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
        a = l - c / 2;
      rgb = (
        h < 60
          ? [c, x, 0]
          : h < 120
            ? [x, c, 0]
            : h < 180
              ? [0, c, x]
              : h < 240
                ? [0, x, c]
                : h < 300
                  ? [x, 0, c]
                  : [c, 0, x]
      ).map((n) => Math.round((n + a) * 255));
    }
  }
  if (!rgb || rgb.some((n) => n < 0 || n > 255)) fail('Enter a colour as HEX, RGB or HSL.');
  return rgb;
}
function describeColour(rgb) {
  const [r, g, b] = rgb.map((n) => n / 255),
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min,
    l = (max + min) / 2;
  let h = 0,
    s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = 60 * (max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4);
    if (h < 0) h += 360;
  }
  return {
    hex: '#' + rgb.map((n) => n.toString(16).padStart(2, '0')).join(''),
    rgb: `rgb(${rgb.join(', ')})`,
    hsl: `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`,
  };
}
export async function runData(operation, inputs, o) {
  const input = inputs[0],
    bytes = input.bytes;
  if (['archive-browser', 'repack-tar'].includes(operation)) {
    const files = Object.fromEntries(
      Object.entries(unpack(input)).filter(
        ([name]) => !o.contains || name.toLowerCase().includes(o.contains.toLowerCase()),
      ),
    );
    if (operation === 'archive-browser' && o.mode === 'list')
      return result({
        files: Object.entries(files).map(([path, b]) => ({
          path,
          bytes: b.length,
          directory: path.endsWith('/'),
        })),
      });
    return pack(files, o.format || 'zip');
  }
  if (operation === 'create-archive') {
    const files = Object.create(null);
    for (const [i, file] of inputs.entries()) {
      const name = safeEntry((file.name || `file-${i + 1}`).replace(/\\/g, '/').split('/').pop());
      if (Object.hasOwn(files, name)) fail('Files in an archive need unique names.');
      files[name] = file.bytes;
    }
    return pack(files, o.format);
  }
  if (operation === 'svg-gzip')
    return input.source === 'svg'
      ? { ...result(gzipSync(safeSvg(bytes)), 'svgz'), mime: 'image/svg+xml' }
      : result(safeSvg(gunzip(bytes)), 'svg');
  if (operation === 'clean-csv') {
    const parsed = Papa.parse(decode(bytes), {
      delimiter: o.delimiter === 'auto' ? '' : o.delimiter,
      skipEmptyLines: o.emptyRows ? 'greedy' : false,
    });
    if (parsed.errors.length) fail('CSV is malformed: ' + parsed.errors[0].message);
    let rows = parsed.data;
    if (rows.reduce((n, row) => n + row.length, 0) > 100000) fail('CSV exceeds 100,000 cells.');
    if (o.trim) rows = rows.map((row) => row.map((v) => v.trim()));
    const before = rows.length;
    if (o.deduplicate) {
      const seen = new Set();
      rows = rows.filter((row) => {
        const k = JSON.stringify(row);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
    return result(
      Papa.unparse(rows, { delimiter: o.outputDelimiter }),
      o.outputDelimiter === '\t' ? 'tsv' : 'csv',
      { rows: rows.length, duplicatesRemoved: before - rows.length },
    );
  }
  if (['structured-data', 'format-data'].includes(operation)) {
    const text = decode(bytes),
      value = await parseStructured(text, o.input);
    if (o.style === 'validate')
      return result({
        valid: true,
        syntax: o.input,
        rootType: Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value,
      });
    const extension = o.format || o.input;
    return result(
      o.input === 'xml' && extension === 'xml'
        ? formatXml(text, o.style === 'minify')
        : await structuredOutput(value, extension, o.style === 'minify', o.input),
      extension,
    );
  }
  if (operation === 'file-checksum') {
    const checksum = await digest(bytes, o.algorithm),
      expected = (o.expected || '').trim().toLowerCase();
    if (expected && (!/^[\da-f]+$/.test(expected) || expected.length !== checksum.length))
      fail('Expected checksum has the wrong length or characters.');
    return result({
      algorithm: o.algorithm,
      file: input.name,
      bytes: bytes.length,
      checksum,
      ...(expected ? { expected, matches: expected === checksum } : {}),
    });
  }
  if (operation === 'color-palette') {
    const rgb = colour(decode(bytes)),
      colors = Array.from({ length: o.steps }, (_, i) => {
        const t = i / (o.steps - 1),
          mix = t < 0.5 ? 255 : 0,
          w = Math.abs(t - 0.5) * 1.7;
        return describeColour(rgb.map((n) => Math.round(n * (1 - w) + mix * w)));
      });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${colors.length * 140}" height="160">${colors.map((c, i) => `<rect x="${i * 140}" width="140" height="120" fill="${c.hex}"/><text x="${i * 140 + 14}" y="145" font-family="sans-serif" font-size="16">${c.hex}</text>`).join('')}</svg>`;
    return result(
      zipSync({
        'palette.json': textBytes(JSON.stringify({ base: describeColour(rgb), colors }, null, 2)),
        'palette.svg': textBytes(svg),
      }),
      'zip',
    );
  }
  if (operation === 'text-encoding') {
    if (o.mode === 'encoding') {
      const label = labels[o.from];
      if (!label) fail('Unsupported input character encoding.');
      const text = new TextDecoder(label, { fatal: true }).decode(bytes),
        out = encodeLegacy(text, o.to);
      if (new TextDecoder(labels[o.to], { fatal: true }).decode(out) !== text)
        fail('Some characters cannot be represented in the selected output encoding.');
      return result(out, 'txt');
    }
    if (o.mode === 'base64-encode') return result(base64(bytes), 'txt');
    const text = decode(bytes);
    if (o.mode === 'base64-decode') {
      const out = unbase64(text);
      decode(out);
      return result(out, 'txt');
    }
    if (o.mode === 'url-encode') return result(encodeURIComponent(text), 'txt');
    if (o.mode === 'url-decode') return result(decodeURIComponent(text), 'txt');
    if (o.mode === 'html-encode')
      return result(he.encode(text, { useNamedReferences: true }), 'txt');
    if (o.mode === 'html-decode') return result(he.decode(text), 'txt');
  }
  fail('Unsupported browser data operation.');
}
