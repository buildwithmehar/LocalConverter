import { abort, fail } from './utility-common.js';
import { executeDataPair } from './utility-pair-core.js';
export { supportedDataPairs } from './utility-pair-core.js';
export async function convertDataPair(request) {
  abort(request.signal);
  if (typeof Worker === 'undefined') return executeDataPair(request);
  if (!(request.file instanceof Blob)) fail('Input file bytes are unavailable.');
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./utility-pair-worker.js', import.meta.url), {
      type: 'module',
    });
    let done = false;
    const finish = (error, out) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        request.signal?.removeEventListener('abort', cancel);
        worker.terminate();
        error ? reject(error) : resolve(out);
      },
      cancel = () => finish(new Error('Conversion cancelled.')),
      timer = setTimeout(
        () => finish(new Error('Table conversion took too long. Use a smaller file.')),
        60000,
      );
    request.signal?.addEventListener('abort', cancel, { once: true });
    worker.onerror = (e) => finish(new Error(e.message || 'Browser table worker failed.'));
    worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.result);
    const { signal, ...payload } = request;
    worker.postMessage(payload);
  });
}
