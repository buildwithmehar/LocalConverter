import {
  canvas,
  canvasBlob,
  drawFit,
  pixels,
  checkAbort,
  result,
  zipResult,
} from './image-common.js';
import { decodeImage, encodeCanvas } from './image-engine.js';

let segmentationSession, fontCodec;
export async function heicBitmap(file) {
  const { heicTo, isHeic } = await import('heic-to/csp');
  if (!(await isHeic(file))) throw new Error('File contents are not HEIC/HEIF.');
  const bitmap = await heicTo({ blob: file, type: 'bitmap' });
  try {
    pixels(bitmap.width, bitmap.height);
  } catch (error) {
    bitmap.close();
    throw error;
  }
  return bitmap;
}
async function modelSession(onProgress, signal) {
  if (!segmentationSession)
    segmentationSession = (async () => {
      onProgress?.({
        stage: 'Loading local subject segmentation model',
        progress: 8,
      });
      const ort = await import('onnxruntime-web/wasm');
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      ort.env.wasm.wasmPaths = new URL('/tool-runtime/ort/', globalThis.location.href).href;
      const response = await fetch('/tool-runtime/models/u2netp.onnx.gz', {
        signal,
      });
      if (!response.ok)
        throw new Error(
          'The local segmentation model is missing. Refresh after deployment finishes.',
        );
      const encoded = new Uint8Array(await response.arrayBuffer()),
        { gunzipSync } = await import('fflate'),
        bytes = encoded[0] === 31 && encoded[1] === 139 ? gunzipSync(encoded) : encoded;
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('');
      if (hash !== '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8')
        throw new Error('Segmentation model integrity verification failed.');
      const session = await ort.InferenceSession.create(bytes, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      return { ort, session };
    })().catch((error) => {
      segmentationSession = undefined;
      throw error;
    });
  return segmentationSession;
}
export function segmentationInput(rgba) {
  const out = new Float32Array(3 * 320 * 320),
    mean = [0.485, 0.456, 0.406],
    std = [0.229, 0.224, 0.225];
  let max = 1;
  for (let i = 0; i < rgba.length; i += 4) max = Math.max(max, rgba[i], rgba[i + 1], rgba[i + 2]);
  for (let p = 0; p < 320 * 320; p++)
    for (let channel = 0; channel < 3; channel++)
      out[channel * 320 * 320 + p] = (rgba[p * 4 + channel] / max - mean[channel]) / std[channel];
  return out;
}
export function normalizedMask(values) {
  let low = Infinity,
    high = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) throw new Error('Segmentation produced an invalid mask.');
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  if (high - low < 1e-8)
    throw new Error('Segmentation could not identify a subject. Try a clearer photo.');
  const data = new Uint8ClampedArray(values.length * 4);
  for (let p = 0; p < values.length; p++) {
    const value = Math.round(((values[p] - low) / (high - low)) * 255);
    data[p * 4] = data[p * 4 + 1] = data[p * 4 + 2] = 255;
    data[p * 4 + 3] = value;
  }
  return data;
}
async function background(operation, inputs, o, signal, onProgress) {
  if (inputs.length !== (operation === 'photo-background' && o.mode === 'image' ? 2 : 1))
    throw new Error(
      'Image replacement requires subject then background. Other background modes require one image.',
    );
  const images = [];
  try {
    for (const input of inputs) images.push(await decodeImage(input.file, input.source));
    const image = images[0],
      { canvas: small, ctx: sc } = canvas(320, 320);
    sc.fillStyle = 'white';
    sc.fillRect(0, 0, 320, 320);
    sc.drawImage(image, 0, 0, 320, 320);
    const tensorData = segmentationInput(sc.getImageData(0, 0, 320, 320).data),
      { ort, session } = await modelSession(onProgress, signal);
    checkAbort(signal);
    onProgress?.({
      stage: 'Identifying the photo subject locally',
      progress: 25,
    });
    const tensor = new ort.Tensor('float32', tensorData, [1, 3, 320, 320]);
    let outputs;
    try {
      outputs = await session.run({ [session.inputNames[0]]: tensor });
    } finally {
      tensor.dispose();
    }
    checkAbort(signal);
    const mask = outputs[session.outputNames[0]],
      maskData = normalizedMask(mask.data);
    for (const output of Object.values(outputs)) output.dispose();
    const { canvas: maskSmall, ctx: ms } = canvas(320, 320);
    ms.putImageData(new ImageData(maskData, 320, 320), 0, 0);
    const { canvas: fullMask, ctx: mc } = canvas(image.width, image.height);
    mc.drawImage(maskSmall, 0, 0, image.width, image.height);
    if (o.threshold) {
      const data = mc.getImageData(0, 0, image.width, image.height);
      for (let p = 3; p < data.data.length; p += 4)
        data.data[p] = data.data[p] >= o.threshold ? 255 : 0;
      mc.putImageData(data, 0, 0);
    }
    const { canvas: subject, ctx: subjectCtx } = canvas(image.width, image.height);
    subjectCtx.drawImage(image, 0, 0);
    subjectCtx.globalCompositeOperation = 'destination-in';
    subjectCtx.drawImage(fullMask, 0, 0);
    subjectCtx.globalCompositeOperation = 'source-over';
    let out = subject;
    if (operation === 'photo-background') {
      const { canvas: composite, ctx } = canvas(image.width, image.height);
      ctx.fillStyle = o.background || 'white';
      ctx.fillRect(0, 0, image.width, image.height);
      if (o.mode === 'blur') {
        ctx.filter = `blur(${o.blur}px)`;
        ctx.drawImage(image, -o.blur, -o.blur, image.width + o.blur * 2, image.height + o.blur * 2);
        ctx.filter = 'none';
      } else if (o.mode === 'image') drawFit(ctx, images[1], image.width, image.height, 'cover');
      ctx.drawImage(subject, 0, 0);
      out = composite;
    }
    onProgress?.({ stage: 'Encoding the segmented image', progress: 90 });
    return result(
      await encodeCanvas(out, 'png'),
      operation === 'remove-background' ? 'cutout.png' : 'photo-background.png',
      {
        width: image.width,
        height: image.height,
        model: 'U²-Net small',
        softMask: !o.threshold,
        localInference: true,
      },
    );
  } finally {
    for (const image of images) image.close?.();
  }
}

function rgbaCanvas(imageData) {
  const { canvas: c, ctx } = canvas(imageData.width, imageData.height);
  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height),
    0,
    0,
  );
  return c;
}
export async function psdExport(inputs, o, signal) {
  const bytes = new Uint8Array(await inputs[0].file.arrayBuffer());
  if (bytes.length < 26 || new TextDecoder().decode(bytes.subarray(0, 4)) !== '8BPS')
    throw new Error('Not a Photoshop PSD document.');
  const header = new DataView(bytes.buffer);
  if (header.getUint16(4) !== 1)
    throw new Error(
      'PSB large Photoshop documents are unsupported. Save a standard PSD with compatibility preview first.',
    );
  pixels(header.getUint32(18), header.getUint32(14));
  const mod = await import('ag-psd'),
    ag = mod.default?.readPsd ? mod.default : mod;
  ag.initializeCanvas(
    (w, h) => canvas(w, h).canvas,
    (w, h) => new ImageData(w, h),
  );
  const psd = ag.readPsd(bytes, {
    useImageData: true,
    skipThumbnail: true,
    skipLinkedFilesData: true,
    skipLayerImageData: o.mode === 'preview',
    skipCompositeImageData: o.mode === 'layers',
  });
  checkAbort(signal);
  if (o.mode === 'preview') {
    if (!psd.imageData && !psd.canvas)
      throw new Error(
        'PSD has no cached compatibility composite. Re-save with Maximize Compatibility in Photoshop.',
      );
    const c = psd.imageData ? rgbaCanvas(psd.imageData) : psd.canvas;
    return result(await encodeCanvas(c, o.format), 'psd-preview.' + o.format, {
      width: psd.width,
      height: psd.height,
      cachedComposite: true,
    });
  }
  const files = {},
    index = [];
  let decodedPixels = 0;
  const visit = async (layers) => {
    for (const layer of layers || []) {
      checkAbort(signal);
      if (layer.children) await visit(layer.children);
      if (!layer.imageData && !layer.canvas) continue;
      if (index.length >= 100)
        throw new Error('PSD layer extraction supports at most 100 raster layers.');
      const c = layer.imageData ? rgbaCanvas(layer.imageData) : layer.canvas;
      decodedPixels += c.width * c.height;
      if (decodedPixels > 100_000_000)
        throw new Error('PSD raster layers exceed 100 million pixels.');
      const name = `${String(index.length + 1).padStart(3, '0')}-${String(layer.name || 'layer')
        .replace(/[^\w-]/g, '_')
        .slice(0, 80)}.png`;
      files[name] = new Uint8Array(await (await encodeCanvas(c, 'png')).arrayBuffer());
      index.push({
        name: layer.name,
        filename: name,
        left: layer.left || 0,
        top: layer.top || 0,
        right: layer.right,
        bottom: layer.bottom,
        width: c.width,
        height: c.height,
        hidden: !!layer.hidden,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
      });
    }
  };
  await visit(psd.children);
  if (!index.length) throw new Error('PSD contains no stored raster layer images.');
  files['layers.json'] = new TextEncoder().encode(
    JSON.stringify(
      {
        width: psd.width,
        height: psd.height,
        layers: index,
        note: 'Stored layer pixels; masks, effects and blend modes are not rendered into these individual images.',
      },
      null,
      2,
    ),
  );
  return zipResult(files, 'psd-layers.zip', {
    layers: index.length,
    storedPixels: true,
  });
}
function fontSignature(bytes) {
  if (bytes.length < 12) throw new Error('Font file is too short.');
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
}
export function validateFont(bytes) {
  const signature = fontSignature(bytes),
    v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (signature === 0x774f4646 || signature === 0x774f4632) {
    if (
      bytes.length < 44 ||
      v.getUint32(8) > bytes.length ||
      v.getUint32(16) > 50 * 1024 * 1024 ||
      !v.getUint16(12) ||
      v.getUint16(12) > 256
    )
      throw new Error('Invalid or oversized WOFF font.');
    return signature === 0x774f4632 ? 'woff2' : 'woff';
  }
  if (signature !== 0x00010000 && signature !== 0x4f54544f && signature !== 0x74727565)
    throw new Error(
      'Choose a single TTF, OTF, WOFF or WOFF2 font. Font collections are unsupported.',
    );
  const count = v.getUint16(4);
  if (!count || count > 256 || 12 + count * 16 > bytes.length)
    throw new Error('Invalid SFNT table directory.');
  for (let i = 0; i < count; i++) {
    const p = 12 + i * 16,
      offset = v.getUint32(p + 8),
      length = v.getUint32(p + 12);
    if (offset + length > bytes.length) throw new Error('Font table extends outside the file.');
  }
  return signature === 0x4f54544f ? 'otf' : 'ttf';
}
export async function convertFont(file, target, signal, onProgress) {
  if (file.size > 30 * 1024 * 1024)
    throw new Error('Font conversion accepts one font up to 30 MB.');
  let bytes = new Uint8Array(await file.arrayBuffer());
  const source = validateFont(bytes),
    module = await import('fonteditor-core'),
    core = module.default?.woff2 ? module.default : module,
    { zlibSync, unzlibSync } = await import('fflate');
  if (source === 'woff2' || target === 'woff2') {
    onProgress?.({ stage: 'Loading local WOFF2 codec', progress: 10 });
    fontCodec ??= core.woff2.init(
      new URL('/tool-runtime/font/woff2.wasm', globalThis.location.href).href,
    );
    await fontCodec;
  }
  checkAbort(signal);
  const array = () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  if (source === 'woff2') bytes = core.woff2.decode(array());
  else if (source === 'woff')
    bytes = new Uint8Array(
      core.woff2ttf(array(), {
        inflate: (data) => unzlibSync(new Uint8Array(data)),
      }),
    );
  const flavor = validateFont(bytes);
  let out,
    extension = target;
  if (target === 'sfnt') {
    out = bytes;
    extension = flavor;
  } else if (target === 'woff2') out = core.woff2.encode(bytes);
  else if (target === 'woff') {
    out = core.ttf2woff(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), {
      deflate: (data) => zlibSync(new Uint8Array(data)),
    });
    new DataView(out).setUint32(
      4,
      new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0),
    );
  } else throw new Error('Choose WOFF, WOFF2 or original SFNT font container.');
  checkAbort(signal);
  const output = result(out, `converted-font.${extension}`, {
    source,
    container: target,
    outlines: flavor === 'otf' ? 'CFF/OpenType' : 'TrueType',
    outlineConversion: false,
  });
  output.mime =
    target === 'woff2'
      ? 'font/woff2'
      : target === 'woff'
        ? 'font/woff'
        : flavor === 'otf'
          ? 'font/otf'
          : 'font/ttf';
  output.blob = new Blob([output.blob], { type: output.mime });
  return output;
}
export async function advancedImageTool(operation, inputs, o, signal, onProgress) {
  if (operation === 'remove-background' || operation === 'photo-background')
    return background(operation, inputs, o, signal, onProgress);
  if (operation === 'psd-export') return psdExport(inputs, o, signal);
  if (operation === 'convert-font')
    return convertFont(inputs[0].file, o.format, signal, onProgress);
  if (operation === 'ai-upscale') {
    const { upscaleImage } = await import('./image-upscale-engine.js');
    return upscaleImage(inputs[0], o, signal, onProgress);
  }
  if (['heic-converter', 'jxl-converter', 'raw-converter'].includes(operation)) {
    const codecs = operation === 'heic-converter' ? null : await import('./image-extra-codecs.js');
    const image =
      operation === 'heic-converter'
        ? await heicBitmap(inputs[0].file)
        : operation === 'jxl-converter'
          ? await codecs.jxlCanvas(inputs[0].file)
          : await codecs.rawCanvas(inputs[0].file, signal, onProgress);
    try {
      checkAbort(signal);
      const { canvas: c, ctx } = canvas(image.width, image.height);
      ctx.drawImage(image, 0, 0);
      return result(await encodeCanvas(c, o.format), operation + '.' + o.format, {
        width: image.width,
        height: image.height,
        primaryImage: true,
      });
    } finally {
      image.close?.();
    }
  }
  throw new Error('Unsupported advanced image operation.');
}
