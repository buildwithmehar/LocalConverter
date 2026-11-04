import { formatDescription, settingDescription, conversionQuestion } from './converter-facts.js';
const upper = (value) => value.toUpperCase();
const profile = (pair, source, target) => {
  const from = upper(pair.source),
    to = upper(pair.target),
    key = `${from} to ${to}`;
  if (pair.target === 'txt' && ['md', 'html', 'docx'].includes(pair.source))
    return {
      lead: `Extract readable content from ${from} into a plain-text TXT file. ${pair.source === 'md' ? 'Markdown is parsed and its formatting markers are removed.' : pair.source === 'html' ? 'HTML markup is removed; embedded scripts and styles are not part of the extracted words.' : 'DOCX text extraction reads document wording without reproducing Word page layout.'} Use this route to reuse or compare the wording in a text editor, rather than preserve typography, pictures or interactive features.`,
      useCases: [
        'Read document wording in an editor that accepts plain text.',
        'Compare a document revision without markup or page styling.',
        'Prepare a text-only copy for a search or data-cleaning workflow.',
      ],
      example: {
        title: 'Check wording and paragraph boundaries',
        text: `Start with a short ${from} document containing a heading, two paragraphs and a list. Convert it to TXT and open the result in a text editor. Check that the wording is present in the intended order. Markup, visual styling and embedded images are not retained as editable document features; line breaks can differ from the source.`,
      },
      review:
        'Compare the words, punctuation, character encoding and reading order with the original. Plain text has no fonts, page layout or interactive links. Complex tables, images and visual spacing need separate review; keep the editable source when presentation matters.',
    };
  if (pair.source === 'pdf')
    return {
      lead:
        pair.target === 'txt'
          ? `Extract selectable words from a PDF into a plain-text file. ${key} is useful when you need to search, quote or edit the document's text without carrying page styling into your next app. This route reads an existing text layer; a photographed or scanned page needs the separate OCR tool first.`
          : `Render PDF pages as ${to} images for presentations, previews or an upload form that accepts pictures. Each selected page becomes a raster image, so its visible page layout is retained while links, forms and selectable text become pixels. You can choose one page or export every page together in a ZIP.`,
      useCases:
        pair.target === 'txt'
          ? [
              'Copy the wording of a text-based report into an editor.',
              'Search extracted text without page layout getting in the way.',
              'Prepare readable document text for another local workflow.',
            ]
          : [
              'Add a document page to a slide deck as an image.',
              'Create page previews for a report or document catalogue.',
              'Export individual pages for an image-only upload workflow.',
            ],
      example: {
        title:
          pair.target === 'txt'
            ? 'From a report to editable words'
            : 'Export the page you actually need',
        text:
          pair.target === 'txt'
            ? 'Start with a PDF whose words can be selected in a reader. Convert it to TXT, then compare a paragraph with the original. A multicolumn layout can change reading order; review names, numbers and headings before reusing the extracted text.'
            : `For a three-page document, open Options and choose page 2 to save a single ${to} image. Choose page 0 to render all three pages into one ZIP. Increase scale only when you need more pixels; rendered pages still have image and total-pixel limits.`,
      },
      review:
        pair.target === 'txt'
          ? 'Check reading order, punctuation and the presence of all expected paragraphs. This operation does not recognize words inside scanned images.'
          : 'Open the exported page at full size and check small labels and page orientation. Higher rendering scale increases dimensions and memory use, not the source document’s original detail.',
    };
  if (['data', 'spreadsheet'].includes(source.category))
    return {
      lead: `Transfer a simple table from ${from} into ${to} for the next part of your workflow. This converter moves row values and column names rather than reproducing a styled workbook. ${pair.source === 'xlsx' ? 'Only the first worksheet is read.' : 'Use unique, nonempty column names.'} JSON and YAML table inputs must be arrays of flat records, not nested application configuration.`,
      useCases: [
        `Move ${from} table values into a ${to}-based workflow.`,
        pair.target === 'xlsx'
          ? 'Open plain table data in a spreadsheet workbook.'
          : 'Export records in a format another data tool can read.',
        'Keep a portable copy of a small, well-formed table.',
      ],
      example: {
        title: 'Check a small table before converting a batch',
        text: `Try a table with Name, Code and Quantity columns and two representative rows. Convert ${from} to ${to}, then confirm that the column names, record count and codes are intact. CSV/TSV fields remain strings; a spreadsheet app may apply its own type or formula interpretation when opening an export.`,
      },
      review:
        'Compare row and column counts, leading zeros and non-ASCII characters. Formula cells, dates represented as spreadsheet objects, rich text and nested records are outside this table converter. Use the dedicated structured-data tool for nested JSON, XML, TOML or YAML.',
    };
  if (pair.source === 'txt' && ['zip', 'gz'].includes(pair.target))
    return {
      lead: `Package a plain-text file as ${to} without changing its text bytes. ${pair.target === 'zip' ? 'This route creates a ZIP with one member named content.txt.' : 'This route creates a GZIP stream containing the original text.'} It is a single-file packaging operation, not document conversion or a multi-file archive builder. Use Create an archive when you need to choose several files and preserve their names.`,
      useCases: [
        `Make a ${to} delivery copy of one text file.`,
        'Keep the source text while preparing a compressed attachment.',
        'Package a simple text export without rewriting its contents.',
      ],
      example: {
        title: 'Package a text export',
        text: `Start with notes.txt and convert it to ${to}. ${pair.target === 'zip' ? 'Open the ZIP and check content.txt against the source; the member name is fixed for this route.' : 'Decompress the GZIP stream and compare the recovered text with the source.'} Text compression can help repetitive content, but a very short file may grow because of container overhead.`,
      },
      review:
        'Compare the decompressed bytes or text with the original. This route packages one input per result, does not combine selections into a single archive, and does not imply that the output must be smaller.',
    };
  if (source.category === 'archive')
    return {
      lead:
        pair.target === 'gz'
          ? `Compress the ${from} container itself into a GZIP stream. This ${key} operation wraps the complete archive bytes; it does not unpack its members or turn each member into a separate file. Keep that distinction in mind when another app asks for an extracted document rather than a compressed archive.`
          : pair.source === 'gz'
            ? `Decompress the GZIP stream and package those bytes inside a ZIP as content. GZIP represents one stream rather than a directory tree, so this route does not infer the original filename or unpack a nested archive. The dedicated archive inspector provides a different workflow for examining and selecting archive members.`
            : `Repackage regular files and folders from ${from} into ${to}. The converter checks member paths and expanded size before building a new archive, keeping the file contents and folder structure. It deliberately does not carry over timestamps, permissions, encryption, links or special filesystem entries.`,
      useCases: [
        `Prepare a ${to} container for an app that does not accept ${from}.`,
        'Create a fresh archive copy while keeping the original untouched.',
        'Move regular file contents through a bounded local archive workflow.',
      ],
      example: {
        title: 'Confirm the container and its contents',
        text:
          pair.target === 'gz'
            ? `If you start with photos.zip, the GZIP output contains the original ZIP bytes. Un-gzipping it gives you the ZIP container again. If you need the photos themselves, use Inspect & unpack archive instead of treating this route as an extraction tool.`
            : `Start with an archive containing notes.txt and an images folder. Convert it, then open the new ${to} container with an archive reader and compare the member names and file contents. TAR output is uncompressed; another container is not guaranteed to make the same files smaller.`,
      },
      review:
        'Check the member list after repacking. Unsafe paths, duplicate names, links, special entries, corrupt checksums and expansion beyond the supported budget cause a failure rather than a partial successful download.',
    };
  if (source.category === 'audio' || source.category === 'video')
    return {
      lead:
        target.category === 'audio' && source.category === 'video'
          ? `Save the first audio track of a ${from} video as ${to}. This route is useful when you need a recording without its picture, such as a voice track for listening or editing. The video must already contain audio; the converter cannot generate speech or restore a missing soundtrack.`
          : pair.target === 'gif'
            ? `Turn a selected moment from a ${from} video into a GIF for a short visual demonstration. Set a start time, duration, width and frame rate to control how much motion is exported. GIF has a limited colour palette and carries no audio, so it serves a different purpose from the original video.`
            : `Re-encode ${from} media as ${to} using the installed local encoder. Choose a compatible container for your player or editor, and trim the source when you only need a specific passage. Re-encoding can change quality and size; switching extensions cannot recover detail already missing from the recording.`,
      useCases: [
        target.category === 'audio' && source.category === 'video'
          ? 'Listen to or edit a video’s existing sound without the picture.'
          : `Make a ${to} copy for a player or editor that needs this format.`,
        'Export a selected passage rather than the entire recording.',
        pair.target === 'gif'
          ? 'Create a short silent demonstration for a document or message.'
          : 'Keep the source while preparing a separate delivery copy.',
      ],
      example: {
        title: 'Start with one representative passage',
        text: `For a recording longer than 20 seconds, set Start to 5 and Duration to 10 to export the passage from second 5 to second 15. ${pair.options.some((o) => o.key === 'audioBitrate') ? 'Try the default bitrate first, then compare clarity and file size before reducing it.' : pair.target === 'gif' ? 'Try a moderate width and frame rate before exporting a longer animation.' : 'Review the default output before changing quality or dimensions.'} Use Duration 0 when you want the remaining recording.`,
      },
      review:
        'Play the saved file in the app you intend to use. Check the beginning and end, orientation, audio/video synchronisation and whether the required track is present. Only the first supported streams are used and metadata is removed. Inputs can be up to two hours; processing still has a job deadline.',
    };
  if (source.category === 'subtitle')
    return {
      lead: `Convert ${from} subtitle cues to ${to} while keeping their text and time ranges. This route is useful when a video player or publishing workflow expects a different subtitle file extension. It transfers basic cues rather than every styling, positioning or annotation feature of the original format.`,
      useCases: [
        `Prepare ${to} captions for a compatible video player.`,
        'Keep a separate timed-text copy beside your original subtitle file.',
        'Move basic subtitle cues between media workflows.',
      ],
      example: {
        title: 'Verify a cue near the start and the end',
        text: `Convert a UTF-8 ${from} file with several cues, then load the ${to} result beside the matching video. Check an early cue and a late cue to confirm timing. This route does not shift timestamps; use the dedicated subtitle tool when the entire caption track needs an offset.`,
      },
      review:
        'Compare cue count, accented characters and timestamp boundaries. Styling, WebVTT notes and advanced cue settings are omitted. Use a player test rather than assuming that every renderer treats line breaks and positioning identically.',
    };
  if (['image', 'vector'].includes(source.category))
    return {
      lead:
        pair.target === 'pdf'
          ? `Place a ${from} image into its own PDF document for a workflow that requires a PDF attachment. This route creates one result for each input file. It does not combine a batch of images into one document; the dedicated Images to PDF tool handles page ordering and combined output.`
          : pair.source === pair.target
            ? `Create a new ${from} copy with supported resize and re-encoding settings. This ${from} optimisation route is useful when a picture has the right format but needs a different width or encoding quality. It does not promise a smaller file on every input; compare the actual result before replacing a delivery copy.`
            : `Convert a ${from} image into ${to} for an upload form, website or editing app that expects that format. The converter decodes the image and writes a new file rather than renaming the extension. ${pair.target === 'jpg' ? 'JPEG uses lossy compression and fills transparent areas with white.' : pair.source === 'svg' ? 'SVG shapes are rendered into pixels at the selected output width.' : 'The output retains only the features supported by the destination image format.'}`,
      useCases: [
        pair.target === 'pdf'
          ? 'Attach an individual picture as a PDF document.'
          : `Prepare a ${to} copy for a service that does not accept ${from}.`,
        'Set an output width while retaining the original source file.',
        pair.source === 'svg'
          ? 'Render a self-contained vector illustration as a raster image.'
          : 'Create a delivery copy with the settings your next app needs.',
      ],
      example: {
        title:
          pair.source === pair.target
            ? 'Make the dimensions fit your next use'
            : 'Choose settings for the destination',
        text: `Start with a 2400-pixel-wide ${from} image. ${pair.options.some((o) => o.key === 'width') ? 'Set Width to 1200 to create a narrower copy while retaining its proportions.' : 'Use the default output settings first.'} ${pair.options.some((o) => o.key === 'quality') ? 'Compare the default quality with a lower value if file size matters.' : 'Inspect the saved file before submitting or sharing it.'} ${pair.target === 'jpg' ? 'Check the white background if the source contained transparent areas.' : 'Keep the original if you may need another export later.'}`,
      },
      review:
        'Inspect small text, fine edges, orientation and transparency at the intended display size. Standard format-pair conversion uses the first frame or page and removes metadata. Use the dedicated animation tools for moving GIF/WebP/APNG, or metadata tools when inspection or removal is the specific task.',
    };
  return {
    lead: `Convert ${from} document content into ${to} for the next step in your work. This route uses ${pair.engine} and preserves the kind of content described in its format notes. ${pair.source === 'docx' ? 'Word conversion here extracts semantic content rather than reproducing page layout.' : 'PDF creation here uses simple text flow rather than a full CSS or Office layout renderer.'} Choose the dedicated Office or HTML rendering tool when visual page layout is the main requirement.`,
    useCases: [
      `Create a ${to} version of supported ${from} content.`,
      'Move readable text into an editor without keeping every visual feature.',
      'Keep an editable source alongside a separate delivery copy.',
    ],
    example: {
      title: 'Compare content as well as the file extension',
      text: `Convert a short ${from} document containing a heading, a paragraph and a list. Open the ${to} result and compare the words, order and line breaks. This makes it easier to spot a layout or typography limitation before processing a longer document. Images and complex formatting may need a different dedicated tool.`,
    },
    review:
      'Read a few paragraphs and inspect headings and lists. Simple generated PDFs use built-in Latin fonts; exact document layout, arbitrary typography, embedded images and interactive content are not promised. Keep the editable original for corrections.',
  };
};

export function buildPairGuide(pair, registry) {
  const source = registry.formats.find((f) => f.id === pair.source),
    target = registry.formats.find((f) => f.id === pair.target);
  const from = upper(pair.source),
    to = upper(pair.target),
    title = `${from} to ${to} Converter`,
    p = profile(pair, source, target);
  const limits = registry.limits || {},
    maxFiles = limits.maxFiles || 20,
    maxMB = Math.round((limits.maxBytes || 104857600) / 1048576),
    minutes = limits.retentionMinutes || 30;
  const settings = pair.options.map((option) => ({
    label: option.label,
    text: settingDescription(option) + ` Default: ${option.default}.`,
  }));
  return {
    kind: 'converter',
    path: `/${pair.source}-to-${pair.target}`,
    title,
    shortTitle: `${from} to ${to}`,
    description:
      pair.source === pair.target
        ? `Resize and re-encode ${from} images locally. Adjust supported settings, review format limits and save a new copy with Local Converter.`
        : `Convert ${from} to ${to} locally with ${pair.engine}. See output settings, step-by-step instructions, format limitations and common questions.`,
    lead: p.lead,
    useCases: p.useCases,
    example: p.example,
    settings,
    formats: [
      { label: `About ${from}`, text: formatDescription(source) },
      { label: `About ${to}`, text: formatDescription(target) },
    ],
    steps: [
      {
        title: `Select your ${from} files`,
        text: `Use Select File or drop supported ${from} files into the upload area. Each file creates a separate ${to} result. Check that the filename extension matches the contents and that the original opens correctly before adding a larger batch.`,
      },
      {
        title: settings.length ? 'Choose the output settings' : 'Review the format notes',
        text: settings.length
          ? `Open Options beside a selected file. ${pair.options.map((o) => o.label.replace(/\s*\(.*\)/, '')).join(', ')} ${settings.length === 1 ? 'is' : 'are'} available for this ${from} to ${to} operation. Save options to apply them to that file; other files in a batch can use different settings.`
          : `This ${from} to ${to} operation uses fixed settings. Read the output notes before proceeding, especially if document layout, table structure or archive contents matter. The available operation is based on the installed local engine, not a change to the filename alone.`,
      },
      {
        title: `Convert to ${to}`,
        text: `Select Convert to add the files to the local queue. Files run one at a time, with real progress where the engine provides it. You can cancel a queued or running job and retry a failed result after correcting its input or settings.`,
      },
      {
        title: 'Download and check the result',
        text: `When a file is finished, use Download to save the ${to} result. ${pair.source === 'pdf' && pair.target !== 'txt' ? 'An all-pages export may be a ZIP containing individual page images. ' : ''}Use Download all for finished results on this converter page. Save downloads before the ${minutes}-minute temporary retention ends.`,
      },
    ],
    review: p.review,
    limitations: [
      ...pair.limitations,
      `Up to ${maxFiles} files per session, ${maxMB} MB per file and 200 MB per output. Processing has a ${limits.timeoutSeconds || 180}-second job deadline.`,
    ],
    faqs: [
      {
        question: `How do I convert ${from} to ${to}?`,
        answer: `Choose your ${from} files, review ${settings.length ? 'Options and ' : ''}the format notes, then select Convert. Download the finished ${to} copy and check it in your destination application. Each input is processed independently; the original file remains unchanged.`,
      },
      (() => {
        const [question, answer] = conversionQuestion(pair, registry);
        return { question, answer };
      })(),
      {
        question: `Which settings can I change for ${from} to ${to}?`,
        answer: settings.length
          ? settings.map((setting) => `${setting.label}: ${setting.text}`).join(' ')
          : `This route uses fixed conversion settings. There are no hidden quality or layout controls. Read the format limitations above, or choose a dedicated tool from the related links if you need a different kind of processing.`,
      },
      {
        question: 'Will the result be smaller or better quality?',
        answer: `A successful ${to} conversion does not guarantee a smaller file or recovered detail. Container overhead, compression and the selected settings all affect output size. Check the saved result and keep the source if you might need a different export.`,
      },
      {
        question: `Why did my ${from} file fail?`,
        answer: `Read the message beside the file. A mismatched extension, corrupt data, unsupported feature or resource limit can prevent conversion. Check that the source opens normally, try the default settings and retry. The app will not offer a successful download for a failed job.`,
      },
      {
        question: 'Where are files processed and how long are they kept?',
        answer: `Your browser sends selected files to the local server on this computer. No external conversion service is used. Temporary job copies expire after approximately ${minutes} minutes; remove or clear deletes them sooner. Originals and downloads you saved are not overwritten.`,
      },
    ],
    related: registry.pairs
      .filter((other) => other.source === pair.source && other.target !== pair.target)
      .slice(0, 4)
      .map((other) => ({
        title: `${from} to ${upper(other.target)}`,
        path: `/${other.source}-to-${other.target}`,
      })),
  };
}
