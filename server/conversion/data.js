import Papa from 'papaparse';
import YAML from 'yaml';
import ExcelJS from 'exceljs';
import { textInput, LIMITS, fail } from './common.js';
import { inspectZip } from './packaging.js';

export const dataFormats = ['csv', 'tsv', 'json', 'yaml', 'xlsx'];
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
  if (!headers.length || headers.length > 200 || headers.length * rows.length > LIMITS.cells)
    fail('Table exceeds 100,000 cells or 200 columns.');
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) fail('Each row must be an object.');
    for (const v of Object.values(row))
      if (v !== null && !['string', 'number', 'boolean'].includes(typeof v))
        fail('Nested records are unsupported.');
  }
  return { rows, headers };
}
export async function parseData(buffer, source) {
  let rows;
  if (source === 'xlsx') {
    inspectZip(buffer);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer);
    if (!book.worksheets.length) fail('Workbook is empty.');
    const sheet = book.worksheets[0];
    if (
      sheet.rowCount > 50001 ||
      sheet.columnCount > 200 ||
      sheet.rowCount * sheet.columnCount > LIMITS.cells
    )
      fail('Workbook exceeds table resource limits.');
    const headers = sheet
      .getRow(1)
      .values.slice(1)
      .map((v) => String(v ?? ''));
    if (headers.some((v) => !v) || new Set(headers).size !== headers.length)
      fail('Column names must be present and unique.');
    rows = [];
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = {};
      headers.forEach((h, j) => {
        const v = sheet.getCell(i, j + 1).value;
        if (v && typeof v === 'object')
          fail('Formula, rich text, dates and linked spreadsheet cells are unsupported.');
        row[h] = v ?? '';
      });
      rows.push(row);
    }
  } else {
    const txt = textInput(buffer);
    if (source === 'json') rows = JSON.parse(txt);
    if (source === 'yaml') rows = YAML.parse(txt, { maxAliasCount: 20, uniqueKeys: true });
    if (source === 'csv' || source === 'tsv') {
      const result = Papa.parse(txt, {
        delimiter: source === 'tsv' ? '\t' : ',',
        header: true,
        skipEmptyLines: 'greedy',
        dynamicTyping: false,
      });
      if (
        result.errors.length ||
        !result.meta.fields?.length ||
        result.meta.fields.some((x) => !x) ||
        result.meta.renamedHeaders
      )
        fail('Malformed table or duplicate/empty column names.');
      rows = result.data;
    }
  }
  return records(rows);
}
export async function convertData(buffer, source, target) {
  const { rows, headers } = await parseData(buffer, source);
  if (target === 'json') return Buffer.from(JSON.stringify(rows, null, 2));
  if (target === 'yaml') return Buffer.from(YAML.stringify(rows));
  if (target === 'csv' || target === 'tsv')
    return Buffer.from(
      Papa.unparse(
        { fields: headers, data: rows.map((row) => headers.map((h) => row[h] ?? '')) },
        { delimiter: target === 'tsv' ? '\t' : ',' },
      ),
    );
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Data');
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(headers.map((h) => row[h] ?? '')));
  return Buffer.from(await book.xlsx.writeBuffer());
}
