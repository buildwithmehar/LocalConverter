import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { detectArchiver } from './native-archives.js';
import { imageSources, imageTargets } from './image.js';
import { dataFormats } from './data.js';
import { detectMedia, audioFormats, videoFormats } from './media.js';
import { everydayTools } from '../../shared/everyday-tools.js';
export const formats = [
  ...[
    ['7z', '7Z archive', 'archive', 'application/x-7z-compressed'],
    ['tar', 'TAR archive', 'archive', 'application/x-tar'],
    ['jpg', 'JPEG', 'image', 'image/jpeg'],
    ['png', 'PNG', 'image', 'image/png'],
    ['webp', 'WebP', 'image', 'image/webp'],
    ['avif', 'AVIF', 'image', 'image/avif'],
    ['gif', 'GIF', 'image', 'image/gif'],
    ['tiff', 'TIFF', 'image', 'image/tiff'],
    ['svg', 'SVG', 'vector', 'image/svg+xml'],
    ['pdf', 'PDF', 'document', 'application/pdf'],
    ['txt', 'Plain text', 'document', 'text/plain'],
    ['md', 'Markdown', 'document', 'text/markdown'],
    ['html', 'HTML', 'document', 'text/html'],
    [
      'docx',
      'Word DOCX',
      'document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    ['csv', 'CSV', 'spreadsheet', 'text/csv'],
    ['tsv', 'TSV', 'spreadsheet', 'text/tab-separated-values'],
    [
      'xlsx',
      'Excel XLSX',
      'spreadsheet',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    ['json', 'JSON', 'data', 'application/json'],
    ['yaml', 'YAML', 'data', 'application/yaml'],
    ['srt', 'SubRip SRT', 'subtitle', 'application/x-subrip'],
    ['vtt', 'WebVTT', 'subtitle', 'text/vtt'],
    ['zip', 'ZIP', 'archive', 'application/zip'],
    ['gz', 'GZIP', 'archive', 'application/gzip'],
    ['mp3', 'MP3', 'audio', 'audio/mpeg'],
    ['wav', 'WAV', 'audio', 'audio/wav'],
    ['flac', 'FLAC', 'audio', 'audio/flac'],
    ['ogg', 'Ogg Vorbis', 'audio', 'audio/ogg'],
    ['m4a', 'M4A AAC', 'audio', 'audio/mp4'],
    ['aiff', 'AIFF', 'audio', 'audio/aiff'],
    ['mp4', 'MP4 H.264', 'video', 'video/mp4'],
    ['webm', 'WebM VP9', 'video', 'video/webm'],
    ['mov', 'QuickTime MOV', 'video', 'video/quicktime'],
    ['mkv', 'Matroska MKV', 'video', 'video/x-matroska'],
  ].map(([id, label, category, mime]) => ({ id, label, category, mime })),
];
const number = (key, label, value, min, max) => ({
  key,
  label,
  type: 'number',
  default: value,
  min,
  max,
});
const width = number('width', 'Width (pixels; 0 keeps original)', 0, 0, 8192);
const trim = [
  number('start', 'Start time (seconds)', 0, 0, 7200),
  number('duration', 'Duration (seconds; 0 keeps remaining)', 0, 0, 7200),
];
export async function getRegistry() {
  const installed = async (p) =>
    stat(fileURLToPath(new URL('../../' + p, import.meta.url)))
      .then((s) => s.isFile())
      .catch(() => false);
  const toolboxDependencies = await Promise.all(
    [
      ['LibreOffice', '.tools/native/libreoffice/program/soffice.exe'],
      ['Calibre', '.tools/native/calibre/PFiles64/Calibre2/ebook-convert.exe'],
      ['Python image / PDF / font engines', '.tools/python/Scripts/python.exe'],
      ['U²-Net background segmentation', '.tools/models/image/u2netp.onnx'],
      ['Whisper tiny speech model', '.tools/models/media/whisper-tiny/model.bin'],
      ['English OCR', '.tools/models/document/eng.traineddata.gz'],
    ].map(async ([name, p]) => ({ name, available: await installed(p) })),
  );
  const pairs = [];
  const add = (source, target, engine, options = [], limitations = []) =>
    pairs.push({ source, target, engine, options, limitations });
  for (const source of imageSources)
    for (const target of [...imageTargets, 'pdf'])
      if (
        sharp.format[source === 'jpg' ? 'jpeg' : source === 'avif' ? 'heif' : source]?.input
          ?.buffer &&
        (target === 'pdf' ||
          sharp.format[target === 'jpg' ? 'jpeg' : target === 'avif' ? 'heif' : target]?.output
            ?.buffer)
      )
        add(
          source,
          target,
          'Sharp',
          target === 'pdf'
            ? [width]
            : [
                width,
                ...(['jpg', 'webp', 'avif'].includes(target)
                  ? [number('quality', 'Quality', 85, 1, 100)]
                  : []),
              ],
          [
            'Only the first frame/page is converted.',
            'JPEG transparency is flattened onto white.',
            'Metadata is removed; SVG must be self-contained, without CSS escapes.',
          ],
        );
  for (const target of ['txt', 'png', 'jpg'])
    add(
      'pdf',
      target,
      'PDF.js',
      target === 'txt'
        ? []
        : [
            number('page', 'Page number (0 means all)', 0, 0, 100),
            number('scale', 'Render scale', 2, 1, 4),
          ],
      [
        'Up to 100 pages, 40 million pixels per page and 100 million total rendered pixels; multiple image pages are packaged in one ZIP.',
        'Text extraction requires selectable text; OCR is not included.',
      ],
    );
  for (const source of dataFormats)
    for (const target of dataFormats)
      if (source !== target)
        add(
          source,
          target,
          'Data',
          [],
          [
            'UTF-8 tables with unique column names; JSON/YAML must be arrays of flat records.',
            'Only the first worksheet is read; styles, formulas, dates and nested values are unsupported.',
            'Up to 100,000 cells, 50,000 rows and 200 columns. CSV/TSV fields remain strings.',
          ],
        );
  for (const source of ['txt', 'md', 'html'])
    add(
      source,
      'pdf',
      'PDFKit',
      [],
      [
        'Simple text flow using built-in Latin fonts; CSS, remote resources, images and exact page layout are not rendered.',
      ],
    );
  for (const source of ['md', 'html', 'docx'])
    add(
      source,
      'txt',
      source === 'docx' ? 'Mammoth' : 'Text',
      [],
      ['Semantic text extraction; document layout is not preserved.'],
    );
  add(
    'docx',
    'html',
    'Mammoth',
    [],
    ['Sanitized semantic HTML; embedded images, styles and exact layout are omitted.'],
  );
  add(
    'srt',
    'vtt',
    'Subtitles',
    [],
    ['Cue text/timestamps preserved; styling and cue settings are omitted.'],
  );
  add(
    'vtt',
    'srt',
    'Subtitles',
    [],
    ['Cue text/timestamps preserved; styling, notes and cue settings are omitted.'],
  );
  for (const [source, target] of [
    ['txt', 'gz'],
    ['txt', 'zip'],
    ['zip', 'gz'],
    ['gz', 'zip'],
  ])
    add(
      source,
      target,
      'Archive',
      [],
      [
        'ZIP to GZIP compresses the ZIP container, without extracting files.',
        'GZIP to ZIP stores its decompressed bytes as content.',
        'Archive expansion capped at 100 MB and 1,000 entries; unsafe paths are rejected.',
      ],
    );
  const archiver = await detectArchiver();
  if (archiver.available)
    for (const source of ['zip', '7z', 'tar'])
      for (const target of ['zip', '7z', 'tar'])
        if (source !== target)
          add(
            source,
            target,
            '7-Zip',
            target === 'tar' ? [] : [number('compression', 'Compression level', 5, 0, 9)],
            [
              'Repackages regular files and folders; timestamps and permissions are not preserved.',
              'Up to 100 MB expanded and 1,000 entries. Encrypted, unsafe paths, links and special entries are rejected.',
            ],
          );
  const media = await detectMedia();
  if (media.available) {
    for (const source of audioFormats)
      for (const target of audioFormats)
        if (source !== target && media.encoders.includes(target))
          add(
            source,
            target,
            'FFmpeg',
            [
              ...trim,
              ...(['mp3', 'ogg', 'm4a'].includes(target)
                ? [number('audioBitrate', 'Audio bitrate (kbps)', 192, 32, 320)]
                : []),
            ],
            ['Re-encoded audio; metadata removed. Input duration limited to two hours.'],
          );
    for (const source of videoFormats)
      for (const target of ['mp4', 'webm', 'mov', 'mkv', 'gif', ...audioFormats])
        if (source !== target && media.encoders.includes(target))
          add(
            source,
            target,
            'FFmpeg',
            [
              ...trim,
              ...(['mp4', 'webm', 'mov', 'mkv'].includes(target)
                ? [
                    width,
                    number(
                      'crf',
                      'Video quality (lower is better)',
                      target === 'webm' ? 30 : 23,
                      0,
                      51,
                    ),
                  ]
                : target === 'gif'
                  ? [
                      number('width', 'Width (pixels)', 480, 16, 1920),
                      number('fps', 'Frames per second', 10, 1, 30),
                    ]
                  : ['mp3', 'ogg', 'm4a'].includes(target)
                    ? [number('audioBitrate', 'Audio bitrate (kbps)', 192, 32, 320)]
                    : []),
            ],
            [
              'Only first video/audio streams; media is re-encoded, metadata removed.',
              'Audio extraction requires an audio track. GIF has no audio.',
              'Input duration limited to two hours; MP4/MOV/MKV use H.264/AAC, WebM uses VP9/Opus.',
            ],
          );
  }
  return {
    formats: formats.filter((f) => pairs.some((p) => p.source === f.id || p.target === f.id)),
    pairs,
    tools: everydayTools,
    dependencies: [
      { name: '7-Zip', available: archiver.available, version: archiver.version },
      { name: 'Sharp / libvips', available: true, version: sharp.versions.sharp },
      { name: 'PDF.js / PDFKit / pdf-lib', available: true },
      { name: 'FFmpeg / FFprobe', available: media.available, version: media.version },
      ...toolboxDependencies,
    ],
  };
}
