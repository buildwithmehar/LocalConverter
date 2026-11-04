import { PDFDocument } from 'pdf-lib';
import { canvas, canvasBlob, checkAbort, result, zipResult } from './image-common.js';
import { extractText, semanticConvert, validateDocumentArchive } from './document-engine.js';
function parseXml(text) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text))
    throw new Error('Office XML entities and DTDs are unsupported.');
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length)
    throw new Error('Office document contains invalid XML.');
  return doc;
}
const nodes = (doc, name) => [...doc.getElementsByTagNameNS('*', name)];
const attr = (node, name) =>
  node.getAttribute(name) || [...node.attributes].find((a) => a.localName === name)?.value;
function xmlParagraphs(node) {
  return nodes(node, 'p')
    .map((p) => p.textContent.trim())
    .filter(Boolean)
    .join('\n\n');
}
async function officeEntries(file) {
  if (file.size > 20 * 1024 * 1024) throw new Error('Office reflow accepts one file up to 20 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  return validateDocumentArchive(bytes);
}
export async function officeSections(file, source, signal) {
  checkAbort(signal);
  if (file.size > 20 * 1024 * 1024) throw new Error('Office reflow accepts one file up to 20 MB.');
  if (['docx', 'odt', 'rtf'].includes(source)) {
    if (source === 'docx') return [{ title: '', text: await extractText(file, 'docx') }];
    if (source === 'rtf') {
      const out = await semanticConvert(file, 'rtf', 'txt', { signal });
      return [{ title: '', text: await out.blob.text() }];
    }
  }
  if (source === 'xlsx') {
    validateDocumentArchive(new Uint8Array(await file.arrayBuffer()));
    const { default: ExcelJS } = await import('exceljs'),
      workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sections = [];
    let cells = 0;
    for (const sheet of workbook.worksheets) {
      const lines = [];
      sheet.eachRow({ includeEmpty: false }, (row) => {
        const values = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          if (++cells > 100000) throw new Error('Office spreadsheet exceeds 100,000 cells.');
          values.push(cell.text ?? '');
        });
        lines.push(values.join(' | '));
      });
      sections.push({ title: sheet.name, text: lines.join('\n') });
    }
    return sections;
  }
  const entries = await officeEntries(file),
    decode = (name) => {
      if (!entries[name]) throw new Error('Missing Office document part: ' + name);
      return new TextDecoder().decode(entries[name]);
    };
  if (source === 'pptx') {
    const slideNames = Object.keys(entries)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => Number(a.match(/slide(\d+)/)[1]) - Number(b.match(/slide(\d+)/)[1]));
    if (!slideNames.length || slideNames.length > 100)
      throw new Error('Choose a presentation with 1 to 100 slides.');
    return slideNames.map((name, i) => ({
      title: `Slide ${i + 1}`,
      text: nodes(parseXml(decode(name)), 'p')
        .map((p) =>
          nodes(p, 't')
            .map((t) => t.textContent)
            .join(''),
        )
        .filter(Boolean)
        .join('\n\n'),
    }));
  }
  if (['odt', 'ods', 'odp'].includes(source)) {
    const doc = parseXml(decode('content.xml'));
    if (source === 'odt') return [{ title: '', text: xmlParagraphs(doc) }];
    if (source === 'odp') {
      const pages = nodes(doc, 'page');
      if (pages.length > 100) throw new Error('Presentation exceeds 100 slides.');
      return pages.map((p, i) => ({
        title: attr(p, 'name') || `Slide ${i + 1}`,
        text: xmlParagraphs(p),
      }));
    }
    const tables = nodes(doc, 'table'),
      sections = [];
    let cells = 0;
    for (const table of tables) {
      const lines = [];
      for (const row of nodes(table, 'table-row')) {
        const values = [];
        for (const cell of [...row.children].filter((c) =>
          ['table-cell', 'covered-table-cell'].includes(c.localName),
        )) {
          const text = nodes(cell, 'p')
              .map((p) => p.textContent)
              .join(' '),
            repeat = Math.min(1000, Number(attr(cell, 'number-columns-repeated')) || 1);
          if (!text && repeat > 100) continue;
          cells += repeat;
          if (cells > 100000) throw new Error('Office spreadsheet exceeds 100,000 cells.');
          for (let n = 0; n < repeat; n++)
            values.push(text || attr(cell, 'value') || attr(cell, 'string-value') || '');
        }
        if (values.some((x) => x.trim())) {
          const repeated = Math.min(1000, Number(attr(row, 'number-rows-repeated')) || 1);
          for (let n = 0; n < repeated; n++) lines.push(values.join(' | '));
          if (lines.length > 100000) throw new Error('Office spreadsheet exceeds 100,000 rows.');
        }
      }
      sections.push({
        title: attr(table, 'name') || `Sheet ${sections.length + 1}`,
        text: lines.join('\n'),
      });
    }
    return sections;
  }
  throw new Error('Office reflow supports DOCX, XLSX, PPTX, ODT, ODS, ODP and RTF.');
}
export async function renderOffice(inputs, o, signal, onProgress) {
  const source = inputs[0].source,
    sections = await officeSections(inputs[0].file, source, signal);
  if (!sections.some((s) => s.text.trim()))
    throw new Error(
      'No document text or cached spreadsheet values could be extracted. Charts, images and drawings alone are unsupported.',
    );
  const scale = o.dpi / 72,
    pageWidth = 595.28,
    pageHeight = 841.89,
    margin = 44,
    lineHeight = 16,
    fontSize = 11,
    maxLines = Math.floor((pageHeight - 2 * margin) / lineHeight),
    pdf = o.format === 'pdf' ? await PDFDocument.create() : null,
    files = {};
  let count = 0,
    totalPixels = 0,
    current,
    line = 0;
  const start = () => {
    current = canvas(Math.ceil(pageWidth * scale), Math.ceil(pageHeight * scale));
    current.ctx.fillStyle = 'white';
    current.ctx.fillRect(0, 0, current.canvas.width, current.canvas.height);
    current.ctx.fillStyle = '#111';
    current.ctx.font = `${fontSize * scale}px Arial, sans-serif`;
    current.ctx.textBaseline = 'top';
    line = 0;
  };
  const finish = async () => {
    if (!current) return;
    checkAbort(signal);
    if (++count > (pdf ? 100 : 20))
      throw new Error(`Office output exceeds ${pdf ? 100 : 20} pages.`);
    totalPixels += current.canvas.width * current.canvas.height;
    if (totalPixels > 100_000_000) throw new Error('Office rendering exceeds 100 million pixels.');
    onProgress?.({
      stage: `Creating reflowed page ${count}`,
      progress: Math.min(95, 20 + count * 4),
    });
    if (pdf) {
      const image = await pdf.embedJpg(
        await (await canvasBlob(current.canvas, 'image/jpeg', 0.94)).arrayBuffer(),
      );
      pdf
        .addPage([pageWidth, pageHeight])
        .drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });
    } else
      files[`page-${String(count).padStart(3, '0')}.${o.format}`] = new Uint8Array(
        await (
          await canvasBlob(current.canvas, `image/${o.format === 'jpg' ? 'jpeg' : 'png'}`, 0.94)
        ).arrayBuffer(),
      );
    current.canvas.width = current.canvas.height = 0;
    current = null;
  };
  const write = async (text) => {
    if (!current) start();
    if (line >= maxLines) {
      await finish();
      start();
    }
    current.ctx.fillText(text, margin * scale, (margin + line * lineHeight) * scale);
    line++;
  };
  for (const section of sections) {
    if (current) await finish();
    start();
    if (section.title) {
      await write(section.title);
      await write('');
    }
    for (const paragraph of section.text.replace(/\r/g, '').split('\n')) {
      checkAbort(signal);
      if (!paragraph.trim()) {
        await write('');
        continue;
      }
      let value = '';
      for (const char of paragraph) {
        const next = value + char;
        if (current.ctx.measureText(next).width > (pageWidth - 2 * margin) * scale && value) {
          const breakAt = value.lastIndexOf(' ');
          if (breakAt > value.length / 2) {
            const rest = value.slice(breakAt + 1);
            await write(value.slice(0, breakAt));
            value = rest + char;
          } else {
            await write(value);
            value = char;
          }
        } else value = next;
      }
      if (value) await write(value);
    }
  }
  await finish();
  const details = {
    pages: count,
    rendering: 'Reflowed extracted document text and cached cell values',
    originalLayoutPreserved: false,
    rasterized: true,
    omitted: 'Charts, images, drawings, macros, page styles and interactive features',
  };
  return pdf
    ? result(await pdf.save(), 'office-reflow.pdf', details)
    : zipResult(files, 'office-reflow-pages.zip', details);
}
