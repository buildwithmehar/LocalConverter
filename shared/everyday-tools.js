import { toolCopy } from './tool-copy.js';
import { imageTools } from './image-tools.js';

import { mediaTools } from './media-tools.js';

import { documentTools } from './document-tools.js';

import { dataTools } from './data-tools.js';
import { productivityTools } from './productivity-tools.js';
import { reportTools } from './report-tools.js';
import { applyToolUpgrades } from './tool-upgrades.js';

export const essentialTools = [
  {
    id: 'compress-image',
    title: 'Compress image',
    category: 'image',
    icon: 'compress',
    summary: 'Make an image fit your upload limit.',
    intro:
      'Choose a size in KB, compare the result and save a smaller copy. Your original stays unchanged.',
    action: 'Compress image',
    accept: ['jpg', 'png', 'webp', 'avif', 'tiff'],
    multiple: false,
    guide:
      'Set an upload limit, such as 100 KB. You can allow smaller dimensions when quality changes alone are not enough.',
    note: 'PNG compression can reduce the colour palette. A very small target may need smaller dimensions or a different format.',
  },

  {
    id: 'resize-image',
    title: 'Resize image',
    category: 'image',
    icon: 'resize',
    summary: 'Set the exact width and height you need.',
    intro:
      'Resize a photo or graphic to the dimensions your next app needs, with controls for fitting, padding and cropping.',
    action: 'Resize image',
    accept: ['jpg', 'png', 'webp', 'avif', 'tiff'],
    multiple: false,
    guide:
      'Enter dimensions in pixels. Fit and pad keeps the full image; fill and crop trims the edges to fill the same dimensions.',
    note: 'Upscaling adds pixels; it does not recover detail that was missing from the original.',
  },

  {
    id: 'crop-image',
    title: 'Crop & rotate image',
    category: 'image',
    icon: 'crop',
    summary: 'Keep the part that matters.',
    intro:
      'Draw a crop on your image or enter precise pixel values, then rotate or flip the selected area.',
    action: 'Save cropped image',
    accept: ['jpg', 'png', 'webp', 'avif', 'tiff'],
    multiple: false,
    guide:
      'Drag across the preview to select an area. Pixel coordinates offer the same controls with a keyboard. Rotation and flipping are applied after cropping.',
    note: 'The preview uses the image’s display orientation. Animated and multipage images are not supported by these still-image tools.',
  },

  {
    id: 'merge-pdf',
    title: 'Merge PDF',
    category: 'document',
    icon: 'merge',
    summary: 'Bring your documents into one PDF.',
    intro:
      'Combine PDF files in the order you choose. Add your documents, arrange them and download one file.',
    action: 'Merge PDFs',
    accept: ['pdf'],
    multiple: true,
    minFiles: 2,
    guide:
      'Add at least two PDFs. Move documents up or down to choose their order; pages inside each document keep their original order.',
    note: 'Up to 100 pages across the selected PDFs. Page content is copied; interactive forms, bookmarks and digital signatures may not carry over.',
  },

  {
    id: 'split-pdf',
    title: 'Split PDF',
    category: 'document',
    icon: 'split',
    summary: 'Save the pages you need.',
    intro: 'Extract selected pages into one PDF or download individual pages together in a ZIP.',
    action: 'Split PDF',
    accept: ['pdf'],
    multiple: false,
    guide:
      'Use page numbers and ranges, such as 1-3, 5. Choose one PDF to keep those pages together, or separate pages for a ZIP download.',
    note: 'Up to 100 input pages. Password-protected files need an unprotected copy. A ZIP contains separate PDF pages, not images.',
  },

  {
    id: 'images-to-pdf',
    title: 'Images to PDF',
    category: 'document',
    icon: 'images',
    summary: 'Turn selected images into one document.',
    intro:
      'Combine photos and screenshots into a single PDF, with one image per page and an order you control.',
    action: 'Create PDF',
    accept: ['jpg', 'png', 'webp', 'avif', 'tiff'],
    multiple: true,
    guide:
      'Add images and arrange them in reading order. Choose a paper size and margin; each image is fitted without stretching.',
    note: 'Up to 20 still images. Transparent areas use a white page background. Animated and multipage inputs need a still-image export.',
  },
];

for (const tool of essentialTools)
  tool.family = [
    {
      'compress-image': 8,
      'resize-image': 9,
      'crop-image': 10,
      'merge-pdf': 25,
      'split-pdf': 25,
      'images-to-pdf': 24,
    }[tool.id],
  ];
export const everydayTools = [
  ...essentialTools,
  ...imageTools,
  ...mediaTools,
  ...documentTools,
  ...dataTools,
  ...productivityTools,
  ...reportTools,
];
applyToolUpgrades(everydayTools);

for (const tool of everydayTools)
  if (toolCopy[tool.id]) {
    tool.summary = toolCopy[tool.id];
    tool.intro = toolCopy[tool.id] + ' Choose your settings below and save a new copy.';
  }
export const toolById = (id) => everydayTools.find((tool) => tool.id === id);

export const sourceFromName = (name) => {
  const filename = String(name).toLowerCase();

  for (const compound of ['tar.gz', 'tar.bz2', 'tar.xz'])
    if (filename.endsWith('.' + compound)) return compound;

  const ext = filename.split('.').pop();

  return { jpeg: 'jpg', tif: 'tiff' }[ext] || (/^[a-z0-9]{1,16}$/.test(ext) ? ext : 'bin');
};

export const toolDefaults = (id) =>
  ({
    'compress-image': { targetKB: 100, output: 'jpg', allowResize: true },

    'resize-image': {
      width: 1200,
      height: 800,
      fit: 'contain',
      output: 'png',
      background: 'white',
    },

    'crop-image': {
      left: 0,
      top: 0,
      width: 1,
      height: 1,
      rotate: 0,
      flip: false,
      flop: false,
      output: 'png',
    },

    'merge-pdf': {},
    'split-pdf': { pages: '', mode: 'extract' },
    'images-to-pdf': { paper: 'a4', margin: 24 },
  })[id] ||
  toolById(id)?.defaults ||
  {};
