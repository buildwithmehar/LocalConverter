import { executeCore } from './utility-core.js';
self.onmessage = async ({ data }) => {
  self.postMessage({ ready: true });
  try {
    const out = await executeCore(data.operation, data.inputs, data.options);
    self.postMessage({ result: out }, [out.bytes.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message || 'Browser conversion failed.' });
  }
};
