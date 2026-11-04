const num = (key, label, value, min, max, step = 1) => ({
  key,
  label,
  type: 'number',
  default: value,
  min,
  max,
  step,
});
const select = (key, label, value, values) => ({
  key,
  label,
  type: 'select',
  default: value,
  options: values.map((v) => [v, v.toUpperCase()]),
});
const check = (key, label, value = false) => ({ key, label, type: 'checkbox', default: value });
const text = (key, label, value = '') => ({
  key,
  label,
  type: 'text',
  default: value,
  maxLength: 200,
});
const images = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'apng'];
const videos = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'flv', 'wmv', 'mpeg', 'mpg', 'ts', 'gif'];
const audio = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aiff', 'aac', 'opus', 'wma', 'amr', 'ape'];
const trim = [
  num('start', 'Start (seconds)', 0, 0, 7200, 0.1),
  num('duration', 'Length (seconds)', 20, 0.1, 120, 0.1),
];
const animate = [
  select('format', 'Output format', 'gif', ['gif', 'webp', 'apng']),
  num('width', 'Maximum width', 480, 16, 1200),
  num('loop', 'Loop count (-1 = source, 0 = forever)', -1, -1, 100),
  ...trim,
];
const video = [
  select('format', 'Output format', 'mp4', ['mp4', 'webm', 'mov', 'mkv']),
  num('width', 'Maximum width', 1280, 16, 1920),
  num('crf', 'Quality (lower = better)', 26, 16, 45),
  ...trim,
];
const audioOptions = [
  select('format', 'Output format', 'mp3', ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aiff']),
  num('bitrate', 'Bitrate (kbps)', 128, 32, 320),
  ...trim,
];
function tool(id, family, title, category, accept, fields, extra = {}) {
  return {
    id,
    family,
    title,
    category,
    icon: category === 'audio' ? 'music' : 'video',
    summary: title + ' with local processing.',
    intro: 'Choose your files and settings, then download the processed result.',
    action: title,
    accept,
    multiple: false,
    minFiles: 1,
    engine: 'media',
    fields,
    defaults: Object.fromEntries(fields.map((f) => [f.key, f.default])),
    guide: 'Upload a file, adjust settings and run the tool. All processing uses the local engine.',
    note: 'Media jobs are bounded to 120 seconds; animations to 240 frames, 30 seconds and 64 million decoded pixels.',
    ...extra,
  };
}
export const mediaTools = [
  tool(
    'gif-maker',
    [16],
    'Images to animated GIF',
    'image',
    images,
    [
      ...animate,
      num('height', 'Canvas height', 480, 16, 1200),
      num('delay', 'Frame delay (ms)', 100, 20, 2000),
    ],
    {
      multiple: true,
      minFiles: 2,
      guide:
        'Add images in frame order. Files are fitted on a transparent canvas. Delay applies to each image.',
    },
  ),
  tool(
    'animation-to-video',
    [17],
    'GIF to video',
    'video',
    ['gif', 'webp', 'apng'],
    [...video, text('background', 'Transparency background', '#ffffff')],
  ),
  tool(
    'animation-convert',
    [18, 19],
    'Animated GIF, WebP and APNG',
    'image',
    ['gif', 'webp', 'apng', 'png'],
    animate,
  ),
  tool('video-to-animation', [20], 'Video to animated WebP, APNG or GIF', 'video', videos, [
    ...animate,
    num('fps', 'Frames per second', 10, 1, 24),
  ]),
  tool('extract-frames', [21], 'Extract video or GIF frames', 'video', videos, [
    select('format', 'Frame format', 'png', ['png', 'jpg']),
    num('fps', 'Frames per second', 1, 1, 10),
    num('width', 'Maximum width', 800, 16, 1600),
    ...trim,
  ]),
  tool(
    'compress-gif',
    [22],
    'Compress GIF to target size',
    'image',
    ['gif'],
    [
      ...animate.map((f) =>
        f.key === 'format' ? select('format', 'Output format', 'gif', ['gif']) : f,
      ),
      num('colors', 'Maximum palette colours', 128, 16, 256),
      num('targetKB', 'Target size (KB)', 500, 1, 20000),
    ],
    {
      note: 'Tries six palette and dimension reductions. The result reports whether the target was reached and returns the smallest valid animation.',
    },
  ),
  tool(
    'edit-animation',
    [23],
    'Crop, trim and edit animation',
    'image',
    ['gif', 'webp', 'apng'],
    [
      ...animate,
      num('speed', 'Playback speed', 1, 0.25, 4, 0.25),
      check('reverse', 'Reverse frame order'),
      num('left', 'Crop left', 0, 0, 10000),
      num('top', 'Crop top', 0, 0, 10000),
      num('cropWidth', 'Crop width (0 = unchanged)', 0, 0, 10000),
      num('cropHeight', 'Crop height (0 = unchanged)', 0, 0, 10000),
    ],
  ),
  tool('compress-audio', [29], 'Compress or trim audio', 'audio', audio, audioOptions),
  tool('compress-video', [30], 'Compress or trim video', 'video', videos, video),
  tool('transform-video', [31], 'Crop, rotate, speed or reverse video', 'video', videos, [
    ...video,
    num('speed', 'Playback speed', 1, 0.25, 4, 0.25),
    check('reverse', 'Reverse video and audio'),
    select('rotate', 'Rotation', '0', ['0', '90', '180', '270']),
    num('left', 'Crop left', 0, 0, 10000),
    num('top', 'Crop top', 0, 0, 10000),
    num('cropWidth', 'Crop width (0 = unchanged)', 0, 0, 10000),
    num('cropHeight', 'Crop height (0 = unchanged)', 0, 0, 10000),
  ]),
  tool('join-audio', [32], 'Join audio clips', 'audio', audio, audioOptions, {
    multiple: true,
    minFiles: 2,
    guide:
      'Add clips in playback order. Each clip is trimmed using the same start and length, then normalized to stereo 48 kHz.',
  }),
  tool('join-video', [32], 'Join video clips', 'video', videos, video, {
    multiple: true,
    minFiles: 2,
    guide:
      'Add clips in playback order. Clips are fitted to the chosen width on a 16:9 canvas at 25 fps; audio is normalized. Silent clips receive silence.',
  }),
  tool('mute-video', [33], 'Mute video', 'video', videos, video),
  tool('replace-video-audio', [33], 'Replace video audio', 'video', [...videos, ...audio], video, {
    multiple: true,
    minFiles: 2,
    guide:
      'Add exactly two files: video first, then audio. New audio is trimmed or padded with silence to the video duration.',
  }),
  tool('audio-waveform', [34], 'Audio waveform image', 'audio', audio, [
    num('width', 'Image width', 1200, 200, 2000),
    num('height', 'Image height', 300, 100, 1000),
    ...trim,
  ]),
  tool('video-thumbnail', [34], 'Video thumbnail', 'video', videos, [
    num('start', 'Timestamp (seconds)', 0, 0, 7200, 0.1),
    num('width', 'Maximum width', 800, 16, 1600),
  ]),
  tool(
    'lottie-render',
    [40],
    'Lottie or TGS to animation',
    'design',
    ['json', 'tgs'],
    [...animate, num('fps', 'Frames per second', 15, 1, 30)],
    {
      note: 'Self-contained JSON/TGS only, without external images, fonts, expressions or scripts. Up to 240 frames. ZIP .lottie bundles are unsupported.',
    },
  ),
  tool('convert-native-video', [56], 'AVI, FLV, WMV, MPEG or TS to video', 'video', videos, video),
  tool(
    'convert-native-audio',
    [57],
    'AAC, Opus, WMA, AMR or APE to audio',
    'audio',
    audio,
    audioOptions,
  ),
  tool(
    'convert-subtitles',
    [58],
    'ASS, SSA, SRT and VTT subtitles',
    'subtitle',
    ['ass', 'ssa', 'srt', 'vtt'],
    [
      select('format', 'Output format', 'srt', ['srt', 'vtt', 'ass', 'ssa']),
      num('shift', 'Timestamp shift (seconds)', 0, -7200, 7200, 0.1),
    ],
    {
      note: 'ASS/SSA styling and positioning are lost in SRT/VTT. Negative timestamps are clamped to zero.',
    },
  ),
  tool(
    'burn-subtitles',
    [59],
    'Burn subtitles into video',
    'video',
    [...videos, 'ass', 'ssa', 'srt', 'vtt'],
    video,
    {
      multiple: true,
      minFiles: 2,
      guide:
        'Add exactly two files: video first, subtitle file second. FFmpeg libass renders subtitles permanently into the output.',
    },
  ),
  tool('normalize-audio', [60], 'Normalize loudness and fade audio', 'audio', audio, [
    ...audioOptions,
    num('loudness', 'Loudness (LUFS)', -16, -30, -5),
    num('fadeIn', 'Fade in (seconds)', 0, 0, 30, 0.1),
    num('fadeOut', 'Fade out (seconds)', 0, 0, 30, 0.1),
  ]),
  tool(
    'transcribe-media',
    [61],
    'Transcribe audio or video locally',
    'audio',
    [...audio, ...videos],
    [
      select('format', 'Transcript format', 'txt', ['txt', 'srt', 'vtt']),
      text('language', 'Language code (auto detects)', 'auto'),
      ...trim,
    ],
    {
      note: 'Requires the bundled local Whisper tiny model. Maximum 120 seconds. Recognition can be inaccurate; review the transcript.',
    },
  ),
];
