import { toolById, toolDefaults } from '../../shared/everyday-tools.js';
import {
  MIME,
  canvas,
  canvasBlob,
  drawFit,
  checkAbort,
  result,
  zipResult,
  stem,
} from './image-common.js';
import { imageTool, decodeImage, encodeCanvas } from './image-engine.js';
import {
  manipulatePdf,
  imagesPdf,
  convertPdfPair,
  pdfText,
  openPdf,
  renderPage,
} from './pdf-engine.js';
import { semanticConvert, ocrDocument } from './document-engine.js';

export const unsupportedReasons = {};
const nativeIds = Object.keys(unsupportedReasons);
const implemented = [
  'compress-image',
  'resize-image',
  'crop-image',
  'merge-pdf',
  'split-pdf',
  'images-to-pdf',
  'bmp-converter',
  'icon-favicon',
  'jfif-converter',
  'image-vectorize',
  'resize-print-image',
  'passport-signature',
  'image-watermark',
  'image-collage',
  'image-dpi',
  'image-metadata',
  'svg-optimize',
  'svg-sprite',
  'reorder-pdf',
  'rotate-pdf',
  'compress-pdf',
  'ocr-document',
  'stamp-pdf',
  'fill-pdf-form',
  'compare-pdfs',
  'pdf-tables',
  'pdf-markdown',
  'convert-ebook',
  'semantic-document',
  'scan-cleanup',
  'heic-converter',
  'remove-background',
  'photo-background',
  'psd-export',
  'convert-font',
  'jxl-converter',
  'raw-converter',
  'ai-upscale',
  'office-render',
];
export const supportedToolIds = implemented;
export const capabilities = Object.fromEntries(
  [...implemented, ...nativeIds].map((id) => [
    id,
    {
      supported: implemented.includes(id),
      ...(unsupportedReasons[id] ? { reason: unsupportedReasons[id] } : {}),
    },
  ]),
);
Object.assign(capabilities['scan-cleanup'], {
  limitations:
    'Automatic bright page-border perspective correction, text-line deskew and adaptive contrast/grayscale/threshold cleanup. Review automatic geometry corrections.',
});
Object.assign(capabilities['pdf-tables'], {
  limitations:
    'Detects selectable-text tables from vector grid lines or aligned text. Merged cells, multiple grids and irregular layouts need review.',
});
Object.assign(capabilities['convert-ebook'], {
  limitations:
    'Unprotected EPUB to EPUB or text. MOBI/AZW3 and ebook PDF rendering require Calibre and are unavailable.',
});
Object.assign(capabilities['image-vectorize'], {
  limitations: 'Editable quantized pixel contour paths. Curved outlines are not smoothed.',
});
Object.assign(capabilities['compress-image'], {
  limitations:
    'PNG is re-encoded losslessly; palette reduction is unavailable. Target success is reported honestly.',
});
Object.assign(capabilities['pdf-markdown'], {
  limitations:
    'Selectable text is extracted into Markdown. Complex reading order, headings and tables need review; scans require OCR first.',
});
Object.assign(capabilities['psd-export'], {
  limitations:
    'Standard PSD cached composite or stored layer pixels. PSB is unsupported. Layer masks, effects and blending are listed without re-rendering.',
});
Object.assign(capabilities['heic-converter'], {
  limitations:
    'Decodes the primary HEIC/HEIF still image locally. Auxiliary depth maps and image sequences are not exported.',
});
Object.assign(capabilities['raw-converter'], {
  limitations:
    'LibRaw camera white balance and sRGB, on isolated browser pages. Unsupported camera/compression variants fail explicitly.',
});
Object.assign(capabilities['ai-upscale'], {
  limitations:
    'Local subpixel CNN trained at 3×, resampled to requested 2×/4×. Uses an edge-aware local denoiser and global contrast stretch; results differ from native FSRCNN.',
});
Object.assign(capabilities['office-render'], {
  limitations:
    'Reflows extracted text and cached spreadsheet values into raster PDF or page images. Original Office layout, charts, images, drawings, macros and interactive features are omitted.',
});
export const supportedPairFormats = {
  imageSources: [
    'jpg',
    'jpeg',
    'png',
    'webp',
    'avif',
    'gif',
    'tiff',
    'tif',
    'svg',
    'bmp',
    'jfif',
    'ico',
    'heic',
    'heif',
    'jxl',
  ],
  imageTargets: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'tiff', 'bmp', 'pdf'],
  pdfTargets: ['txt', 'md', 'png', 'jpg', 'webp'],
  documentSources: ['md', 'markdown', 'html', 'htm', 'txt', 'docx', 'rtf', 'odt', 'epub'],
  documentTargets: ['md', 'html', 'txt', 'docx', 'rtf', 'odt', 'epub', 'pdf'],
};
const normalize = (x) =>
  ({ jpeg: 'jpg', tif: 'tiff', markdown: 'md', htm: 'html' })[String(x).toLowerCase()] ||
  String(x).toLowerCase();
export function isSupportedPair(source, target) {
  source = normalize(source);
  target = normalize(target);
  return (
    (supportedPairFormats.imageSources.includes(source) &&
      supportedPairFormats.imageTargets.includes(target)) ||
    (source === 'pdf' && supportedPairFormats.pdfTargets.includes(target)) ||
    (supportedPairFormats.documentSources.includes(source) &&
      supportedPairFormats.documentTargets.includes(target) &&
      !(target === 'pdf' && ['rtf', 'odt', 'epub'].includes(source)))
  );
}
export function validateOptions(operation, supplied = {}) {
  const tool = toolById(operation),
    defaults = toolDefaults(operation);
  if (!tool || !supplied || Array.isArray(supplied) || typeof supplied !== 'object')
    throw new Error('Choose a supported tool and valid settings.');
  for (const key of Object.keys(supplied))
    if (!Object.hasOwn(defaults, key)) throw new Error(`Unsupported setting: ${key}`);
  const o = { ...defaults, ...supplied };
  for (const field of tool.fields || []) {
    const v = o[field.key];
    if (
      field.type === 'number' &&
      (!Number.isFinite(v) ||
        ((field.step ?? 1) >= 1 && !Number.isInteger(v)) ||
        v < field.min ||
        v > field.max)
    )
      throw new Error(`Invalid ${field.label}.`);
    if (field.type === 'select' && !field.options.some(([value]) => value === v))
      throw new Error(`Invalid ${field.label}.`);
    if (field.type === 'checkbox' && typeof v !== 'boolean')
      throw new Error(`Invalid ${field.label}.`);
    if (
      ['text', 'textarea', 'password', 'color'].includes(field.type) &&
      (typeof v !== 'string' || v.length > (field.maxLength || 10000) || v.includes('\0'))
    )
      throw new Error(`Invalid ${field.label}.`);
    if (field.type === 'color' && !/^#[\da-f]{6}$/i.test(v))
      throw new Error(`Invalid ${field.label}.`);
  }
  const integer = (key, min, max) => {
    if (!Number.isInteger(o[key]) || o[key] < min || o[key] > max)
      throw new Error(`Invalid ${key}: use a whole number from ${min} to ${max}.`);
  };
  if ('output' in o && !['png', 'jpg', 'webp'].includes(o.output))
    throw new Error('Invalid image output format.');
  for (const key of ['allowResize', 'flip', 'flop'])
    if (key in o && typeof o[key] !== 'boolean') throw new Error(`Invalid ${key}.`);
  if (operation === 'compress-image') integer('targetKB', 1, 102400);
  if (operation === 'resize-image') {
    integer('width', 1, 8192);
    integer('height', 1, 8192);
    if (
      !['contain', 'cover', 'fill', 'inside'].includes(o.fit) ||
      !['transparent', 'white'].includes(o.background)
    )
      throw new Error('Invalid resize fit or background.');
  }
  if (operation === 'crop-image') {
    integer('left', 0, 65535);
    integer('top', 0, 65535);
    integer('width', 1, 65535);
    integer('height', 1, 65535);
    if (![0, 90, 180, 270].includes(o.rotate)) throw new Error('Invalid rotation.');
  }
  if (operation === 'split-pdf' && !['extract', 'separate'].includes(o.mode))
    throw new Error('Invalid split mode.');
  if (operation === 'images-to-pdf') {
    if (!['a4', 'letter', 'original'].includes(o.paper)) throw new Error('Invalid paper size.');
    integer('margin', 0, 72);
  }
  return o;
}
async function metadata(inputs, o) {
  const { metadataReport } = await import('./utility-reports.js');
  const fields = await metadataReport(await inputs[0].file.arrayBuffer()),
    search = (o.search || '').toLowerCase(),
    filtered = Object.fromEntries(
      Object.entries(fields).filter(
        ([k, v]) => !search || `${k} ${v}`.toLowerCase().includes(search),
      ),
    );
  if (o.reportFormat === 'csv') {
    const csv = (x) => `"${String(x).replace(/"/g, '""')}"`;
    return result(
      'Field,Value\r\n' +
        Object.entries(filtered)
          .map(([k, v]) => `${csv(k)},${csv(v)}`)
          .join('\r\n') +
        '\r\n',
      'metadata.csv',
    );
  }
  return result(JSON.stringify(filtered, null, 2), 'metadata.json');
}
async function scanCleanup(inputs, o, signal, onProgress) {
  const { cleanScan } = await import('./image-scan-engine.js');
  return cleanScan(inputs[0], o, signal, onProgress);
}
async function comparePdfs(inputs, o, signal, onProgress) {
  if (inputs.length !== 2) throw new Error('Choose exactly two PDFs.');
  const docs = await Promise.all(inputs.map((i) => openPdf(i.file)));
  try {
    if (docs.some((d) => d.numPages > 20))
      throw new Error('Comparison allows up to 20 pages in each PDF.');
    const files = {},
      stats = [];
    let total = 0;
    const texts = [[], []];
    for (let i = 1; i <= Math.max(...docs.map((d) => d.numPages)); i++) {
      checkAbort(signal);
      const rendered = [];
      for (let d = 0; d < 2; d++) {
        if (i > docs[d].numPages) {
          rendered.push(null);
          texts[d].push('');
          continue;
        }
        const page = await docs[d].getPage(i),
          text = await page.getTextContent();
        texts[d].push(text.items.map((x) => x.str || '').join(' '));
        rendered.push(await renderPage(docs[d], i, o.dpi / 72, signal));
      }
      const w = Math.max(...rendered.map((c) => c?.width || 0)),
        h = Math.max(...rendered.map((c) => c?.height || 0));
      total += w * h;
      if (total > 100_000_000) throw new Error('Comparison exceeds 100 million pixels.');
      const images = rendered.map((c) => {
          const { canvas: out, ctx } = canvas(w, h);
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, w, h);
          if (c) ctx.drawImage(c, 0, 0);
          return ctx.getImageData(0, 0, w, h);
        }),
        { canvas: diff, ctx } = canvas(w, h),
        out = ctx.createImageData(w, h);
      let changed = 0;
      for (let p = 0; p < out.data.length; p += 4) {
        const delta = Math.max(
          Math.abs(images[0].data[p] - images[1].data[p]),
          Math.abs(images[0].data[p + 1] - images[1].data[p + 1]),
          Math.abs(images[0].data[p + 2] - images[1].data[p + 2]),
        );
        if (delta > 12) {
          changed++;
          out.data[p] = 255;
          out.data[p + 1] = 30;
          out.data[p + 2] = 30;
        } else
          out.data[p] =
            out.data[p + 1] =
            out.data[p + 2] =
              Math.round(images[0].data[p] * 0.15 + 217);
        out.data[p + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);
      files[`difference-${String(i).padStart(3, '0')}.png`] = new Uint8Array(
        await (await canvasBlob(diff)).arrayBuffer(),
      );
      stats.push({
        page: i,
        width: w,
        height: h,
        changedPixels: changed,
        changedPercent: (changed / (w * h)) * 100,
        leftPageExists: i <= docs[0].numPages,
        rightPageExists: i <= docs[1].numPages,
      });
      onProgress?.({
        stage: `Compared page ${i}`,
        progress: Math.round((i / Math.max(...docs.map((d) => d.numPages))) * 100),
      });
    }
    const { createTwoFilesPatch } = await import('diff');
    files['text-changes.diff'] = new TextEncoder().encode(
      createTwoFilesPatch(
        inputs[0].name,
        inputs[1].name,
        texts[0].join('\n\n'),
        texts[1].join('\n\n'),
      ),
    );
    files['comparison.json'] = new TextEncoder().encode(
      JSON.stringify({ threshold: 12, pages: stats }, null, 2),
    );
    return zipResult(files, 'pdf-comparison.zip', {
      pages: stats.length,
      changedPages: stats.filter((p) => p.changedPixels).length,
    });
  } finally {
    await Promise.all(docs.map((d) => d.loadingTask.destroy()));
  }
}
async function pdfTables(inputs, o, signal) {
  const doc = await openPdf(inputs[0].file),
    tables = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      checkAbort(signal);
      const page = await doc.getPage(i),
        content = await page.getTextContent(),
        rows = [];
      for (const item of content.items
        .filter((x) => x.str?.trim())
        .sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4])) {
        const y = item.transform[5];
        let row = rows.find((r) => Math.abs(r.y - y) < 3);
        if (!row) {
          row = { y, cells: [] };
          rows.push(row);
        }
        row.cells.push({
          x: item.transform[4],
          text: item.str,
          width: item.width,
        });
      }
      let grid = rows
        .map((row) => {
          const cells = [];
          for (const item of row.cells.sort((a, b) => a.x - b.x)) {
            const prev = cells.at(-1);
            if (
              prev &&
              item.x - prev.right < Math.max(12, Math.min(25, (item.width / item.text.length) * 2))
            ) {
              prev.text += ' ' + item.text;
              prev.right = item.x + item.width;
            } else cells.push({ text: item.text, right: item.x + item.width });
          }
          return cells.map((c) => c.text);
        })
        .filter((row) => row.length >= 2);
      if (o.strategy === 'lines') {
        const { lineTable } = await import('./pdf-table-engine.js');
        const { OPS } = await import('pdfjs-dist/build/pdf.mjs');
        grid = lineTable(await page.getOperatorList(), content.items, OPS);
      }
      if (grid.length >= 2) tables.push({ page: i, rows: grid });
      page.cleanup();
    }
    if (!tables.length)
      throw new Error(
        'No aligned selectable-text tables were detected. Irregular layouts and scans require manual review.',
      );
    if (o.format === 'xlsx') {
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      for (const table of tables) {
        const sheet = workbook.addWorksheet(`Page ${table.page}`);
        for (const row of table.rows) sheet.addRow(row);
      }
      return result(await workbook.xlsx.writeBuffer(), 'pdf-tables.xlsx', {
        tables: tables.length,
        strategy: o.strategy,
        reviewRequired: true,
      });
    }
    const entries = {};
    for (const table of tables)
      entries[`page-${table.page}-table.csv`] = new TextEncoder().encode(
        table.rows
          .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
          .join('\r\n') + '\r\n',
      );
    return zipResult(entries, 'pdf-tables.zip', {
      tables: tables.length,
      strategy: o.strategy,
      reviewRequired: true,
    });
  } finally {
    await doc.loadingTask.destroy();
  }
}
export async function convert({ operation, inputs, options = {}, onProgress, signal }) {
  checkAbort(signal);
  if (unsupportedReasons[operation]) throw new Error(unsupportedReasons[operation]);
  if (!supportedToolIds.includes(operation))
    throw new Error('Unsupported browser image or document tool.');
  const tool = toolById(operation),
    o = validateOptions(operation, options);
  if (
    !Array.isArray(inputs) ||
    inputs.length < (tool.minFiles || 1) ||
    inputs.length > (tool.multiple ? 20 : 1)
  )
    throw new Error('Select the required number of files for this tool.');
  inputs = inputs.map((i) => ({
    ...i,
    source: normalize(i.source || i.name?.split('.').pop() || ''),
    name: i.name || i.file?.name || 'input',
  }));
  if (inputs.some((i) => !(i.file instanceof Blob) || !i.file.size))
    throw new Error('Select nonempty input files.');
  if (inputs.some((i) => !tool.accept.map(normalize).includes(i.source)))
    throw new Error('This tool does not support the selected input format.');
  if (inputs.reduce((sum, i) => sum + i.file.size, 0) > 100 * 1024 * 1024)
    throw new Error('Combined inputs exceed 100 MB.');
  onProgress?.({ stage: 'Processing locally in your browser', progress: 5 });
  let out;
  if (
    [
      'heic-converter',
      'remove-background',
      'photo-background',
      'psd-export',
      'convert-font',
      'jxl-converter',
      'raw-converter',
      'ai-upscale',
    ].includes(operation)
  ) {
    const { advancedImageTool } = await import('./advanced-image-engine.js');
    out = await advancedImageTool(operation, inputs, o, signal, onProgress);
  } else if (operation === 'office-render') {
    const { renderOffice } = await import('./document-office-engine.js');
    out = await renderOffice(inputs, o, signal, onProgress);
  } else if (operation === 'images-to-pdf') out = await imagesPdf(inputs, o, decodeImage, signal);
  else if (operation === 'image-metadata' && o.mode === 'view') out = await metadata(inputs, o);
  else if (operation === 'scan-cleanup') out = await scanCleanup(inputs, o, signal, onProgress);
  else if (operation === 'compare-pdfs') out = await comparePdfs(inputs, o, signal, onProgress);
  else if (operation === 'pdf-tables') out = await pdfTables(inputs, o, signal);
  else if (operation === 'pdf-markdown')
    out = result(
      (await pdfText(inputs[0].file, { signal, onProgress })).join('\n\n'),
      'converted.md',
      {
        selectableText: true,
        layout: 'Extracted text; reading order needs review',
      },
    );
  else if (operation === 'ocr-document') out = await ocrDocument(inputs, o, signal, onProgress);
  else if (operation === 'semantic-document')
    out = await semanticConvert(inputs[0].file, inputs[0].source, o.format, {
      signal,
      onProgress,
    });
  else if (operation === 'convert-ebook') {
    if (inputs[0].source !== 'epub' || !['epub', 'txt'].includes(o.format))
      throw new Error(
        'Browser ebook conversion supports unprotected EPUB to EPUB or text. MOBI, AZW3 and ebook PDF rendering require Calibre.',
      );
    out = await semanticConvert(inputs[0].file, 'epub', o.format, {
      signal,
      onProgress,
    });
  } else if (
    [
      'merge-pdf',
      'split-pdf',
      'reorder-pdf',
      'rotate-pdf',
      'compress-pdf',
      'stamp-pdf',
      'fill-pdf-form',
    ].includes(operation)
  )
    out = await manipulatePdf(operation, inputs, o, signal, onProgress);
  else out = await imageTool(operation, inputs, o, signal, onProgress);
  checkAbort(signal);
  onProgress?.({ stage: 'Output ready', progress: 100 });
  return out;
}
export async function convertPair({ source, target, file, options = {}, onProgress, signal }) {
  checkAbort(signal);
  source = normalize(source);
  target = normalize(target);
  if (!(file instanceof Blob) || !file.size) throw new Error('Choose a nonempty input file.');
  if (file.size > 100 * 1024 * 1024) throw new Error('Input exceeds 100 MB.');
  if (!isSupportedPair(source, target))
    throw new Error(
      'This format pair is unavailable in the browser. Choose a supported image, PDF or semantic document conversion.',
    );
  if (source === 'pdf') return convertPdfPair(file, target, options, signal, onProgress);
  if (supportedPairFormats.imageSources.includes(source)) {
    if (target === 'pdf')
      return imagesPdf([{ file, source }], { paper: 'original', margin: 0 }, decodeImage, signal);
    const image = await decodeImage(file, source);
    try {
      const ratio = options.width ? Number(options.width) / image.width : 1,
        w = Math.max(1, Math.round(image.width * ratio)),
        h = Math.max(1, Math.round(image.height * ratio)),
        { canvas: c, ctx } = canvas(w, h);
      drawFit(ctx, image, w, h, 'fill');
      const blob = await encodeCanvas(c, target, options.quality ?? 90);
      checkAbort(signal);
      return result(blob, `${stem(file.name)}.${target}`, {
        width: w,
        height: h,
      });
    } finally {
      image.close?.();
    }
  }
  return semanticConvert(file, source, target, { signal, onProgress });
}
