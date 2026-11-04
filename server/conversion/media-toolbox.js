import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { zipSync } from 'fflate';
import sharp from 'sharp';
import { createRequire } from 'node:module';
import { runProcess, fail, LIMITS, textInput } from './common.js';
import { mediaTools } from '../../shared/media-tools.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const demux = {
  mp4: 'mov',
  mov: 'mov',
  m4a: 'mov',
  mkv: 'matroska',
  webm: 'matroska',
  avi: 'avi',
  flv: 'flv',
  wmv: 'asf',
  wma: 'asf',
  mpeg: 'mpeg',
  mpg: 'mpeg',
  ts: 'mpegts',
  mp3: 'mp3',
  wav: 'wav',
  flac: 'flac',
  ogg: 'ogg',
  opus: 'ogg',
  aiff: 'aiff',
  aac: 'aac',
  amr: 'amr',
  ape: 'ape',
  gif: 'gif',
  apng: 'apng',
  png: 'apng',
};
const mime = {
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
  zip: 'application/zip',
  srt: 'application/x-subrip',
  vtt: 'text/vtt',
  ass: 'text/plain',
  ssa: 'text/plain',
  txt: 'text/plain',
};
const n = (o, k, d, min, max) => {
  const v = o[k] ?? d;
  if (!Number.isFinite(v) || v < min || v > max) fail(`Invalid ${k}; expected ${min}–${max}.`);
  return v;
};
const choice = (o, k, d, values) => {
  const v = o[k] ?? d;
  if (!values.includes(v)) fail(`Unsupported ${k}.`);
  return v;
};
const ff = async (args, signal, cwd) =>
  runProcess(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-y',
      '-threads',
      '2',
      '-filter_threads',
      '1',
      '-filter_complex_threads',
      '1',
      ...args.slice(0, -1),
      ...(args.at(-1) === '-' ? [] : ['-fs', String(LIMITS.outputBytes)]),
      args.at(-1),
    ],
    { signal, cwd, timeout: 165000 },
  );
const source = (i) => String(i.source || path.extname(i.name || i.path).slice(1)).toLowerCase();
function inputArgs(i) {
  if (!demux[source(i)]) fail('Unsupported media input.');
  return ['-protocol_whitelist', 'file,pipe', '-f', demux[source(i)], '-i', i.path];
}
async function probe(i, signal, output = false) {
  const p = JSON.parse(
    await runProcess(
      'ffprobe',
      [
        '-v',
        'error',
        '-protocol_whitelist',
        'file,pipe',
        ...(!output && demux[source(i)] ? ['-f', demux[source(i)]] : []),
        '-show_format',
        '-show_streams',
        '-of',
        'json',
        i.path,
      ],
      { signal, timeout: 15000 },
    ),
  );
  const v = p.streams?.find((s) => s.codec_type === 'video');
  const a = p.streams?.find((s) => s.codec_type === 'audio');
  const duration = Number(p.format?.duration || v?.duration || a?.duration);
  if (!p.streams?.length) fail('Media contains no decodable streams.');
  if (v && (!(v.width > 0) || !(v.height > 0) || v.width * v.height > 8_294_400))
    fail('Media frame exceeds 8.3 million pixels.');
  return { p, v, a, duration };
}
async function checkedProbe(i, signal) {
  const p = await probe(i, signal);
  if (!(p.duration > 0) || p.duration > 7200)
    fail('Media must have a known duration of at most two hours.');
  return p;
}
function segment(o, p, max = 120) {
  const start = n(o, 'start', 0, 0, 7200),
    length = n(o, 'duration', 20, 0.1, max);
  if (start >= p.duration) fail('Start must be before the media ends.');
  return { start, length: Math.min(length, p.duration - start) };
}
async function python(operation, inputs, output, options, outputDir, signal) {
  const manifest = path.join(outputDir, 'media-manifest.json');
  await fs.writeFile(
    manifest,
    JSON.stringify({
      operation,
      inputs: inputs.map((i) => i.path),
      output,
      options,
      model: path.join(root, '.tools/models/media/whisper-tiny'),
    }),
  );
  const executable =
    process.env.LOCAL_CONVERTER_PYTHON || path.join(root, '.tools/python/Scripts/python.exe');
  try {
    return JSON.parse(
      await runProcess(executable, [path.join(root, 'server/toolbox/media_worker.py'), manifest], {
        signal,
        timeout: 165000,
      }),
    );
  } catch (e) {
    if (e.code === 'ENOENT') fail('Python media runtime is missing from .tools/python.');
    throw e;
  }
}
async function validateOutput(output, format, signal) {
  const stat = await fs.stat(output);
  if (!stat.size || stat.size > LIMITS.outputBytes) fail('Output is empty or exceeds 200 MB.');
  if (['mp4', 'mov', 'mkv', 'webm', 'mp3', 'wav', 'flac', 'ogg', 'm4a', 'aiff'].includes(format)) {
    const p = await probe({ path: output }, signal, true);
    if (!(p.duration > 0)) fail('Output duration failed validation.');
    await ff(
      ['-protocol_whitelist', 'file,pipe', '-i', output, '-t', '0.1', '-f', 'null', '-'],
      signal,
    );
  }
  if (format === 'png') await sharp(output).raw().toBuffer();
}
function audioCodec(format, o) {
  return [
    '-c:a',
    {
      mp3: 'libmp3lame',
      wav: 'pcm_s16le',
      flac: 'flac',
      ogg: 'libvorbis',
      m4a: 'aac',
      aiff: 'pcm_s16be',
    }[format],
    ...(['wav', 'flac', 'aiff'].includes(format)
      ? []
      : ['-b:a', `${n(o, 'bitrate', 128, 32, 320)}k`]),
  ];
}
function videoCodec(format, o) {
  return [
    '-c:v',
    format === 'webm' ? 'libvpx-vp9' : 'libx264',
    '-crf',
    String(n(o, 'crf', 26, 16, 45)),
    ...(format === 'webm'
      ? ['-b:v', '0', '-deadline', 'realtime', '-cpu-used', '6']
      : ['-preset', 'veryfast']),
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    format === 'webm' ? 'libopus' : 'aac',
    ...(['webm', 'mkv'].includes(format) ? [] : ['-movflags', '+faststart']),
  ];
}
function tempo(speed) {
  const filters = [];
  while (speed > 2) {
    filters.push('atempo=2');
    speed /= 2;
  }
  while (speed < 0.5) {
    filters.push('atempo=0.5');
    speed *= 2;
  }
  filters.push(`atempo=${speed}`);
  return filters;
}
function cleanSubtitle(text) {
  if (text.length > 2_000_000 || text.includes('\0')) fail('Subtitle file exceeds text limits.');
  if (/(?:^|\n)\s*(?:fontname:|filename:|\[Fonts\]|\[Graphics\])/i.test(text))
    fail('Embedded subtitle attachments are unsupported.');
  return text;
}
function convertSubtitles(text, ext, format, shift) {
  cleanSubtitle(text);
  const cues = [];
  const parse = (s) => {
    const m = s.trim().match(/^(\d+):(\d{2}):(\d{2})[.,](\d{1,3})$/);
    return m
      ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 10 ** m[4].length
      : NaN;
  };
  if (['ass', 'ssa'].includes(ext)) {
    for (const line of text.split(/\r?\n/)) {
      if (!/^Dialogue:/i.test(line)) continue;
      const cells = line.replace(/^Dialogue:\s*/i, '').split(',');
      if (cells.length < 10) fail('Invalid ASS/SSA dialogue.');
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
    for (const block of text.replace(/^WEBVTT[^\n]*\n/, '').split(/\r?\n\s*\r?\n/)) {
      const lines = block.split(/\r?\n/);
      const index = lines.findIndex((l) => l.includes('-->'));
      if (index < 0) continue;
      const t = lines[index].match(/([\d:. ,]+)\s+-->\s+([\d:.,]+)/);
      if (!t) fail('Invalid subtitle timestamp.');
      const norm = (s) => (s.trim().split(':').length === 2 ? '00:' + s.trim() : s.trim());
      cues.push([
        parse(norm(t[1])),
        parse(norm(t[2])),
        lines
          .slice(index + 1)
          .join('\n')
          .replace(/<[^>]*>/g, ''),
      ]);
    }
  }
  if (
    !cues.length ||
    cues.length > 10000 ||
    cues.some((c) => !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || c[1] < c[0])
  )
    fail('No valid subtitle cues found.');
  const ts = (s, ass = false) => {
    let ms = Math.max(0, Math.round((s + shift) * 1000));
    let h = Math.floor(ms / 3600000);
    ms %= 3600000;
    const m = Math.floor(ms / 60000);
    ms %= 60000;
    const sec = Math.floor(ms / 1000);
    ms %= 1000;
    return `${ass ? h : String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}${ass || format === 'vtt' ? '.' : ','}${String(ass ? Math.floor(ms / 10) : ms).padStart(ass ? 2 : 3, '0')}`;
  };
  if (['ass', 'ssa'].includes(format)) {
    const header =
      format === 'ssa'
        ? '[Script Info]\nScriptType: v4.00\n[V4 Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, TertiaryColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, AlphaLevel, Encoding\nStyle: Default,Arial,24,16777215,16777215,0,0,0,0,1,1,0,2,10,10,10,0,1\n[Events]\nFormat: Marked, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'
        : '[Script Info]\nScriptType: v4.00+\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,24,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,2,10,10,10,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
    return (
      header +
      cues
        .map(
          (c) =>
            `Dialogue: ${format === 'ssa' ? 'Marked=0' : '0'},${ts(c[0], true)},${ts(c[1], true)},Default,,0,0,0,,${c[2].replace(/[{}]/g, '').replace(/\n/g, '\\N')}`,
        )
        .join('\n') +
      '\n'
    );
  }
  return (
    (format === 'vtt' ? 'WEBVTT\n\n' : '') +
    cues.map((c, i) => `${i + 1}\n${ts(c[0])} --> ${ts(c[1])}\n${c[2]}`).join('\n\n') +
    '\n'
  );
}

async function renderLottie(input, options, dir, signal) {
  let data = await fs.readFile(input.path);
  if (source(input) === 'tgs') data = gunzipSync(data, { maxOutputLength: 5_000_000 });
  if (data.length > 5_000_000) fail('Lottie JSON exceeds 5 MB.');
  let animation;
  try {
    animation = JSON.parse(textInput(data));
  } catch {
    fail('Invalid Lottie JSON or TGS.');
  }
  if (
    !animation ||
    !Array.isArray(animation.layers) ||
    !Number.isFinite(animation.fr) ||
    !Number.isFinite(animation.ip) ||
    !Number.isFinite(animation.op) ||
    !Number.isFinite(animation.w) ||
    !Number.isFinite(animation.h) ||
    animation.fr <= 0 ||
    animation.op <= animation.ip ||
    animation.w <= 0 ||
    animation.h <= 0 ||
    animation.w * animation.h > 4_000_000
  )
    fail('Invalid or oversized Lottie composition.');
  let nodes = 0;
  const inspect = (v) => {
    if (++nodes > 100000) fail('Lottie structure is too complex.');
    if (Array.isArray(v)) {
      v.forEach(inspect);
      return;
    }
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (k === 'x' && typeof x === 'string') fail('Lottie expressions are unsupported.');
        if (
          (k === 'p' || k === 'u') &&
          typeof x === 'string' &&
          x &&
          !x.startsWith('data:image/png;base64,') &&
          !x.startsWith('data:image/jpeg;base64,')
        )
          fail('Lottie external images and fonts are unsupported.');
        if (k === 'fPath' || k === 'fOrigin') fail('Lottie external fonts are unsupported.');
        inspect(x);
      }
    }
  };
  inspect(animation);
  const fps = n(options, 'fps', 15, 1, 30),
    start = n(options, 'start', 0, 0, 7200),
    duration = Math.min(
      n(options, 'duration', 20, 0.1, 30),
      (animation.op - animation.ip) / animation.fr - start,
    );
  const count = Math.ceil(duration * fps);
  if (count < 1 || count > 240) fail('Lottie render must contain 1–240 frames.');
  const width = n(options, 'width', 480, 16, 1200),
    height = Math.max(1, Math.round((width * animation.h) / animation.w));
  if (width * height * count > 64_000_000) fail('Lottie frames exceed decoded memory budget.');
  const { chromium } = await import('@playwright/test');
  signal?.throwIfAborted();
  const browser = await chromium.launch({ headless: true, timeout: 15000 });
  const cancel = () => {
    browser.close().catch(() => {});
  };
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 120000);
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(10000);
    await page.route('**/*', (route) => route.abort());
    await page.setContent(
      `<html><body style="margin:0;background:transparent"><div id="animation" style="width:${width}px;height:${height}px"></div></body></html>`,
    );
    await page.addScriptTag({ path: require.resolve('lottie-web/build/player/lottie.min.js') });
    await page.evaluate(
      (data) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error('Lottie rendering initialization timed out.')),
            10000,
          );
          window.rendered = lottie.loadAnimation({
            container: document.getElementById('animation'),
            renderer: 'svg',
            loop: false,
            autoplay: false,
            animationData: data,
          });
          rendered.addEventListener('DOMLoaded', () => {
            clearTimeout(timer);
            resolve();
          });
          rendered.addEventListener('data_failed', () => {
            clearTimeout(timer);
            reject(new Error('Lottie rendering failed.'));
          });
        }),
      animation,
    );
    const frames = [];
    for (let i = 0; i < count; i++) {
      signal?.throwIfAborted();
      await page.evaluate(
        (frame) => window.rendered.goToAndStop(frame, true),
        animation.ip + (start + i / fps) * animation.fr,
      );
      const frame = path.join(dir, `lottie-${String(i).padStart(4, '0')}.png`);
      await page.screenshot({ path: frame, omitBackground: true });
      frames.push({ path: frame });
    }
    return { frames, fps, height };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    await browser.close();
  }
}

export async function convertMediaTool({
  operation,
  inputs,
  outputDir,
  options = {},
  signal,
  onProgress,
}) {
  const def = mediaTools.find((t) => t.id === operation);
  if (!def) fail('Unknown media tool.');
  if (
    !Array.isArray(inputs) ||
    inputs.length < (def.minFiles || 1) ||
    inputs.length > 20 ||
    (!def.multiple && inputs.length !== 1)
  )
    fail('Invalid file count.');
  let total = 0;
  for (const input of inputs) {
    const s = await fs.stat(input.path);
    if (!s.isFile() || !s.size) fail('Input must be a nonempty file.');
    total += s.size;
    if (!def.accept.includes(source(input))) fail('Unsupported input format for this tool.');
  }
  if (total > LIMITS.inputBytes) fail('Inputs exceed 100 MB.');
  const o = { ...def.defaults, ...options };
  const outformat = o.format || 'png';
  if (
    o.format &&
    !def.fields.find((f) => f.key === 'format')?.options.some(([v]) => v === o.format)
  )
    fail('Unsupported output format.');
  for (const field of def.fields) {
    if (field.type === 'number') n(o, field.key, field.default, field.min, field.max);
    if (field.type === 'checkbox' && typeof o[field.key] !== 'boolean')
      fail(`Invalid ${field.key}.`);
  }
  if (Boolean(o.cropWidth) !== Boolean(o.cropHeight))
    fail('Set both crop width and height, or leave both at zero.');
  await fs.mkdir(outputDir, { recursive: true });
  const output = path.join(
    outputDir,
    `result.${operation === 'extract-frames' ? 'zip' : operation === 'audio-waveform' || operation === 'video-thumbnail' ? 'png' : outformat}`,
  );
  let details = {};
  let format = path.extname(output).slice(1);
  onProgress?.({ stage: 'Inspecting media', progress: 5 });
  if (operation === 'convert-subtitles') {
    const ext = source(inputs[0]);
    const content = convertSubtitles(
      textInput(await fs.readFile(inputs[0].path)),
      ext,
      format,
      n(o, 'shift', 0, -7200, 7200),
    );
    await fs.writeFile(output, content);
    details = { styling: format === 'ass' || format === 'ssa' ? 'Default style' : 'Plain cues' };
  } else if (
    ['gif-maker', 'animation-convert', 'compress-gif', 'edit-animation'].includes(operation)
  ) {
    if (operation === 'compress-gif') o.format = 'gif';
    details = await python(operation, inputs, output, o, outputDir, signal);
  } else if (operation === 'lottie-render') {
    const r = await renderLottie(inputs[0], o, outputDir, signal);
    details = await python(
      'gif-maker',
      r.frames,
      output,
      { ...o, height: r.height, delay: Math.round(1000 / r.fps), duration: 30 },
      outputDir,
      signal,
    );
  } else if (operation === 'animation-to-video' && ['webp', 'apng'].includes(source(inputs[0]))) {
    const intermediate = path.join(outputDir, 'decoded.gif');
    await python(
      'animation-convert',
      inputs,
      intermediate,
      { ...o, format: 'gif', loop: 1 },
      outputDir,
      signal,
    );
    return convertMediaTool({
      operation,
      inputs: [{ path: intermediate, source: 'gif' }],
      outputDir,
      options: o,
      signal,
      onProgress,
    });
  } else {
    const first = await checkedProbe(inputs[0], signal);
    const { start, length } = segment(o, first);
    let args = [];
    if (operation === 'transcribe-media') {
      if (!first.a) fail('Input has no speech audio track.');
      const wav = path.join(outputDir, 'speech.wav');
      await ff(
        [
          ...inputArgs(inputs[0]),
          '-ss',
          String(start),
          '-t',
          String(length),
          '-vn',
          '-ac',
          '1',
          '-ar',
          '16000',
          '-c:a',
          'pcm_s16le',
          wav,
        ],
        signal,
      );
      details = await python(operation, [{ path: wav }], output, o, outputDir, signal);
    } else if (operation === 'video-to-animation' || operation === 'extract-frames') {
      if (!first.v) fail('Input contains no video frames.');
      const fps = n(o, 'fps', operation === 'extract-frames' ? 1 : 10, 1, 24);
      const count = Math.ceil(length * fps);
      if (count > 240) fail('Frame export is limited to 240 frames; reduce duration or fps.');
      const width = n(o, 'width', 480, 16, 1600);
      const height = Math.ceil((first.v.height * width) / first.v.width);
      if (width * height * count > 64_000_000)
        fail('Frame export exceeds 64 million decoded pixels.');
      const framesDir = path.join(outputDir, 'frames');
      await fs.mkdir(framesDir, { recursive: true });
      await ff(
        [
          ...inputArgs(inputs[0]),
          '-ss',
          String(start),
          '-t',
          String(length),
          '-an',
          '-vf',
          `fps=${fps},scale=${width}:-1`,
          '-frames:v',
          '240',
          path.join(framesDir, `frame-%04d.${operation === 'extract-frames' ? o.format : 'png'}`),
        ],
        signal,
      );
      const names = (await fs.readdir(framesDir)).sort();
      if (!names.length) fail('No frames extracted.');
      if (operation === 'extract-frames') {
        const entries = {};
        for (const name of names)
          entries[name] = new Uint8Array(await fs.readFile(path.join(framesDir, name)));
        await fs.writeFile(output, zipSync(entries));
        details = { frames: names.length, fps };
      } else
        details = await python(
          'gif-maker',
          names.map((name) => ({ path: path.join(framesDir, name) })),
          output,
          { ...o, height, delay: Math.round(1000 / fps), start: 0, duration: 30 },
          outputDir,
          signal,
        );
    } else if (operation === 'audio-waveform') {
      if (!first.a) fail('Input contains no audio.');
      await ff(
        [
          ...inputArgs(inputs[0]),
          '-filter_complex',
          `[0:a]atrim=start=${start}:duration=${length},asetpts=PTS-STARTPTS,showwavespic=s=${o.width}x${o.height}:colors=0x3388cc[wave]`,
          '-map',
          '[wave]',
          '-frames:v',
          '1',
          output,
        ],
        signal,
      );
    } else if (operation === 'video-thumbnail') {
      if (!first.v) fail('Input contains no video.');
      await ff(
        [
          ...inputArgs(inputs[0]),
          '-ss',
          String(start),
          '-an',
          '-vf',
          `scale=${o.width}:-1`,
          '-frames:v',
          '1',
          output,
        ],
        signal,
      );
    } else if (operation === 'join-audio' || operation === 'join-video') {
      const isVideo = operation === 'join-video';
      const filters = [];
      let concat = '';
      let totalDuration = 0;
      for (let i = 0; i < inputs.length; i++) {
        const p = await checkedProbe(inputs[i], signal);
        const seg = segment(o, p);
        totalDuration += seg.length;
        if (totalDuration > 120) fail('Joined output is limited to 120 seconds.');
        args.push(...inputArgs(inputs[i]));
        if (isVideo) {
          if (!p.v) fail('Every clip must have video.');
          const width = Math.round(o.width / 2) * 2,
            height = Math.round((width * 9) / 16 / 2) * 2;
          filters.push(
            `[${i}:v]trim=start=${seg.start}:duration=${seg.length},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25,format=yuv420p[v${i}]`,
          );
          filters.push(
            p.a
              ? `[${i}:a]atrim=start=${seg.start}:duration=${seg.length},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[a${i}]`
              : `anullsrc=r=48000:cl=stereo,atrim=duration=${seg.length}[a${i}]`,
          );
          concat += `[v${i}][a${i}]`;
        } else {
          if (!p.a) fail('Every clip must contain audio.');
          filters.push(
            `[${i}:a]atrim=start=${seg.start}:duration=${seg.length},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[a${i}]`,
          );
          concat += `[a${i}]`;
        }
      }
      filters.push(
        `${concat}concat=n=${inputs.length}:v=${isVideo ? 1 : 0}:a=1${isVideo ? '[v]' : ''}[a]`,
      );
      args.push(
        '-filter_complex',
        filters.join(';'),
        ...(isVideo ? ['-map', '[v]'] : []),
        '-map',
        '[a]',
        ...(isVideo ? videoCodec(format, o) : audioCodec(format, o)),
        '-t',
        String(totalDuration),
        output,
      );
      await ff(args, signal);
      details = { duration: totalDuration, clips: inputs.length };
    } else {
      const isAudio = ['compress-audio', 'convert-native-audio', 'normalize-audio'].includes(
        operation,
      );
      if (isAudio && !first.a) fail('Input contains no audio.');
      if (!isAudio && !first.v) fail('Input contains no video.');
      args.push(...inputArgs(inputs[0]));
      const vf = [`trim=start=${start}:duration=${length}`, 'setpts=PTS-STARTPTS'],
        af = [`atrim=start=${start}:duration=${length}`, 'asetpts=PTS-STARTPTS'];
      let speed = 1;
      if (operation === 'replace-video-audio') {
        if (inputs.length !== 2) fail('Supply video first and audio second.');
        const replacement = await checkedProbe(inputs[1], signal);
        if (!replacement.a) fail('Second file contains no audio.');
        args.push(...inputArgs(inputs[1]));
      }
      if (operation === 'burn-subtitles') {
        if (inputs.length !== 2 || !['ass', 'ssa', 'srt', 'vtt'].includes(source(inputs[1])))
          fail('Supply video first and subtitle second.');
        const content = cleanSubtitle(textInput(await fs.readFile(inputs[1].path)));
        const subtitleFile = `burn.${source(inputs[1])}`;
        await fs.writeFile(path.join(outputDir, subtitleFile), content);
        vf.unshift(`subtitles=filename=${subtitleFile}`);
      }
      if (operation === 'transform-video') {
        speed = n(o, 'speed', 1, 0.25, 4);
        if (o.cropWidth > 0 && o.cropHeight > 0) {
          if (o.left + o.cropWidth > first.v.width || o.top + o.cropHeight > first.v.height)
            fail('Crop extends beyond frame.');
          vf.push(`crop=${o.cropWidth}:${o.cropHeight}:${o.left}:${o.top}`);
        }
        const rotate = choice(o, 'rotate', '0', ['0', '90', '180', '270']);
        if (rotate === '90') vf.push('transpose=1');
        if (rotate === '270') vf.push('transpose=2');
        if (rotate === '180') vf.push('hflip', 'vflip');
        if (o.reverse) {
          if (
            length > 15 ||
            (first.v.width *
              first.v.height *
              length *
              Number(first.v.avg_frame_rate.split('/')[0])) /
              Math.max(1, Number(first.v.avg_frame_rate.split('/')[1])) >
              64_000_000
          )
            fail('Reverse is limited to 15 seconds and 64 million decoded pixels.');
          vf.push('reverse');
          af.push('areverse');
        }
        vf.push(`setpts=PTS/${speed}`);
        af.push(...tempo(speed));
      }
      if (isAudio) {
        args.push('-map', '0:a:0', '-vn');
        if (operation === 'normalize-audio') {
          const fadeIn = n(o, 'fadeIn', 0, 0, 30),
            fadeOut = n(o, 'fadeOut', 0, 0, 30);
          if (fadeIn > length || fadeOut > length) fail('Fade length exceeds clip duration.');
          af.push(`loudnorm=I=${n(o, 'loudness', -16, -30, -5)}:TP=-1.5:LRA=11`);
          if (fadeIn) af.push(`afade=t=in:d=${fadeIn}`);
          if (fadeOut) af.push(`afade=t=out:st=${Math.max(0, length - fadeOut)}:d=${fadeOut}`);
        }
        if (af.length) args.push('-af', af.join(','));
        args.push(...audioCodec(format, o));
      } else {
        args.push('-map', '0:v:0');
        if (operation === 'mute-video' || operation === 'animation-to-video') args.push('-an');
        else if (operation === 'replace-video-audio') {
          args.push('-map', '1:a:0');
          af.push('apad');
        } else args.push('-map', '0:a:0?');
        if (operation === 'animation-to-video') {
          const bg = String(o.background || '#ffffff');
          if (!/^#[0-9a-f]{6}$/i.test(bg)) fail('Background must be a six-digit hex colour.');
          vf.push(
            `format=rgba,split[fg][bg];[bg]drawbox=color=${bg.replace('#', '0x')}:replace=1:t=fill[base];[base][fg]overlay=format=auto`,
          );
        }
        vf.push(
          `scale=w='min(${o.width},iw)':h=-2:force_divisible_by=2`,
          'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        );
        args.push('-vf', vf.join(','));
        if ((af.length && first.a) || operation === 'replace-video-audio')
          args.push('-af', af.join(','));
        args.push(...videoCodec(format, o));
      }
      args.push(
        '-t',
        String(length / speed),
        '-map_metadata',
        '-1',
        '-fs',
        String(LIMITS.outputBytes),
        output,
      );
      await ff(args, signal, outputDir);
      details = { duration: length / speed };
    }
  }
  await validateOutput(output, format, signal);
  onProgress?.({ stage: 'Media ready', progress: 100 });
  return {
    path: output,
    filename: path.basename(output),
    mime: mime[format] || 'application/octet-stream',
    details,
  };
}
