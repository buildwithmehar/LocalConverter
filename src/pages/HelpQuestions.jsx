import { isBrowserSite } from '../browser/site-mode.js';
import React, { useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { ActionButton } from '../components/ui-kit.jsx';

export default function HelpQuestions({
  minutes,
  sizeLimit,
  fileLimit,
  browser = isBrowserSite(),
}) {
  const [query, setQuery] = useState('');
  const input = useRef(null);
  const baseQuestions = [
    {
      id: 'unsupported',
      question: 'Why is the output format I want missing?',
      keywords: 'unsupported compatibility conversion pair',
      answer:
        'The output picker shows conversions supported for your selected source. Support has a direction: being able to create a format does not always mean the app can read it. Browse Supported formats to find a compatible source and output.',
    },
    {
      id: 'failed',
      question: 'My conversion failed. What should I try?',
      keywords: 'error corrupt invalid retry',
      answer:
        'Read the error beside the file, then check that the original opens correctly and its extension matches its contents. Try the default settings and select Retry. If the original is damaged, export a fresh copy from the application that created it.',
    },
    {
      id: 'size',
      question: 'Why can’t I add more files or a larger file?',
      keywords: 'upload size limit batch too large',
      answer: `The current limits are ${fileLimit} files in your workspace and ${sizeLimit} per file. Remove files you no longer need before adding more. A file above the size limit needs to be reduced in its original application before you select it here.`,
    },
    {
      id: 'slow',
      question: 'Why is a conversion taking longer than expected?',
      keywords: 'progress waiting queued slow stuck video avif',
      answer:
        'Files are processed one at a time. Large videos, high-resolution images and some output encoders need more time and memory. Queued means another file is being processed first. Progress percentages appear when the engine can report them; otherwise the processing status remains visible. You can Cancel a queued or running file.',
    },
    {
      id: 'expired',
      question: 'My download expired. Can I get it back?',
      keywords: 'missing download result deleted retention',
      answer: `Temporary files and results expire after ${minutes} minutes, or sooner if you remove them or use Clear all. Convert the original again to create a new result. A copy already downloaded to your computer is unaffected by clearing the workspace.`,
    },
    {
      id: 'transparent',
      question: 'Why did a transparent image get a solid background?',
      keywords: 'png jpg jpeg transparency white black',
      answer:
        'JPEG cannot store transparency. Choose PNG or WebP when a compatible conversion is available and you need to keep transparent areas. Changing the filename extension alone does not change the image format.',
    },
    {
      id: 'navigation',
      question: 'Can I move between pages while converting?',
      keywords: 'my files activity navigate reload refresh tab',
      answer:
        'Yes. Use My files to return to your workspace, or open the converter for a particular source and output. Pending selections stay available while you navigate inside the app, but do not survive closing or reloading the tab. Convert or save what you need before doing so.',
    },
    {
      id: 'same-format',
      question: 'Why can I convert a format to itself?',
      keywords: 're-encode resize quality compress same',
      answer:
        'Some tools can re-encode a file without changing its format. This is useful when supported options let you change dimensions or quality. The available settings depend on the conversion; the app does not promise a smaller output for every file.',
    },
    {
      id: 'privacy',
      question: 'Do my files leave this computer?',
      keywords: 'privacy local offline upload account security',
      answer:
        'File contents are sent only to the app’s local server on this computer for conversion. They are not uploaded to a third-party conversion service. After setup and installation of the required tools, supported conversions can run without an internet connection.',
    },
    {
      id: 'connection',
      question: 'The local app is disconnected. How do I reconnect?',
      keywords: 'server startup start offline connection npm',
      answer:
        'Keep the local application running while converting and downloading. Start it from the installation folder using npm start, then reload the page. The project README includes installation and startup commands. Media and archive tools must be installed locally for their conversions to appear.',
    },
    {
      id: 'pdf-pages',
      question: 'Why did my PDF conversion download as a ZIP?',
      keywords: 'pdf pages images multiple zip render',
      answer:
        'PDF-to-image conversion can create one image for each page. Page number 0 means all supported pages; when there is more than one result, those images are packaged in a ZIP. Open that archive to find the page images, or choose a specific page number before converting if you only need one.',
    },
    {
      id: 'scanned',
      question: 'Can I extract words from a scanned PDF?',
      keywords: 'scan scanned ocr selectable text empty',
      answer:
        'PDF-to-text needs selectable text in the source. A scan that contains only pictures of letters needs optical character recognition, which this app does not include. You can render the PDF pages as images, or use an appropriate OCR tool to create a text layer before trying text extraction again.',
    },
    {
      id: 'formulas',
      question: 'Why is my spreadsheet rejected when it contains formulas?',
      keywords: 'xlsx worksheet formula dates rich text values',
      answer:
        'The table converters accept simple cell values from the first worksheet. Formulas, date objects, rich text and linked cells are unsupported. Create a values-only copy in your spreadsheet application, or export the sheet as CSV or TSV with clear, unique column names, then convert that copy.',
    },
    {
      id: 'quality',
      question: 'Will a different format always make my file smaller?',
      keywords: 'quality compression smaller filesize lossless',
      answer:
        'No. Size depends on the original, the selected format and the settings. A PNG or WAV copy can be larger than a compressed source, while reducing image dimensions or using a supported lossy encoder may reduce size. Compare the actual outputs and keep the version that meets the requirements of the receiving application.',
    },
    {
      id: 'audio-track',
      question: 'Why can’t I save audio from this video?',
      keywords: 'silent sound track mp4 mp3 ffmpeg extraction',
      answer:
        'Audio extraction needs an audio track in the original video. Check that the source plays with sound and that the selected converter is available locally. Media conversion uses the first supported audio stream; it does not create sound for a silent recording or choose between every embedded track.',
    },
    {
      id: 'save-folder',
      question: 'Where does the browser save my downloaded files?',
      keywords: 'folder location save browser downloads',
      answer:
        'Your browser controls the download folder and whether it asks where to save a file. Check its downloads list or download settings if a completed copy is difficult to find. The app supplies the output file; it does not silently choose a different destination folder on your computer.',
    },
  ];
  const browserAnswers = {
    size: {
      answer: `Keep up to ${fileLimit} files in the workspace, with a ${sizeLimit} input limit. Some tools also limit combined input size, page counts, pixels or expanded archives. Large jobs can exceed browser memory before the file-size limit. Save and remove finished results, or try a smaller source.`,
    },
    expired: {
      question: 'My result disappeared. Can I recover it?',
      answer:
        'Selections, jobs and results are held in this tab’s memory. Reloading or closing the tab, Remove and Clear all discard them. Select the original again and convert it to create a new result. Files already downloaded to your computer are unaffected.',
    },
    privacy: {
      answer:
        'File contents stay inside your browser while conversion engines process them. The site does not upload files for conversion or include file contents, filenames or text you enter in analytics. The browser may download engine code, fonts and models from this site when you open a tool.',
    },
    connection: {
      question: 'A browser engine failed to load. What can I try?',
      keywords: 'browser engine download wasm worker connection offline',
      answer:
        'The first use of a tool may download its conversion engine from this site. Check your connection and allow the browser to finish loading it. Save other completed results before reloading. An unsupported feature, damaged file or memory limit will have a separate message beside the affected job.',
    },
    scanned: {
      answer:
        'PDF-to-text needs selectable text. For a scan, open OCR document to recognize English text or create a searchable PDF, then review the recognized words. OCR is limited to supported images or up to 20 PDF pages and can make mistakes on small or unclear text.',
    },
    'audio-track': {
      answer:
        'Audio extraction needs an audio track in the original video. Check that the source plays with sound, then try the default settings. The bundled browser media engine reads supported audio streams; it does not create sound for a silent recording. Larger inputs may exceed browser memory.',
    },
  };
  const questions = browser
    ? baseQuestions.map((item) => ({ ...item, ...browserAnswers[item.id] }))
    : baseQuestions;
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const visible = questions.filter((item) =>
    tokens.every((token) =>
      `${item.question} ${item.answer} ${item.keywords}`.toLowerCase().includes(token),
    ),
  );
  function clear() {
    setQuery('');
    input.current?.focus();
  }
  return (
    <section className="help-section" id="help-questions" aria-labelledby="help-questions-heading">
      <div className="help-section-heading">
        <h2 id="help-questions-heading">Questions & troubleshooting</h2>
        <p>Search by a format, a problem or the result you need.</p>
      </div>
      <div className="help-question-search">
        <label htmlFor="help-question-search">Search questions</label>
        <div>
          <Search size={18} />
          <input
            ref={input}
            id="help-question-search"
            type="search"
            value={query}
            placeholder="Try download, file size or transparency"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') clear();
            }}
          />
          {query && (
            <ActionButton variant="icon" aria-label="Clear help search" onClick={clear}>
              <X size={16} />
            </ActionButton>
          )}
        </div>
      </div>
      <p className="help-answer-count" role="status">
        {visible.length} {visible.length === 1 ? 'answer' : 'answers'}
        {query ? ` for “${query}”` : ' to common questions'}
      </p>
      <div className="help-question-list">
        {visible.map((item) => (
          <details key={item.id}>
            <summary>
              {item.question}
              <ChevronDown size={17} />
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
      {!visible.length && (
        <div className="help-search-empty">
          <Search size={24} />
          <h3>No matching questions</h3>
          <p>Try a shorter search, such as “download”, “format” or “file size”.</p>
          <ActionButton variant="secondary" onClick={clear}>
            Show all questions
          </ActionButton>
        </div>
      )}
    </section>
  );
}
