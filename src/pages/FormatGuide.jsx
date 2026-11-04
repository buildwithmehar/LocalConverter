import React from 'react';
import { ArrowRight, Check, SlidersHorizontal } from 'lucide-react';
import { categoryIcons, categoryNames, upper } from '../lib/formats.js';
import { Link } from '../lib/navigation.jsx';

const families = {
  image: {
    title: 'Images: balance detail, size and transparency',
    text: 'Start with the way the image will be used. A photograph for an upload often suits JPEG; a logo or screenshot with transparent areas may need PNG or WebP. AVIF can be useful for delivery where the receiving app supports it. Changing the format changes how the image is stored, but it cannot recover detail already missing from the original.',
    check:
      'Check the dimensions, transparent edges and small text. Image conversions process the first frame or page and remove metadata.',
  },
  document: {
    title: 'Documents: decide between pages and text',
    text: 'A document can be a visual page, a body of text or both. PDF-to-image conversion renders pages, while PDF-to-text extracts selectable text. DOCX tools extract plain text or semantic HTML rather than recreating a Word document’s layout. Markdown, HTML and plain text can create a simple flowing PDF; they do not use a full browser or office layout renderer.',
    check:
      'Review reading order, headings and page breaks. Scanned text needs OCR, which is not included here.',
  },
  spreadsheet: {
    title: 'Spreadsheets: move the values you need',
    text: 'Use the table converters for a clean set of rows and columns. CSV and TSV work well when another app needs a simple text table; XLSX is useful when a workbook container is expected. The local tools read the first worksheet and require unique column names. They handle simple values, rather than preserving a complete spreadsheet with formulas, styling and date objects.',
    check:
      'Compare column names, row counts and representative values. Export a values-only sheet first if the workbook contains advanced cells.',
  },
  data: {
    title: 'Structured data: keep one record per row',
    text: 'JSON and YAML table conversion expects an array of flat records. Each record represents a row, and its fields become columns. Simple strings, numbers, booleans and null values are accepted; nested objects and arrays are outside this workflow. CSV and TSV fields are kept as strings, so an identifier such as 0012 is not deliberately turned into the number 12.',
    check:
      'Inspect field names, empty cells and value types before connecting the result to another application.',
  },
  audio: {
    title: 'Audio: choose for playback or editing',
    text: 'Choose a format accepted by the player or editor that will receive the file. MP3, AAC in M4A and Ogg Vorbis use lossy compression; WAV and AIFF are uncompressed, while FLAC stores decoded audio without further loss. Converting a lossy recording to a larger format will not bring back sound detail removed earlier. Supported media conversions use the locally installed FFmpeg tools.',
    check:
      'Listen to the start and end, check the duration, and use bitrate or trimming options only when they are available.',
  },
  video: {
    title: 'Video: consider the container and the sound',
    text: 'The filename extension identifies a container, but the video and audio inside it also need compatible codecs. Local MP4, MOV and MKV output uses H.264 video with AAC audio; WebM uses VP9 with Opus. The tools re-encode the first supported video and audio streams. Choosing an audio output saves the audio track without the picture, so the original must contain sound.',
    check:
      'Play the result in its intended app. Check framing, duration and audio before removing temporary copies.',
  },
  archive: {
    title: 'Archives: distinguish packing from conversion',
    text: 'ZIP, TAR and 7Z can hold files and folders, while GZIP compresses one stream of bytes. The available native archive tools determine which repacking pairs appear. ZIP-to-GZIP wraps the ZIP itself rather than turning each item into a separate file; GZIP-to-ZIP stores the decompressed content in an archive. Archive expansion is limited, and unsafe paths, encrypted entries and links may be rejected.',
    check:
      'Open the result and inspect its contents. Repacking does not preserve every permission, timestamp or archive feature.',
  },
  vector: {
    title: 'Vector graphics: choose the right pixel size',
    text: 'SVG describes shapes that can scale, but converting it to a raster image creates a fixed grid of pixels. Choose the output width for the place where the image will be used. A small raster copy can look soft when enlarged later, even if the SVG was sharp. The source must be self-contained; remote resources and unsupported SVG features can prevent the conversion.',
    check:
      'Review small details and transparent edges. Rasterising an SVG does not create an editable vector copy in the target format.',
  },
  subtitle: {
    title: 'Subtitles: preserve the words and timing',
    text: 'SRT and WebVTT store text cues with start and end times. Local conversion keeps the cue text and timestamps while changing the file structure for another player. Advanced styling, WebVTT notes and cue settings are omitted, so a visually elaborate subtitle track may look different in its new format. Converting subtitle files does not add them to, or burn them into, a video.',
    check:
      'Load the converted subtitles in the target player and check a few early and late cues against the media.',
  },
};
const scenarios = [
  {
    source: 'png',
    target: 'jpg',
    heading: 'Make a screenshot ready to upload',
    text: 'Use a JPEG copy when the receiving form accepts photographs or flat images and transparency is not required. If the screenshot has a transparent background, the JPEG result fills it with white. Start with the default settings, then reduce width or quality only if the destination needs a smaller file.',
  },
  {
    source: 'pdf',
    target: 'png',
    heading: 'Turn document pages into images',
    text: 'Choose PNG when you need to place a PDF page into a document or another visual workflow. Page number 0 renders all supported pages; a multi-page result arrives in a ZIP. Rendering scale changes the image dimensions and detail. This makes pictures of the pages, rather than an editable document.',
  },
  {
    source: 'mp4',
    target: 'mp3',
    heading: 'Keep the audio from a video',
    text: 'Choose an audio output for a recording you want to listen to in another player. The converter reads the first audio track and re-encodes it. Check that the video actually contains sound, and review the start, duration and bitrate options before converting a longer recording.',
  },
  {
    source: 'csv',
    target: 'json',
    heading: 'Move a table into structured records',
    text: 'Use this pair when a script or application expects JSON instead of comma-separated text. The first CSV row supplies unique field names, and each following row becomes a record. Values remain strings, so review numeric-looking fields and empty entries before using the result in another data pipeline.',
  },
];

export default function FormatGuide({ registry }) {
  const available = scenarios.filter((example) =>
    registry.pairs.some((pair) => pair.source === example.source && pair.target === example.target),
  );
  const categories = Object.keys(families).filter((id) =>
    registry.formats.some((format) => format.category === id),
  );
  return (
    <div className="reading-guides format-reading">
      <section aria-labelledby="format-decisions-heading">
        <div className="reading-heading" data-page-enter>
          <span className="home-eyebrow">Choose for the next step</span>
          <h2 id="format-decisions-heading">A format is a choice about the result.</h2>
          <p>
            Ask where the file is going next: a website, a document, a media player or another data
            tool. The most useful output is the one that fits that destination while keeping the
            parts of the original you need. Compatibility, file size and editable structure do not
            always point to the same format.
          </p>
        </div>
        <div className="reading-decision-strip">
          <SlidersHorizontal size={22} />
          <p>
            <strong>Source support and output support have a direction.</strong> A tool that writes
            a format may not read it, and a listed extension does not make every pair possible. The
            directory above is built from the conversions available in this local setup. Open a
            converter to see the options and limits for that exact pair.
          </p>
        </div>
        {available.length > 0 && (
          <div className="format-use-cases">
            {available.map((example) => (
              <article key={`${example.source}-${example.target}`}>
                <Link className="reading-pair" to={`/${example.source}-to-${example.target}`}>
                  {upper(example.source)}
                  <ArrowRight size={14} />
                  {upper(example.target)}
                  <ArrowRight size={16} />
                </Link>
                <h3>{example.heading}</h3>
                <p>{example.text}</p>
              </article>
            ))}
          </div>
        )}
      </section>
      <section aria-labelledby="format-families-heading">
        <div className="reading-heading" data-page-enter>
          <span className="home-eyebrow">Understand your file family</span>
          <h2 id="format-families-heading">What to keep. What may change.</h2>
          <p>
            Different tools preserve different parts of a file. Use these notes to set expectations
            before you choose an output, then read the converter’s own format notes for the details
            that apply to your file.
          </p>
        </div>
        <div className="format-family-guide">
          {categories.map((id) => {
            const Icon = categoryIcons[id],
              family = families[id];
            return (
              <article key={id}>
                <span className="reading-category">
                  <Icon size={18} />
                  {categoryNames[id]}
                </span>
                <h3>{family.title}</h3>
                <p>{family.text}</p>
                <p className="reading-check">
                  <Check size={16} />
                  <span>{family.check}</span>
                </p>
                <Link className="learning-text-link" to={`/${id}-converter`}>
                  Explore {categoryNames[id].toLowerCase()} <ArrowRight size={14} />
                </Link>
              </article>
            );
          })}
        </div>
      </section>
      <section className="reading-final-note" aria-labelledby="format-review-heading">
        <h2 id="format-review-heading">Keep the original until the result is checked.</h2>
        <p>
          Open the new file in the application that will use it. Look at a few representative pages,
          rows or frames, rather than relying only on the filename or the Finished label. Converting
          creates another copy; it does not change what the source originally contained. A new
          extension cannot repair damaged content, recover detail lost through compression or add
          features that the selected engine does not support.
        </p>
        <p>
          CAD, ebook and font conversion, full office or presentation rendering, DRM-protected
          content and most camera RAW formats are outside the current registry. A text-extraction
          route does not replace an office layout renderer. If the format or pair you need is not
          listed above, the app does not currently provide that conversion.
        </p>
        <div className="reading-links">
          <Link to="/how-it-works">
            Follow the conversion workflow <ArrowRight size={15} />
          </Link>
          <Link to="/help">
            Find help with a file <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </div>
  );
}
