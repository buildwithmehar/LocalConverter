import { canvas, pixels, checkAbort } from './image-common.js';
let jxlCodec;
// Parse only the JPEG XL size/basic animation fields, before allocating pixels.
// Field encodings follow libjxl's SizeHeader/PreviewHeader/ImageMetadata visitors.
export function inspectJxl(bytes) {
  bytes = new Uint8Array(bytes);
  if (!(bytes[0] === 255 && bytes[1] === 10)) {
    const chunks = [];
    let p = 0;
    while (p + 8 <= bytes.length) {
      const view = new DataView(bytes.buffer, bytes.byteOffset + p, bytes.length - p);
      let size = view.getUint32(0),
        header = 8;
      const type = new TextDecoder().decode(bytes.subarray(p + 4, p + 8));
      if (size === 1) {
        if (p + 16 > bytes.length) throw new Error('Invalid JPEG XL box.');
        size = Number(view.getBigUint64(8));
        header = 16;
      }
      if (!size) size = bytes.length - p;
      if (size < header || p + size > bytes.length) throw new Error('Invalid JPEG XL container.');
      if (type === 'jxlc') chunks.push(bytes.subarray(p + header, p + size));
      if (type === 'jxlp') {
        if (size < header + 4) throw new Error('Invalid JPEG XL codestream part.');
        chunks.push(bytes.subarray(p + header + 4, p + size));
      }
      p += size;
    }
    if (!chunks.length) throw new Error('File is not a JPEG XL codestream.');
    const out = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    bytes = out;
  }
  if (bytes[0] !== 255 || bytes[1] !== 10) throw new Error('File is not a JPEG XL image.');
  let bit = 16;
  const bits = (n) => {
    if (bit + n > bytes.length * 8) throw new Error('Truncated JPEG XL header.');
    let value = 0;
    for (let i = 0; i < n; i++, bit++) value += ((bytes[bit >> 3] >> (bit & 7)) & 1) * 2 ** i;
    return value;
  };
  const u32 = (spec) => {
    const entry = spec[bits(2)];
    return entry.length === 1 ? entry[0] : bits(entry[0]) + entry[1];
  };
  const dimension = () =>
    u32([
      [9, 1],
      [13, 1],
      [18, 1],
      [30, 1],
    ]);
  const size = () => {
    const small = bits(1),
      height = small ? (bits(5) + 1) * 8 : dimension(),
      ratio = bits(3),
      ratios = [
        [1, 1],
        [12, 10],
        [4, 3],
        [3, 2],
        [16, 9],
        [5, 4],
        [2, 1],
      ],
      width = ratio
        ? Math.floor((height * ratios[ratio - 1][0]) / ratios[ratio - 1][1])
        : small
          ? (bits(5) + 1) * 8
          : dimension();
    return { width, height };
  };
  const dimensions = size();
  pixels(dimensions.width, dimensions.height);
  let animated = false;
  if (!bits(1) && bits(1)) {
    bits(3);
    if (bits(1)) size();
    if (bits(1)) {
      const div8 = bits(1),
        preview = () =>
          div8
            ? u32([[16], [32], [5, 1], [9, 33]])
            : u32([
                [6, 1],
                [8, 65],
                [10, 321],
                [12, 1345],
              ]);
      preview();
      if (!bits(3)) preview();
    }
    animated = !!bits(1);
  }
  if (animated) throw new Error('Animated JPEG XL is unsupported. Export a still frame first.');
  return { ...dimensions, animated };
}
export async function jxlCanvas(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  inspectJxl(bytes);
  jxlCodec ??= (async () => {
    const url = new URL('/tool-runtime/jxl/codec/dec/jxl_dec.js', globalThis.location.href).href,
      { default: factory } = await import(/* @vite-ignore */ url);
    return factory({
      noInitialRun: true,
      locateFile: (name) =>
        new URL('/tool-runtime/jxl/codec/dec/' + name, globalThis.location.href).href,
    });
  })();
  const codec = await jxlCodec,
    data = codec.decode(bytes);
  if (!data) throw new Error('JPEG XL decoding failed.');
  pixels(data.width, data.height);
  const { canvas: c, ctx } = canvas(data.width, data.height);
  ctx.putImageData(data, 0, 0);
  return c;
}
export async function rawCanvas(file, signal, onProgress) {
  if (!globalThis.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined')
    throw new Error(
      'Camera RAW development requires cross-origin isolation. Open the deployed site with COOP and COEP headers enabled.',
    );
  const url = new URL('/tool-runtime/raw/index.js', globalThis.location.href).href,
    { default: LibRaw } = await import(/* @vite-ignore */ url),
    raw = new LibRaw(),
    stop = () => raw.dispose();
  signal?.addEventListener('abort', stop, { once: true });
  try {
    checkAbort(signal);
    onProgress?.({
      stage: 'Opening the camera sensor data locally',
      progress: 10,
    });
    await raw.open(new Uint8Array(await file.arrayBuffer()), {
      useCameraWb: true,
      useAutoWb: false,
      outputColor: 1,
      outputBps: 8,
      userFlip: -1,
    });
    const metadata = await raw.metadata();
    pixels(metadata.width, metadata.height);
    checkAbort(signal);
    onProgress?.({
      stage: 'Demosaicing with camera white balance and sRGB',
      progress: 35,
    });
    const image = await raw.imageData();
    pixels(image.width, image.height);
    if (image.bits !== 8 || ![1, 3, 4].includes(image.colors))
      throw new Error('This camera RAW output pixel format is unsupported.');
    const rgba = new Uint8ClampedArray(image.width * image.height * 4);
    for (let p = 0; p < image.width * image.height; p++) {
      const offset = p * image.colors;
      rgba[p * 4] = image.data[offset];
      rgba[p * 4 + 1] = image.data[offset + (image.colors === 1 ? 0 : 1)];
      rgba[p * 4 + 2] = image.data[offset + (image.colors === 1 ? 0 : 2)];
      rgba[p * 4 + 3] = 255;
    }
    const { canvas: c, ctx } = canvas(image.width, image.height);
    ctx.putImageData(new ImageData(rgba, image.width, image.height), 0, 0);
    checkAbort(signal);
    return c;
  } finally {
    signal?.removeEventListener('abort', stop);
    raw.dispose();
  }
}
