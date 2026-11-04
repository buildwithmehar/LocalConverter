import { canvas, checkAbort, result } from './image-common.js';
import { decodeImage, encodeCanvas } from './image-engine.js';
let model;
async function upscaleSession(signal, onProgress) {
  model ??= (async () => {
    onProgress?.({
      stage: 'Loading the local neural super-resolution model',
      progress: 8,
    });
    const ort = await import('onnxruntime-web/wasm');
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = new URL('/tool-runtime/ort/', globalThis.location.href).href;
    const response = await fetch('/tool-runtime/models/super-resolution-10.onnx.gz', { signal });
    if (!response.ok)
      throw new Error(
        'The local neural super-resolution model is missing. Refresh after deployment finishes.',
      );
    const encoded = new Uint8Array(await response.arrayBuffer()),
      { gunzipSync } = await import('fflate'),
      bytes = encoded[0] === 31 && encoded[1] === 139 ? gunzipSync(encoded) : encoded;
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');
    if (hash !== '85f36ff88cc504a24af5e0602148bc56a8aa09a58eca8c0da2756f3e8186035e')
      throw new Error('Super-resolution model integrity verification failed.');
    return {
      ort,
      session: await ort.InferenceSession.create(bytes, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      }),
    };
  })().catch((error) => {
    model = undefined;
    throw error;
  });
  return model;
}
export function lumaPlane(data, width, height, denoise = 0, enhance = false) {
  const plane = new Float32Array(width * height);
  for (let p = 0; p < plane.length; p++)
    plane[p] = (data[p * 4] * 0.299 + data[p * 4 + 1] * 0.587 + data[p * 4 + 2] * 0.114) / 255;
  if (denoise) {
    const source = plane.slice(),
      threshold = (denoise / 255) * 3;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const center = source[y * width + x];
        let sum = 0,
          weight = 0;
        for (let j = Math.max(0, y - 1); j <= Math.min(height - 1, y + 1); j++)
          for (let i = Math.max(0, x - 1); i <= Math.min(width - 1, x + 1); i++) {
            const value = source[j * width + i],
              w = Math.exp(-Math.abs(value - center) / Math.max(0.001, threshold));
            sum += value * w;
            weight += w;
          }
        plane[y * width + x] = sum / weight;
      }
  }
  if (enhance) {
    const hist = new Uint32Array(256);
    for (const value of plane) hist[Math.max(0, Math.min(255, Math.round(value * 255)))]++;
    let low = 0,
      high = 255,
      sum = 0;
    while (low < 255 && sum < plane.length * 0.01) sum += hist[low++];
    sum = 0;
    while (high > low && sum < plane.length * 0.01) sum += hist[high--];
    if (high > low)
      for (let i = 0; i < plane.length; i++)
        plane[i] = Math.max(0, Math.min(1, (plane[i] * 255 - low) / (high - low)));
  }
  return plane;
}
export async function upscaleImage(input, o, signal, onProgress) {
  const image = await decodeImage(input.file, input.source);
  try {
    const w = image.width,
      h = image.height;
    if (w * h > 1_000_000)
      throw new Error('Neural upscaling accepts at most 1 million input pixels.');
    const { canvas: source, ctx } = canvas(w, h);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(image, 0, 0);
    const luma = lumaPlane(ctx.getImageData(0, 0, w, h).data, w, h, o.denoise, o.enhance),
      { ort, session } = await upscaleSession(signal, onProgress),
      trainedScale = 3,
      ow = w * trainedScale,
      oh = h * trainedScale,
      output = new Float32Array(ow * oh),
      tile = 204,
      border = 10,
      total = Math.ceil(w / tile) * Math.ceil(h / tile);
    let completed = 0;
    for (let y = 0; y < h; y += tile)
      for (let x = 0; x < w; x += tile) {
        checkAbort(signal);
        const left = x - border,
          top = y - border,
          tw = 224,
          th = 224,
          tensorData = new Float32Array(tw * th);
        for (let row = 0; row < th; row++)
          for (let col = 0; col < tw; col++)
            tensorData[row * tw + col] =
              luma[
                Math.max(0, Math.min(h - 1, top + row)) * w +
                  Math.max(0, Math.min(w - 1, left + col))
              ];
        const tensor = new ort.Tensor('float32', tensorData, [1, 1, th, tw]);
        let prediction;
        try {
          prediction = await session.run({ [session.inputNames[0]]: tensor });
        } finally {
          tensor.dispose();
        }
        const out = prediction[session.outputNames[0]];
        if (out.dims.at(-1) !== tw * 3 || out.dims.at(-2) !== th * 3)
          throw new Error('Neural model output dimensions do not match its trained 3× scale.');
        const copyW = Math.min(tile, w - x) * 3,
          copyH = Math.min(tile, h - y) * 3,
          sx = (x - left) * 3,
          sy = (y - top) * 3;
        for (let row = 0; row < copyH; row++)
          output.set(
            out.data.subarray((sy + row) * tw * 3 + sx, (sy + row) * tw * 3 + sx + copyW),
            (y * 3 + row) * ow + x * 3,
          );
        for (const value of Object.values(prediction)) value.dispose();
        onProgress?.({
          stage: `Neural upscale tile ${++completed} of ${total}`,
          progress: Math.round(10 + (completed / total) * 75),
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    const { canvas: trained, ctx: tc } = canvas(ow, oh);
    tc.imageSmoothingQuality = 'high';
    tc.drawImage(image, 0, 0, ow, oh);
    const rgba = tc.getImageData(0, 0, ow, oh);
    for (let p = 0; p < output.length; p++) {
      const i = p * 4,
        oldY = rgba.data[i] * 0.299 + rgba.data[i + 1] * 0.587 + rgba.data[i + 2] * 0.114,
        cb = (rgba.data[i + 2] - oldY) / 1.772,
        cr = (rgba.data[i] - oldY) / 1.402,
        newY = Math.max(0, Math.min(255, output[p] * 255));
      rgba.data[i] = newY + 1.402 * cr;
      rgba.data[i + 1] = newY - 0.344136 * cb - 0.714136 * cr;
      rgba.data[i + 2] = newY + 1.772 * cb;
    }
    tc.putImageData(rgba, 0, 0);
    const { canvas: final, ctx: fc } = canvas(w * o.scale, h * o.scale);
    fc.imageSmoothingQuality = 'high';
    fc.drawImage(trained, 0, 0, final.width, final.height);
    checkAbort(signal);
    return result(await encodeCanvas(final, 'png'), 'upscaled.png', {
      width: final.width,
      height: final.height,
      model: 'ONNX Model Zoo subpixel CNN',
      trainedScale: 3,
      outputScale: o.scale,
      finalResampling: true,
      denoise: o.denoise ? 'Edge-aware local luma filter' : 'Off',
      contrastEnhancement: o.enhance ? 'Global luma contrast stretch' : 'Off',
      localInference: true,
    });
  } finally {
    image.close?.();
  }
}
