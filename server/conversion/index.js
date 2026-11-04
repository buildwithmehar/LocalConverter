import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { getRegistry, formats } from './registry.js';
import { readInput, validateOptions, checkAbort, LIMITS, fail, textInput } from './common.js';
import { convertImage, validateImage } from './image.js';
import { convertPdf } from './pdf.js';
import { convertData } from './data.js';
import { convertDocument, convertSubtitle } from './documents.js';
import { convertArchive } from './packaging.js';
import { convertMedia } from './media.js';
import { convertNativeArchive } from './native-archives.js';
export { getRegistry };
export async function convert({
  inputPath,
  outputDir,
  source,
  target,
  options = {},
  signal,
  onProgress,
}) {
  checkAbort(signal);
  const registry = await getRegistry();
  const pair = registry.pairs.find((p) => p.source === source && p.target === target);
  if (!pair) fail('Unsupported conversion pair.');
  const settings = validateOptions(pair, options);
  const buffer = await readInput(inputPath);
  checkAbort(signal);
  await fs.mkdir(outputDir, { recursive: true });
  onProgress?.({ stage: 'Validating and converting', progress: null });
  let extension = target,
    result,
    details;
  const filenameBase = `converted-${randomUUID().slice(0, 8)}`;
  let outputPath = path.join(outputDir, `${filenameBase}.${extension}`);
  try {
    switch (pair.engine) {
      case 'Sharp':
        result = await convertImage(buffer, source, target, settings);
        break;
      case 'PDF.js': {
        const converted = await convertPdf(buffer, target, settings, signal, onProgress);
        result = converted.buffer;
        extension = converted.extension;
        outputPath = path.join(outputDir, `${filenameBase}.${extension}`);
        break;
      }
      case 'Data':
        result = await convertData(buffer, source, target);
        break;
      case 'Mammoth':
      case 'PDFKit':
      case 'Text':
        result = await convertDocument(buffer, source, target);
        break;
      case 'Subtitles':
        result = convertSubtitle(buffer, source, target);
        break;
      case 'Archive':
        if (source === 'txt') textInput(buffer);
        result = convertArchive(buffer, source, target);
        break;
      case '7-Zip':
        result = await convertNativeArchive({
          inputPath,
          outputPath,
          buffer,
          source,
          target,
          options: settings,
          signal,
          onProgress,
        });
        break;
      case 'FFmpeg':
        details = await convertMedia({
          inputPath,
          path: outputPath,
          buffer,
          source,
          target,
          options: settings,
          signal,
          onProgress,
        });
        break;
      default:
        fail('Engine unavailable.');
    }
    checkAbort(signal);
    if (result) {
      if (!result.length || result.length > LIMITS.outputBytes)
        fail('Output is empty or exceeds 200 MB.');
      if (['png', 'jpg', 'webp', 'avif', 'gif', 'tiff'].includes(extension))
        await validateImage(result, extension);
      await fs.writeFile(outputPath, result, { flag: 'wx' });
    }
    const stat = await fs.stat(outputPath);
    if (!stat.size || stat.size > LIMITS.outputBytes) fail('Output validation failed.');
    onProgress?.({ stage: 'Complete', progress: 100 });
    return {
      path: outputPath,
      filename: path.basename(outputPath),
      mime: formats.find((f) => f.id === extension).mime,
      ...(details ? { details } : {}),
    };
  } catch (error) {
    await fs.rm(outputPath, { force: true }).catch(() => {});
    throw error;
  }
}
