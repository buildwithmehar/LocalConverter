import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
} from 'pdf-lib';
import {
  canvas,
  canvasBlob,
  checkAbort,
  result,
  zipResult,
  parsePages,
  drawFit,
} from './image-common.js';
export async function loadPdf(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-')
    throw new Error('File contents do not match PDF.');
  let pdf;
  try {
    pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch {
    throw new Error('This PDF could not be read. Choose an unprotected, working PDF.');
  }
  if (pdf.getPageCount() < 1 || pdf.getPageCount() > 100)
    throw new Error('Choose a PDF with 1 to 100 pages.');
  return pdf;
}
export async function openPdf(file, password) {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    password,
    isEvalSupported: false,
    verbosity: 0,
    cMapUrl: '/tool-runtime/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/tool-runtime/pdfjs/standard_fonts/',
    wasmUrl: '/tool-runtime/pdfjs/wasm/',
    useWorkerFetch: true,
  });
  const pdf = await task.promise;
  if (pdf.numPages > 100) {
    await task.destroy();
    throw new Error('PDF exceeds 100 pages.');
  }
  return pdf;
}
export async function renderPage(doc, pageNumber, scale, signal) {
  checkAbort(signal);
  const page = await doc.getPage(pageNumber),
    viewport = page.getViewport({ scale }),
    { canvas: c, ctx } = canvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, c.width, c.height);
  const task = page.render({ canvasContext: ctx, viewport, annotationMode: 0 });
  const cancel = () => task.cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    await task.promise;
  } finally {
    signal?.removeEventListener('abort', cancel);
    page.cleanup();
  }
  return c;
}
export async function pdfText(file, { signal, onProgress, password } = {}) {
  const doc = await openPdf(file, password);
  try {
    const texts = [];
    for (let i = 1; i <= doc.numPages; i++) {
      checkAbort(signal);
      const page = await doc.getPage(i),
        content = await page.getTextContent();
      texts.push(
        content.items
          .map((x) => (x.str || '') + (x.hasEOL ? '\n' : ' '))
          .join('')
          .trim(),
      );
      page.cleanup();
      onProgress?.({
        stage: `Reading page ${i} of ${doc.numPages}`,
        progress: Math.round((i / doc.numPages) * 100),
      });
    }
    if (!texts.some((x) => x.trim()))
      throw new Error('PDF contains no selectable text. Run OCR on scanned pages first.');
    return texts;
  } finally {
    await doc.loadingTask.destroy();
  }
}
export async function convertPdfPair(file, target, o = {}, signal, onProgress) {
  if (['txt', 'md'].includes(target)) {
    const text = await pdfText(file, { signal, onProgress });
    return result(text.join('\n\n'), `converted.${target}`, {
      pages: text.length,
      selectableText: true,
    });
  }
  if (!['png', 'jpg', 'webp'].includes(target))
    throw new Error(
      'PDF converts to selectable text or rendered PNG, JPG and WebP pages in the browser.',
    );
  const doc = await openPdf(file);
  try {
    const pages = o.page ? [Number(o.page)] : Array.from({ length: doc.numPages }, (_, i) => i + 1);
    if (pages.some((p) => !Number.isInteger(p) || p < 1 || p > doc.numPages))
      throw new Error('Selected page does not exist.');
    if (pages.length > 20)
      throw new Error(
        'PDF image rendering allows up to 20 pages. Select a single page for larger PDFs.',
      );
    const files = {};
    let total = 0;
    for (const [i, p] of pages.entries()) {
      const c = await renderPage(doc, p, o.scale || 2, signal);
      total += c.width * c.height;
      if (total > 100_000_000)
        throw new Error('PDF rendering exceeds 100 million pixels in total.');
      const blob = await canvasBlob(c, `image/${target === 'jpg' ? 'jpeg' : target}`, 0.9);
      files[`page-${String(p).padStart(3, '0')}.${target}`] = new Uint8Array(
        await blob.arrayBuffer(),
      );
      onProgress?.({
        stage: `Rendered page ${i + 1} of ${pages.length}`,
        progress: Math.round(((i + 1) / pages.length) * 100),
      });
    }
    return pages.length === 1
      ? result(Object.values(files)[0], Object.keys(files)[0])
      : zipResult(files, 'pdf-pages.zip', { pages: pages.length });
  } finally {
    await doc.loadingTask.destroy();
  }
}
export async function imagesPdf(inputs, o, decode, signal) {
  const pdf = await PDFDocument.create();
  for (const input of inputs) {
    checkAbort(signal);
    const image = await decode(input.file, input.source);
    try {
      const { canvas: c, ctx } = canvas(image.width, image.height);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(image, 0, 0);
      const png = await canvasBlob(c),
        embed = await pdf.embedPng(await png.arrayBuffer());
      const size =
        o.paper === 'letter'
          ? [612, 792]
          : o.paper === 'original'
            ? [image.width, image.height]
            : [595.28, 841.89];
      const margin = o.margin ?? 24;
      if (size[0] <= 2 * margin || size[1] <= 2 * margin)
        throw new Error('Page margin leaves no space for the image.');
      const page = pdf.addPage(size),
        scale = Math.min(
          (size[0] - 2 * margin) / image.width,
          (size[1] - 2 * margin) / image.height,
        ),
        w = image.width * scale,
        h = image.height * scale;
      page.drawImage(embed, {
        x: (size[0] - w) / 2,
        y: (size[1] - h) / 2,
        width: w,
        height: h,
      });
    } finally {
      image.close?.();
    }
  }
  return result(await pdf.save(), 'images.pdf', { pages: inputs.length });
}
export async function manipulatePdf(operation, inputs, o, signal, onProgress) {
  checkAbort(signal);
  const pdf = await loadPdf(inputs[0].file),
    count = pdf.getPageCount();
  let output = pdf;
  if (operation === 'merge-pdf') {
    output = await PDFDocument.create();
    let total = 0;
    for (const input of inputs) {
      checkAbort(signal);
      const source = await loadPdf(input.file);
      total += source.getPageCount();
      if (total > 100) throw new Error('Merged PDF exceeds 100 pages.');
      for (const p of await output.copyPages(source, source.getPageIndices())) output.addPage(p);
    }
  } else if (operation === 'split-pdf' || operation === 'reorder-pdf') {
    const selected = parsePages(o.pages, count, {
      unique: operation !== 'reorder-pdf',
    });
    if (operation === 'split-pdf' && o.mode === 'separate') {
      const entries = {};
      for (const p of selected) {
        checkAbort(signal);
        const next = await PDFDocument.create();
        next.addPage((await next.copyPages(pdf, [p]))[0]);
        entries[`page-${String(p + 1).padStart(3, '0')}.pdf`] = await next.save();
      }
      return zipResult(entries, 'split-pages.zip', { pages: selected.length });
    }
    output = await PDFDocument.create();
    for (const page of await output.copyPages(pdf, selected)) output.addPage(page);
  } else if (operation === 'rotate-pdf') {
    for (const p of parsePages(o.pages, count))
      pdf
        .getPage(p)
        .setRotation(degrees((pdf.getPage(p).getRotation().angle + Number(o.angle)) % 360));
  } else if (operation === 'fill-pdf-form') {
    const form = pdf.getForm();
    if (form.hasXFA()) throw new Error('Dynamic XFA forms are not supported.');
    let values;
    try {
      values = JSON.parse(o.values);
    } catch {
      throw new Error('Field values must be valid JSON.');
    }
    if (!values || Array.isArray(values) || typeof values !== 'object')
      throw new Error('Field values must be a JSON object.');
    for (const [name, value] of Object.entries(values)) {
      const field = form.getFieldMaybe(name);
      if (!field)
        throw new Error(
          `Unknown field ${name}. Available: ${form
            .getFields()
            .map((f) => f.getName())
            .join(', ')}`,
        );
      if (field instanceof PDFCheckBox) {
        if (typeof value !== 'boolean') throw new Error(`${name} requires true or false.`);
        value ? field.check() : field.uncheck();
      } else if (field instanceof PDFTextField) {
        if (typeof value !== 'string') throw new Error(`${name} requires text.`);
        field.setText(value);
      } else if (
        field instanceof PDFDropdown ||
        field instanceof PDFOptionList ||
        field instanceof PDFRadioGroup
      ) {
        if (typeof value !== 'string' || !field.getOptions().includes(value))
          throw new Error(`Invalid selection for ${name}.`);
        field.select(value);
      } else throw new Error(`Field type for ${name} is not supported.`);
    }
    if (o.flatten) form.flatten();
  } else if (operation === 'stamp-pdf') {
    const selected = parsePages(o.pages, count);
    if (o.kind === 'overlay') {
      if (inputs.length !== 2)
        throw new Error('Overlay requires the destination PDF and overlay PDF.');
      const overlay = await loadPdf(inputs[1].file);
      const pages = await pdf.embedPages(overlay.getPages());
      for (const [i, index] of selected.entries()) {
        const page = pdf.getPage(index),
          stamp = pages[i % pages.length],
          scale = Math.min(page.getWidth() / stamp.width, page.getHeight() / stamp.height);
        page.drawPage(stamp, {
          x: (page.getWidth() - stamp.width * scale) / 2,
          y: (page.getHeight() - stamp.height * scale) / 2,
          width: stamp.width * scale,
          height: stamp.height * scale,
        });
      }
    } else {
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      for (const index of selected) {
        const page = pdf.getPage(index),
          text = o.kind === 'numbers' ? String(index + 1) : o.text;
        const width = font.widthOfTextAtSize(text, o.fontSize);
        const watermark = o.kind === 'watermark';
        page.drawText(text, {
          x: Math.max(8, (page.getWidth() - width) / 2),
          y: watermark ? page.getHeight() / 2 : 24,
          size: o.fontSize,
          font,
          color: rgb(0.25, 0.25, 0.25),
          opacity: o.opacity / 100,
          rotate: degrees(watermark ? 35 : 0),
        });
      }
    }
  } else if (operation === 'compress-pdf' && o.mode === 'raster') {
    const source = await openPdf(inputs[0].file);
    try {
      if (source.numPages > 20) throw new Error('Raster compression allows up to 20 pages.');
      output = await PDFDocument.create();
      let total = 0;
      for (let i = 1; i <= source.numPages; i++) {
        const page = await source.getPage(i),
          view = page.getViewport({ scale: 1 }),
          c = await renderPage(source, i, o.dpi / 72, signal);
        total += c.width * c.height;
        if (total > 100_000_000) throw new Error('Raster compression exceeds 100 million pixels.');
        const image = await output.embedJpg(
            await (await canvasBlob(c, 'image/jpeg', o.quality / 100)).arrayBuffer(),
          ),
          next = output.addPage([view.width, view.height]);
        next.drawImage(image, {
          x: 0,
          y: 0,
          width: view.width,
          height: view.height,
        });
        onProgress?.({
          stage: `Compressed page ${i} of ${source.numPages}`,
          progress: Math.round((i / source.numPages) * 100),
        });
      }
    } finally {
      await source.loadingTask.destroy();
    }
  } else if (operation !== 'compress-pdf') throw new Error('Unsupported PDF operation.');
  checkAbort(signal);
  const bytes = await output.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });
  return result(bytes, `${operation}.pdf`, {
    pages: output.getPageCount(),
    ...(operation === 'compress-pdf'
      ? {
          inputBytes: inputs[0].file.size,
          outputBytes: bytes.length,
          reduced: bytes.length < inputs[0].file.size,
          rasterized: o.mode === 'raster',
        }
      : {}),
  });
}
export async function textPdf(text) {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica),
    size = 11,
    lineHeight = 15,
    maxWidth = 499;
  let page = pdf.addPage([595.28, 841.89]),
    y = 794;
  for (const paragraph of text.replace(/\r/g, '').split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      let candidate = line ? `${line} ${word}` : word;
      let measured;
      try {
        measured = font.widthOfTextAtSize(candidate, size);
      } catch {
        throw new Error(
          'Browser text-to-PDF supports Latin-1 text. Use DOCX or HTML output to preserve other scripts.',
        );
      }
      if (measured > maxWidth && line) {
        if (y < 48) {
          page = pdf.addPage([595.28, 841.89]);
          y = 794;
        }
        page.drawText(line, { x: 48, y, size, font });
        y -= lineHeight;
        line = word;
      } else line = candidate;
    }
    if (y < 48) {
      page = pdf.addPage([595.28, 841.89]);
      y = 794;
    }
    page.drawText(line, { x: 48, y, size, font });
    y -= lineHeight;
    if (pdf.getPageCount() > 100) throw new Error('Text output exceeds 100 pages.');
  }
  return result(await pdf.save(), 'converted.pdf', {
    pages: pdf.getPageCount(),
    layout: 'Plain text, reflowed',
  });
}
