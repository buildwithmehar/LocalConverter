import { executeDataPair } from './utility-pair-core.js';
self.onmessage = async ({ data }) => {
  try {
    self.postMessage({ result: await executeDataPair(data) });
  } catch (error) {
    self.postMessage({ error: error.message || 'Table conversion failed.' });
  }
};
