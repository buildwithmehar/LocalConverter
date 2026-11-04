import { mediaTools } from '../../shared/media-tools.js';
import { gunzip } from './utility-common.js';

export const MAX_INPUT = 100 * 1024 * 1024;
export const MAX_OUTPUT = 200 * 1024 * 1024;
export const MAX_JOB_MS = 180000;
export const audioFormats = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aiff'];
export const videoFormats = ['mp4', 'webm', 'mov', 'mkv'];
export const mimeTypes = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  gif: 'image/gif',
  webp: 'image/webp',
  apng: 'image/apng',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aiff: 'audio/aiff',
  png: 'image/png',
  jpg: 'image/jpeg',
  zip: 'application/zip',
  srt: 'application/x-subrip',
  vtt: 'text/vtt',
  ass: 'text/plain',
  ssa: 'text/plain',
  txt: 'text/plain',
};
export const unsupportedTools = {};
export function mediaFailure(error, loaded = false) {
  if (error instanceof Error) return error;
  const reason = String(error || 'Unknown worker error.').slice(0, 1000);
  return new Error(
    `${loaded ? 'Media processing failed' : 'The local media engine could not load. Refresh the page and retry'}: ${reason}`,
  );
}
export function lottieBytes(bytes, source) {
  const decoded = source === 'tgs' ? gunzip(bytes) : bytes;
  if (decoded.length > 5 * 1024 * 1024) throw new Error('Lottie JSON exceeds 5 MiB.');
  return decoded;
}
export const extension = (input) =>
  String(input.source || input.name?.split('.').pop() || '').toLowerCase();
export function checkAbort(signal) {
  if (signal?.aborted)
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException('Conversion cancelled.', 'AbortError');
}
export function numberOption(options, key, fallback, min, max) {
  const value = options[key] ?? fallback;
  if (!Number.isFinite(value) || value < min || value > max)
    throw new Error(`Invalid ${key}; expected ${min}–${max}.`);
  return value;
}
export function validateInputs(operation, inputs, options = {}) {
  if (unsupportedTools[operation]) throw new Error(unsupportedTools[operation]);
  const definition = mediaTools.find((tool) => tool.id === operation);
  if (!definition) throw new Error('Unknown media tool.');
  if (
    !Array.isArray(inputs) ||
    inputs.length < definition.minFiles ||
    inputs.length > 20 ||
    (!definition.multiple && inputs.length !== 1)
  )
    throw new Error('Invalid file count.');
  if (['replace-video-audio', 'burn-subtitles'].includes(operation) && inputs.length !== 2)
    throw new Error('This tool requires exactly two files in the displayed order.');
  let total = 0;
  for (const input of inputs) {
    if (!(input.file instanceof Blob) || !input.file.size)
      throw new Error('Input must be a nonempty browser file.');
    if (!definition.accept.includes(extension(input)))
      throw new Error('Unsupported input format for this tool.');
    total += input.file.size;
  }
  if (total > MAX_INPUT) throw new Error('Inputs exceed 100 MB.');
  const result = { ...definition.defaults, ...options };
  for (const field of definition.fields) {
    if (field.type === 'number')
      numberOption(result, field.key, field.default, field.min, field.max);
    if (field.type === 'checkbox' && typeof result[field.key] !== 'boolean')
      throw new Error(`Invalid ${field.key}.`);
    if (field.type === 'select' && !field.options.some(([value]) => value === result[field.key]))
      throw new Error(`Unsupported ${field.key}.`);
  }
  if (Boolean(result.cropWidth) !== Boolean(result.cropHeight))
    throw new Error('Set both crop width and height, or leave both at zero.');
  return result;
}
export function segment(options, metadata, max = 120) {
  const start = numberOption(options, 'start', 0, 0, 7200);
  const requested = numberOption(options, 'duration', 20, 0.1, max);
  if (!(metadata.duration > start)) throw new Error('Start must be before the media ends.');
  return { start, length: Math.min(requested, metadata.duration - start) };
}
export function pairSegment(options, metadata, target) {
  const start = numberOption(options, 'start', 0, 0, 7200);
  if (!(metadata.duration > start)) throw new Error('Start must be before the media ends.');
  const maximum = target === 'gif' ? 30 : 120;
  const remaining = metadata.duration - start;
  if (options.duration === undefined && remaining > maximum)
    throw new Error(
      `Browser ${target === 'gif' ? 'GIF' : 'media'} conversion is limited to ${maximum} seconds. Choose a Duration of ${maximum} seconds or less and a Start time for the segment you want; the file will not be truncated automatically.`,
    );
  const requested =
    options.duration === undefined
      ? remaining
      : numberOption(options, 'duration', maximum, 0.1, maximum);
  return { start, length: Math.min(requested, remaining) };
}
export function inspectProbe(data) {
  const v = data.streams?.find((stream) => stream.codec_type === 'video');
  const a = data.streams?.find((stream) => stream.codec_type === 'audio');
  const duration = Number(data.format?.duration || v?.duration || a?.duration);
  if (!data.streams?.length) throw new Error('Media contains no decodable streams.');
  if (!(duration > 0) || duration > 7200)
    throw new Error('Media must have a known duration of at most two hours.');
  if (v && (!(v.width > 0) || !(v.height > 0) || v.width * v.height > 8294400))
    throw new Error('Media frame exceeds 8.3 million pixels.');
  return { v, a, duration };
}
export function audioCodec(format, options) {
  const codecs = {
    mp3: 'libmp3lame',
    wav: 'pcm_s16le',
    flac: 'flac',
    ogg: 'libvorbis',
    m4a: 'aac',
    aiff: 'pcm_s16be',
  };
  if (!codecs[format]) throw new Error('Unsupported audio output format.');
  return [
    '-c:a',
    codecs[format],
    ...(['wav', 'flac', 'aiff'].includes(format)
      ? []
      : ['-b:a', `${numberOption(options, 'bitrate', 128, 32, 320)}k`]),
  ];
}
export function videoCodec(format, options) {
  if (!videoFormats.includes(format)) throw new Error('Unsupported video output format.');
  // VP9 in core 0.12.10 can corrupt wasm memory while audio is being encoded.
  // VP8 is a valid WebM codec and its single-thread path is stable with Opus.
  return [
    '-c:v',
    format === 'webm' ? 'libvpx' : 'libx264',
    '-crf',
    String(numberOption(options, 'crf', 26, 16, 45)),
    ...(format === 'webm'
      ? ['-b:v', '2M', '-deadline', 'realtime', '-cpu-used', '6']
      : ['-preset', 'veryfast']),
    '-threads',
    '1',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    format === 'webm' ? 'libopus' : 'aac',
    ...(['webm', 'mkv'].includes(format) ? [] : ['-movflags', '+faststart']),
  ];
}
export function tempo(speed) {
  const result = [];
  while (speed > 2) {
    result.push('atempo=2');
    speed /= 2;
  }
  while (speed < 0.5) {
    result.push('atempo=0.5');
    speed *= 2;
  }
  result.push(`atempo=${speed}`);
  return result;
}
export function frameBudget(width, height, frames) {
  if (!(frames > 0) || frames > 240 || width * height * frames > 64000000)
    throw new Error(
      'Animation exceeds 240 frames or 64 million decoded pixels; reduce width, duration or fps.',
    );
}
export function cleanSubtitle(text) {
  if (text.length > 2000000 || text.includes('\0'))
    throw new Error('Subtitle file exceeds text limits.');
  if (/(?:^|\n)\s*(?:fontname:|filename:|\[Fonts\]|\[Graphics\])/i.test(text))
    throw new Error('Embedded subtitle attachments are unsupported.');
  return text;
}
export function convertSubtitles(text, source, format, shift = 0) {
  cleanSubtitle(text);
  if (
    !['srt', 'vtt', 'ass', 'ssa'].includes(source) ||
    !['srt', 'vtt', 'ass', 'ssa'].includes(format)
  )
    throw new Error('Unsupported subtitle format.');
  if (!Number.isFinite(shift) || Math.abs(shift) > 7200)
    throw new Error('Invalid subtitle timestamp shift.');
  const cues = [];
  const parse = (value) => {
    const m = value.trim().match(/^(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{1,3})$/);
    return m && Number(m[2]) < 60 && Number(m[3]) < 60
      ? Number(m[1] || 0) * 3600 +
          Number(m[2]) * 60 +
          Number(m[3]) +
          Number(m[4]) / 10 ** m[4].length
      : NaN;
  };
  if (['ass', 'ssa'].includes(source)) {
    for (const line of text.split(/\r?\n/)) {
      if (!/^Dialogue:/i.test(line)) continue;
      const cells = line.replace(/^Dialogue:\s*/i, '').split(',');
      if (cells.length < 10) throw new Error('Invalid ASS/SSA dialogue.');
      cues.push([
        parse(cells[1]),
        parse(cells[2]),
        cells
          .slice(9)
          .join(',')
          .replace(/\{[^}]*\}/g, '')
          .replace(/\\[Nn]/g, '\n'),
      ]);
    }
  } else {
    for (const block of text
      .replace(/^\uFEFF/, '')
      .replace(/^WEBVTT[^\n]*\n/, '')
      .split(/\r?\n\s*\r?\n/)) {
      const lines = block.split(/\r?\n/),
        index = lines.findIndex((line) => line.includes('-->'));
      if (index < 0) continue;
      const times = lines[index].match(/^\s*([\d:.,]+)\s+-->\s+([\d:.,]+)/);
      if (!times) throw new Error('Invalid subtitle timestamp.');
      cues.push([
        parse(times[1]),
        parse(times[2]),
        lines
          .slice(index + 1)
          .join('\n')
          .replace(/<[^>]*>/g, '')
          .trimEnd(),
      ]);
    }
  }
  if (
    !cues.length ||
    cues.length > 10000 ||
    cues.some(([start, end]) => !Number.isFinite(start) || !Number.isFinite(end) || end < start)
  )
    throw new Error('No valid subtitle cues found.');
  const timestamp = (seconds, ass = false) => {
    let ms = Math.max(0, Math.round((seconds + shift) * 1000));
    const h = Math.floor(ms / 3600000);
    ms %= 3600000;
    const m = Math.floor(ms / 60000);
    ms %= 60000;
    const s = Math.floor(ms / 1000);
    ms %= 1000;
    return `${ass ? h : String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${ass || format === 'vtt' ? '.' : ','}${String(ass ? Math.floor(ms / 10) : ms).padStart(ass ? 2 : 3, '0')}`;
  };
  if (['ass', 'ssa'].includes(format)) {
    const ssa = format === 'ssa';
    const header = ssa
      ? '[Script Info]\nScriptType: v4.00\n[V4 Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, TertiaryColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, AlphaLevel, Encoding\nStyle: Default,Arial,24,16777215,16777215,0,0,0,0,1,1,0,2,10,10,10,0,1\n[Events]\nFormat: Marked, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'
      : '[Script Info]\nScriptType: v4.00+\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,24,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,2,10,10,10,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
    return (
      header +
      cues
        .map(
          (cue) =>
            `Dialogue: ${ssa ? 'Marked=0' : '0'},${timestamp(cue[0], true)},${timestamp(cue[1], true)},Default,,0,0,0,,${cue[2].replace(/[{}]/g, '').replace(/\n/g, '\\N')}`,
        )
        .join('\n') +
      '\n'
    );
  }
  return (
    (format === 'vtt' ? 'WEBVTT\n\n' : '') +
    cues
      .map((cue, i) => `${i + 1}\n${timestamp(cue[0])} --> ${timestamp(cue[1])}\n${cue[2]}`)
      .join('\n\n') +
    '\n'
  );
}
