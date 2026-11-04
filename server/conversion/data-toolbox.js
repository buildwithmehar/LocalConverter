import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { zipSync } from 'fflate';
import Papa from 'papaparse';
import YAML from 'yaml';
import TOML from '@iarna/toml';
import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';
import iconv from 'iconv-lite';
import * as he from 'he';
import QRCode from 'qrcode';
import bwipjs from 'bwip-js';
import sharp from 'sharp';
import {
  MultiFormatReader,
  RGBLuminanceSource,
  HybridBinarizer,
  BinaryBitmap,
} from '@zxing/library';
import { readInput, textInput, safeSvg, LIMITS, fail, runProcess, checkAbort } from './common.js';
import { safeGunzip } from './packaging.js';
import { detectArchiver, readArchiveFiles, readMember, safeEntry } from './native-archives.js';

function boundedText(buffer) {
  if (buffer.length > 8 * 1024 * 1024) fail('Text tools accept up to 8 MB.');
  return textInput(buffer);
}
function safeObject(value, depth = 0) {
  if (depth > 60) fail('Structured data is nested too deeply.');
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => safeObject(item, depth + 1));
  if (value && typeof value === 'object') {
    const result = Object.create(null);
    for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) fail('Reserved object key.');
      result[key] = safeObject(item, depth + 1);
    }
    return result;
  }
  if (typeof value === 'number' && !Number.isFinite(value))
    fail('Data contains a non-finite number.');
  return value;
}
function parseStructured(text, syntax) {
  if (syntax === 'json') return safeObject(JSON.parse(text));
  if (syntax === 'yaml')
    return safeObject(YAML.parse(text, { maxAliasCount: 20, uniqueKeys: true }));
  if (syntax === 'toml') return safeObject(TOML.parse(text));
  if (/<!DOCTYPE|<!ENTITY/i.test(text))
    fail('XML document types and external entities are unsupported.');
  const valid = XMLValidator.validate(text);
  if (valid !== true) fail(`Invalid XML: ${valid.err.msg}`);
  return safeObject(
    new XMLParser({
      ignoreAttributes: false,
      parseTagValue: false,
      parseAttributeValue: false,
      processEntities: true,
    }).parse(text),
  );
}
function structuredOutput(value, syntax, compact = false, source) {
  if (syntax === 'json') return JSON.stringify(value, null, compact ? 0 : 2);
  if (syntax === 'yaml')
    return YAML.stringify(value, {
      indent: 2,
      lineWidth: 0,
      flowCollectionPadding: !compact,
      collectionStyle: compact ? 'flow' : undefined,
    });
  if (syntax === 'toml') {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      fail('TOML requires an object at its root.');
    return TOML.stringify(value);
  }
  const body = new XMLBuilder({
    ignoreAttributes: false,
    format: !compact,
    processEntities: true,
  }).build(source === 'xml' ? value : { root: value });
  if (XMLValidator.validate(body) !== true)
    fail('Object keys cannot be represented as valid XML element names.');
  return body;
}
function decodeBase64(text) {
  const value = text.replace(/\s/g, '');
  if (!value || value.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value))
    fail('Invalid Base64 data.');
  const out = Buffer.from(value, 'base64');
  if (out.toString('base64').replace(/=+$/, '') !== value.replace(/=+$/, ''))
    fail('Invalid Base64 padding or content.');
  return out;
}
function formatXml(text, compact) {
  // Object conversion loses mixed text order. Keep the ordered XML tree here.
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
        ([key, value]) =>
          Array.isArray(value) &&
          ((value.some((item) => Object.hasOwn(item, '#text') && String(item['#text']).trim()) &&
            value.some((item) => Object.keys(item).some((k) => k !== '#text' && k !== ':@'))) ||
            mixed(value)),
      ),
    );
  const hasMixed = mixed(tree);
  // Formatting indentation is significant in mixed content: preserve it verbatim.
  return new XMLBuilder({
    preserveOrder: true,
    ignoreAttributes: false,
    format: !compact && !hasMixed,
    processEntities: true,
  }).build(tree);
}
async function archiveFiles(input, signal, outputDir) {
  const buffer = await readInput(input.path);
  let source = input.source;
  if (source.startsWith('tar.') || ['gz', 'bz2', 'xz'].includes(source)) {
    const codec = source.split('.').pop();
    let unpacked;
    if (codec === 'gz') unpacked = safeGunzip(buffer);
    else {
      const native = await detectArchiver();
      if (!native.available) fail('7-Zip is not installed.');
      const listing = await runProcess(
        native.executable,
        ['l', `-t${codec === 'bz2' ? 'bzip2' : codec}`, '-slt', '-ba', input.path],
        { signal, timeout: 20000 },
      );
      const match = listing.match(/^Size = (\d+)/m),
        size = match ? Number(match[1]) : undefined;
      if (
        size !== undefined &&
        (!Number.isSafeInteger(size) || size < 1 || size > LIMITS.archiveBytes)
      )
        fail('Compressed file exceeds expansion limits.');
      unpacked = await readMember(
        native.executable,
        ['e', '-so', '-p-', '-bsp0', input.path],
        size,
        signal,
      );
    }
    const isTar = unpacked.length >= 512 && unpacked.subarray(257, 262).toString() === 'ustar';
    if (source.startsWith('tar.') && !isTar) fail('Compressed contents are not a TAR archive.');
    if (!isTar)
      return {
        [safeEntry(
          path.basename(input.name || 'file').replace(/\.(gz|bz2|xz)$/i, '') || 'unpacked',
        )]: unpacked,
      };
    const tarPath = path.join(outputDir, randomUUID() + '.tar');
    await fs.writeFile(tarPath, unpacked);
    return readArchiveFiles({ inputPath: tarPath, buffer: unpacked, source: 'tar', signal });
  }
  return readArchiveFiles({ inputPath: input.path, buffer, source, signal });
}
async function packageFiles(files, format, outputDir, signal) {
  if (!Object.keys(files).length) fail('No files match these settings.');
  if (format === 'zip')
    return { buffer: Buffer.from(zipSync(files, { level: 5 })), extension: 'zip' };
  const native = await detectArchiver();
  if (!native.available) fail('7-Zip is not installed.');
  const stage = await fs.mkdtemp(path.join(outputDir, '.pack-'));
  try {
    for (const [raw, data] of Object.entries(files)) {
      const name = safeEntry(raw.replace(/\/$/, '')),
        dest = path.resolve(stage, ...name.split('/'));
      if (!dest.startsWith(path.resolve(stage) + path.sep)) fail('Unsafe archive path.');
      if (raw.endsWith('/')) await fs.mkdir(dest, { recursive: true });
      else {
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.writeFile(dest, data, { flag: 'wx' });
      }
    }
    const archive = path.join(outputDir, randomUUID() + '.' + (format === '7z' ? '7z' : 'tar'));
    await runProcess(
      native.executable,
      ['a', `-t${format === '7z' ? '7z' : 'tar'}`, '-y', '-bd', '-bso0', '-bsp0', archive, '.'],
      { signal, cwd: stage, timeout: 60000 },
    );
    if (!format.startsWith('tar.'))
      return { buffer: await fs.readFile(archive), extension: format };
    const codec = format.split('.').pop(),
      packed = path.join(outputDir, randomUUID() + '.' + format);
    if (codec === 'gz') return { buffer: gzipSync(await fs.readFile(archive)), extension: format };
    await runProcess(
      native.executable,
      ['a', `-t${codec === 'bz2' ? 'bzip2' : 'xz'}`, '-y', '-bd', packed, archive],
      { signal, timeout: 60000 },
    );
    return { buffer: await fs.readFile(packed), extension: format };
  } finally {
    await fs.rm(stage, { recursive: true, force: true });
  }
}
function colour(text) {
  const v = text.trim();
  let rgb;
  if (/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(v)) {
    const hex =
      v.length === 4
        ? v
            .slice(1)
            .split('')
            .map((x) => x + x)
            .join('')
        : v.slice(1);
    rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  } else if (/^rgb\(/i.test(v)) {
    const match = v.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (match) rgb = match.slice(1).map(Number);
  } else {
    const m = v.match(/^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i);
    if (m) {
      let [h, s, l] = m.slice(1).map(Number);
      if (h > 360 || s > 100 || l > 100) fail('HSL values are out of range.');
      s /= 100;
      l /= 100;
      const c = (1 - Math.abs(2 * l - 1)) * s,
        x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
        a = l - c / 2;
      const row =
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
                  : [c, 0, x];
      rgb = row.map((n) => Math.round((n + a) * 255));
    }
  }
  if (!rgb || rgb.some((n) => n < 0 || n > 255))
    fail('Enter a colour as #336699, rgb(51, 102, 153) or hsl(210, 50%, 40%).');
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

export async function convertDataTool({
  operation,
  inputs,
  outputDir,
  options,
  signal,
  onProgress,
}) {
  checkAbort(signal);
  await fs.mkdir(outputDir, { recursive: true });
  onProgress?.({ stage: 'Preparing local result', progress: null });
  const input = inputs[0],
    buffer = await readInput(input.path);
  let result,
    extension = 'txt',
    mime = 'text/plain; charset=utf-8',
    details = {};
  if (operation === 'image-base64') {
    if (options.mode === 'encode') {
      if (input.source === 'svg') safeSvg(buffer);
      else {
        const meta = await sharp(buffer, { limitInputPixels: LIMITS.pixels }).metadata();
        if (!meta.format) fail('Invalid image.');
      }
      const type =
        input.source === 'svg'
          ? 'image/svg+xml'
          : `image/${input.source === 'jpg' ? 'jpeg' : input.source}`;
      result = Buffer.from(
        (options.dataUri ? `data:${type};base64,` : '') + buffer.toString('base64'),
      );
    } else {
      let value = boundedText(buffer).trim();
      const match = value.match(/^data:([^;,]+);base64,([\s\S]*)$/);
      if (match) value = match[2];
      result = decodeBase64(value);
      if (/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(result.toString('utf8', 0, 300))) {
        safeSvg(result);
        extension = 'svg';
        mime = 'image/svg+xml';
      } else {
        const m = await sharp(result, { limitInputPixels: LIMITS.pixels }).metadata();
        extension = { jpeg: 'jpg' }[m.format] || m.format;
        if (!['jpg', 'png', 'webp', 'gif', 'avif', 'tiff'].includes(extension))
          fail('Decoded data is not a supported image.');
        mime = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
      }
    }
  } else if (operation === 'svg-gzip') {
    if (input.source === 'svg') {
      safeSvg(buffer);
      result = gzipSync(buffer);
      extension = 'svgz';
      mime = 'image/svg+xml';
    } else {
      result = safeGunzip(buffer);
      safeSvg(result);
      extension = 'svg';
      mime = 'image/svg+xml';
    }
  } else if (operation === 'archive-browser' || operation === 'repack-tar') {
    const files = await archiveFiles(input, signal, outputDir);
    const filtered = Object.fromEntries(
      Object.entries(files).filter(
        ([name]) =>
          !options.contains || name.toLowerCase().includes(options.contains.toLowerCase()),
      ),
    );
    if (operation === 'archive-browser' && options.mode === 'list') {
      result = Buffer.from(
        JSON.stringify(
          {
            files: Object.entries(filtered).map(([name, data]) => ({
              path: name,
              bytes: data.length,
              directory: name.endsWith('/'),
            })),
          },
          null,
          2,
        ),
      );
      extension = 'json';
      mime = 'application/json';
      details.entries = Object.keys(filtered).length;
    } else {
      const packed = await packageFiles(filtered, options.format || 'zip', outputDir, signal);
      result = packed.buffer;
      extension = packed.extension;
      mime = extension === 'zip' ? 'application/zip' : 'application/octet-stream';
    }
  } else if (operation === 'create-archive') {
    const files = Object.create(null);
    for (const [i, file] of inputs.entries()) {
      const name = safeEntry(path.basename(file.name || `file-${i + 1}`));
      if (Object.hasOwn(files, name)) fail('Files in an archive need unique names.');
      files[name] = await readInput(file.path);
    }
    const packed = await packageFiles(files, options.format, outputDir, signal);
    result = packed.buffer;
    extension = packed.extension;
    mime = extension === 'zip' ? 'application/zip' : 'application/octet-stream';
  } else if (operation === 'clean-csv') {
    const parsed = Papa.parse(boundedText(buffer), {
      delimiter: options.delimiter === 'auto' ? '' : options.delimiter,
      skipEmptyLines: options.emptyRows ? 'greedy' : false,
    });
    if (parsed.errors.length) fail('CSV is malformed: ' + parsed.errors[0].message);
    let rows = parsed.data;
    const cells = rows.reduce((n, row) => n + row.length, 0);
    if (cells > LIMITS.cells) fail('CSV exceeds 100,000 cells.');
    if (options.trim) rows = rows.map((row) => row.map((cell) => cell.trim()));
    const before = rows.length;
    if (options.deduplicate) {
      const seen = new Set();
      rows = rows.filter((row) => {
        const key = JSON.stringify(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    result = Buffer.from(Papa.unparse(rows, { delimiter: options.outputDelimiter }));
    extension = options.outputDelimiter === '\t' ? 'tsv' : 'csv';
    mime = 'text/csv; charset=utf-8';
    details = { rows: rows.length, duplicatesRemoved: before - rows.length };
  } else if (operation === 'structured-data' || operation === 'format-data') {
    const value = parseStructured(boundedText(buffer), options.input);
    if (options.style === 'validate') {
      result = Buffer.from(
        JSON.stringify(
          {
            valid: true,
            syntax: options.input,
            rootType: Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value,
          },
          null,
          2,
        ),
      );
      extension = 'json';
    } else {
      extension = options.format || options.input;
      const text = boundedText(buffer);
      result = Buffer.from(
        options.input === 'xml' && extension === 'xml'
          ? formatXml(text, options.style === 'minify')
          : structuredOutput(value, extension, options.style === 'minify', options.input),
      );
    }
    mime =
      extension === 'json'
        ? 'application/json'
        : extension === 'xml'
          ? 'application/xml'
          : 'text/plain; charset=utf-8';
  } else if (operation === 'file-checksum') {
    const hash = createHash(options.algorithm).update(buffer).digest('hex'),
      expected = options.expected.trim().toLowerCase();
    if (expected && (!/^[\da-f]+$/.test(expected) || expected.length !== hash.length))
      fail('Expected checksum has the wrong length or characters.');
    result = Buffer.from(
      JSON.stringify(
        {
          algorithm: options.algorithm,
          file: input.name,
          bytes: buffer.length,
          checksum: hash,
          ...(expected ? { expected, matches: expected === hash } : {}),
        },
        null,
        2,
      ),
    );
    extension = 'json';
    mime = 'application/json';
    details = { ...(expected ? { matches: expected === hash } : {}) };
  } else if (operation === 'create-code') {
    const text = boundedText(buffer).trim();
    if (!text || text.length > 2000) fail('Codes accept 1 to 2,000 characters.');
    extension = options.format;
    mime = extension === 'svg' ? 'image/svg+xml' : 'image/png';
    if (input.source !== 'txt')
      fail('Enter QR text or upload a TXT file first, followed by an optional raster logo.');
    if (inputs.length > 2) fail('Supply one text input and at most one logo.');
    if (options.kind === 'qr') {
      const { styledQr } = await import('./qr-design.js');
      const out = await styledQr(
        text,
        options,
        inputs[1] ? await readInput(inputs[1].path) : undefined,
      );
      result = out.buffer;
      details = out.details;
    } else {
      const config = {
        bcid: options.kind,
        text,
        scale: 3,
        height: 20,
        includetext: true,
        textxalign: 'center',
        padding: 12,
      };
      result =
        extension === 'png' ? await bwipjs.toBuffer(config) : Buffer.from(bwipjs.toSVG(config));
    }
    if (extension === 'svg' && options.kind !== 'qr') safeSvg(result);
  } else if (operation === 'read-code') {
    const { data, info } = await sharp(buffer, { limitInputPixels: LIMITS.pixels })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    try {
      const reader = new MultiFormatReader(),
        source = new RGBLuminanceSource(new Uint8ClampedArray(data), info.width, info.height);
      reader.setHints(new Map());
      const found = reader.decodeWithState(new BinaryBitmap(new HybridBinarizer(source)));
      result = Buffer.from(found.getText());
      details = { format: String(found.getBarcodeFormat()) };
    } catch {
      fail('No readable code found. Try a clear image with one large QR code or barcode.');
    }
  } else if (operation === 'color-palette') {
    const rgb = colour(boundedText(buffer)),
      base = describeColour(rgb);
    const colors = Array.from({ length: options.steps }, (_, i) => {
      const t = i / (options.steps - 1),
        mix = t < 0.5 ? 255 : 0,
        weight = Math.abs(t - 0.5) * 1.7;
      return describeColour(rgb.map((n) => Math.round(n * (1 - weight) + mix * weight)));
    });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${colors.length * 140}" height="160">${colors.map((c, i) => `<rect x="${i * 140}" width="140" height="120" fill="${c.hex}"/><text x="${i * 140 + 14}" y="145" font-family="sans-serif" font-size="16">${c.hex}</text>`).join('')}</svg>`;
    result = Buffer.from(
      zipSync({
        'palette.json': Buffer.from(JSON.stringify({ base, colors }, null, 2)),
        'palette.svg': Buffer.from(svg),
      }),
    );
    extension = 'zip';
    mime = 'application/zip';
  } else if (operation === 'text-encoding') {
    if (buffer.length > 8 * 1024 * 1024) fail('Text tools accept up to 8 MB.');
    if (options.mode === 'encoding') {
      const text = iconv.decode(buffer, options.from);
      result = iconv.encode(text, options.to);
      if (iconv.decode(result, options.to) !== text)
        fail('Some characters cannot be represented in the selected output encoding.');
    } else {
      const text = boundedText(buffer);
      if (options.mode === 'base64-encode') result = buffer.toString('base64');
      if (options.mode === 'base64-decode') {
        result = decodeBase64(text);
        textInput(result);
      }
      if (options.mode === 'url-encode') result = encodeURIComponent(text);
      if (options.mode === 'url-decode') result = decodeURIComponent(text);
      if (options.mode === 'html-encode') result = he.encode(text, { useNamedReferences: true });
      if (options.mode === 'html-decode') result = he.decode(text);
      if (typeof result === 'string') result = Buffer.from(result);
    }
  } else fail('Unsupported local data tool.');
  if (!result?.length || result.length > LIMITS.outputBytes)
    fail('Output is empty or exceeds 200 MB.');
  if (
    ['json', 'yaml', 'toml', 'xml', 'txt', 'csv', 'tsv'].includes(extension) &&
    result.length <= 65536 &&
    !result.includes(0)
  ) {
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(result);
      details.preview = text.slice(0, 4000);
      details.previewTruncated = text.length > 4000;
    } catch {}
  }
  checkAbort(signal);
  const filename = `result.${extension}`,
    destination = path.join(outputDir, `${randomUUID()}.${extension}`);
  await fs.writeFile(destination, result, { flag: 'wx' });
  return { path: destination, filename, mime, details };
}
