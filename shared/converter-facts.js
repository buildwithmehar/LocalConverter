const descriptions = {
  png: 'Stores images without lossy compression and supports transparency. Commonly used for screenshots, logos and graphics.',
  jpg: 'Uses lossy compression to keep photographs compact. JPEG does not support transparent backgrounds.',
  webp: 'Supports both lossy and lossless images, including transparency. Often used to reduce image sizes on websites.',
  avif: 'Compresses images using AV1 encoding and supports transparency. Creating an AVIF can take longer than creating a JPEG.',
  gif: 'Stores images with a palette of up to 256 colors. Image-to-image conversions in this app use the first frame.',
  tiff: 'Stores high-detail images, often for scans and print work. This converter processes the first page.',
  svg: 'Describes images as vector shapes and paths. Raster conversion renders those shapes into pixels; the SVG must be self-contained.',
  pdf: 'Preserves document pages in a portable format. Local tools can extract selectable text or render pages as images.',
  txt: 'Stores plain text without document styling. Useful for extracting words from a formatted document.',
  md: 'Stores text with Markdown formatting. Local tools can extract the text or create a simple PDF.',
  html: 'Stores structured document content. Local conversion uses semantic text rather than reproducing a full browser layout.',
  docx: 'Stores Word documents. Local tools extract text or semantic HTML; exact layout, styling and embedded images are omitted.',
  csv: 'Stores table rows as comma-separated text. The converter requires unique column names and reads field values as strings.',
  tsv: 'Stores table rows as tab-separated text. Useful for transferring simple tables between applications.',
  xlsx: 'Stores Excel workbooks. Local conversion reads the first worksheet and handles simple tabular values.',
  json: 'Stores structured data as text. Table conversion requires an array of flat records with consistent fields.',
  yaml: 'Stores structured data in a readable text format. Table conversion requires an array of flat records.',
  mp3: 'Uses lossy audio compression for smaller files and broad compatibility. The selected bitrate affects size and sound quality.',
  wav: 'Stores uncompressed audio for editing and playback compatibility. Files are usually larger than compressed audio.',
  flac: 'Compresses audio without further loss of decoded sound data. It cannot restore detail already removed from a lossy source.',
  ogg: 'Stores compressed audio in an Ogg container. Local output uses Vorbis encoding.',
  m4a: 'Stores compressed audio in an MPEG-4 container. Local output uses AAC encoding.',
  aiff: 'Stores uncompressed audio, commonly used in audio production. Expect larger files than with lossy compression.',
  mp4: 'Stores video and audio in a widely supported container. Local output uses H.264 video and AAC audio.',
  webm: 'Stores video and audio for web playback. Local output uses VP9 video and Opus audio.',
  mov: 'Stores video and audio in a QuickTime container. Local output uses H.264 video and AAC audio.',
  mkv: 'Stores video and audio in a Matroska container. Local output uses H.264 video and AAC audio.',
  zip: 'Packages files in a widely supported archive. Local tools check file paths and enforce expansion limits.',
  '7z': 'Packages files in a 7-Zip archive. Local repacking supports regular files and folders, without preserving permissions or timestamps.',
  tar: 'Packages files and folders in a single archive. TAR output is uncompressed; permissions and timestamps are not preserved.',
  gz: 'Compresses a single stream of data using GZIP. Converting a ZIP to GZIP compresses the archive itself without extracting its contents.',
  srt: 'Stores subtitle cues with numbered entries and timestamps. Conversion preserves cue text and timing, but omits advanced styling.',
  vtt: 'Stores WebVTT subtitles for media playback. Conversion preserves cue text and timing, but omits notes and advanced styling.',
};

export const formatDescription = (format) =>
  descriptions[format.id] ||
  `${format.label} files can be converted using the tools installed on this computer.`;

export function converterIntro(pair) {
  const source = pair.source.toUpperCase(),
    target = pair.target.toUpperCase();
  return pair.source === pair.target
    ? `Resize or optimize ${source} images on this computer, then save a new copy.`
    : `Convert ${source} to ${target} on this computer. Adjust the output settings, then download your files.`;
}

export function settingDescription(option) {
  const descriptions = {
    width:
      option.min === 0
        ? 'Set the output width in pixels. Use 0 to keep the original width; proportions are retained.'
        : `Set the output width in pixels, from ${option.min} to ${option.max}. Proportions are retained.`,
    quality:
      'Choose a value from 1 to 100. Higher values keep more detail and may produce larger files.',
    page: 'Choose a page number, or use 0 to render every page. Multiple pages are delivered in a ZIP file.',
    scale: 'Choose the rendering scale. Higher values produce larger, more detailed page images.',
    start: 'Set where the conversion begins, measured in seconds from the start of the file.',
    duration: 'Set how many seconds to convert. Use 0 to include the rest of the file.',
    audioBitrate:
      'Set the audio bitrate in kbps. Higher values usually increase sound quality and file size.',
    crf: 'Set video compression quality. Lower values keep more detail and usually produce larger files.',
    compression: 'Set the archive compression level. Higher values may take longer to process.',
    fps: 'Set the number of frames per second in the output animation.',
  };
  return (
    descriptions[option.key] ||
    option.description ||
    'Apply this setting from Options beside the selected file.'
  );
}

export function conversionQuestion(pair, registry) {
  const category = registry.formats.find((format) => format.id === pair.source)?.category;
  if (pair.source === 'pdf' && ['png', 'jpg'].includes(pair.target))
    return [
      'Can I convert every PDF page?',
      'Yes. In Options, set Page number to 0 to render every page. Multiple page images are packaged in a ZIP. The converter accepts up to 100 pages.',
    ];
  if (category === 'image' || category === 'vector') {
    if (pair.target === 'jpg')
      return [
        'What happens to a transparent background?',
        'JPEG does not support transparency. This converter fills transparent areas with white.',
      ];
    if (pair.target === 'png')
      return [
        'Will converting to PNG improve image quality?',
        'PNG stores the decoded image without further lossy compression. It cannot recover detail already removed from the source image.',
      ];
    return [
      'Are all frames and metadata preserved?',
      'Image conversion processes the first frame or page and removes metadata. Check the format limits above before converting an animated or multi-page image.',
    ];
  }
  if (
    category === 'video' &&
    registry.formats.find((format) => format.id === pair.target)?.category === 'audio'
  )
    return [
      'Can I extract audio from any video?',
      'The video must contain an audio track. Local conversion extracts and re-encodes that track into the selected audio format.',
    ];
  if (category === 'audio')
    return [
      'Will this restore quality lost in the original?',
      'No. Converting changes the encoding, but cannot recover sound detail removed by an earlier lossy conversion.',
    ];
  if (['data', 'spreadsheet'].includes(category))
    return [
      'Will spreadsheet formatting and formulas be kept?',
      'No. This converter transfers simple table values from the first worksheet. Styles, formulas and nested data are not supported.',
    ];
  if (category === 'archive')
    return [
      'Are all archive features preserved?',
      'Archive conversions depend on the selected formats. Review the format limits for handling of folders, timestamps, permissions and compressed contents.',
    ];
  return [
    'Will the output look exactly like the original?',
    'That depends on the source and output formats. Review the format limits above for details about layout, styling and content that may change.',
  ];
}
