import sharp from 'sharp';
import QRCodeStyling from 'qr-code-styling';
import { JSDOM } from 'jsdom';
import {
  MultiFormatReader,
  RGBLuminanceSource,
  HybridBinarizer,
  BinaryBitmap,
} from '@zxing/library';
import { fail, LIMITS } from './common.js';
import { qrPayload } from '../../shared/qr-payload.js';
export async function decodeQr(buffer) {
  const { data, info } = await sharp(buffer, { limitInputPixels: LIMITS.pixels })
    .rotate()
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const reader = new MultiFormatReader();
  try {
    reader.setHints(new Map());
    return reader
      .decodeWithState(
        new BinaryBitmap(
          new HybridBinarizer(
            new RGBLuminanceSource(new Uint8ClampedArray(data), info.width, info.height),
          ),
        ),
      )
      .getText();
  } finally {
    reader.reset();
  }
}
export async function styledQr(text, o, logo) {
  const payload = qrPayload(text, o);
  if (!payload || payload.length > 2000) fail('QR content must contain 1 to 2,000 characters.');
  const rgb = (h) =>
      [1, 3, 5]
        .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
        .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)),
    lum = (h) => rgb(h).reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
  if (
    (Math.max(lum(o.foreground), lum(o.background)) + 0.05) /
      (Math.min(lum(o.foreground), lum(o.background)) + 0.05) <
    3
  )
    fail('Choose QR colours with at least 3:1 contrast.');
  const q = new QRCodeStyling({
    jsdom: JSDOM,
    type: 'svg',
    width: o.width,
    height: o.width,
    margin: Math.max(24, Math.round(o.width * 0.06)),
    data: payload,
    qrOptions: { errorCorrectionLevel: 'H' },
    dotsOptions: { type: o.dots, color: o.foreground },
    cornersSquareOptions: { type: o.corners, color: o.foreground },
    cornersDotOptions: { color: o.foreground },
    backgroundOptions: { color: o.background },
  });
  let svg = Buffer.from(await q.getRawData('svg'));
  // Only our decoded raster logo is embedded; never embed user SVG or URL content.
  if (logo) {
    const png = await sharp(logo, { limitInputPixels: LIMITS.pixels })
        .resize(128, 128, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer(),
      size = o.width * 0.18,
      position = (o.width - size) / 2;
    svg = Buffer.from(
      svg
        .toString()
        .replace(
          '</svg>',
          `<rect x="${position - 4}" y="${position - 4}" width="${size + 8}" height="${size + 8}" fill="${o.background}"/><image x="${position}" y="${position}" width="${size}" height="${size}" href="data:image/png;base64,${png.toString('base64')}"/></svg>`,
        ),
    );
  }
  const png = await sharp(svg, { limitInputPixels: LIMITS.pixels }).png().toBuffer();
  let verified;
  if (o.verify) {
    try {
      verified = (await decodeQr(png)) === payload;
    } catch {
      verified = false;
    }
    if (!verified)
      fail(
        'This QR design could not be decoded. Increase its size, simplify styling or remove the logo.',
      );
  }
  return {
    buffer: o.format === 'svg' ? svg : png,
    details: { ...(o.verify ? { scanVerified: verified } : {}), width: o.width, height: o.width },
  };
}
