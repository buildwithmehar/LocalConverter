import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { unzipSync } from 'fflate';
import { convertMediaTool } from '../server/conversion/media-toolbox.js';
import { mediaTools } from '../shared/media-tools.js';
import { runProcess } from '../server/conversion/common.js';

test(
  'media toolbox produces decodable animations, edited media, subtitles and frame archives',
  { timeout: 180000 },
  async (t) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'converter-media-'));
    const input = (name) => ({ path: path.join(dir, name), name, source: name.split('.').pop() });
    let counter = 0;
    const convert = (operation, names, options = {}) =>
      convertMediaTool({
        operation,
        inputs: names.map((n) => (typeof n === 'string' ? input(n) : n)),
        outputDir: path.join(dir, `job-${counter++}`),
        options,
      });
    const probe = async (file) =>
      JSON.parse(
        await runProcess('ffprobe', [
          '-v',
          'error',
          '-show_format',
          '-show_streams',
          '-of',
          'json',
          file,
        ]),
      );
    try {
      await sharp({ create: { width: 64, height: 48, channels: 4, background: '#ff0000' } })
        .png()
        .toFile(input('red.png').path);
      await sharp({ create: { width: 64, height: 48, channels: 4, background: '#0000ff' } })
        .png()
        .toFile(input('blue.png').path);
      await runProcess('ffmpeg', [
        '-v',
        'error',
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc2=size=160x120:rate=12:duration=2',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=2',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-shortest',
        input('video.mp4').path,
      ]);
      await runProcess('ffmpeg', [
        '-v',
        'error',
        '-y',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=660:duration=2',
        '-c:a',
        'pcm_s16le',
        input('audio.wav').path,
      ]);
      await fs.writeFile(
        input('sub.srt').path,
        '1\n00:00:00,200 --> 00:00:01,500\nHello converter\n',
      );
      await t.test('metadata families and defaults', () => {
        assert.equal(new Set(mediaTools.map((t) => t.id)).size, mediaTools.length);
        for (const tool of mediaTools)
          for (const f of tool.fields) assert.ok(Object.hasOwn(tool.defaults, f.key));
        for (const family of [
          16, 17, 18, 19, 20, 21, 22, 23, 29, 30, 31, 32, 33, 34, 40, 56, 57, 58, 59, 60, 61,
        ])
          assert.ok(mediaTools.some((t) => t.family.includes(family)));
      });
      let gif;
      await t.test(
        'GIF maker and animated WebP/APNG roundtrip retain frames and loop',
        async () => {
          gif = await convert('gif-maker', ['red.png', 'blue.png'], {
            width: 64,
            height: 48,
            delay: 120,
            loop: 3,
          });
          const info = await sharp(gif.path, { animated: true }).metadata();
          assert.equal(info.pages, 2);
          assert.equal(info.loop, 3);
          for (const format of ['webp', 'apng']) {
            const result = await convert(
              'animation-convert',
              [{ ...input('animation.gif'), path: gif.path }],
              { format, width: 64 },
            );
            assert.equal(result.details.frames, 2);
            const back = await convert(
              'animation-convert',
              [{ path: result.path, source: format }],
              { format: 'gif', width: 64 },
            );
            assert.equal(back.details.frames, 2);
            const roundtrip = await sharp(back.path, { animated: true }).metadata();
            assert.equal(roundtrip.loop, 3);
            assert.deepEqual(roundtrip.delay, [120, 120]);
          }
        },
      );
      await t.test('GIF target compression/editor produce actual animation', async () => {
        const result = await convert('compress-gif', [{ path: gif.path, source: 'gif' }], {
          targetKB: 1,
          width: 64,
        });
        assert.equal(typeof result.details.targetMet, 'boolean');
        const edited = await convert('edit-animation', [{ path: gif.path, source: 'gif' }], {
          reverse: true,
          speed: 2,
          cropWidth: 32,
          cropHeight: 24,
          width: 64,
        });
        assert.equal((await sharp(edited.path).metadata()).width, 32);
        assert.ok(edited.details.duration < gif.details.duration);
      });
      await t.test('GIF to video, video to APNG and frame extraction', async () => {
        const video = await convert('animation-to-video', [{ path: gif.path, source: 'gif' }], {
          width: 64,
        });
        assert.equal((await probe(video.path)).streams[0].codec_name, 'h264');
        const anim = await convert('video-to-animation', ['video.mp4'], {
          format: 'apng',
          width: 80,
          fps: 4,
          duration: 1,
        });
        assert.equal(anim.details.frames, 4);
        const frames = await convert('extract-frames', ['video.mp4'], {
          duration: 1,
          fps: 2,
          width: 80,
        });
        const entries = unzipSync(await fs.readFile(frames.path));
        assert.equal(Object.keys(entries).length, 2);
        for (const bytes of Object.values(entries))
          assert.equal((await sharp(bytes).metadata()).width, 80);
      });
      await t.test('audio/video compressors, waveform and thumbnail', async () => {
        for (const op of ['compress-audio', 'normalize-audio']) {
          const result = await convert(op, ['audio.wav'], {
            duration: 1,
            start: 0.5,
            fadeIn: 0.1,
            fadeOut: 0.1,
          });
          const p = await probe(result.path);
          assert.equal(p.streams[0].codec_type, 'audio');
          assert.ok(Number(p.format.duration) < 1.2);
        }
        const compressed = await convert('compress-video', ['video.mp4'], {
          duration: 1,
          width: 80,
        });
        assert.equal((await probe(compressed.path)).streams[0].width, 80);
        for (const [op, name] of [
          ['audio-waveform', 'audio.wav'],
          ['video-thumbnail', 'video.mp4'],
        ]) {
          const r = await convert(op, [name], { duration: 1, width: 400, height: 100 });
          assert.equal((await sharp(r.path).metadata()).format, 'png');
        }
      });
      await t.test('video transform/join, audio join, mute and replacement', async () => {
        const transformed = await convert('transform-video', ['video.mp4'], {
          duration: 1,
          width: 80,
          speed: 2,
          reverse: true,
          cropWidth: 80,
          cropHeight: 60,
          rotate: '90',
        });
        assert.ok(Number((await probe(transformed.path)).format.duration) < 0.8);
        for (const [op, names] of [
          ['join-video', ['video.mp4', 'video.mp4']],
          ['join-audio', ['audio.wav', 'audio.wav']],
        ]) {
          const joined = await convert(op, names, { duration: 0.5, width: 80 });
          assert.ok(Number((await probe(joined.path)).format.duration) > 0.9);
        }
        const muted = await convert('mute-video', ['video.mp4'], { duration: 1, width: 80 });
        assert.ok(!(await probe(muted.path)).streams.some((s) => s.codec_type === 'audio'));
        const replaced = await convert('replace-video-audio', ['video.mp4', 'audio.wav'], {
          duration: 1,
          width: 80,
        });
        assert.ok((await probe(replaced.path)).streams.some((s) => s.codec_type === 'audio'));
      });
      await t.test('subtitle shifts, ASS/SSA roundtrip and burn', async () => {
        for (const format of ['ass', 'ssa']) {
          const ass = await convert('convert-subtitles', ['sub.srt'], { format, shift: 1 });
          const srt = await convert('convert-subtitles', [{ path: ass.path, source: format }], {
            format: 'vtt',
          });
          assert.match(await fs.readFile(srt.path, 'utf8'), /00:00:01\.200/);
        }
        const burned = await convert('burn-subtitles', ['video.mp4', 'sub.srt'], {
          duration: 1,
          width: 160,
        });
        assert.equal((await probe(burned.path)).streams[0].codec_name, 'h264');
      });
      await t.test('extended native formats are decoded', async () => {
        for (const [ext, codec] of [
          ['avi', 'mpeg4'],
          ['flv', 'flv'],
          ['wmv', 'wmv2'],
          ['mpeg', 'mpeg2video'],
          ['ts', 'mpeg2video'],
        ]) {
          const native = input(`native.${ext}`);
          await runProcess('ffmpeg', [
            '-v',
            'error',
            '-y',
            '-i',
            input('video.mp4').path,
            '-an',
            '-c:v',
            codec,
            ...(ext === 'ts' ? ['-f', 'mpegts'] : []),
            native.path,
          ]);
          const r = await convert('convert-native-video', [native], { duration: 0.5, width: 80 });
          assert.equal((await probe(r.path)).streams[0].codec_name, 'h264');
        }
        for (const [ext, codec] of [
          ['aac', 'aac'],
          ['opus', 'libopus'],
          ['wma', 'wmav2'],
        ]) {
          const native = input(`native.${ext}`);
          await runProcess('ffmpeg', [
            '-v',
            'error',
            '-y',
            '-i',
            input('audio.wav').path,
            '-c:a',
            codec,
            native.path,
          ]);
          const r = await convert('convert-native-audio', [native], { duration: 0.5 });
          assert.equal((await probe(r.path)).streams[0].codec_name, 'mp3');
        }
      });
      await t.test('Lottie and compressed TGS render local frames', async () => {
        const lottie = {
          v: '5.12.2',
          fr: 10,
          ip: 0,
          op: 10,
          w: 64,
          h: 48,
          nm: 'fixture',
          ddd: 0,
          assets: [],
          layers: [
            {
              ddd: 0,
              ind: 1,
              ty: 1,
              nm: 'solid',
              sr: 1,
              ks: {
                o: { a: 0, k: 100 },
                r: { a: 0, k: 0 },
                p: { a: 0, k: [0, 0, 0] },
                a: { a: 0, k: [0, 0, 0] },
                s: { a: 0, k: [100, 100, 100] },
              },
              ao: 0,
              sw: 64,
              sh: 48,
              sc: '#ff0000',
              ip: 0,
              op: 10,
              st: 0,
              bm: 0,
            },
          ],
        };
        await fs.writeFile(input('animation.json').path, JSON.stringify(lottie));
        const r = await convert('lottie-render', ['animation.json'], {
          duration: 0.5,
          fps: 4,
          width: 64,
        });
        assert.ok(r.details.frames >= 1);
        const { gzipSync } = await import('node:zlib');
        await fs.writeFile(input('animation.tgs').path, gzipSync(JSON.stringify(lottie)));
        assert.ok(
          (await convert('lottie-render', ['animation.tgs'], { duration: 0.5, fps: 4, width: 64 }))
            .details.frames >= 1,
        );
      });
      const modelReady = await fs
        .access(
          fileURLToPath(new URL('../.tools/models/media/whisper-tiny/model.bin', import.meta.url)),
        )
        .then(
          () => true,
          () => false,
        );
      await t.test(
        'offline Whisper recognizes a real synthesized speech fixture',
        { skip: process.platform !== 'win32' || !modelReady },
        async () => {
          const synth = path.join(dir, 'speech-fixture.ps1');
          await fs.writeFile(
            synth,
            'param([string]$OutputPath)\nAdd-Type -AssemblyName System.Speech\n$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer\n$speaker.SetOutputToWaveFile($OutputPath)\n$speaker.Speak("Hello. This is a local speech recognition test. The quick brown fox jumps over the lazy dog.")\n$speaker.Dispose()\n',
          );
          await runProcess('powershell.exe', [
            '-NoProfile',
            '-File',
            synth,
            input('speech.wav').path,
          ]);
          for (const format of ['txt', 'srt', 'vtt']) {
            const r = await convert('transcribe-media', ['speech.wav'], {
              format,
              language: 'en',
              duration: 20,
            });
            const text = await fs.readFile(r.path, 'utf8');
            assert.match(text, /speech|recognition|quick|brown|fox/i);
            assert.ok(r.details.segments > 0);
            if (format === 'vtt') assert.match(text, /^WEBVTT/);
            if (format === 'srt') assert.match(text, /-->/);
          }
        },
      );
      await t.test('reject invalid payloads and frame budgets', async () => {
        await fs.writeFile(input('bad.mp4').path, 'not media');
        await assert.rejects(convert('compress-video', ['bad.mp4']));
        await assert.rejects(convert('extract-frames', ['video.mp4'], { duration: 120, fps: 100 }));
        await assert.rejects(convert('replace-video-audio', ['audio.wav', 'video.mp4']));
        await assert.rejects(
          convert('edit-animation', [{ path: gif.path, source: 'gif' }], {
            cropWidth: 999,
            cropHeight: 999,
          }),
        );
      });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  },
);
