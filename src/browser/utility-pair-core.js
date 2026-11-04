import Papa from 'papaparse';
import YAML from 'yaml';
import { gzipSync, zipSync } from 'fflate';
import {
  abort,
  decode,
  fail,
  safeObject,
  safeUnzip,
  gunzip,
  textBytes,
  result,
  pack,
  unpack,
} from './utility-common.js';
const formats = ['csv', 'tsv', 'json', 'yaml', 'xlsx'];
function records(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 50000)
    fail('Data must be a nonempty array of records, up to 50,000 rows.');
  const headers = [
    ...new Set(
      rows.flatMap((row) =>
        row && typeof row === 'object' && !Array.isArray(row) ? Object.keys(row) : [],
      ),
    ),
  ];
  if (
    !headers.length ||
    headers.some((h) => !h) ||
    headers.length > 200 ||
    headers.length * rows.length > 100000
  )
    fail('Table exceeds 100,000 cells or 200 columns, or contains empty column names.');
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) fail('Each row must be an object.');
    for (const value of Object.values(row))
      if (value !== null && !['string', 'number', 'boolean'].includes(typeof value))
        fail('Nested records are unsupported.');
  }
  return { rows, headers };
}
async function excel() {
  const module = await import('exceljs/dist/exceljs.min.js');
  return module.default || module;
}
async function parseTable(bytes, source) {
  let rows;
  if (source === 'xlsx') {
    safeUnzip(bytes);
    const ExcelJS = await excel(),
      book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes);
    const sheet = book.worksheets[0];
    if (!sheet) fail('Workbook is empty.');
    if (
      sheet.rowCount > 50001 ||
      sheet.columnCount > 200 ||
      sheet.rowCount * sheet.columnCount > 100000
    )
      fail('Workbook exceeds table resource limits.');
    const headers = sheet
      .getRow(1)
      .values.slice(1)
      .map((v) => String(v ?? ''));
    if (headers.some((h) => !h) || new Set(headers).size !== headers.length)
      fail('Column names must be present and unique.');
    rows = [];
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = Object.create(null);
      headers.forEach((h, j) => {
        const v = sheet.getCell(i, j + 1).value;
        if (v && typeof v === 'object')
          fail('Formula, rich text, dates and linked spreadsheet cells are unsupported.');
        row[h] = v ?? '';
      });
      rows.push(row);
    }
  } else {
    const text = decode(bytes);
    if (source === 'json') rows = JSON.parse(text);
    if (source === 'yaml') rows = YAML.parse(text, { maxAliasCount: 20, uniqueKeys: true });
    if (source === 'csv' || source === 'tsv') {
      const parsed = Papa.parse(text, {
          delimiter: source === 'tsv' ? '\t' : ',',
          header: false,
          skipEmptyLines: 'greedy',
          dynamicTyping: false,
        }),
        headers = parsed.data.shift();
      if (
        parsed.errors.length ||
        !headers?.length ||
        headers.some((h) => !h) ||
        new Set(headers).size !== headers.length ||
        parsed.data.some((row) => row.length !== headers.length)
      )
        fail('Malformed table or duplicate/empty column names.');
      rows = parsed.data.map((values) => Object.fromEntries(headers.map((h, i) => [h, values[i]])));
    }
  }
  return records(safeObject(rows));
}
function timestamp(value) {
  const m = value.match(/^(?:(\d{2,}):)?(\d{2}):(\d{2})[,.](\d{3})$/);
  if (!m || +m[2] > 59 || +m[3] > 59) fail('Invalid subtitle timestamp.');
  return `${(m[1] ?? '00').padStart(2, '0')}:${m[2]}:${m[3]}.${m[4]}`;
}
function subtitle(bytes, source, target) {
  let text = decode(bytes).replace(/\r/g, '').trim();
  if (source === 'vtt') {
    if (!/^WEBVTT(?:\s|$)/.test(text)) fail('Invalid WebVTT signature.');
    text = text.replace(/^WEBVTT[^\n]*(?:\n+|$)/, '');
  }
  const cues = text
    .split(/\n{2,}/)
    .filter((block) => block && !/^(?:NOTE(?:\s|$)|STYLE(?:\s|$)|REGION(?:\s|$))/.test(block))
    .map((block) => {
      const lines = block.split('\n');
      if (!lines[0].includes('-->')) lines.shift();
      const parts = (lines.shift() || '').split(/\s+-->\s+/);
      if (parts.length !== 2 || !lines.length) fail('Malformed subtitle cue.');
      const start = timestamp(parts[0]),
        end = timestamp(parts[1].split(/\s/)[0]);
      if (end < start) fail('Subtitle cue ends before it starts.');
      return { start, end, body: lines.join('\n') };
    });
  if (!cues.length) fail('No subtitle cues found.');
  return result(
    (target === 'vtt' ? 'WEBVTT\n\n' : '') +
      cues
        .map(
          (c, i) =>
            `${target === 'srt' ? `${i + 1}\n` : ''}${target === 'srt' ? c.start.replace('.', ',') : c.start} --> ${target === 'srt' ? c.end.replace('.', ',') : c.end}\n${c.body}`,
        )
        .join('\n\n') +
      '\n',
    target,
  );
}
export const supportedDataPairs = [
  ...formats.flatMap((source) =>
    formats.filter((target) => target !== source).map((target) => `${source}:${target}`),
  ),
  'srt:vtt',
  'vtt:srt',
  'txt:zip',
  'txt:gz',
  'zip:txt',
  'gz:txt',
  'zip:gz',
  'gz:zip',
  'zip:tar',
  'tar:zip',
];
export async function executeDataPair({ source, target, file, options = {}, signal }) {
  abort(signal);
  if (!(file instanceof Blob)) fail('Input file bytes are unavailable.');
  if (file.size > 100 * 1024 * 1024) fail('Input exceeds 100 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let out;
  if (formats.includes(source) && formats.includes(target)) {
    const { rows, headers } = await parseTable(bytes, source);
    abort(signal);
    if (target === 'json') out = result(JSON.stringify(rows, null, 2), 'json');
    else if (target === 'yaml') out = result(YAML.stringify(rows), 'yaml');
    else if (['csv', 'tsv'].includes(target))
      out = result(
        Papa.unparse(
          { fields: headers, data: rows.map((row) => headers.map((h) => row[h] ?? '')) },
          { delimiter: target === 'tsv' ? '\t' : ',' },
        ),
        target,
      );
    else {
      const ExcelJS = await excel(),
        book = new ExcelJS.Workbook(),
        sheet = book.addWorksheet('Data');
      sheet.addRow(headers);
      for (const row of rows) sheet.addRow(headers.map((h) => row[h] ?? ''));
      out = {
        ...result(new Uint8Array(await book.xlsx.writeBuffer()), 'xlsx'),
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }
  } else if (['srt', 'vtt'].includes(source) && ['srt', 'vtt'].includes(target))
    out = subtitle(bytes, source, target);
  else if ((source === 'zip' && target === 'tar') || (source === 'tar' && target === 'zip'))
    out = pack(unpack({ bytes, source, name: 'input.' + source }), target);
  else if (source === 'zip' && target === 'gz') {
    safeUnzip(bytes);
    out = { ...result(gzipSync(bytes), 'gz'), mime: 'application/gzip' };
  } else if (source === 'gz' && target === 'zip')
    out = result(zipSync({ content: gunzip(bytes) }, { level: 5 }), 'zip');
  else if (['txt', 'zip', 'gz'].includes(source) && ['txt', 'zip', 'gz'].includes(target)) {
    let content = bytes,
      name = 'content.txt';
    if (source === 'gz') content = gunzip(bytes);
    if (source === 'zip') {
      const files = Object.entries(safeUnzip(bytes)).filter(([n]) => !n.endsWith('/'));
      if (files.length !== 1) fail('Choose an archive containing exactly one text file.');
      [name, content] = files[0];
    }
    decode(content, 100 * 1024 * 1024);
    if (target === 'txt') out = result(content, 'txt');
    else if (target === 'gz')
      out = { ...result(gzipSync(content), 'gz'), mime: 'application/gzip' };
    else out = result(zipSync({ [name]: content }, { level: 5 }), 'zip');
  } else fail('This format pair is unavailable in the browser.');
  abort(signal);
  return {
    blob: new Blob([out.bytes], { type: out.mime }),
    filename: `converted.${target}`,
    mime: out.mime,
    details: out.details,
  };
}
