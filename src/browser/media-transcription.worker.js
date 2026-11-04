import { gunzipSync } from 'fflate';

const root = '/tool-runtime/models/whisper-tiny/';
const originalFetch = globalThis.fetch.bind(globalThis);
const progress = (stage, value) =>
  self.postMessage({ type: 'progress', value: { stage, progress: value } });
const localURL = (value) => {
  const url = new URL(value, self.location.href);
  if (url.origin !== self.location.origin)
    throw new Error('Speech processing only permits bundled same-origin model assets.');
  return url;
};
async function readAsset(path) {
  const response = await originalFetch(localURL(path));
  if (!response.ok)
    throw new Error(`Local speech asset is unavailable (${response.status}): ${path}`);
  return new Uint8Array(await response.arrayBuffer());
}
function unpack(bytes) {
  return bytes[0] === 31 && bytes[1] === 139 ? gunzipSync(bytes) : bytes;
}
async function setupLocalRuntime() {
  const manifest = JSON.parse(new TextDecoder().decode(await readAsset(root + 'manifest.json')));
  const files = manifest.files || manifest;
  // No input audio is ever passed to fetch. These are model/config/wasm reads.
  globalThis.fetch = async (resource, options) => {
    const url = localURL(
      typeof resource === 'string' || resource instanceof URL ? resource : resource.url,
    );
    if (options?.method && options.method !== 'GET')
      throw new Error('The speech worker only reads local assets.');
    const relative = url.pathname.startsWith(root) ? url.pathname.slice(root.length) : url.pathname;
    const entry = files[relative];
    if (!entry) return originalFetch(resource, options);
    const parts = Array.isArray(entry) ? entry : entry.parts;
    if (!Array.isArray(parts) || !parts.length)
      throw new Error('Invalid local speech asset manifest.');
    const buffers = await Promise.all(
      parts.map((path) => readAsset(new URL(path, self.location.origin + root).href)),
    );
    const size = buffers.reduce((sum, bytes) => sum + bytes.length, 0);
    if (size > 80000000) throw new Error('Local speech model asset exceeds its size limit.');
    const combined = new Uint8Array(size);
    let offset = 0;
    for (const buffer of buffers) {
      combined.set(buffer, offset);
      offset += buffer.length;
    }
    const bytes = unpack(combined);
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(bytes.length),
      },
    });
  };
  const { env, pipeline } = await import('@huggingface/transformers');
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.localModelPath = '/tool-runtime/models/';
  env.useBrowserCache = true;
  const wasm = env.backends.onnx.wasm;
  wasm.numThreads = 1;
  wasm.proxy = false;
  wasm.wasmBinary = unpack(
    await readAsset('/tool-runtime/onnx/ort-wasm-simd-threaded.jsep.wasm.gz'),
  );
  wasm.wasmPaths = {
    mjs: self.location.origin + '/tool-runtime/onnx/ort-wasm-simd-threaded.jsep.mjs',
  };
  return pipeline;
}
self.onmessage = async ({ data: { samples, language, timestamps } }) => {
  let transcriber;
  try {
    progress('Loading the local Whisper tiny speech model', 15);
    const pipeline = await setupLocalRuntime();
    transcriber = await pipeline('automatic-speech-recognition', 'whisper-tiny', {
      device: 'wasm',
      dtype: 'q8',
      local_files_only: true,
      progress_callback: (item) => {
        if (item.status === 'progress')
          progress(
            'Loading the local Whisper tiny speech model',
            Math.min(45, 15 + Math.round((item.progress || 0) * 0.3)),
          );
      },
    });
    progress('Recognizing speech on this device', 50);
    const result = await transcriber(samples, {
      ...(language === 'auto' ? {} : { language: language.toLowerCase() }),
      task: 'transcribe',
      return_timestamps: timestamps,
      chunk_length_s: 30,
      stride_length_s: 5,
      max_new_tokens: 448,
      chunk_callback: () => progress('Recognizing speech on this device', 70),
    });
    self.postMessage({ type: 'result', value: result });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error.message || 'Local speech recognition failed.',
    });
  } finally {
    await transcriber?.dispose();
  }
};
