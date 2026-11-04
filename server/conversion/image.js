import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { LIMITS, fail, safeSvg } from './common.js';
sharp.concurrency(1);
sharp.cache({ memory: 32, files: 0, items: 20 });
export const imageSources = ['jpg', 'png', 'webp', 'avif', 'gif', 'tiff', 'svg'];
export const imageTargets = imageSources.filter((x) => x !== 'svg');
export async function validateImage(buffer, source) {
  if (source === 'svg') safeSvg(buffer);
  const meta = await sharp(buffer, {
    limitInputPixels: LIMITS.pixels,
    failOn: 'warning',
    pages: 1,
  }).metadata();
  const expected = { jpg: 'jpeg', avif: 'heif' }[source] ?? source;
  if (meta.format !== expected || (source === 'avif' && meta.compression !== 'av1'))
    fail('File content does not match its selected image format.');
  if (!meta.width || !meta.height || meta.width * meta.height > LIMITS.pixels)
    fail('Image exceeds 40 million pixels.');
  return meta;
}
export async function convertImage(buffer, source, target, options) {
  const meta = await validateImage(buffer, source);
  if (options.width) {
    const swapped = meta.orientation >= 5 && meta.orientation <= 8;
    const inputWidth = swapped ? meta.height : meta.width;
    const inputHeight = swapped ? meta.width : meta.height;
    if (options.width * Math.ceil((inputHeight * options.width) / inputWidth) > LIMITS.pixels)
      fail('Resized image exceeds 40 million pixels.');
  }
  let image = sharp(buffer, {
    limitInputPixels: LIMITS.pixels,
    failOn: 'warning',
    pages: 1,
  }).rotate();
  if (options.width) image = image.resize({ width: options.width });
  if (target === 'pdf') {
    const png = await image.png().toBuffer();
    const pdf = await PDFDocument.create();
    const picture = await pdf.embedPng(png);
    const page = pdf.addPage([picture.width, picture.height]);
    page.drawImage(picture, { x: 0, y: 0, width: picture.width, height: picture.height });
    return Buffer.from(await pdf.save());
  }
  if (target === 'jpg') image = image.flatten({ background: '#ffffff' });
  return image
    .toFormat(target === 'jpg' ? 'jpeg' : target, {
      ...(options.quality ? { quality: options.quality } : {}),
      ...(target === 'avif' ? { effort: 4 } : {}),
    })
    .toBuffer();
}
