import fs from 'node:fs/promises';
import { runProcess, fail, LIMITS } from './common.js';
export const audioFormats = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aiff'];
export const videoFormats = ['mp4', 'webm', 'mov', 'mkv'];
const demuxers = {
  mp3: 'mp3',
  wav: 'wav',
  flac: 'flac',
  ogg: 'ogg',
  m4a: 'mov',
  aiff: 'aiff',
  mp4: 'mov',
  mov: 'mov',
  mkv: 'matroska',
  webm: 'matroska',
};
export const codecs = {
  mp3: 'libmp3lame',
  wav: 'pcm_s16le',
  flac: 'flac',
  ogg: 'libvorbis',
  m4a: 'aac',
  aiff: 'pcm_s16be',
  mp4: 'libx264',
  mov: 'libx264',
  mkv: 'libx264',
  webm: 'libvpx-vp9',
  gif: 'gif',
};
let detection;
export async function detectMedia() {
  return (detection ??= Promise.all([
    runProcess('ffmpeg', ['-hide_banner', '-encoders'], { timeout: 10000 }),
    runProcess('ffprobe', ['-version'], { timeout: 10000 }),
  ])
    .then(([encoders, version]) => ({
      available: true,
      encoders: Object.keys(codecs).filter((x) =>
        [
          codecs[x],
          ...(['mp4', 'mov', 'mkv'].includes(x) ? ['aac'] : x === 'webm' ? ['libopus'] : []),
        ].every((codec) => new RegExp(`\\b${codec}\\b`).test(encoders)),
      ),
      version: version.split('\n')[0],
    }))
    .catch(() => ({ available: false, encoders: [], version: null })));
}
function signature(buffer, source) {
  const ascii = buffer.subarray(0, 16).toString('latin1');
  const ok = {
    mp3: ascii.startsWith('ID3') || (buffer[0] === 255 && (buffer[1] & 224) === 224),
    wav: ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WAVE',
    flac: ascii.startsWith('fLaC'),
    ogg: ascii.startsWith('OggS'),
    aiff: ascii.startsWith('FORM') && ['AIFF', 'AIFC'].includes(ascii.slice(8, 12)),
    m4a: ascii.slice(4, 8) === 'ftyp',
    mp4: ascii.slice(4, 8) === 'ftyp',
    mov:
      ascii.slice(4, 8) === 'ftyp' || ascii.slice(4, 8) === 'wide' || ascii.slice(4, 8) === 'mdat',
    mkv: buffer.readUInt32BE(0) === 0x1a45dfa3,
    webm: buffer.readUInt32BE(0) === 0x1a45dfa3,
  }[source];
  if (!ok) fail('File signature does not match its selected media format.');
}
export async function probeMedia(file, signal, source) {
  const args = [
    '-v',
    'error',
    '-protocol_whitelist',
    'file,pipe',
    ...(source ? ['-f', demuxers[source]] : []),
    '-show_format',
    '-show_streams',
    '-of',
    'json',
    file,
  ];
  return JSON.parse(await runProcess('ffprobe', args, { signal, timeout: 20000 }));
}
export async function convertMedia({
  inputPath,
  path: outputPath,
  buffer,
  source,
  target,
  options,
  signal,
  onProgress,
}) {
  signature(buffer, source);
  const input = await probeMedia(inputPath, signal, source);
  const audio = input.streams.some((s) => s.codec_type === 'audio');
  const video = input.streams.find((s) => s.codec_type === 'video');
  if (audioFormats.includes(source) && !audio) fail('Input contains no audio stream.');
  if (videoFormats.includes(source) && !video) fail('Input contains no video stream.');
  if (audioFormats.includes(target) && !audio) fail('Video contains no audio track to extract.');
  const duration = Number(input.format.duration);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 7200)
    fail('Media must have a finite duration of at most two hours.');
  for (const s of input.streams)
    if (s.width * s.height > LIMITS.pixels) fail('Video frame exceeds pixel limit.');
  const remaining = duration - (options.start || 0);
  if (remaining <= 0) fail('Start time must occur before the end of the input.');
  const expectedDuration = Math.min(options.duration || remaining, remaining);
  if (video && !audioFormats.includes(target)) {
    const width = options.width || video.width;
    if (width * Math.ceil((video.height * width) / video.width) > LIMITS.pixels)
      fail('Resized video exceeds 40 million pixels per frame.');
  }
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    '-y',
    '-protocol_whitelist',
    'file,pipe',
    '-f',
    demuxers[source],
    '-i',
    inputPath,
    '-map_metadata',
    '-1',
    '-threads',
    '2',
  ];
  if (options.start) args.push('-ss', String(options.start));
  if (options.duration) args.push('-t', String(options.duration));
  if (audioFormats.includes(target)) {
    args.push('-map', '0:a:0', '-vn', '-c:a', codecs[target]);
    if (options.audioBitrate) args.push('-b:a', `${options.audioBitrate}k`);
  } else if (target === 'gif') {
    args.push(
      '-map',
      '0:v:0',
      '-an',
      '-vf',
      `fps=${options.fps ?? 10},scale=${options.width ?? 480}:-1:flags=lanczos`,
    );
  } else {
    args.push(
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-c:v',
      codecs[target],
      '-pix_fmt',
      'yuv420p',
      '-vf',
      options.width ? `scale=${options.width}:-2` : 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    );
    if (['mp4', 'mov', 'mkv'].includes(target)) {
      args.push('-preset', 'fast', '-crf', String(options.crf ?? 23), '-c:a', 'aac');
      if (target !== 'mkv') args.push('-movflags', '+faststart');
    }
    if (target === 'webm')
      args.push(
        '-deadline',
        'realtime',
        '-cpu-used',
        '6',
        '-crf',
        String(options.crf ?? 30),
        '-b:v',
        '0',
        '-c:a',
        'libopus',
      );
  }
  args.push('-progress', 'pipe:1', '-nostats', '-fs', String(LIMITS.outputBytes), outputPath);
  let pending = '';
  await runProcess('ffmpeg', args, {
    signal,
    onLine: (chunk) => {
      pending += chunk;
      const lines = pending.split('\n');
      pending = lines.pop();
      for (const line of lines) {
        const m = line.match(/^out_time_us=(\d+)/);
        if (m)
          onProgress?.({
            stage: 'Encoding media',
            progress: Math.min(100, Math.round((Number(m[1]) / 1e6 / expectedDuration) * 100)),
          });
      }
    },
  });
  const stat = await fs.stat(outputPath);
  if (!stat.size || stat.size >= LIMITS.outputBytes) fail('Encoded media exceeds output limit.');
  const out = await probeMedia(outputPath, signal);
  const outDuration = Number(out.format.duration);
  const expectedCodec = {
    mp3: 'mp3',
    wav: 'pcm_s16le',
    flac: 'flac',
    ogg: 'vorbis',
    m4a: 'aac',
    aiff: 'pcm_s16be',
    mp4: 'h264',
    mov: 'h264',
    mkv: 'h264',
    webm: 'vp9',
    gif: 'gif',
  }[target];
  if (!out.streams.length || !(outDuration > 0) || out.streams[0].codec_name !== expectedCodec)
    fail('Encoded media failed codec validation.');
  if (outDuration + Math.max(0.5, expectedDuration * 0.02) < expectedDuration)
    fail('Encoded media was truncated, possibly by the output size limit.');
  if (audioFormats.includes(target) && out.streams[0].codec_type !== 'audio')
    fail('Audio output validation failed.');
  return { duration: outDuration, codec: out.streams[0].codec_name };
}
