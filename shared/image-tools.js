const raster = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tiff', 'bmp'];

const select = (key, label, options, value) => ({
  key,
  label,
  type: 'select',
  options: options.map((x) => (Array.isArray(x) ? x : [x, x.toUpperCase()])),
  default: value,
});

const num = (key, label, value, min, max) => ({
  key,
  label,
  type: 'number',
  default: value,
  min,
  max,
});

const flag = (key, label, value = false) => ({ key, label, type: 'checkbox', default: value });

const color = (key, label, value) => ({ key, label, type: 'color', default: value });

const text = (key, label, value, maxLength = 300) => ({
  key,
  label,
  type: 'text',
  default: value,
  maxLength,
});

const format = (formats = ['png', 'jpg', 'webp'], value = 'png') =>
  select('format', 'Output format', formats, value);

const outcomes = {
  'heic-converter': 'Convert still HEIC and HEIF photos to JPG, PNG or WebP.',

  'bmp-converter': 'Convert BMP images to common formats, or create a real BMP.',

  'icon-favicon': 'Create a multi-size ICO, extract ICO to PNG, or download a favicon ZIP.',

  'jfif-converter': 'Decode JPEG content saved as JFIF and export JPG or PNG.',

  'jxl-converter': 'Decode a still JPEG XL image to JPG, PNG or WebP.',

  'raw-converter': 'Develop supported camera RAW files using camera white balance and sRGB.',

  'image-vectorize': 'Trace raster colours or silhouettes into editable SVG paths.',

  'resize-print-image': 'Resize to a physical print size in mm, cm or inches at your chosen DPI.',

  'passport-signature':
    'Create an exact-size photo or signature with print DPI and an optional KB target.',

  'image-watermark': 'Composite a text label or uploaded logo over your photo.',

  'image-collage': 'Arrange ordered images into a spaced grid or single row.',

  'image-dpi': 'Inspect print resolution, change DPI metadata, or resample printed dimensions.',

  'image-metadata':
    'Export image properties and EXIF as JSON, or remove metadata from a new image.',

  'remove-background': 'Use a local segmentation model to create a transparent PNG cutout.',

  'photo-background': 'Segment the subject and blur, recolour or replace the photo background.',

  'ai-upscale': 'Run local neural super-resolution at 2× or 4× with optional denoising.',

  'scan-cleanup': 'Correct page perspective and skew, then clean scan contrast or threshold text.',

  'psd-export':
    'Export a cached Photoshop composite or download raster layers with their positions.',

  'svg-optimize': 'Minify a self-contained SVG while retaining accessibility, viewBox and IDs.',

  'svg-sprite': 'Combine SVG icons into reusable symbols with isolated internal IDs.',
};

const make = (id, family, title, accept, fields, extra = {}) => ({
  id,
  family: [family],
  title,
  category: 'image',
  icon: 'images',
  summary: outcomes[id],
  intro: outcomes[id],
  action: 'Create output',
  accept,
  multiple: false,
  minFiles: 1,
  engine: 'image',
  defaults: Object.fromEntries(fields.map((f) => [f.key, f.default])),
  fields,
  guide: 'Upload a supported file, adjust the settings and create the output.',
  note: 'Still images only; maximum 40 million decoded pixels.',
  ...extra,
});

export const imageTools = [
  make('heic-converter', 1, 'HEIC / HEIF converter', ['heic', 'heif'], [format()]),

  make(
    'bmp-converter',
    2,
    'BMP converter',
    [...raster],
    [format(['bmp', 'png', 'jpg', 'webp'], 'bmp')],
  ),

  make(
    'icon-favicon',
    3,
    'ICO and favicon pack',
    [...raster, 'ico'],
    [
      select(
        'mode',
        'Export',
        [
          ['ico', 'Multi-size ICO'],
          ['png', 'ICO to PNG'],
          ['pack', 'Favicon ZIP'],
        ],
        'ico',
      ),
      num('size', 'PNG size (px)', 256, 16, 512),
    ],
    {
      category: 'design',
      note: 'ICO includes 16, 32, 48, 64 and 256 px images. Pack also includes 180, 192 and 512 px PNGs.',
    },
  ),

  make(
    'jfif-converter',
    4,
    'JFIF converter',
    ['jfif', 'jpg', 'jpeg'],
    [format(['jpg', 'png'], 'jpg')],
  ),

  make('jxl-converter', 5, 'JPEG XL converter', ['jxl'], [format()], {
    note: 'Still JPEG XL only. Animated inputs are rejected.',
  }),

  make(
    'raw-converter',
    6,
    'Camera RAW converter',
    ['cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2', 'pef'],
    [format(['jpg', 'png'], 'jpg')],
    {
      note: 'LibRaw supported uncompressed camera files; uses camera white balance and sRGB. Unsupported camera variants fail explicitly.',
    },
  ),

  make(
    'image-vectorize',
    7,
    'Raster to SVG vectorizer',
    raster,
    [
      select(
        'colorMode',
        'Trace colours',
        [
          ['color', 'Colour'],
          ['binary', 'Black and white'],
        ],
        'color',
      ),
      num('detail', 'Colour precision', 6, 1, 8),
      num('speckle', 'Remove speckles (px)', 4, 0, 100),
    ],
    {
      category: 'vector',
      note: 'Creates traced paths, not an embedded bitmap. Input is limited to 4 million pixels for tracing.',
    },
  ),

  make(
    'resize-print-image',
    9,
    'Resize in centimetres, millimetres or inches',
    raster,
    [
      { ...num('width', 'Print width', 25.4, 0.1, 10000), step: 0.1 },
      { ...num('height', 'Print height', 25.4, 0.1, 10000), step: 0.1 },
      select(
        'unit',
        'Dimensions unit',
        [
          ['mm', 'Millimetres'],
          ['cm', 'Centimetres'],
          ['in', 'Inches'],
        ],
        'mm',
      ),
      num('dpi', 'Print DPI', 300, 1, 2400),
      select(
        'fit',
        'Image fit',
        [
          ['cover', 'Centre crop'],
          ['contain', 'Pad to fit'],
          ['fill', 'Stretch'],
        ],
        'contain',
      ),
      color('background', 'Padding colour', '#ffffff'),
      format(['png', 'jpg']),
    ],
    {
      note: 'Physical dimensions are converted to pixels at the selected DPI, rounded to whole pixels. Maximum 40 million output pixels.',
    },
  ),

  make(
    'passport-signature',
    11,
    'Passport photo / signature resizer',
    raster,
    [
      num('width', 'Width (px)', 413, 1, 4096),
      num('height', 'Height (px)', 531, 1, 4096),
      num('dpi', 'Print DPI', 300, 72, 1200),
      select(
        'fit',
        'Fit',
        [
          ['cover', 'Centre crop'],
          ['contain', 'Pad to fit'],
        ],
        'cover',
      ),
      format(['jpg', 'png'], 'jpg'),
      num('targetKB', 'Target KB (0 = no target)', 0, 0, 10240),
    ],
    {
      note: 'Editable dimensions do not guarantee acceptance by an issuing authority. Target-size success is reported honestly.',
    },
  ),

  make(
    'image-watermark',
    12,
    'Text or logo watermark',
    raster,
    [
      select(
        'mode',
        'Watermark',
        [
          ['text', 'Text'],
          ['logo', 'Second image as logo'],
        ],
        'text',
      ),
      text('text', 'Watermark text', 'Local Converter', 200),
      num('fontSize', 'Font size (px)', 36, 8, 300),
      num('opacity', 'Opacity (%)', 50, 1, 100),
      select(
        'position',
        'Position',
        [
          ['bottom-right', 'Bottom right'],
          ['bottom-left', 'Bottom left'],
          ['top-right', 'Top right'],
          ['top-left', 'Top left'],
          ['center', 'Centre'],
        ],
        'bottom-right',
      ),
      color('color', 'Text colour', '#ffffff'),
      num('logoWidth', 'Logo width (%)', 25, 1, 90),
      format(),
    ],
    {
      multiple: true,
      note: 'Text mode uses one image. Logo mode requires exactly two: photo first, logo second.',
    },
  ),

  make(
    'image-collage',
    13,
    'Join images / collage',
    raster,
    [
      num('columns', 'Columns', 2, 1, 10),
      num('cellWidth', 'Cell width (px)', 600, 1, 4096),
      num('cellHeight', 'Cell height (px)', 600, 1, 4096),
      num('gap', 'Spacing (px)', 16, 0, 300),
      color('background', 'Background', '#ffffff'),
      format(),
    ],
    {
      multiple: true,
      minFiles: 2,
      note: 'Images are placed in upload order, from left to right. Maximum 20 inputs and 40 million output pixels.',
    },
  ),

  make(
    'image-dpi',
    14,
    'DPI checker and converter',
    raster,
    [
      select(
        'mode',
        'Action',
        [
          ['write', 'Write DPI'],
          ['check', 'Inspect DPI'],
        ],
        'write',
      ),
      num('dpi', 'Output DPI', 300, 1, 2400),
      flag('resample', 'Resample to preserve printed size'),
      format(['png', 'jpg']),
    ],
    {
      note: 'Changing DPI alone changes print metadata, without adding image detail. Missing input DPI is treated as 72 when resampling.',
    },
  ),

  make(
    'image-metadata',
    15,
    'View / remove image metadata',
    raster,
    [
      select(
        'mode',
        'Action',
        [
          ['view', 'Metadata JSON'],
          ['remove', 'Strip metadata'],
        ],
        'view',
      ),
      format(),
    ],
    {
      note: 'Metadata JSON includes image properties, EXIF values, ICC presence and GPS if present. Strip mode re-encodes pixels without metadata.',
    },
  ),

  make(
    'remove-background',
    37,
    'Remove background',
    raster,
    [num('threshold', 'Mask cutoff (0 = soft)', 0, 0, 254)],
    {
      note: 'Local U²-Net small segmentation model. Fine hair and low-contrast subjects may require further editing. Transparent PNG output.',
    },
  ),

  make(
    'photo-background',
    38,
    'Blur / replace photo background',
    raster,
    [
      select(
        'mode',
        'Background',
        [
          ['blur', 'Blur original'],
          ['color', 'Solid colour'],
          ['image', 'Second image as background'],
        ],
        'blur',
      ),
      num('blur', 'Blur radius', 20, 1, 100),
      color('background', 'Background colour', '#ffffff'),
      num('threshold', 'Mask cutoff (0 = soft)', 0, 0, 254),
    ],
    {
      multiple: true,
      note: 'Image replacement requires two files: subject first, background second. Local segmentation may leave edge artefacts.',
    },
  ),

  make(
    'ai-upscale',
    39,
    'AI upscale and denoise',
    raster,
    [
      select(
        'scale',
        'Upscale factor',
        [
          [2, '2×'],
          [4, '4×'],
        ],
        2,
      ),
      num('denoise', 'Denoise strength (0 = off)', 3, 0, 20),
      flag('enhance', 'Improve local contrast'),
    ],
    {
      note: 'Real FSRCNN neural super-resolution on CPU, with optional non-local-means denoising and CLAHE. Maximum 1 million input pixels and 16 million output pixels.',
    },
  ),

  make(
    'scan-cleanup',
    48,
    'Document scan cleanup',
    raster,
    [
      flag('perspective', 'Detect document and correct perspective', true),
      flag('deskew', 'Correct small skew', true),
      select(
        'mode',
        'Cleanup',
        [
          ['binary', 'Black and white'],
          ['gray', 'Clean grayscale'],
          ['color', 'Contrast enhanced colour'],
        ],
        'binary',
      ),
    ],
    {
      note: 'Automatic page detection works best with clear page borders. Review perspective and handwriting before use.',
    },
  ),

  make(
    'psd-export',
    53,
    'PSD / PSB preview and layers',
    ['psd', 'psb'],
    [
      select(
        'mode',
        'Export',
        [
          ['preview', 'Merged preview'],
          ['layers', 'Layer PNG ZIP'],
        ],
        'preview',
      ),
      format(['png', 'jpg'], 'png'),
    ],
    {
      category: 'design',
      note: 'Exports cached merged preview or up to 100 rasterized layers. Photoshop adjustment layers, fonts and effects can differ; text remains rasterized.',
    },
  ),

  make(
    'svg-optimize',
    54,
    'SVG optimizer',
    ['svg'],
    [flag('pretty', 'Readable formatting'), num('precision', 'Numeric precision', 3, 1, 8)],
    {
      category: 'vector',
      note: 'Self-contained SVGs only. Keeps viewBox, accessibility attributes and element IDs.',
    },
  ),

  make(
    'svg-sprite',
    55,
    'SVG icon sprite',
    ['svg'],
    [text('prefix', 'Symbol prefix', 'icon', 40)],
    {
      category: 'vector',
      multiple: true,
      minFiles: 1,
      note: 'Symbols use prefix-1, prefix-2, and so on. Internal IDs and references are namespaced for each icon.',
    },
  ),
];
