import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { gzipSync } from 'fflate';
import {
  lottieBytes,
  mediaFailure,
  validateInputs,
  segment,
  pairSegment,
  inspectProbe,
  frameBudget,
  tempo,
  convertSubtitles,
  audioCodec,
  videoCodec,
} from '../src/browser/media-helpers.js';
import {
  convert,
  isSupportedPair,
  supportedToolIds,
  unsupportedTools,
} from '../src/browser/media-engine.js';
import { transcriptOutput, transcribeAudio } from '../src/browser/media-transcription.js';

const input = (source, bytes = 'bytes') => ({
  source,
  name: `input.${source}`,
  file: new Blob([bytes]),
});

test('FFmpeg worker string rejections expose a readable error to the job runtime', () => {
  const loadFailure = mediaFailure('TypeError: Failed to fetch');
  assert.ok(loadFailure instanceof Error);
  assert.match(loadFailure.message, /local media engine could not load.*Refresh.*Failed to fetch/);
  assert.match(
    mediaFailure('Decoder failed', true).message,
    /Media processing failed: Decoder failed/,
  );
  const original = new Error('Specific codec failure');
  assert.equal(mediaFailure(original, true), original);
});

test('TGS decoding rejects corrupt CRC and size trailers before parsing valid JSON', () => {
  const json = new TextEncoder().encode('{"layers":[],"fr":15,"ip":0,"op":15,"w":100,"h":100}');
  const valid = gzipSync(json);
  assert.deepEqual(lottieBytes(valid, 'tgs'), json);
  assert.equal(lottieBytes(json, 'json'), json);
  const badChecksum = valid.slice();
  badChecksum[badChecksum.length - 8] ^= 1;
  assert.throws(() => lottieBytes(badChecksum, 'tgs'), /checksum or size mismatch/);
  const badSize = valid.slice();
  badSize[badSize.length - 4] ^= 1;
  assert.throws(() => lottieBytes(badSize, 'tgs'), /checksum or size mismatch/);
  assert.throws(() => lottieBytes(gzipSync(new Uint8Array(5 * 1024 * 1024 + 1)), 'tgs'), /5 MiB/);
});

test('media capabilities expose all original tools and valid pair directions', () => {
  assert.equal(supportedToolIds.length, 23);
  assert.ok(supportedToolIds.includes('transcribe-media'));
  assert.deepEqual(unsupportedTools, {});
  assert.equal(isSupportedPair('mp4', 'wav'), true);
  assert.equal(isSupportedPair('mp4', 'gif'), true);
  assert.equal(isSupportedPair('wav', 'mp4'), false);
  assert.equal(isSupportedPair('mp4', 'exe'), false);
});

test('transcripts preserve speech and model timestamps in text, SRT and VTT', () => {
  const result = {
    text: ' Hello world.',
    chunks: [
      { text: ' Hello', timestamp: [0, 1.25] },
      { text: ' world.', timestamp: [1.25, null] },
    ],
  };
  assert.equal(transcriptOutput(result, 'txt', 3), 'Hello world.\n');
  assert.equal(
    transcriptOutput(result, 'srt', 3),
    '1\n00:00:00,000 --> 00:00:01,250\nHello\n\n2\n00:00:01,250 --> 00:00:03,000\nworld.\n',
  );
  assert.match(transcriptOutput(result, 'vtt', 3), /^WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.250/);
  assert.throws(() => transcriptOutput({ text: '' }, 'txt', 3), /No speech/);
  assert.throws(
    () => transcriptOutput({ text: 'bad', chunks: [{ text: 'bad', timestamp: [2, 1] }] }, 'srt', 3),
    /invalid segment/,
  );
});

test('speech validation rejects silence and invalid samples before worker startup', async () => {
  await assert.rejects(
    transcribeAudio({ samples: new Float32Array(160), format: 'txt', language: 'auto' }),
    /silent/,
  );
  await assert.rejects(
    transcribeAudio({ samples: new Float32Array([NaN]), format: 'txt', language: 'en' }),
    /Invalid speech/,
  );
});

test('subtitle conversion produces actual shifted cues without loading wasm', async () => {
  const srt = '1\n00:00:00,250 --> 00:00:02,750\n<i>Hello</i>\nWorld\n';
  const result = await convert({
    operation: 'convert-subtitles',
    inputs: [input('srt', srt)],
    options: { format: 'vtt', shift: -1 },
  });
  assert.equal(result.mime, 'text/vtt');
  assert.equal(result.filename, 'result.vtt');
  assert.equal(
    await result.blob.text(),
    'WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.750\nHello\nWorld\n',
  );
  const ass = convertSubtitles(srt, 'srt', 'ass');
  assert.match(ass, /Dialogue: 0,0:00:00.25,0:00:02.75,Default,,0,0,0,,Hello\\NWorld/);
  assert.equal(
    convertSubtitles(ass, 'ass', 'srt'),
    '1\n00:00:00,250 --> 00:00:02,750\nHello\nWorld\n',
  );
});

test('subtitle parser validates timestamps and rejects embedded resources', () => {
  assert.throws(
    () => convertSubtitles('1\n00:99:00,000 --> 01:00:00,000\nBad', 'srt', 'vtt'),
    /valid subtitle/,
  );
  assert.throws(
    () => convertSubtitles('[Fonts]\nfontname:private.ttf', 'ass', 'srt'),
    /attachments/,
  );
  assert.throws(
    () => convertSubtitles('1\n00:00:02,000 --> 00:00:01,000\nBad', 'srt', 'vtt'),
    /valid subtitle/,
  );
  assert.equal(
    convertSubtitles('WEBVTT\n\nc1\n00:01.000 --> 00:02.500 align:start\nHi', 'vtt', 'srt'),
    '1\n00:00:01,000 --> 00:00:02,500\nHi\n',
  );
});

test('media preflight rejects mismatched types, unsafe values and incorrect file counts', () => {
  assert.throws(
    () => validateInputs('compress-video', [input('mp4')], { crf: '26' }),
    /Invalid crf/,
  );
  assert.throws(
    () => validateInputs('transform-video', [input('mp4')], { reverse: 'false' }),
    /Invalid reverse/,
  );
  assert.throws(
    () => validateInputs('transform-video', [input('mp4')], { cropWidth: 10 }),
    /both crop/,
  );
  assert.throws(() => validateInputs('compress-video', [input('wav')]), /Unsupported input/);
  assert.throws(
    () => validateInputs('replace-video-audio', [input('mp4'), input('mp3'), input('mp3')]),
    /exactly two/,
  );
  assert.throws(
    () => validateInputs('compress-video', [input('mp4')], { format: 'mp4;evil' }),
    /Unsupported format/,
  );
  const options = validateInputs('compress-audio', [input('mp3')]);
  assert.equal(options.bitrate, 128);
  assert.equal(options.duration, 20);
});

test('probe, segment and decoded frame budgets bound memory and playback work', () => {
  const metadata = inspectProbe({
    streams: [{ codec_type: 'video', width: 640, height: 480 }],
    format: { duration: '10' },
  });
  assert.deepEqual(segment({ start: 8, duration: 20 }, metadata), { start: 8, length: 2 });
  assert.throws(() => segment({ start: 10 }, metadata), /before/);
  assert.throws(() => inspectProbe({ streams: [], format: { duration: 1 } }), /no decodable/);
  assert.throws(
    () =>
      inspectProbe({
        streams: [{ codec_type: 'video', width: 10000, height: 10000 }],
        format: { duration: 1 },
      }),
    /8.3 million/,
  );
  assert.throws(() => frameBudget(1200, 1000, 240), /64 million/);
  assert.throws(() => frameBudget(10, 10, 241), /240 frames/);
  assert.deepEqual(tempo(0.25), ['atempo=0.5', 'atempo=0.5']);
  assert.deepEqual(tempo(4), ['atempo=2', 'atempo=2']);
});

test('pre-aborted media jobs do not begin processing', async () => {
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    convert({ operation: 'convert-subtitles', inputs: [input('srt')], signal: abort.signal }),
    { name: 'AbortError' },
  );
});

test('long media pairs require an explicit duration instead of silently truncating', () => {
  assert.throws(
    () => pairSegment({}, { duration: 121 }, 'mp3'),
    /Choose a Duration.*will not be truncated automatically/,
  );
  assert.throws(() => pairSegment({ start: 10 }, { duration: 200 }, 'mp4'), /120 seconds/);
  assert.throws(() => pairSegment({}, { duration: 31 }, 'gif'), /30 seconds/);
  assert.deepEqual(pairSegment({ duration: 120, start: 10 }, { duration: 200 }, 'mp4'), {
    start: 10,
    length: 120,
  });
  assert.deepEqual(pairSegment({ start: 110 }, { duration: 200 }, 'mp4'), {
    start: 110,
    length: 90,
  });
  assert.deepEqual(pairSegment({}, { duration: 119 }, 'wav'), { start: 0, length: 119 });
  assert.throws(() => pairSegment({ duration: 121 }, { duration: 200 }, 'wav'), /Invalid duration/);
});

// Run the exact deployed single-thread core against generated fixtures. This is
// a codec/output test, independent of browser DOM and any installed native FFmpeg.
test('bundled wasm encodes all media pair target codecs and decodes actual output', async (t) => {
  globalThis.self ??= { location: { href: 'file:///ffmpeg-core.js' } };
  const { default: createCore } = await import('@ffmpeg/core');
  const core = await createCore({
    wasmBinary: await fs.readFile(
      new URL('../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm', import.meta.url),
    ),
  });
  let logs = [];
  core.setLogger(({ message }) => {
    logs.push(message);
    if (logs.length > 20) logs.shift();
  });
  const run = (args) => {
    logs = [];
    core.setTimeout(10000);
    core.exec(
      '-hide_banner',
      '-loglevel',
      'error',
      '-threads',
      '1',
      '-filter_threads',
      '1',
      '-filter_complex_threads',
      '1',
      '-y',
      ...args,
    );
    const code = core.ret;
    core.reset();
    assert.equal(code, 0, logs.join('\n'));
  };
  const probe = (name) => {
    try {
      core.FS.unlink('probe.json');
    } catch {
      /* Fresh report. */
    }
    core.ffprobe(
      '-v',
      'error',
      '-show_streams',
      '-show_format',
      '-of',
      'json',
      name,
      '-o',
      'probe.json',
    );
    core.reset();
    return inspectProbe(JSON.parse(core.FS.readFile('probe.json', { encoding: 'utf8' })));
  };
  run(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.4', 'tone.wav']);
  for (const format of ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aiff']) {
    await t.test(format, () => {
      const name = `audio-${format}.${format}`;
      run(['-i', 'tone.wav', ...audioCodec(format, { bitrate: 96 }), name]);
      const meta = probe(name);
      assert.ok(meta.a && meta.duration >= 0.39);
      assert.ok(core.FS.stat(name).size > 50);
      run(['-i', name, '-t', '0.1', '-f', 'null', '-']);
    });
  }
  run([
    '-f',
    'lavfi',
    '-i',
    'testsrc=size=320x240:rate=5:duration=0.4',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=0.4',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    'source.mp4',
  ]);
  for (const format of ['mp4', 'webm', 'mov', 'mkv']) {
    await t.test(format, () => {
      const name = `video-${format}.${format}`;
      run(['-i', 'source.mp4', ...videoCodec(format, { crf: 28 }), name]);
      const meta = probe(name);
      assert.equal(meta.v.codec_name, format === 'webm' ? 'vp8' : 'h264');
      assert.ok(meta.a && meta.duration >= 0.39);
      run(['-i', name, '-t', '0.1', '-f', 'null', '-']);
    });
  }
  for (const [format, codec] of [
    ['gif', 'gif'],
    ['webp', 'libwebp_anim'],
    ['apng', 'apng'],
  ]) {
    await t.test(`animation-${format}`, () => {
      const name = `animation.${format}`;
      run([
        '-i',
        'source.mp4',
        '-an',
        '-c:v',
        codec,
        ...(format === 'apng' ? ['-f', 'apng'] : []),
        name,
      ]);
      assert.ok(core.FS.stat(name).size > 50);
      // FFmpeg's legacy WebP decoder cannot decode animations; browser
      // ImageDecoder handles animated WebP in the production adapter.
      if (format !== 'webp') run(['-i', name, '-frames:v', '1', '-f', 'null', '-']);
    });
  }
  await t.test('waveform and normalization filters produce bytes', () => {
    run([
      '-i',
      'tone.wav',
      '-filter_complex',
      '[0:a]showwavespic=s=200x100:colors=0x3388cc[wave]',
      '-map',
      '[wave]',
      '-frames:v',
      '1',
      'wave.png',
    ]);
    assert.deepEqual(
      [...core.FS.readFile('wave.png').slice(0, 8)],
      [137, 80, 78, 71, 13, 10, 26, 10],
    );
    run([
      '-i',
      'tone.wav',
      '-af',
      'loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:d=0.1',
      'normalized.wav',
    ]);
    assert.ok(probe('normalized.wav').a);
  });
});
