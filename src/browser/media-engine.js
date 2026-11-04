import { gunzipSync, zipSync } from 'fflate';
import { mediaTools } from '../../shared/media-tools.js';
import {
  MAX_INPUT,
  MAX_OUTPUT,
  MAX_JOB_MS,
  audioFormats,
  videoFormats,
  mimeTypes,
  unsupportedTools,
  lottieBytes,
  mediaFailure,
  extension,
  checkAbort,
  numberOption,
  validateInputs,
  segment,
  pairSegment,
  inspectProbe,
  audioCodec,
  videoCodec,
  tempo,
  frameBudget,
  cleanSubtitle,
  convertSubtitles,
} from './media-helpers.js';

export const supportedToolIds = mediaTools
  .filter((tool) => !unsupportedTools[tool.id])
  .map((tool) => tool.id);
export { unsupportedTools };
export const pairSources = [...audioFormats, ...videoFormats];
export const pairTargets = [...audioFormats, ...videoFormats, 'gif'];
export function isSupportedPair(source, target) {
  return (
    pairSources.includes(source) &&
    pairTargets.includes(target) &&
    !(audioFormats.includes(source) && (videoFormats.includes(target) || target === 'gif'))
  );
}
let runtimeAssets;
let queue = Promise.resolve();

// A single single-threaded wasm worker runs at a time. Each job gets a fresh
// filesystem, and termination frees both wasm memory and all input/output bytes.
async function exclusive(task, signal) {
  const previous = queue;
  let release;
  queue = new Promise((resolve) => {
    release = resolve;
  });
  try {
    await previous;
    checkAbort(signal);
    return await task();
  } finally {
    release();
  }
}
async function localAsset(path, signal) {
  const response = await fetch(path, { signal, credentials: 'same-origin' });
  if (!response.ok)
    throw new Error(`Local media engine asset is unavailable (${response.status}): ${path}`);
  return new Uint8Array(await response.arrayBuffer());
}
async function coreAssets(signal) {
  if (!runtimeAssets) {
    runtimeAssets = (async () => {
      const compressed = await localAsset('/tool-runtime/ffmpeg/ffmpeg-core.wasm.gz', signal);
      // Static servers may declare Content-Encoding:gzip for .gz assets, which
      // makes fetch transparently decompress them before returning the bytes.
      const wasm =
        compressed[0] === 31 && compressed[1] === 139 ? gunzipSync(compressed) : compressed;
      if (wasm[0] !== 0 || wasm[1] !== 97 || wasm[2] !== 115 || wasm[3] !== 109)
        throw new Error('Local media engine is not a valid WebAssembly binary.');
      return {
        coreURL: new URL('/tool-runtime/ffmpeg/ffmpeg-core.js', location.href).href,
        wasmURL: URL.createObjectURL(new Blob([wasm], { type: 'application/wasm' })),
      };
    })().catch((error) => {
      runtimeAssets = undefined;
      throw error;
    });
  }
  return runtimeAssets;
}
async function withEngine(signal, onProgress, task) {
  return exclusive(async () => {
    checkAbort(signal);
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    checkAbort(signal);
    const ffmpeg = new FFmpeg();
    const control = new AbortController();
    let expired = false;
    let loaded = false;
    const stop = () => {
      control.abort(signal?.reason);
      ffmpeg.terminate();
    };
    signal?.addEventListener('abort', stop, { once: true });
    const timeout = setTimeout(() => {
      expired = true;
      control.abort();
      ffmpeg.terminate();
    }, MAX_JOB_MS);
    const logs = [];
    ffmpeg.on('log', ({ message }) => {
      logs.push(message);
      if (logs.length > 40) logs.shift();
    });
    ffmpeg.on('progress', ({ progress }) =>
      onProgress?.({
        stage: 'Processing media in your browser',
        progress: Math.min(94, Math.max(10, Math.round(progress * 80 + 10))),
      }),
    );
    try {
      onProgress?.({ stage: 'Loading local media engine', progress: 2 });
      await ffmpeg.load(await coreAssets(control.signal), { signal: control.signal });
      loaded = true;
      const context = {
        ffmpeg,
        signal: control.signal,
        async run(args) {
          checkAbort(control.signal);
          logs.length = 0;
          const status = await ffmpeg.exec(
            [
              '-hide_banner',
              '-loglevel',
              'error',
              '-threads',
              '1',
              '-filter_threads',
              '1',
              '-filter_complex_threads',
              '1',
              ...args,
            ],
            MAX_JOB_MS,
            { signal: control.signal },
          );
          if (status !== 0)
            throw new Error(
              `Media conversion failed: ${logs.slice(-5).join(' ').slice(0, 600) || 'this codec or file is not supported by the browser engine.'}`,
            );
        },
        async write(name, blob) {
          checkAbort(control.signal);
          await ffmpeg.writeFile(name, new Uint8Array(await blob.arrayBuffer()), {
            signal: control.signal,
          });
        },
        async bytes(name) {
          const bytes = await ffmpeg.readFile(name, 'binary', { signal: control.signal });
          if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length >= MAX_OUTPUT)
            throw new Error('Media output is empty or exceeds 200 MB.');
          return bytes;
        },
        async probe(name, still = false) {
          const output = 'probe.json';
          try {
            await ffmpeg.deleteFile(output);
          } catch {
            /* First probe in a fresh worker. */
          }
          const status = await ffmpeg.ffprobe(
            [
              '-v',
              'error',
              '-protocol_whitelist',
              'file,pipe',
              '-show_format',
              '-show_streams',
              '-of',
              'json',
              name,
              '-o',
              output,
            ],
            15000,
            { signal: control.signal },
          );
          // core 0.12.10 leaves ret=-1 after successful ffprobe. Its generated
          // JSON is authoritative; remove the previous report to avoid stale data.
          if (status !== 0 && status !== -1)
            throw new Error('This media file cannot be decoded by the browser engine.');
          const data = JSON.parse(
            await ffmpeg.readFile(output, 'utf8', { signal: control.signal }),
          );
          if (still) {
            const v = data.streams?.find((stream) => stream.codec_type === 'video');
            if (!v || v.width * v.height > 8294400)
              throw new Error('Invalid image or image exceeds 8.3 million pixels.');
            return {
              v,
              a: data.streams.find((stream) => stream.codec_type === 'audio'),
              duration: Number(data.format?.duration || v.duration) || 0,
            };
          }
          return inspectProbe(data);
        },
      };
      const result = await task(context);
      checkAbort(control.signal);
      onProgress?.({ stage: 'Media ready', progress: 100 });
      return result;
    } catch (error) {
      if (expired)
        throw new Error(
          'Browser media processing exceeded three minutes. Use a shorter clip or smaller dimensions.',
        );
      checkAbort(signal);
      throw mediaFailure(error, loaded);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', stop);
      ffmpeg.terminate();
    }
  }, signal);
}
const inputArgs = (name) => ['-protocol_whitelist', 'file,pipe', '-i', name];
const cappedOutput = (name) => ['-fs', String(MAX_OUTPUT), name];
const scale = (width) =>
  `scale=w='min(${width},iw)':h=-2:force_divisible_by=2,scale=trunc(iw/2)*2:trunc(ih/2)*2`;
const resultBlob = (bytes, format, details = {}) => ({
  blob: new Blob([bytes], { type: mimeTypes[format] }),
  filename: `result.${format}`,
  mime: mimeTypes[format],
  details,
});
async function validateResult(context, name, format, expectedDuration) {
  const bytes = await context.bytes(name);
  if (audioFormats.includes(format) || videoFormats.includes(format)) {
    const meta = await context.probe(name);
    if ((audioFormats.includes(format) && !meta.a) || (videoFormats.includes(format) && !meta.v))
      throw new Error('Output media stream validation failed.');
    if (
      expectedDuration &&
      meta.duration + Math.max(0.5, expectedDuration * 0.02) < expectedDuration
    )
      throw new Error('Output was truncated, possibly by the size limit.');
    await context.run([...inputArgs(name), '-t', '0.1', '-f', 'null', '-']);
    return resultBlob(bytes, format, {
      duration: meta.duration,
      codec: (meta.v || meta.a).codec_name,
    });
  }
  if (format === 'webp') {
    // This core encodes animated WebP, but its older WebP decoder cannot read
    // those animations. Validate the actual output with the browser decoder.
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/webp' }));
    if (!bitmap.width || !bitmap.height) throw new Error('Output WebP validation failed.');
    bitmap.close();
  } else if (['png', 'jpg', 'gif', 'apng'].includes(format))
    await context.run([...inputArgs(name), '-frames:v', '1', '-f', 'null', '-']);
  return resultBlob(bytes, format);
}
async function writeInputs(context, inputs) {
  const names = [];
  for (let i = 0; i < inputs.length; i++) {
    const name = `input-${i}.${extension(inputs[i])}`;
    await context.write(name, inputs[i].file);
    names.push(name);
  }
  return names;
}
async function canvasBlob(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode an animation frame.'))),
      'image/png',
    ),
  );
}
function canvas(width, height) {
  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  return output;
}
async function fittedImage(blob, width, height) {
  const image = await createImageBitmap(blob);
  try {
    if (image.width * image.height > 8294400) throw new Error('Image exceeds 8.3 million pixels.');
    const output = canvas(width, height),
      drawing = output.getContext('2d');
    const ratio = Math.min(width / image.width, height / image.height);
    drawing.drawImage(
      image,
      (width - image.width * ratio) / 2,
      (height - image.height * ratio) / 2,
      image.width * ratio,
      image.height * ratio,
    );
    return await canvasBlob(output);
  } finally {
    image.close();
  }
}

async function decodeAnimation(context, input, options) {
  // FFmpeg 5 does not decode animated WebP. WebCodecs supplies all composited
  // frames locally, including each frame's actual duration and disposal mode.
  if (!globalThis.ImageDecoder) {
    if (extension(input) === 'webp')
      throw new Error(
        'Animated WebP input requires a browser with the WebCodecs ImageDecoder API (current Chrome or Edge).',
      );
    return null;
  }
  const type = { gif: 'image/gif', webp: 'image/webp', apng: 'image/png', png: 'image/png' }[
    extension(input)
  ];
  if (!(await ImageDecoder.isTypeSupported(type))) {
    if (extension(input) === 'webp') throw new Error('This browser cannot decode animated WebP.');
    return null;
  }
  const decoder = new ImageDecoder({
    data: await input.file.arrayBuffer(),
    type,
    preferAnimation: true,
  });
  try {
    await decoder.completed;
    await decoder.tracks.ready;
    const count = decoder.tracks.selectedTrack?.frameCount;
    const repetitions = decoder.tracks.selectedTrack?.repetitionCount;
    if (!count || count > 2000)
      throw new Error('Animation has too many source frames (maximum 2000).');
    const start = options.start || 0,
      end = start + Math.min(options.duration || 20, 30);
    const fps = options.fps ? Math.min(options.fps, 24) : undefined,
      delay = fps ? 1 / fps : undefined;
    let elapsed = 0,
      nextTime = start,
      saved = 0,
      width,
      height,
      sourceWidth,
      sourceHeight,
      savedDuration = 0;
    const lines = [];
    for (let i = 0; i < count && elapsed < end; i++) {
      checkAbort(context.signal);
      const { image } = await decoder.decode({ frameIndex: i, completeFramesOnly: true });
      try {
        const frameDuration = Math.max(0.01, (image.duration || 100000) / 1000000);
        if (!width) {
          if (image.displayWidth * image.displayHeight > 8294400)
            throw new Error('Animation frame exceeds 8.3 million pixels.');
          sourceWidth = image.displayWidth;
          sourceHeight = image.displayHeight;
          width = Math.min(options.width || 480, sourceWidth);
          height = Math.max(1, Math.round((width * sourceHeight) / sourceWidth));
        }
        const save = async (duration) => {
          frameBudget(width, height, saved + 1);
          const frame = canvas(width, height);
          frame.getContext('2d').drawImage(image, 0, 0, width, height);
          const name = `decoded-${String(saved++).padStart(4, '0')}.png`;
          await context.write(name, await canvasBlob(frame));
          lines.push(`file '${name}'`, 'option framerate 1000', `duration ${duration}`);
          savedDuration += duration;
        };
        if (!fps) {
          const visible = Math.min(end, elapsed + frameDuration) - Math.max(start, elapsed);
          if (visible > 0) await save(visible);
        } else {
          while (nextTime < elapsed + frameDuration && nextTime < end) {
            if (nextTime >= elapsed) await save(Math.min(delay, end - nextTime));
            nextTime += delay;
          }
        }
        elapsed += frameDuration;
      } finally {
        image.close();
      }
    }
    if (!saved) throw new Error('No animation frames at the selected start time.');
    lines.push(lines.at(-3), 'option framerate 1000');
    await context.write('animation-frames.txt', new Blob([lines.join('\n')]));
    return {
      name: 'animation-frames.txt',
      args: ['-f', 'concat', '-safe', '0', '-i', 'animation-frames.txt'],
      duration: savedDuration,
      width,
      height,
      sourceWidth,
      sourceHeight,
      fps,
      frames: saved,
      preserveTiming: !fps,
      loop:
        repetitions === Infinity
          ? 0
          : Number.isFinite(repetitions)
            ? Math.max(1, repetitions + 1)
            : undefined,
    };
  } finally {
    decoder.close();
  }
}

async function renderLottie(context, input, options) {
  const bytes = lottieBytes(new Uint8Array(await input.file.arrayBuffer()), extension(input));
  let animation;
  try {
    animation = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('Invalid Lottie JSON or TGS.');
  }
  if (
    !Array.isArray(animation?.layers) ||
    ![animation.fr, animation.ip, animation.op, animation.w, animation.h].every(Number.isFinite) ||
    animation.fr <= 0 ||
    animation.op <= animation.ip ||
    animation.w <= 0 ||
    animation.h <= 0 ||
    animation.w * animation.h > 4000000
  )
    throw new Error('Invalid or oversized Lottie composition.');
  let nodes = 0;
  function inspect(value) {
    if (++nodes > 100000) throw new Error('Lottie structure is too complex.');
    if (Array.isArray(value)) return value.forEach(inspect);
    if (value && typeof value === 'object')
      for (const [key, item] of Object.entries(value)) {
        if (key === 'x' && typeof item === 'string')
          throw new Error('Lottie expressions are unsupported.');
        if (
          (key === 'p' || key === 'u') &&
          typeof item === 'string' &&
          item &&
          !/^data:image\/(png|jpeg);base64,/.test(item)
        )
          throw new Error('Lottie external images and fonts are unsupported.');
        if (key === 'fPath' || key === 'fOrigin' || key === 'chars')
          throw new Error('External Lottie fonts and text glyph bundles are unsupported.');
        inspect(item);
      }
  }
  inspect(animation);
  const fps = options.fps,
    duration = Math.min(
      options.duration,
      30,
      (animation.op - animation.ip) / animation.fr - options.start,
    );
  const count = Math.ceil(duration * fps),
    width = options.width,
    height = Math.max(1, Math.round((width * animation.h) / animation.w));
  frameBudget(width, height, count);
  const { default: lottie } = await import('lottie-web/build/player/lottie_light_canvas.min.js');
  const element = document.createElement('div'),
    output = canvas(width, height);
  const instance = lottie.loadAnimation({
    container: element,
    renderer: 'canvas',
    loop: false,
    autoplay: false,
    animationData: animation,
    rendererSettings: {
      context: output.getContext('2d'),
      clearCanvas: true,
      progressiveLoad: false,
    },
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Lottie initialization timed out.')), 10000);
      instance.addEventListener('DOMLoaded', () => {
        clearTimeout(timer);
        resolve();
      });
      instance.addEventListener('data_failed', () => {
        clearTimeout(timer);
        reject(new Error('Lottie rendering failed.'));
      });
    });
    for (let i = 0; i < count; i++) {
      checkAbort(context.signal);
      instance.goToAndStop((options.start + i / fps) * animation.fr, true);
      await context.write(`lottie-${String(i).padStart(4, '0')}.png`, await canvasBlob(output));
    }
  } finally {
    instance.destroy();
  }
  return {
    args: ['-framerate', String(fps), '-i', 'lottie-%04d.png'],
    duration,
    width,
    height,
    fps,
  };
}
function animationCodec(format, options, colors = 256) {
  if (format === 'gif')
    return {
      filter: `split[palin][picture];[palin]palettegen=max_colors=${colors}:reserve_transparent=1[palette];[picture][palette]paletteuse=dither=sierra2_4a`,
      args: ['-loop', String(options.loop < 0 ? 0 : options.loop)],
    };
  if (format === 'webp')
    return {
      filter: null,
      args: [
        '-c:v',
        'libwebp_anim',
        '-quality',
        '80',
        '-loop',
        String(options.loop < 0 ? 0 : options.loop),
      ],
    };
  return {
    filter: null,
    args: ['-c:v', 'apng', '-f', 'apng', '-plays', String(options.loop < 0 ? 0 : options.loop)],
  };
}

async function animationJob(context, operation, inputs, names, options) {
  let sourceArgs, duration, dimensions, inheritedLoop;
  if (operation === 'gif-maker') {
    const { width, height } = options;
    frameBudget(width, height, inputs.length);
    for (let i = 0; i < inputs.length; i++) {
      const name = `image-${String(i).padStart(4, '0')}.png`;
      await context.write(name, await fittedImage(inputs[i].file, width, height));
    }
    sourceArgs = ['-framerate', String(1000 / options.delay), '-i', 'image-%04d.png'];
    duration = (inputs.length * options.delay) / 1000;
    dimensions = { width, height };
    if (options.start >= duration) throw new Error('Start must be before the animation ends.');
    sourceArgs.push('-ss', String(options.start));
    duration = Math.min(duration - options.start, options.duration, 30);
  } else if (operation === 'lottie-render') {
    const source = await renderLottie(context, inputs[0], options);
    sourceArgs = source.args;
    duration = source.duration;
    dimensions = source;
  } else {
    const decoded = await decodeAnimation(context, inputs[0], options);
    if (decoded) {
      sourceArgs = decoded.args;
      duration = decoded.duration;
      dimensions = decoded;
      inheritedLoop = decoded.loop;
    } else {
      const meta = await context.probe(names[0]);
      const seg = segment(options, meta, 30);
      sourceArgs = [...inputArgs(names[0]), '-ss', String(seg.start)];
      duration = seg.length;
      dimensions = {
        width: Math.min(options.width, meta.v.width),
        height: Math.round((meta.v.height * Math.min(options.width, meta.v.width)) / meta.v.width),
      };
    }
    // Preserve the source loop count where the container exposes it.
    if (options.loop < 0 && extension(inputs[0]) === 'gif') {
      const source = new Uint8Array(await inputs[0].file.arrayBuffer());
      const marker = new TextEncoder().encode('NETSCAPE2.0');
      outer: for (let i = 0; i < Math.min(source.length - 16, 65536); i++) {
        for (let j = 0; j < marker.length; j++) if (source[i + j] !== marker[j]) continue outer;
        if (source[i + 11] === 3 && source[i + 12] === 1)
          inheritedLoop = source[i + 13] | (source[i + 14] << 8);
        break;
      }
    }
  }
  frameBudget(
    dimensions.width,
    dimensions.height,
    operation === 'gif-maker'
      ? inputs.length
      : dimensions.frames || Math.ceil(duration * (options.fps || 10)),
  );
  const filters = [];
  let speed = 1;
  if (operation === 'edit-animation') {
    speed = options.speed;
    if (options.cropWidth) {
      if (
        options.left + options.cropWidth > (dimensions.sourceWidth || dimensions.width) ||
        options.top + options.cropHeight > (dimensions.sourceHeight || dimensions.height)
      )
        throw new Error('Crop extends beyond the decoded animation.');
      const ratio = dimensions.sourceWidth ? dimensions.width / dimensions.sourceWidth : 1;
      filters.push(
        `crop=${Math.max(1, Math.round(options.cropWidth * ratio))}:${Math.max(1, Math.round(options.cropHeight * ratio))}:${Math.round(options.left * ratio)}:${Math.round(options.top * ratio)}`,
      );
    }
    if (options.reverse) filters.push('reverse');
    filters.push(`setpts=PTS/${speed}`);
  }
  const format = options.format,
    attempts = operation === 'compress-gif' ? 6 : 1;
  let smallest,
    targetReached = false;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const width = Math.max(16, Math.round(options.width * 0.82 ** attempt));
    const colors = Math.max(16, Math.round((options.colors || 256) * 0.8 ** attempt));
    const codec = animationCodec(
      format,
      { ...options, loop: options.loop < 0 ? (inheritedLoop ?? options.loop) : options.loop },
      colors,
    );
    const filter = [
      ...filters,
      ...(dimensions.preserveTiming
        ? []
        : [`fps=${operation === 'gif-maker' ? 1000 / options.delay : dimensions.fps || 10}`]),
      `scale=w='min(${width},iw)':h=-1`,
      ...(codec.filter ? [codec.filter] : []),
    ].join(',');
    const name = `animation-${attempt}.${format}`;
    await context.run([
      ...sourceArgs,
      '-an',
      '-t',
      String(duration / speed),
      '-vf',
      filter,
      '-frames:v',
      '240',
      '-vsync',
      '0',
      ...codec.args,
      ...cappedOutput(name),
    ]);
    const bytes = await context.bytes(name);
    if (!smallest || bytes.length < smallest.length) smallest = bytes;
    if (operation !== 'compress-gif' || bytes.length <= options.targetKB * 1024) {
      targetReached = true;
      break;
    }
  }
  await context.write(`validated.${format}`, new Blob([smallest]));
  const result = await validateResult(context, `validated.${format}`, format);
  return {
    ...result,
    details: {
      duration: duration / speed,
      ...(operation === 'compress-gif'
        ? {
            targetReached,
            targetKB: options.targetKB,
            actualKB: Math.round(smallest.length / 1024),
          }
        : {}),
      ...(options.loop < 0 &&
      inheritedLoop === undefined &&
      !['gif-maker', 'lottie-render'].includes(operation)
        ? { loop: 'Source loop metadata unavailable; output loops forever.' }
        : {}),
    },
  };
}

async function joiningJob(context, operation, names, options) {
  const isVideo = operation === 'join-video',
    args = [],
    filters = [];
  let concat = '',
    totalDuration = 0;
  for (let i = 0; i < names.length; i++) {
    const meta = await context.probe(names[i]),
      seg = segment(options, meta);
    totalDuration += seg.length;
    if (totalDuration > 120) throw new Error('Joined output is limited to 120 seconds.');
    args.push(...inputArgs(names[i]));
    if (isVideo) {
      if (!meta.v) throw new Error('Every clip must contain video.');
      const width = Math.round(options.width / 2) * 2,
        height = Math.round((width * 9) / 16 / 2) * 2;
      filters.push(
        `[${i}:v]trim=start=${seg.start}:duration=${seg.length},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25,format=yuv420p[v${i}]`,
      );
      filters.push(
        meta.a
          ? `[${i}:a]atrim=start=${seg.start}:duration=${seg.length},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=${seg.length}[a${i}]`
          : `anullsrc=r=48000:cl=stereo,atrim=duration=${seg.length}[a${i}]`,
      );
      concat += `[v${i}][a${i}]`;
    } else {
      if (!meta.a) throw new Error('Every clip must contain audio.');
      filters.push(
        `[${i}:a]atrim=start=${seg.start}:duration=${seg.length},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[a${i}]`,
      );
      concat += `[a${i}]`;
    }
  }
  filters.push(
    `${concat}concat=n=${names.length}:v=${isVideo ? 1 : 0}:a=1${isVideo ? '[v]' : ''}[a]`,
  );
  const name = `result.${options.format}`;
  await context.run([
    ...args,
    '-filter_complex',
    filters.join(';'),
    ...(isVideo ? ['-map', '[v]'] : []),
    '-map',
    '[a]',
    ...(isVideo ? videoCodec(options.format, options) : audioCodec(options.format, options)),
    '-t',
    String(totalDuration),
    ...cappedOutput(name),
  ]);
  return validateResult(context, name, options.format, totalDuration);
}

export async function convert({ operation, inputs, options = {}, onProgress, signal }) {
  checkAbort(signal);
  const o = validateInputs(operation, inputs, options);
  if (
    [
      'gif-maker',
      'animation-convert',
      'compress-gif',
      'edit-animation',
      'lottie-render',
      'video-to-animation',
    ].includes(operation) &&
    o.duration > 30
  )
    throw new Error('Animation output is limited to 30 seconds. Reduce the selected duration.');
  if (operation === 'convert-subtitles') {
    const content = convertSubtitles(
      await inputs[0].file.text(),
      extension(inputs[0]),
      o.format,
      o.shift,
    );
    checkAbort(signal);
    onProgress?.({ stage: 'Subtitles ready', progress: 100 });
    return resultBlob(content, o.format, {
      styling: ['ass', 'ssa'].includes(o.format) ? 'Default style' : 'Plain cues',
    });
  }
  return withEngine(signal, onProgress, async (context) => {
    const names = await writeInputs(context, inputs);
    if (
      [
        'gif-maker',
        'animation-convert',
        'compress-gif',
        'edit-animation',
        'lottie-render',
      ].includes(operation)
    )
      return animationJob(context, operation, inputs, names, o);
    if (['join-audio', 'join-video'].includes(operation))
      return joiningJob(context, operation, names, o);
    let firstName = names[0],
      decoded;
    if (
      operation === 'animation-to-video' &&
      ['gif', 'apng', 'webp'].includes(extension(inputs[0]))
    ) {
      if (o.duration > 30)
        throw new Error(
          'Animation input decoding is limited to 30 seconds. Reduce the selected duration.',
        );
      decoded = await decodeAnimation(context, inputs[0], { ...o, fps: 24 });
    }
    const meta = decoded
      ? { v: { width: decoded.width, height: decoded.height }, duration: decoded.duration }
      : await context.probe(firstName);
    const { start, length } = decoded ? { start: 0, length: decoded.duration } : segment(o, meta);
    if (operation === 'transcribe-media') {
      if (!meta.a) throw new Error('Input contains no speech audio track.');
      await context.run([
        ...inputArgs(firstName),
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
        'pcm_f32le',
        '-f',
        'f32le',
        'speech.pcm',
      ]);
      const bytes = await context.bytes('speech.pcm');
      if (bytes.length % 4) throw new Error('Speech audio decoding failed.');
      const samples = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
      const { transcribeAudio } = await import('./media-transcription.js');
      const result = await transcribeAudio({
        samples,
        format: o.format,
        language: o.language,
        onProgress,
        signal: context.signal,
      });
      return resultBlob(result.content, o.format, result.details);
    }
    if (operation === 'video-to-animation' || operation === 'extract-frames') {
      if (!meta.v) throw new Error('Input contains no video frames.');
      const fps = o.fps,
        width = Math.min(o.width, meta.v.width),
        height = Math.ceil((meta.v.height * width) / meta.v.width);
      const count = Math.ceil(length * fps);
      frameBudget(width, height, count);
      if (operation === 'video-to-animation') {
        const codec = animationCodec(o.format, o),
          name = `result.${o.format}`;
        await context.run([
          ...inputArgs(firstName),
          '-ss',
          String(start),
          '-t',
          String(Math.min(length, 30)),
          '-an',
          '-vf',
          [`fps=${fps}`, `scale=${width}:-1`, codec.filter].filter(Boolean).join(','),
          '-frames:v',
          '240',
          ...codec.args,
          ...cappedOutput(name),
        ]);
        return validateResult(context, name, o.format);
      }
      await context.run([
        ...inputArgs(firstName),
        '-ss',
        String(start),
        '-t',
        String(length),
        '-an',
        '-vf',
        `fps=${fps},scale=${width}:-1`,
        '-frames:v',
        '240',
        `frame-%04d.${o.format}`,
      ]);
      const entries = {},
        listing = await context.ffmpeg.listDir('/');
      let total = 0;
      for (const item of listing
        .filter((item) => /^frame-\d+\.(png|jpg)$/.test(item.name))
        .sort((a, b) => a.name.localeCompare(b.name))) {
        const bytes = await context.bytes(item.name);
        total += bytes.length;
        if (total >= MAX_OUTPUT) throw new Error('Extracted frames exceed 200 MB.');
        entries[item.name] = bytes;
      }
      if (!Object.keys(entries).length) throw new Error('No frames extracted.');
      const zip = zipSync(entries, { level: 0 });
      if (zip.length >= MAX_OUTPUT) throw new Error('Frame archive exceeds 200 MB.');
      return resultBlob(zip, 'zip', { frames: Object.keys(entries).length, fps });
    }
    if (operation === 'audio-waveform') {
      if (!meta.a) throw new Error('Input contains no audio.');
      await context.run([
        ...inputArgs(firstName),
        '-filter_complex',
        `[0:a]atrim=start=${start}:duration=${length},asetpts=PTS-STARTPTS,showwavespic=s=${o.width}x${o.height}:colors=0x3388cc[wave]`,
        '-map',
        '[wave]',
        '-frames:v',
        '1',
        'result.png',
      ]);
      return validateResult(context, 'result.png', 'png');
    }
    if (operation === 'video-thumbnail') {
      if (!meta.v) throw new Error('Input contains no video.');
      await context.run([
        ...inputArgs(firstName),
        '-ss',
        String(start),
        '-an',
        '-vf',
        `scale=${o.width}:-1`,
        '-frames:v',
        '1',
        'result.png',
      ]);
      return validateResult(context, 'result.png', 'png');
    }
    const isAudio = ['compress-audio', 'convert-native-audio', 'normalize-audio'].includes(
      operation,
    );
    if (isAudio && !meta.a) throw new Error('Input contains no audio.');
    if (!isAudio && !meta.v) throw new Error('Input contains no video.');
    const args = decoded ? [...decoded.args] : [...inputArgs(firstName)];
    const vf = [`trim=start=${start}:duration=${length}`, 'setpts=PTS-STARTPTS'],
      af = [`atrim=start=${start}:duration=${length}`, 'asetpts=PTS-STARTPTS'];
    let speed = 1;
    if (operation === 'replace-video-audio') {
      if (!(await context.probe(names[1])).a) throw new Error('Second file contains no audio.');
      args.push(...inputArgs(names[1]));
    }
    if (operation === 'burn-subtitles') {
      if (!['srt', 'vtt', 'ass', 'ssa'].includes(extension(inputs[1])))
        throw new Error('Add video first and subtitle file second.');
      // Rebuild plain cues before libass reads them, so embedded attachments and
      // ASS font paths cannot make the renderer access additional resources.
      const subtitle = convertSubtitles(
        cleanSubtitle(await inputs[1].file.text()),
        extension(inputs[1]),
        'ass',
      );
      await context.write('burn.ass', new Blob([subtitle]));
      const font = await localAsset('/tool-runtime/ffmpeg/subtitle-font.ttf', context.signal);
      await context.ffmpeg.createDir('/fonts');
      await context.ffmpeg.writeFile('/fonts/subtitle-font.ttf', font);
      vf.unshift(
        "subtitles=filename=burn.ass:fontsdir=/fonts:force_style='Fontname=Liberation Sans'",
      );
    }
    if (operation === 'transform-video') {
      speed = o.speed;
      if (o.cropWidth) {
        if (o.left + o.cropWidth > meta.v.width || o.top + o.cropHeight > meta.v.height)
          throw new Error('Crop extends beyond frame.');
        vf.push(`crop=${o.cropWidth}:${o.cropHeight}:${o.left}:${o.top}`);
      }
      if (o.rotate === '90') vf.push('transpose=1');
      if (o.rotate === '270') vf.push('transpose=2');
      if (o.rotate === '180') vf.push('hflip', 'vflip');
      if (o.reverse) {
        const [num, den = 1] = String(meta.v.avg_frame_rate || '30')
          .split('/')
          .map(Number);
        if (length > 15 || meta.v.width * meta.v.height * length * (num / den || 30) > 64000000)
          throw new Error('Reverse is limited to 15 seconds and 64 million decoded pixels.');
        vf.push('reverse');
        af.push('areverse');
      }
      vf.push(`setpts=PTS/${speed}`);
      af.push(...tempo(speed));
    }
    if (isAudio) {
      args.push('-map', '0:a:0', '-vn');
      if (operation === 'normalize-audio') {
        if (o.fadeIn > length || o.fadeOut > length)
          throw new Error('Fade length exceeds clip duration.');
        af.push(`loudnorm=I=${o.loudness}:TP=-1.5:LRA=11`);
        if (o.fadeIn) af.push(`afade=t=in:d=${o.fadeIn}`);
        if (o.fadeOut) af.push(`afade=t=out:st=${length - o.fadeOut}:d=${o.fadeOut}`);
      }
      args.push('-af', af.join(','), ...audioCodec(o.format, o));
    } else {
      args.push('-map', '0:v:0');
      if (['mute-video', 'animation-to-video'].includes(operation)) args.push('-an');
      else if (operation === 'replace-video-audio') {
        args.push('-map', '1:a:0');
        af.push('apad');
      } else args.push('-map', '0:a:0?');
      if (operation === 'animation-to-video') {
        if (!/^#[0-9a-f]{6}$/i.test(o.background))
          throw new Error('Background must be a six-digit hex colour.');
        vf.push(
          `format=rgba,split[fg][bg];[bg]drawbox=color=${o.background.replace('#', '0x')}:replace=1:t=fill[base];[base][fg]overlay=format=auto`,
        );
      }
      vf.push(scale(o.width));
      args.push('-vf', vf.join(','));
      if (decoded?.fps) args.push('-r', String(decoded.fps));
      if (
        (meta.a && !['mute-video', 'animation-to-video'].includes(operation)) ||
        operation === 'replace-video-audio'
      )
        args.push('-af', af.join(','));
      args.push(...videoCodec(o.format, o));
    }
    const name = `result.${o.format}`;
    await context.run([
      ...args,
      '-t',
      String(length / speed),
      '-map_metadata',
      '-1',
      ...cappedOutput(name),
    ]);
    return validateResult(context, name, o.format, length / speed);
  });
}

export async function convertPair({ source, target, file, options = {}, onProgress, signal }) {
  if (!isSupportedPair(source, target))
    throw new Error('Unsupported browser media conversion pair.');
  if (audioFormats.includes(source) && (videoFormats.includes(target) || target === 'gif'))
    throw new Error('An audio file contains no video frames.');
  if (!(file instanceof Blob) || !file.size || file.size > MAX_INPUT)
    throw new Error('Select a nonempty media file of at most 100 MB.');
  const converted = {
    ...options,
    ...(options.audioBitrate !== undefined ? { bitrate: options.audioBitrate } : {}),
    format: target,
  };
  // Convert the complete remaining clip unless the user explicitly chooses a
  // duration. Long clips must never appear to succeed with silently lost media.
  return withEngine(signal, onProgress, async (context) => {
    const name = `input.${source}`;
    await context.write(name, file);
    const meta = await context.probe(name);
    const { start, length: duration } = pairSegment(converted, meta, target);
    const args = [...inputArgs(name), '-ss', String(start), '-t', String(duration)];
    if (audioFormats.includes(target)) {
      if (!meta.a) throw new Error('Input contains no audio track to extract.');
      args.push('-map', '0:a:0', '-vn', ...audioCodec(target, converted));
    } else {
      if (!meta.v) throw new Error('Input contains no video frames.');
      const width = numberOption(
        converted,
        'width',
        target === 'gif' ? 480 : Math.min(meta.v.width, 1920),
        16,
        1920,
      );
      if (target === 'gif') {
        const fps = numberOption(converted, 'fps', 10, 1, 24);
        if (duration > 30)
          throw new Error('GIF output is limited to 30 seconds. Set a shorter duration.');
        frameBudget(
          width,
          Math.ceil((meta.v.height * width) / meta.v.width),
          Math.ceil(duration * fps),
        );
        const codec = animationCodec('gif', { loop: 0 });
        args.push(
          '-map',
          '0:v:0',
          '-an',
          '-vf',
          `fps=${fps},scale=${width}:-1,${codec.filter}`,
          ...codec.args,
        );
      } else
        args.push(
          '-map',
          '0:v:0',
          '-map',
          '0:a:0?',
          '-vf',
          scale(width),
          ...videoCodec(target, converted),
        );
    }
    const output = `result.${target}`;
    await context.run([...args, '-map_metadata', '-1', ...cappedOutput(output)]);
    return validateResult(context, output, target, duration);
  });
}
