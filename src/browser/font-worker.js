import { convert } from './image-document-engine.js';
// This codec checks `window` rather than WorkerGlobalScope when resolving its
// explicitly supplied wasm URL. The isolated worker has no DOM dependencies.
globalThis.window = globalThis;
self.onmessage = async ({ data }) => {
  try {
    const result = await convert({
      ...data,
      onProgress: (progress) => self.postMessage({ progress }),
    });
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error.message || 'Font conversion failed.' });
  }
};
