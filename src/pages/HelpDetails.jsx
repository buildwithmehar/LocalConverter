import React from 'react';
import { isBrowserSite } from '../browser/site-mode.js';
import { ArrowRight, FileCheck2, ClipboardList } from 'lucide-react';
import { Link } from '../lib/navigation.jsx';

export function HelpPreparation({ browser = isBrowserSite() }) {
  return (
    <section
      className="help-section reading-guides help-extra"
      id="help-preparation"
      aria-labelledby="help-preparation-heading"
    >
      <div className="help-section-heading">
        <h2 id="help-preparation-heading">Prepare a file that converts cleanly</h2>
        <p>
          A little preparation makes the result easier to check. Start with an original that opens
          correctly, then choose the output for the application that will receive it.
        </p>
      </div>
      <div className="reading-inline-note">
        <ClipboardList size={21} />
        <p>
          Keep the filename extension that belongs to the file. Renaming report.pdf to report.docx
          changes its name, not its contents. If you need a fresh source, export it from the
          application that created it.
        </p>
      </div>
      <div className="help-preparation-list">
        <article>
          <h3>For documents and page images</h3>
          <p>
            Decide whether you need the page’s appearance or the words on it. Rendering a PDF to PNG
            creates page images. Extracting TXT needs selectable text and will not recognise letters
            inside a scan. Document-to-text tools can also change reading order, spacing and page
            structure, so compare the result with the original.
          </p>
        </article>
        <article>
          <h3>For tables and structured records</h3>
          <p>
            Use a clear header row with unique, non-empty names. The table tools handle simple
            values from the first worksheet; formulas, styling, date objects and nested records are
            outside that workflow. If the workbook is more complex, export the sheet you need as a
            values-only table before selecting it here.
          </p>
        </article>
        <article>
          <h3>For a larger media file</h3>
          <p>
            Check that the original plays and contains the track you need. Choose a compatible
            output for the target player, and try a representative file before starting a larger
            batch.{' '}
            {browser
              ? 'Keep this tab open while the browser processes it.'
              : 'Keep the local app running while it works.'}{' '}
            High-resolution video and demanding encoders can take longer even when the interface is
            still responding.
          </p>
        </article>
      </div>
      <Link className="help-inline-link" to="/how-it-works">
        Read the full conversion workflow <ArrowRight size={15} />
      </Link>
    </section>
  );
}

export function HelpReview() {
  const checks = [
    [
      'Images',
      'Look at the dimensions, small text, colour appearance and transparent edges. A format that removes transparency or uses lossy compression may look different even when the conversion completes.',
    ],
    [
      'Documents',
      'Compare headings, text order, tables and a few page breaks. A text extraction tool keeps words, while a page renderer makes pictures. Neither route promises an editable copy of the original layout.',
    ],
    [
      'Tables and records',
      'Inspect column names, row counts, empty fields and values with leading zeros. Open a representative sample in the receiving tool and check how that tool interprets strings, numbers and separators.',
    ],
    [
      'Audio, video and subtitles',
      'Check the beginning, the end and a point in the middle. Confirm the duration and that the expected sound is present. For subtitles, load the result with the media and compare a few early and late cues.',
    ],
  ];
  return (
    <section
      className="help-section reading-guides help-extra"
      id="help-review"
      aria-labelledby="help-review-heading"
    >
      <div className="help-section-heading">
        <h2 id="help-review-heading">Review the result before sharing</h2>
        <p>
          Finished means the engine created an output. Before using that output elsewhere, open the
          downloaded copy in the application that will receive it. The right checks depend on the
          kind of file.
        </p>
      </div>
      <dl className="help-review-checks">
        {checks.map(([title, text]) => (
          <div key={title}>
            <dt>
              <FileCheck2 size={19} />
              {title}
            </dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
      <p className="help-retention-note">
        If the result is not what you expected, keep the original and try the default settings or
        another supported output. Changing one option at a time makes it easier to understand the
        difference. Raising quality or choosing a larger format cannot restore detail that was
        already removed from the source.
      </p>
      <div className="reading-links">
        <Link to="/formats">
          Compare available formats <ArrowRight size={15} />
        </Link>
        <Link to="/how-it-works">
          Understand the local workflow <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}
