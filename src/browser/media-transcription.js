import { checkAbort, MAX_JOB_MS } from './media-helpers.js';

export function transcriptOutput(result, format, duration) {
  const text = String(result?.text || '').trim();
  if (!text)
    throw new Error('No speech was recognized. Try a clearer recording or a different language.');
  if (format === 'txt') return text + '\n';
  if (!['srt', 'vtt'].includes(format)) throw new Error('Unsupported transcript output format.');
  const chunks = (result.chunks || []).filter((chunk) => String(chunk.text || '').trim());
  if (!chunks.length) throw new Error('The speech model returned no timestamped segments.');
  const stamp = (value) => {
    let ms = Math.round(Math.min(duration, Math.max(0, value)) * 1000);
    const hour = Math.floor(ms / 3600000);
    ms %= 3600000;
    const minute = Math.floor(ms / 60000);
    ms %= 60000;
    const second = Math.floor(ms / 1000);
    ms %= 1000;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}${format === 'vtt' ? '.' : ','}${String(ms).padStart(3, '0')}`;
  };
  const cues = chunks.map((chunk, index) => {
    const begin = Number(chunk.timestamp?.[0]);
    const finish = chunk.timestamp?.[1] ?? chunks[index + 1]?.timestamp?.[0] ?? duration;
    if (!Number.isFinite(begin) || !Number.isFinite(finish) || finish < begin)
      throw new Error('The speech model returned invalid segment timestamps.');
    return `${index + 1}\n${stamp(begin)} --> ${stamp(finish)}\n${String(chunk.text).trim().replace(/-->/g, '→')}`;
  });
  return (format === 'vtt' ? 'WEBVTT\n\n' : '') + cues.join('\n\n') + '\n';
}

export async function transcribeAudio({ samples, format, language, onProgress, signal }) {
  checkAbort(signal);
  if (!(samples instanceof Float32Array) || !samples.length || samples.length > 16000 * 120)
    throw new Error('Speech input must contain up to 120 seconds of mono 16 kHz audio.');
  if (language !== 'auto' && !/^[a-z]{2,3}$/i.test(language))
    throw new Error('Use a two-letter language code, or auto.');
  const duration = samples.length / 16000;
  let energy = 0;
  for (let i = 0; i < samples.length; i++) {
    if (!Number.isFinite(samples[i])) throw new Error('Invalid speech audio samples.');
    energy += samples[i] * samples[i];
  }
  if (Math.sqrt(energy / samples.length) < 0.0001)
    throw new Error('The selected segment is silent. No speech can be transcribed.');
  const worker = new Worker(new URL('./media-transcription.worker.js', import.meta.url), {
    type: 'module',
  });
  try {
    const result = await new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      };
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        error ? reject(error) : resolve(value);
      };
      const abort = () =>
        finish(
          signal.reason instanceof Error
            ? signal.reason
            : new DOMException('Transcription cancelled.', 'AbortError'),
        );
      const timer = setTimeout(
        () =>
          finish(new Error('Browser transcription exceeded three minutes. Try a shorter segment.')),
        MAX_JOB_MS,
      );
      signal?.addEventListener('abort', abort, { once: true });
      worker.onerror = (event) =>
        finish(new Error(event.message || 'Browser speech worker failed to initialize.'));
      worker.onmessage = ({ data }) => {
        if (data.type === 'progress') onProgress?.(data.value);
        if (data.type === 'result') finish(null, data.value);
        if (data.type === 'error') finish(new Error(data.message));
      };
      worker.postMessage({ samples, language, timestamps: format !== 'txt' }, [samples.buffer]);
    });
    return {
      content: transcriptOutput(result, format, duration),
      details: {
        model: 'Whisper tiny (quantized)',
        duration,
        note: 'Speech recognition runs on this device and can make mistakes. Review the transcript.',
      },
    };
  } finally {
    worker.terminate();
  }
}
