import fs from 'node:fs/promises';

import path from 'node:path';

import { randomUUID } from 'node:crypto';

import sharp from 'sharp';

import { PDFDocument } from 'pdf-lib';

import { zipSync } from 'fflate';

import { toolById, toolDefaults } from '../../shared/everyday-tools.js';

import { readInput, checkAbort, fail, LIMITS } from './common.js';

import { validateImage } from './image.js';

export function validateToolOptions(id, supplied = {}) {
  const defaults = toolDefaults(id);

  if (!toolById(id) || !supplied || typeof supplied !== 'object' || Array.isArray(supplied))
    fail('Choose a supported tool and valid settings.');

  for (const key of Object.keys(supplied))
    if (!Object.hasOwn(defaults, key)) fail(`Unsupported setting: ${key}`);

  const settings = { ...defaults, ...supplied };

  const definition = toolById(id);

  if (definition.engine) {
    for (const field of definition.fields || []) {
      const v = settings[field.key];

      if (
        field.type === 'number' &&
        (!Number.isFinite(v) ||
          (field.step === undefined && !Number.isInteger(v)) ||
          (field.min !== undefined && v < field.min) ||
          (field.max !== undefined && v > field.max))
      )
        fail(`Invalid ${field.label}.`);

      if (field.type === 'select' && !field.options.some(([value]) => value === v))
        fail(`Invalid ${field.label}.`);

      if (field.type === 'checkbox' && typeof v !== 'boolean') fail(`Invalid ${field.label}.`);

      if (
        ['text', 'textarea', 'password', 'color'].includes(field.type) &&
        (typeof v !== 'string' || v.length > (field.maxLength || 10000) || v.includes('\0'))
      )
        fail(`Invalid ${field.label}.`);

      if (field.type === 'color' && !/^#[\da-f]{6}$/i.test(v)) fail(`Invalid ${field.label}.`);
    }

    return settings;
  }

  const integer = (key, min, max) => {
    if (!Number.isInteger(settings[key]) || settings[key] < min || settings[key] > max)
      fail(`Invalid ${key}: use a whole number from ${min} to ${max}.`);
  };

  const choice = (key, values) => {
    if (!values.includes(settings[key])) fail(`Invalid ${key}.`);
  };

  for (const key of ['allowResize', 'flip', 'flop'])
    if (key in settings && typeof settings[key] !== 'boolean') fail(`Invalid ${key}.`);

  if ('output' in settings) choice('output', ['jpg', 'png', 'webp']);

  if (id === 'compress-image') integer('targetKB', 1, 102400);

  if (id === 'resize-image') {
    integer('width', 1, 8192);
    integer('height', 1, 8192);
    choice('fit', ['contain', 'cover', 'fill', 'inside']);
    choice('background', ['white', 'transparent']);
    if (settings.width * settings.height > LIMITS.pixels)
      fail('Requested dimensions exceed 40 million pixels.');
  }

  if (id === 'crop-image') {
    for (const key of ['left', 'top']) integer(key, 0, 65535);
    for (const key of ['width', 'height']) integer(key, 1, 65535);
    choice('rotate', [0, 90, 180, 270]);
  }

  if (id === 'split-pdf') {
    if (
      typeof settings.pages !== 'string' ||
      settings.pages.length > 1000 ||
      !/^[\d,\s-]*$/.test(settings.pages)
    )
      fail('Use page numbers and ranges, such as 1-3, 5.');
    choice('mode', ['extract', 'separate']);
  }

  if (id === 'images-to-pdf') {
    choice('paper', ['a4', 'letter', 'original']);
    integer('margin', 0, 72);
  }

  return settings;
}

export function selectedPages(value, count) {
  if (!value.trim()) return Array.from({ length: count }, (_, index) => index);

  const pages = [];

  for (const token of value.split(',')) {
    const match = token.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);

    if (!match) fail('Use page numbers and ranges, such as 1-3, 5.');

    const start = Number(match[1]),
      end = Number(match[2] || match[1]);

    if (start < 1 || end < start || end > count)
      fail(`Page range must stay between 1 and ${count}.`);

    for (let page = start; page <= end; page++) if (!pages.includes(page - 1)) pages.push(page - 1);
  }

  return pages;
}

async function imageInput(input) {
  const buffer = await readInput(input.path);

  const meta = await validateImage(buffer, input.source);

  if ((meta.pages || 1) > 1)
    fail('Choose a still image. Animated or multipage inputs are not supported by this tool.');

  const oriented = await sharp(buffer, { limitInputPixels: LIMITS.pixels, failOn: 'warning' })
    .rotate()
    .png()
    .toBuffer();

  return { buffer: oriented, meta: await sharp(oriented).metadata() };
}

function encode(image, output, quality = 85) {
  if (output === 'jpg')
    return image.flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true }).toBuffer();

  if (output === 'webp') return image.webp({ quality, effort: 4 }).toBuffer();

  return image
    .png({ compressionLevel: 8, ...(quality < 100 ? { palette: true, quality } : {}) })
    .toBuffer();
}

async function pdfInput(input) {
  const buffer = await readInput(input.path);

  if (buffer.subarray(0, 5).toString() !== '%PDF-') fail('File contents do not match PDF.');

  let pdf;

  try {
    pdf = await PDFDocument.load(buffer, { updateMetadata: false });
  } catch {
    fail('This PDF could not be read. Use an unprotected, working PDF.');
  }

  if (pdf.getPageCount() < 1 || pdf.getPageCount() > LIMITS.pages)
    fail('Choose a PDF with 1 to 100 pages.');

  return pdf;
}

export async function convertTool({
  operation,
  inputs,
  outputDir,
  options = {},
  signal,
  onProgress,
}) {
  const tool = toolById(operation),
    settings = validateToolOptions(operation, options);

  if (
    !tool ||
    !Array.isArray(inputs) ||
    inputs.length < (tool.minFiles || 1) ||
    inputs.length > (tool.multiple ? 20 : 1)
  )
    fail('Select the required number of files for this tool.');

  if (inputs.some((input) => !tool.accept.includes('*') && !tool.accept.includes(input.source)))
    fail('This tool does not support the selected input format.');

  checkAbort(signal);
  await fs.mkdir(outputDir, { recursive: true });

  if (operation === 'image-metadata' && settings.mode === 'view')
    return (await import('./reports.js')).convertReports({
      operation,
      inputs,
      outputDir,
      options: settings,
      signal,
    });
  if (operation === 'compress-image' && inputs.length > 1) {
    if (inputs.reduce((sum, input) => sum + (input.size || 0), 0) > LIMITS.inputBytes)
      fail('Combined inputs exceed 100 MB.');
    const files = {},
      reports = [];
    let outputBytes = 0;
    for (const [i, input] of inputs.entries()) {
      checkAbort(signal);
      const result = await convertTool({
          operation,
          inputs: [input],
          outputDir,
          options: settings,
          signal,
          onProgress,
        }),
        data = await fs.readFile(result.path);
      outputBytes += data.length;
      if (outputBytes > 150 * 1024 * 1024) fail('Batch images exceed 150 MB.');
      const name = `${i + 1}-${path.basename(input.name, path.extname(input.name)).replace(/[^a-zA-Z0-9_-]/g, '_')}.${settings.output}`;
      files[name] = data;
      reports.push({
        file: input.name,
        output: name,
        inputBytes: input.size,
        outputBytes: data.length,
        ...result.details,
      });
    }
    files['compression-report.json'] = Buffer.from(JSON.stringify(reports, null, 2));
    const filename = `optimized-images-${randomUUID().slice(0, 8)}.zip`,
      p = path.join(outputDir, filename);
    await fs.writeFile(p, zipSync(files, { level: 3 }));
    return {
      path: p,
      filename,
      mime: 'application/zip',
      details: { files: reports.length, targetMet: reports.every((r) => r.targetMet) },
    };
  }

  if (tool.engine) {
    const handlers = {
      image: ['./image-toolbox.js', 'convertImageTool'],
      media: ['./media-toolbox.js', 'convertMediaTool'],
      document: ['./document-toolbox.js', 'convertDocumentTool'],
      data: ['./data-toolbox.js', 'convertDataTool'],
      productivity: ['./productivity.js', 'convertProductivity'],
      reports: ['./reports.js', 'convertReports'],
    };

    const [module, handler] = handlers[tool.engine] || [];
    if (!module) fail('Unknown processing engine.');

    return (await import(module))[handler]({
      operation,
      inputs,
      outputDir,
      options: settings,
      signal,
      onProgress,
    });
  }

  let result,
    extension =
      operation === 'split-pdf' && settings.mode === 'separate'
        ? 'zip'
        : tool.category === 'document'
          ? 'pdf'
          : settings.output,
    details = {};

  onProgress?.({ stage: 'Checking your files', progress: null });

  if (tool.category === 'image') {
    const { buffer, meta } = await imageInput(inputs[0]);

    if (operation === 'compress-image') {
      const targetBytes = settings.targetKB * 1024;
      let best, chosen;

      const scales = settings.allowResize ? [1, 0.8, 0.6, 0.4] : [1];

      for (const scale of scales) {
        let low = 25,
          high = 95;

        for (let iteration = 0; iteration < 7 && low <= high; iteration++) {
          checkAbort(signal);
          const quality = Math.floor((low + high) / 2);

          const output = await encode(
            sharp(buffer, { limitInputPixels: LIMITS.pixels }).resize({
              width: Math.max(1, Math.round(meta.width * scale)),
              withoutEnlargement: true,
            }),
            settings.output,
            quality,
          );

          const candidate = { buffer: output, quality, scale };
          if (!best || output.length < best.buffer.length) best = candidate;

          if (output.length <= targetBytes) {
            chosen = candidate;
            low = quality + 1;
          } else high = quality - 1;

          onProgress?.({ stage: 'Finding a smaller image', progress: null });
        }

        if (chosen) break;
      }

      const candidate = chosen || best;
      result = candidate.buffer;

      const outputMeta = await sharp(result).metadata();

      details = {
        targetMet: result.length <= targetBytes,
        targetBytes,
        quality: candidate.quality,
        width: outputMeta.width,
        height: outputMeta.height,
      };
    } else {
      let image = sharp(buffer, { limitInputPixels: LIMITS.pixels });

      if (operation === 'resize-image')
        image = image.resize({
          width: settings.width,
          height: settings.height,
          fit: settings.fit,
          background:
            settings.background === 'transparent' ? { r: 0, g: 0, b: 0, alpha: 0 } : '#ffffff',
        });
      else {
        if (
          settings.left + settings.width > meta.width ||
          settings.top + settings.height > meta.height
        )
          fail(`The crop must stay inside the ${meta.width} × ${meta.height} image.`);

        image = image
          .extract({
            left: settings.left,
            top: settings.top,
            width: settings.width,
            height: settings.height,
          })
          .rotate(settings.rotate);

        if (settings.flip) image = image.flip();
        if (settings.flop) image = image.flop();
      }

      result = await encode(image, settings.output, settings.output === 'png' ? 100 : 90);

      const outputMeta = await sharp(result).metadata();
      details = { width: outputMeta.width, height: outputMeta.height };
    }

    await validateImage(result, settings.output);
  } else {
    const destination = await PDFDocument.create();

    if (operation === 'merge-pdf') {
      for (const [index, input] of inputs.entries()) {
        checkAbort(signal);
        const source = await pdfInput(input);

        if (destination.getPageCount() + source.getPageCount() > LIMITS.pages)
          fail('The merged PDF would exceed 100 pages.');

        for (const page of await destination.copyPages(source, source.getPageIndices()))
          destination.addPage(page);

        onProgress?.({
          stage: `Added document ${index + 1} of ${inputs.length}`,
          progress: Math.round(((index + 1) / inputs.length) * 90),
        });
      }

      result = Buffer.from(await destination.save());
      details = { pages: destination.getPageCount() };
    } else if (operation === 'split-pdf') {
      const source = await pdfInput(inputs[0]),
        pages = selectedPages(settings.pages, source.getPageCount());

      if (settings.mode === 'separate') {
        const files = {};
        let size = 0;

        for (const [index, page] of pages.entries()) {
          checkAbort(signal);
          const document = await PDFDocument.create();
          document.addPage((await document.copyPages(source, [page]))[0]);
          const data = new Uint8Array(await document.save());
          size += data.length;

          if (size > LIMITS.outputBytes) fail('Split pages exceed the 200 MB output limit.');
          files[`page-${String(page + 1).padStart(3, '0')}.pdf`] = data;

          onProgress?.({
            stage: `Saved page ${index + 1} of ${pages.length}`,
            progress: Math.round(((index + 1) / pages.length) * 90),
          });
        }

        result = Buffer.from(zipSync(files, { level: 0 }));
      } else {
        for (const page of await destination.copyPages(source, pages)) destination.addPage(page);
        result = Buffer.from(await destination.save());
      }

      details = { pages: pages.length };
    } else if (operation === 'images-to-pdf') {
      let totalPixels = 0;

      for (const [index, input] of inputs.entries()) {
        checkAbort(signal);
        const { buffer, meta } = await imageInput(input);
        totalPixels += meta.width * meta.height;
        if (totalPixels > 100_000_000) fail('Selected images exceed 100 million total pixels.');

        const png = await sharp(buffer).png().toBuffer();
        const image = await destination.embedPng(png);

        let dimensions =
          settings.paper === 'a4'
            ? [595.28, 841.89]
            : settings.paper === 'letter'
              ? [612, 792]
              : [image.width + settings.margin * 2, image.height + settings.margin * 2];

        if (settings.paper !== 'original' && image.width > image.height)
          dimensions = dimensions.reverse();

        const page = destination.addPage(dimensions),
          scale = Math.min(
            (dimensions[0] - settings.margin * 2) / image.width,
            (dimensions[1] - settings.margin * 2) / image.height,
          );

        page.drawImage(image, {
          x: (dimensions[0] - image.width * scale) / 2,
          y: (dimensions[1] - image.height * scale) / 2,
          width: image.width * scale,
          height: image.height * scale,
        });

        onProgress?.({
          stage: `Added image ${index + 1} of ${inputs.length}`,
          progress: Math.round(((index + 1) / inputs.length) * 90),
        });
      }

      result = Buffer.from(await destination.save());
      details = { pages: destination.getPageCount() };
    }
  }

  checkAbort(signal);
  if (!result?.length || result.length > LIMITS.outputBytes)
    fail('Output is empty or exceeds the 200 MB output limit.');

  if (extension === 'pdf') {
    const verified = await PDFDocument.load(result);
    if (!verified.getPageCount()) fail('PDF output could not be verified.');
  }

  const filename = `${operation}-${randomUUID().slice(0, 8)}.${extension}`,
    outputPath = path.join(outputDir, filename);

  await fs.writeFile(outputPath, result, { flag: 'wx' });

  return {
    path: outputPath,
    filename,
    mime: {
      pdf: 'application/pdf',
      zip: 'application/zip',
      png: 'image/png',
      jpg: 'image/jpeg',
      webp: 'image/webp',
    }[extension],
    details,
  };
}
