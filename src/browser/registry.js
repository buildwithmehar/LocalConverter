import base from './format-registry.json' with { type: 'json' };
import { everydayTools } from '../../shared/everyday-tools.js';

export const browserUnavailable = {};
export const browserDefaults = {};
export const browserNotes = {
  'psd-export':
    'PSD composite and layer exports are supported. PSB is not supported by the browser decoder.',
  'scan-cleanup':
    'Browser cleanup uses page-edge perspective correction, text-line deskew and local thresholding. Review page boundaries and small text after processing.',
  'pdf-tables':
    'Browser table extraction uses selectable text and detected page grid lines. Merged cells and irregular layouts need review.',
  'archive-browser':
    'ZIP, TAR and gzip archives are supported. RAR, 7Z, BZ2 and XZ codecs are not included in this browser build.',
  'create-archive': 'Browser archive output supports ZIP, TAR and TAR.GZ.',
  'repack-tar': 'Browser repacking supports TAR and TAR.GZ.',
  'convert-ebook':
    'Browser conversion supports unprotected EPUB to EPUB or TXT; MOBI/AZW3 and ebook page rendering are unavailable.',
  'render-html':
    'Uploaded HTML and CSS render to a viewport image. Scripts, images, external URLs, fonts, frames and forms are omitted. CSS support is limited; PDF output is a raster image.',
  'transcribe-media':
    'The first use downloads the local Whisper tiny model. Speech stays on your device; generated words and timings need review.',
  'office-render':
    'Browser Office conversion reflows extracted text and cached cell values into pages. Charts, images, drawings, macros and original page layout are omitted. PDF output contains page images.',
  'ai-upscale':
    'Browser super-resolution uses a trained 3× sub-pixel CNN on luminance, then resamples to the requested 2× or 4× size. Denoise and contrast use local image filters, not the desktop FSRCNN/NLM/CLAHE algorithms.',
  'raw-converter':
    'Camera support depends on bundled LibRaw. RAW decoding requires a compatible browser with cross-origin isolation and SharedArrayBuffer.',
  'jxl-converter':
    'JPEG XL is decoded to still-image pixels. Animation and advanced HDR metadata are not preserved.',
};
function browserTool(tool) {
  const accept = {
    'psd-export': ['psd'],
    'convert-ebook': ['epub'],
    'archive-browser': ['zip', 'tar', 'gz', 'tar.gz'],
    'repack-tar': ['tar', 'tar.gz'],
  };
  const output = {
    'convert-ebook': ['epub', 'txt'],
    'create-archive': ['zip', 'tar', 'tar.gz'],
    'repack-tar': ['tar', 'tar.gz'],
  };
  return {
    ...tool,
    ...(accept[tool.id] ? { accept: accept[tool.id] } : {}),
    fields: tool.fields?.map((field) =>
      field.key === 'format' && output[tool.id]
        ? { ...field, options: field.options.filter(([value]) => output[tool.id].includes(value)) }
        : field,
    ),
    browserUnavailable: browserUnavailable[tool.id] || null,
    browserDefaults: browserDefaults[tool.id],
    browserNote: browserNotes[tool.id],
  };
}
export function browserRegistry() {
  const formats = base.formats.filter((format) => format.id !== '7z');
  const pairs = base.pairs
    .filter((pair) => pair.source !== '7z' && pair.target !== '7z')
    .map((pair) => ({
      ...pair,
      engine: 'Browser',
      limitations: [
        ...pair.limitations.filter(
          (text) => !/(?:installed|local server|7-Zip|FFmpeg)/i.test(text),
        ),
        'Processing runs in this browser. Large files may exceed your device memory; save results before reloading.',
      ],
    }));
  return {
    mode: 'browser',
    formats,
    pairs,
    tools: everydayTools.map(browserTool),
    dependencies: [{ name: 'Browser conversion engines', available: true }],
    limits: {
      maxBytes: 104857600,
      maxFiles: 20,
      maxOutputBytes: 209715200,
      maxTotalOutputBytes: 157286400,
      timeoutSeconds: 180,
      retentionMinutes: 30,
    },
  };
}
