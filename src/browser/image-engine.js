import {
  MIME,
  canvas,
  canvasBlob,
  drawFit,
  pixels,
  checkAbort,
  result,
  zipResult,
} from './image-common.js';
const codecCache = {};
export async function decodeImage(file, source = '') {
  if (source === 'jxl') {
    const { jxlCanvas } = await import('./image-extra-codecs.js');
    return jxlCanvas(file);
  }
  if (source === 'heic' || source === 'heif') {
    const { heicBitmap } = await import('./advanced-image-engine.js');
    return heicBitmap(file);
  }
  if (source === 'svg') safeSvg(await file.text());
  if (['png', 'webp', 'gif', 'avif'].includes(source)) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (source === 'png') {
      let p = 8;
      while (p + 12 <= bytes.length) {
        const length = new DataView(bytes.buffer, p, 4).getUint32(0),
          type = new TextDecoder().decode(bytes.subarray(p + 4, p + 8));
        if (type === 'acTL')
          throw new Error('Animated images are unsupported. Export a still frame first.');
        p += 12 + length;
      }
    }
    if (source === 'webp' && new TextDecoder().decode(bytes.subarray(0, 128)).includes('ANIM'))
      throw new Error('Animated images are unsupported. Export a still frame first.');
    if (source === 'avif' && new TextDecoder().decode(bytes.subarray(0, 128)).includes('avis'))
      throw new Error('Animated AVIF is unsupported. Export a still frame first.');
    if (source === 'gif') {
      let p = 13;
      if (bytes[10] & 128) p += 3 * (1 << ((bytes[10] & 7) + 1));
      let frames = 0;
      while (p < bytes.length) {
        const tag = bytes[p++];
        if (tag === 0x3b) break;
        if (tag === 0x2c) {
          if (++frames > 1)
            throw new Error('Animated GIF is unsupported. Export a still frame first.');
          const flags = bytes[p + 8];
          p += 9;
          if (flags & 128) p += 3 * (1 << ((flags & 7) + 1));
          p++;
        } else if (tag === 0x21) p++;
        else break;
        while (p < bytes.length) {
          const size = bytes[p++];
          if (!size) break;
          p += size;
        }
      }
    }
  }
  if (source === 'tiff' || source === 'tif') {
    const { default: UTIF } = await import('utif2'),
      bytes = await file.arrayBuffer(),
      ifds = UTIF.decode(bytes);
    if (ifds.length !== 1)
      throw new Error('Choose a single-page TIFF. Multipage images are unsupported.');
    const ifd = ifds[0],
      width = Number(ifd.t256?.[0]),
      height = Number(ifd.t257?.[0]);
    pixels(width, height);
    UTIF.decodeImage(bytes, ifd);
    const { canvas: c, ctx } = canvas(width, height);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(UTIF.toRGBA8(ifd)), width, height), 0, 0);
    return c;
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(
      `This browser cannot decode ${source.toUpperCase() || 'this image'}. Export a still PNG, JPEG, WebP, AVIF or BMP first.`,
    );
  }
  try {
    pixels(bitmap.width, bitmap.height);
  } catch (error) {
    bitmap.close();
    throw error;
  }
  return bitmap;
}
export function encodeBmp(image) {
  const { width, height, data } = image;
  pixels(width, height);
  const stride = (width * 3 + 3) & ~3,
    bytes = new Uint8Array(54 + stride * height),
    v = new DataView(bytes.buffer);
  bytes.set([66, 77]);
  v.setUint32(2, bytes.length, true);
  v.setUint32(10, 54, true);
  v.setUint32(14, 40, true);
  v.setInt32(18, width, true);
  v.setInt32(22, height, true);
  v.setUint16(26, 1, true);
  v.setUint16(28, 24, true);
  v.setUint32(34, stride * height, true);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4,
        o = 54 + (height - y - 1) * stride + x * 3,
        a = data[i + 3] / 255;
      bytes[o] = Math.round(data[i + 2] * a + 255 * (1 - a));
      bytes[o + 1] = Math.round(data[i + 1] * a + 255 * (1 - a));
      bytes[o + 2] = Math.round(data[i] * a + 255 * (1 - a));
    }
  return bytes;
}
export function encodeIco(images) {
  const header = 6 + 16 * images.length,
    total = header + images.reduce((s, x) => s + x.bytes.length, 0),
    out = new Uint8Array(total),
    v = new DataView(out.buffer);
  v.setUint16(2, 1, true);
  v.setUint16(4, images.length, true);
  let offset = header;
  for (const [i, { size, bytes }] of images.entries()) {
    const p = 6 + 16 * i;
    out[p] = out[p + 1] = size === 256 ? 0 : size;
    v.setUint16(p + 4, 1, true);
    v.setUint16(p + 6, 32, true);
    v.setUint32(p + 8, bytes.length, true);
    v.setUint32(p + 12, offset, true);
    out.set(bytes, offset);
    offset += bytes.length;
  }
  return out;
}
function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c ^= byte;
    for (let b = 0; b < 8; b++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
export function writeDpi(bytes, format, dpi) {
  bytes = new Uint8Array(bytes);
  if (format === 'png') {
    const chunk = new Uint8Array(21),
      v = new DataView(chunk.buffer);
    v.setUint32(0, 9);
    chunk.set([112, 72, 89, 115], 4);
    v.setUint32(8, Math.round(dpi / 0.0254));
    v.setUint32(12, Math.round(dpi / 0.0254));
    chunk[16] = 1;
    v.setUint32(17, crc32(chunk.subarray(4, 17)));
    const parts = [bytes.subarray(0, 33), chunk];
    let p = 33;
    while (p + 12 <= bytes.length) {
      const len = new DataView(bytes.buffer, bytes.byteOffset + p, 4).getUint32(0),
        end = p + 12 + len;
      if (end > bytes.length) throw new Error('Invalid PNG chunks.');
      if (new TextDecoder().decode(bytes.subarray(p + 4, p + 8)) !== 'pHYs')
        parts.push(bytes.subarray(p, end));
      p = end;
    }
    const out = new Uint8Array(parts.reduce((s, x) => s + x.length, 0));
    let at = 0;
    for (const part of parts) {
      out.set(part, at);
      at += part.length;
    }
    return out;
  }
  if (format === 'jpg') {
    const out = bytes.slice(),
      v = new DataView(out.buffer);
    if (
      out[2] === 255 &&
      out[3] === 224 &&
      new TextDecoder().decode(out.subarray(6, 11)) === 'JFIF\0'
    ) {
      out[13] = 1;
      v.setUint16(14, dpi);
      v.setUint16(16, dpi);
      return out;
    }
    const jfif = new Uint8Array([
      255,
      224,
      0,
      16,
      74,
      70,
      73,
      70,
      0,
      1,
      2,
      1,
      dpi >> 8,
      dpi & 255,
      dpi >> 8,
      dpi & 255,
      0,
      0,
    ]);
    const combined = new Uint8Array(bytes.length + jfif.length);
    combined.set(bytes.subarray(0, 2));
    combined.set(jfif, 2);
    combined.set(bytes.subarray(2), 2 + jfif.length);
    return combined;
  }
  throw new Error('DPI metadata output supports PNG and JPEG.');
}
export async function encodeCanvas(c, format = 'png', quality = 90, dpi) {
  let blob;
  if (format === 'bmp')
    blob = new Blob([encodeBmp(c.getContext('2d').getImageData(0, 0, c.width, c.height))], {
      type: MIME.bmp,
    });
  else if (format === 'tiff') {
    const { default: UTIF } = await import('utif2');
    blob = new Blob(
      [
        UTIF.encodeImage(
          c.getContext('2d').getImageData(0, 0, c.width, c.height).data.buffer,
          c.width,
          c.height,
        ),
      ],
      { type: 'image/tiff' },
    );
  } else if (format === 'gif') {
    const { default: gifenc } = await import('gifenc');
    const { GIFEncoder, quantize, applyPalette } = gifenc;
    const image = c.getContext('2d').getImageData(0, 0, c.width, c.height),
      palette = quantize(image.data, 256, { format: 'rgba4444' }),
      index = applyPalette(image.data, palette, 'rgba4444'),
      gif = GIFEncoder();
    const transparentIndex = palette.findIndex((color) => color[3] < 128);
    gif.writeFrame(index, c.width, c.height, {
      palette,
      transparent: transparentIndex >= 0,
      transparentIndex: Math.max(0, transparentIndex),
    });
    gif.finish();
    blob = new Blob([gif.bytes()], { type: 'image/gif' });
  } else if (format === 'avif') {
    const { defaultOptions: defaults } = await import('@jsquash/avif/meta.js');
    codecCache.avif ??= (async () => {
      const codecUrl = new URL('/tool-runtime/avif/codec/enc/avif_enc.js', globalThis.location.href)
        .href;
      const factory = (await import(/* @vite-ignore */ codecUrl)).default;
      return factory({
        noInitialRun: true,
        locateFile: (name) => `/tool-runtime/avif/codec/enc/${name}`,
      });
    })();
    const mod = await codecCache.avif,
      image = c.getContext('2d').getImageData(0, 0, c.width, c.height),
      encoded = mod.encode(image.data, c.width, c.height, {
        ...defaults,
        quality,
        speed: 6,
      });
    if (!encoded) throw new Error('AVIF encoding failed.');
    blob = new Blob([new Uint8Array(encoded).slice()], { type: MIME.avif });
  } else {
    if (format === 'jpg') {
      const { canvas: flat, ctx } = canvas(c.width, c.height);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(c, 0, 0);
      c = flat;
    }
    blob = await canvasBlob(c, MIME[format] || 'image/png', quality / 100);
  }
  return dpi
    ? new Blob([writeDpi(await blob.arrayBuffer(), format, dpi)], {
        type: MIME[format],
      })
    : blob;
}
export function safeSvg(text) {
  if (text.length > 5_000_000) throw new Error('SVG tools accept at most 5 MB.');
  const fail = () => {
    throw new Error(
      'Use a self-contained SVG without scripts, external resources, CSS escapes, SMIL animation or embedded HTML.',
    );
  };
  if (/<!DOCTYPE|<!ENTITY|\\|@import|javascript\s*:/i.test(text)) fail();
  if (typeof DOMParser === 'undefined')
    throw new Error('SVG XML parsing is unavailable in this browser context.');
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (
    doc.doctype ||
    doc.getElementsByTagName('parsererror').length ||
    doc.documentElement?.localName !== 'svg'
  )
    fail();
  const forbidden = new Set([
    'script',
    'foreignobject',
    'iframe',
    'object',
    'embed',
    'style',
    'animate',
    'set',
    'animatetransform',
    'animatemotion',
    'animatecolor',
    'discard',
    'mpath',
  ]);
  for (const element of doc.querySelectorAll('*')) {
    if (forbidden.has(element.localName.toLowerCase())) fail();
    for (const attribute of element.attributes) {
      const name = attribute.name.toLowerCase(),
        local = attribute.localName.toLowerCase(),
        value = attribute.value.trim();
      if (value.includes('\\')) fail();
      if (
        /^on/.test(local) ||
        name === 'xml:base' ||
        (attribute.namespaceURI === 'http://www.w3.org/XML/1998/namespace' && local === 'base')
      )
        fail();
      if (['href', 'src'].includes(local) && (!value.startsWith('#') || value.length < 2)) fail();
      if (
        local === 'style' &&
        /(?:https?|data|file|javascript|vbscript):|\/\/|@|expression\s*\(/i.test(value)
      )
        fail();
      for (const match of value.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi))
        if (!(match[1] ?? match[2] ?? match[3]).trim().startsWith('#')) fail();
    }
  }
  return text;
}
export async function svgTool(operation, inputs, o) {
  const { optimize } = await import('svgo/browser');
  const sources = await Promise.all(inputs.map(async (i) => safeSvg(await i.file.text())));
  if (sources.reduce((s, x) => s + x.length, 0) > 5_000_000)
    throw new Error('SVG tools accept at most 5 MB combined.');
  if (operation === 'svg-optimize') {
    const svg = optimize(sources[0], {
      floatPrecision: o.precision,
      js2svg: { pretty: o.pretty },
      plugins: [
        {
          name: 'preset-default',
          params: { overrides: { cleanupIds: false, removeDesc: false } },
        },
      ],
    }).data;
    safeSvg(svg);
    return result(svg, 'optimized.svg', {
      inputBytes: inputs[0].file.size,
      outputBytes: new TextEncoder().encode(svg).length,
    });
  }
  if (!/^[a-zA-Z][\w-]{0,39}$/.test(o.prefix))
    throw new Error(
      'Symbol prefix must start with a letter and use letters, numbers, underscores or hyphens.',
    );
  const symbols = sources.map((source, i) => {
    const id = `${o.prefix}-${i + 1}`,
      svg = optimize(source, {
        plugins: [{ name: 'prefixIds', params: { prefix: id, delim: '-' } }],
      }).data,
      m = svg.match(/<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/i);
    if (!m) throw new Error('Each SVG needs a complete root.');
    let attrs = m[1].replace(
      /\s+(?:xmlns(?::\w+)?|id|width|height)\s*=\s*(?:"[^"]*"|'[^']*')/gi,
      '',
    );
    if (!/\bviewBox\s*=/.test(attrs)) {
      const w = m[1].match(/\bwidth=["']([\d.]+)(?:px)?["']/),
        h = m[1].match(/\bheight=["']([\d.]+)(?:px)?["']/);
      if (!w || !h) throw new Error('Each icon needs a viewBox or numeric width and height.');
      attrs += ` viewBox="0 0 ${w[1]} ${h[1]}"`;
    }
    return `<symbol id="${id}"${attrs}>${m[2]}</symbol>`;
  });
  return result(
    safeSvg(`<svg xmlns="http://www.w3.org/2000/svg">${symbols.join('')}</svg>`),
    'sprite.svg',
    { symbols: symbols.length },
  );
}
export async function inspectDpi(file) {
  let tags = {};
  try {
    const { default: ExifReader } = await import('exifreader');
    tags = ExifReader.load(await file.arrayBuffer());
  } catch {}
  const rational = (t) => {
    const value = t?.value;
    if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number')
      return value[0] / value[1];
    if (Array.isArray(value) && Array.isArray(value[0])) return value[0][0] / value[0][1];
    return Number(t?.description) || Number(value);
  };
  let x = rational(tags.XResolution),
    y = rational(tags.YResolution);
  if (Number(tags.ResolutionUnit?.value) === 3) {
    x *= 2.54;
    y *= 2.54;
  }
  if (!x && tags['Pixels Per Unit X']) {
    x = rational(tags['Pixels Per Unit X']) * 0.0254;
    y = rational(tags['Pixels Per Unit Y']) * 0.0254;
  }
  return {
    x: Number.isFinite(x) && x > 0 ? x : null,
    y: Number.isFinite(y) && y > 0 ? y : null,
  };
}
export function vectorizePixels(image, o) {
  const { width, height, data } = image;
  if (width * height > 4_000_000)
    throw new Error('Vector tracing accepts at most 4 million pixels.');
  const shift = 8 - o.detail,
    colors = new Uint32Array(width * height);
  for (let n = 0; n < colors.length; n++) {
    const i = n * 4;
    if (data[i + 3] < 128) {
      colors[n] = 0xffffffff;
      continue;
    }
    if (o.colorMode === 'binary') {
      colors[n] =
        data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722 < 128 ? 0 : 0xffffff;
    } else
      colors[n] =
        (((data[i] >> shift) << shift) << 16) |
        (((data[i + 1] >> shift) << shift) << 8) |
        ((data[i + 2] >> shift) << shift);
  }
  if (o.speckle > 0) {
    const seen = new Uint8Array(colors.length);
    for (let n = 0; n < colors.length; n++) {
      if (seen[n] || colors[n] === 0xffffffff) continue;
      const queue = [n],
        color = colors[n];
      seen[n] = 1;
      for (let q = 0; q < queue.length; q++) {
        const p = queue[q],
          x = p % width;
        for (const next of [
          x > 0 ? p - 1 : -1,
          x < width - 1 ? p + 1 : -1,
          p >= width ? p - width : -1,
          p + width < colors.length ? p + width : -1,
        ])
          if (next >= 0 && !seen[next] && colors[next] === color) {
            seen[next] = 1;
            queue.push(next);
          }
      }
      if (queue.length < o.speckle) for (const p of queue) colors[p] = 0xffffffff;
    }
  }
  const paths = new Map();
  let length = 0;
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      const color = colors[y * width + x],
        start = x;
      while (x < width && colors[y * width + x] === color) x++;
      if (color === 0xffffffff) continue;
      const d = `M${start} ${y}h${x - start}v1H${start}z`;
      length += d.length;
      if (length > 100_000_000)
        throw new Error(
          'Traced SVG exceeds the browser output limit. Use fewer colours or a smaller image.',
        );
      if (!paths.has(color)) paths.set(color, []);
      paths.get(color).push(d);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="crispEdges">${Array.from(paths, ([color, d]) => `<path fill="#${color.toString(16).padStart(6, '0')}" d="${d.join('')}"/>`).join('')}</svg>`;
}
export async function imageTool(operation, inputs, o, signal, onProgress) {
  if (operation.startsWith('svg-')) return svgTool(operation, inputs, o);
  const images = [];
  try {
    for (const input of inputs) {
      checkAbort(signal);
      images.push(await decodeImage(input.file, input.source));
    }
    const image = images[0];
    let w = image.width,
      h = image.height,
      fit = o.fit || 'contain',
      format = o.output || o.format || 'png',
      dpi;
    if (operation === 'compress-image') {
      const files = {},
        report = [];
      for (const [index, img] of images.entries()) {
        let best;
        for (const scale of o.allowResize ? [1, 0.8, 0.6, 0.4, 0.25] : [1]) {
          checkAbort(signal);
          const { canvas: c, ctx } = canvas(
            Math.max(1, Math.round(img.width * scale)),
            Math.max(1, Math.round(img.height * scale)),
          );
          drawFit(ctx, img, c.width, c.height, 'fill');
          for (const quality of format === 'png' ? [100] : [90, 75, 60, 45, 30, 15]) {
            const blob = await encodeCanvas(c, format, quality),
              value = {
                blob,
                width: c.width,
                height: c.height,
                quality,
                targetMet: blob.size <= o.targetKB * 1024,
              };
            if (!best || blob.size < best.blob.size) best = value;
            if (value.targetMet) {
              best = value;
              break;
            }
          }
          if (best.targetMet) break;
        }
        files[`${index + 1}-compressed.${format}`] = new Uint8Array(await best.blob.arrayBuffer());
        report.push({
          file: inputs[index].name,
          inputBytes: inputs[index].file.size,
          outputBytes: best.blob.size,
          targetBytes: o.targetKB * 1024,
          width: best.width,
          height: best.height,
          quality: best.quality,
          targetMet: best.targetMet,
        });
        onProgress?.({
          stage: `Compressed image ${index + 1} of ${images.length}`,
          progress: Math.round(((index + 1) / images.length) * 100),
        });
      }
      if (images.length === 1)
        return result(Object.values(files)[0], `compressed.${format}`, report[0]);
      files['compression-report.json'] = new TextEncoder().encode(JSON.stringify(report, null, 2));
      return zipResult(files, 'optimized-images.zip', {
        files: report.length,
        targetBytes: o.targetKB * 1024,
        targetMet: report.every((r) => r.targetMet),
      });
    }
    if (operation === 'image-vectorize') {
      const { canvas: c, ctx } = canvas(w, h);
      ctx.drawImage(image, 0, 0);
      return result(vectorizePixels(ctx.getImageData(0, 0, w, h), o), 'traced.svg', {
        tracing: 'Quantized pixel contours as editable paths',
        width: w,
        height: h,
      });
    }
    if (operation === 'image-dpi') {
      const inputDpi = await inspectDpi(inputs[0].file);
      if (o.mode === 'check')
        return result(
          JSON.stringify({ width: w, height: h, dpi: inputDpi }, null, 2),
          'image-dpi.json',
        );
      dpi = o.dpi;
      if (o.resample) {
        w = Math.max(1, Math.round((w * dpi) / (inputDpi.x || 72)));
        h = Math.max(1, Math.round((h * dpi) / (inputDpi.y || 72)));
      }
    }
    if (operation === 'resize-print-image') {
      const factor = o.unit === 'cm' ? 1 / 2.54 : o.unit === 'mm' ? 1 / 25.4 : 1;
      w = Math.round(o.width * factor * o.dpi);
      h = Math.round(o.height * factor * o.dpi);
      dpi = o.dpi;
    }
    if (operation === 'passport-signature' || operation === 'resize-image') {
      w = o.width;
      h = o.height;
      dpi = operation === 'passport-signature' ? o.dpi : undefined;
      if (o.fit === 'inside') {
        const ratio = Math.min(w / image.width, h / image.height);
        w = Math.max(1, Math.round(image.width * ratio));
        h = Math.max(1, Math.round(image.height * ratio));
      }
    }
    if (operation === 'image-collage') {
      w = o.columns * o.cellWidth + (o.columns + 1) * o.gap;
      h =
        Math.ceil(images.length / o.columns) * o.cellHeight +
        (Math.ceil(images.length / o.columns) + 1) * o.gap;
    }
    let { canvas: c, ctx } = canvas(w, h);
    if (operation === 'crop-image') {
      if (o.left + o.width > image.width || o.top + o.height > image.height)
        throw new Error('Crop extends outside the displayed image.');
      const swapped = o.rotate === 90 || o.rotate === 270;
      ({ canvas: c, ctx } = canvas(swapped ? o.height : o.width, swapped ? o.width : o.height));
      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate((o.rotate * Math.PI) / 180);
      ctx.scale(o.flop ? -1 : 1, o.flip ? -1 : 1);
      ctx.drawImage(
        image,
        o.left,
        o.top,
        o.width,
        o.height,
        -o.width / 2,
        -o.height / 2,
        o.width,
        o.height,
      );
    } else if (operation === 'image-collage') {
      ctx.fillStyle = o.background;
      ctx.fillRect(0, 0, w, h);
      for (const [i, img] of images.entries()) {
        ctx.save();
        ctx.translate(
          o.gap + (i % o.columns) * (o.cellWidth + o.gap),
          o.gap + Math.floor(i / o.columns) * (o.cellHeight + o.gap),
        );
        drawFit(ctx, img, o.cellWidth, o.cellHeight, 'contain');
        ctx.restore();
      }
    } else drawFit(ctx, image, w, h, fit, o.background || 'transparent');
    if (operation === 'image-watermark') {
      if (images.length !== (o.mode === 'logo' ? 2 : 1))
        throw new Error('Text watermark needs one photo; logo mode needs photo then logo.');
      ctx.save();
      ctx.globalAlpha = o.opacity / 100;
      let ww, hh;
      if (o.mode === 'logo') {
        ww = (w * o.logoWidth) / 100;
        hh = (images[1].height * ww) / images[1].width;
      } else {
        ctx.font = `${o.fontSize}px Arial, sans-serif`;
        ww = ctx.measureText(o.text).width;
        hh = o.fontSize;
      }
      const inset = Math.max(10, Math.round(Math.min(w, h) * 0.025)),
        x =
          o.position === 'center'
            ? (w - ww) / 2
            : o.position.endsWith('right')
              ? w - ww - inset
              : inset,
        y =
          o.position === 'center'
            ? (h - hh) / 2
            : o.position.startsWith('bottom')
              ? h - hh - inset
              : inset;
      if (o.mode === 'logo') ctx.drawImage(images[1], x, y, ww, hh);
      else {
        ctx.fillStyle = o.color;
        ctx.textBaseline = 'top';
        ctx.fillText(o.text, x, y);
      }
      ctx.restore();
    }
    if (operation === 'icon-favicon') {
      const sizes = o.mode === 'png' ? [o.size] : [16, 32, 48, 64, 256],
        entries = {},
        icons = [];
      for (const size of sizes) {
        const { canvas: icon, ctx: ic } = canvas(size, size);
        drawFit(ic, image, size, size, 'contain');
        const bytes = new Uint8Array(await (await encodeCanvas(icon, 'png')).arrayBuffer());
        icons.push({ size, bytes });
        entries[`favicon-${size}.png`] = bytes;
      }
      if (o.mode === 'png') return result(icons[0].bytes, 'icon.png');
      const ico = encodeIco(icons);
      if (o.mode === 'ico') return result(ico, 'favicon.ico');
      entries['favicon.ico'] = ico;
      for (const size of [180, 192, 512]) {
        const { canvas: icon, ctx: ic } = canvas(size, size);
        drawFit(ic, image, size, size, 'contain');
        entries[`icon-${size}.png`] = new Uint8Array(
          await (await encodeCanvas(icon, 'png')).arrayBuffer(),
        );
      }
      return zipResult(entries, 'favicon-pack.zip', {
        sizes: [...sizes, 180, 192, 512],
      });
    }
    let blob = await encodeCanvas(c, format, 90, dpi),
      details = { width: c.width, height: c.height, ...(dpi ? { dpi } : {}) };
    if (operation === 'passport-signature' && o.targetKB) {
      let best = blob;
      for (const quality of format === 'jpg' ? [85, 70, 55, 40, 25, 10] : []) {
        if (best.size <= o.targetKB * 1024) break;
        const candidate = await encodeCanvas(c, format, quality, dpi);
        if (candidate.size < best.size) best = candidate;
      }
      blob = best;
      details.targetMet = blob.size <= o.targetKB * 1024;
      details.targetBytes = o.targetKB * 1024;
    }
    checkAbort(signal);
    return result(blob, `${operation}.${format}`, details);
  } finally {
    for (const image of images) image.close?.();
  }
}
