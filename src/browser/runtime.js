import { zipSync } from 'fflate';

export function createBrowserRuntime({
  registry,
  convert,
  createUrl = (blob) => URL.createObjectURL(blob),
  revokeUrl = (url) => URL.revokeObjectURL(url),
} = {}) {
  const records = new Map();
  let pumping = false;
  const limits = {
    maxBytes: 104857600,
    maxFiles: 20,
    maxOutputBytes: 209715200,
    maxTotalOutputBytes: 157286400,
    timeoutSeconds: 180,
    ...registry.limits,
  };
  const fail = (message) => {
    throw new Error(message);
  };
  const publicJob = (record) => {
    const { input, controller, blob, url, generation, ...job } = record;
    return { ...job };
  };
  const jobs = () => [...records.values()].map(publicJob);
  function dispose(record) {
    record.controller?.abort();
    if (record.url) revokeUrl(record.url);
    record.url = '';
    record.blob = null;
    record.generation++;
  }
  function stop(record) {
    dispose(record);
    record.status = 'cancelled';
    record.stage = 'Cancelled';
    record.error = '';
  }
  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      for (;;) {
        const record = [...records.values()].find((job) => job.status === 'queued');
        if (!record) break;
        const generation = ++record.generation,
          controller = new AbortController();
        record.controller = controller;
        record.status = 'processing';
        record.stage = 'Processing in your browser…';
        const current = () =>
          records.get(record.id) === record &&
          record.generation === generation &&
          record.status === 'processing';
        let timer, abort;
        try {
          const interrupted = new Promise((_, reject) => {
            abort = () => reject(new Error('Processing cancelled.'));
            controller.signal.addEventListener('abort', abort, { once: true });
            timer = setTimeout(() => {
              reject(new Error('Browser processing timed out. Try a smaller file.'));
              controller.abort();
            }, limits.timeoutSeconds * 1000);
          });
          const result = await Promise.race([
            convert({
              ...record.input,
              signal: controller.signal,
              onProgress: (update) => {
                if (current()) {
                  if (typeof update === 'string') record.stage = update;
                  else if (typeof update === 'number')
                    record.progress = Math.max(0, Math.min(100, update));
                  else if (update) {
                    record.stage = update.stage || record.stage;
                    if (Number.isFinite(update.progress))
                      record.progress = Math.max(0, Math.min(100, update.progress));
                  }
                }
              },
            }),
            interrupted,
          ]);
          if (!current()) continue;
          if (!(result?.blob instanceof Blob) || !result.blob.size)
            fail('The engine did not produce a readable output file.');
          if (result.blob.size > limits.maxOutputBytes)
            fail('Output exceeds the browser memory budget. Try a smaller file.');
          const stored = [...records.values()].reduce((n, job) => n + (job.blob?.size || 0), 0);
          if (stored + result.blob.size > limits.maxTotalOutputBytes)
            fail('Result memory is full. Download and remove previous results, then retry.');
          record.blob = result.blob;
          record.url = createUrl(result.blob);
          record.outputName = String(result.filename || 'converted.bin').replace(
            /[\\/\x00-\x1f]/g,
            '_',
          );
          record.mime = result.mime || result.blob.type || 'application/octet-stream';
          record.outputSize = result.blob.size;
          record.details = {
            ...result.details,
            ...(typeof result.details?.targetReached === 'boolean'
              ? {
                  targetMet: result.details.targetReached,
                  targetBytes: result.details.targetKB * 1024,
                }
              : {}),
          };
          record.status = 'completed';
          record.stage = 'Ready to download';
          record.progress = 100;
          record.input = null;
        } catch (error) {
          if (current()) {
            record.status = 'failed';
            record.stage = 'Needs attention';
            record.error = error.message || 'Browser conversion failed.';
          }
        } finally {
          clearTimeout(timer);
          controller.signal.removeEventListener('abort', abort);
          if (record.controller === controller) record.controller = null;
        }
      }
    } finally {
      pumping = false;
    }
  }
  async function enqueue(path, form) {
    if (!(form instanceof FormData)) fail('Choose files before starting this operation.');
    if (records.size >= limits.maxFiles)
      fail(
        `Keep up to ${limits.maxFiles} files in this workspace. Remove a result before adding more.`,
      );
    const operation = path.match(/^\/api\/tools\/([^/]+)\/jobs$/)?.[1],
      tool = operation ? registry.tools.find((t) => t.id === operation) : null;
    if (operation && !tool) fail('This tool is unavailable.');
    if (tool?.browserUnavailable) fail(tool.browserUnavailable);
    const files = operation ? form.getAll('files') : [form.get('file')];
    if (
      !files.length ||
      files.length > 20 ||
      files.some((file) => !(file instanceof Blob) || !file.size)
    )
      fail('Choose up to 20 nonempty files.');
    const size = files.reduce((n, file) => n + file.size, 0);
    if (size > limits.maxBytes)
      fail(`Input size exceeds the ${limits.maxBytes} byte browser limit.`);
    const retained = [...records.values()].flatMap((job) => job.input?.inputs || []);
    if (
      retained.reduce((n, input) => n + input.file.size, 0) + size > limits.maxBytes ||
      retained.length + files.length > limits.maxFiles
    )
      fail(
        'Browser input memory is full. Finish, remove or clear existing work before adding more files.',
      );
    let options;
    try {
      options = JSON.parse(form.get('options') || '{}');
    } catch {
      fail('Invalid conversion settings.');
    }
    if (!options || typeof options !== 'object' || Array.isArray(options))
      fail('Invalid conversion settings.');
    const source = String(form.get('source') || files[0].name?.split('.').pop() || 'txt'),
      target = String(form.get('target') || '');
    if (
      !operation &&
      !registry.pairs.some((pair) => pair.source === source && pair.target === target)
    )
      fail('This conversion is not supported in this browser build.');
    const inputSource = (file) => {
      const name = (file.name || 'input.txt').toLowerCase();
      return (
        ['tar.gz', 'tar.bz2', 'tar.xz'].find((ext) => name.endsWith('.' + ext)) ||
        { jpeg: 'jpg', tif: 'tiff', yml: 'yaml', htm: 'html' }[name.split('.').pop()] ||
        name.split('.').pop()
      );
    };
    const input = {
      operation,
      source,
      target,
      file: files[0],
      inputs: files.map((file) => ({
        file,
        name: file.name || 'input.txt',
        source: inputSource(file),
      })),
      options,
    };
    const id = crypto.randomUUID(),
      record = {
        id,
        operation,
        source,
        target,
        name: operation
          ? files.length > 1
            ? `${tool.title} · ${files.length} files`
            : files[0].name
          : files[0].name,
        size,
        status: 'queued',
        stage: 'Queued',
        progress: null,
        input,
        generation: 0,
        createdAt: Date.now(),
      };
    records.set(id, record);
    const job = publicJob(record);
    queueMicrotask(pump);
    return { job };
  }
  async function request(path, init = {}) {
    const method = (init.method || 'GET').toUpperCase();
    if (path === '/api/session') return { token: 'browser-memory-session' };
    if (path === '/api/registry') return { ...registry, limits };
    if (path === '/api/jobs' && method === 'GET') return { jobs: jobs() };
    if ((path === '/api/jobs' || /^\/api\/tools\/[^/]+\/jobs$/.test(path)) && method === 'POST')
      return enqueue(path, init.body);
    if (path === '/api/clear' && method === 'POST') {
      for (const job of records.values()) dispose(job);
      records.clear();
      return null;
    }
    const match = path.match(/^\/api\/jobs\/([^/]+)(?:\/(cancel|retry))?$/);
    if (match) {
      const record = records.get(match[1]);
      if (!record) fail('This browser result is no longer available.');
      if (method === 'DELETE' && !match[2]) {
        dispose(record);
        records.delete(record.id);
        return null;
      }
      if (method === 'POST' && match[2] === 'cancel') {
        if (!['queued', 'processing'].includes(record.status))
          fail('Only queued or processing jobs can be cancelled.');
        stop(record);
        return { job: publicJob(record) };
      }
      if (method === 'POST' && match[2] === 'retry') {
        if (!['failed', 'cancelled'].includes(record.status) || !record.input)
          fail('Only failed or cancelled work with its original input can be retried.');
        dispose(record);
        record.status = 'queued';
        record.error = '';
        record.progress = null;
        record.stage = 'Queued';
        queueMicrotask(pump);
        return { job: publicJob(record) };
      }
      if (method === 'GET') return { job: publicJob(record) };
    }
    fail('This browser operation is unavailable.');
  }
  async function batchBlob(ids) {
    const entries = {};
    let total = 0;
    for (const [i, id] of ids.entries()) {
      const record = records.get(id);
      if (!record?.blob) continue;
      total += record.blob.size;
      if (total > limits.maxTotalOutputBytes) fail('ZIP exceeds the browser memory budget.');
      entries[`${i + 1}-${record.outputName}`] = new Uint8Array(await record.blob.arrayBuffer());
    }
    if (!Object.keys(entries).length) fail('No completed results to download.');
    return new Blob([zipSync(entries, { level: 0 })], { type: 'application/zip' });
  }
  return {
    request,
    jobs,
    downloadUrl: (id) => records.get(id)?.url || '',
    resultBlob: (id) => records.get(id)?.blob,
    batchBlob,
    dispose: () => {
      for (const record of records.values()) dispose(record);
      records.clear();
    },
  };
}
