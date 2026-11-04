export function convertFontInWorker(request) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./font-worker.js', import.meta.url), { type: 'module' });
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', abort);
      worker.terminate();
      error ? reject(error) : resolve(value);
    };
    const abort = () => finish(new Error('Font conversion cancelled.')),
      timer = setTimeout(
        () => finish(new Error('Font conversion timed out. Try a smaller font.')),
        120000,
      );
    request.signal?.addEventListener('abort', abort, { once: true });
    if (request.signal?.aborted) {
      abort();
      return;
    }
    worker.onerror = (error) => finish(new Error(error.message || 'Font worker failed.'));
    worker.onmessage = ({ data }) =>
      data.progress
        ? request.onProgress?.(data.progress)
        : finish(data.error ? new Error(data.error) : null, data.result);
    const { signal, onProgress, ...input } = request;
    worker.postMessage(input);
  });
}
