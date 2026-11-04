import InfoHero from '../components/InfoHero.jsx';
import { isBrowserSite } from '../browser/site-mode.js';
import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  UploadCloud,
  SlidersHorizontal,
  Download,
  FileImage,
  FileText,
  FileAudio,
  LockKeyhole,
  Check,
  Clock3,
} from 'lucide-react';
import { Surface } from '../components/ui-kit.jsx';
import { bytes, upper } from '../lib/formats.js';
import HelpQuestions from './HelpQuestions.jsx';
import '../help-page.css';
import { pageMetadata } from '../lib/page-metadata.js';
import { HelpPreparation, HelpReview } from './HelpDetails.jsx';
import FooterReading from './FooterReading.jsx';

const contents = [
  ['help-start', 'Your first conversion'],
  ['help-preparation', 'Prepare your files'],
  ['help-formats', 'Formats & settings'],
  ['help-downloads', 'Files & downloads'],
  ['help-questions', 'Questions & troubleshooting'],
  ['help-review', 'Review your results'],
  ['help-privacy', 'Privacy & limits'],
];

export default function HelpPage({ registry, Link }) {
  const [active, setActive] = useState('help-start');
  const readingColumn = useRef(null);
  const browser = registry.mode === 'browser' || isBrowserSite();
  const minutes = registry.limits?.retentionMinutes || 30;
  const fileLimit = registry.limits?.maxFiles || 20;
  const sizeLimit = bytes(registry.limits?.maxBytes || 104857600);
  const examples = [
    ['png', 'jpg'],
    ['csv', 'json'],
    ['mp4', 'mp3'],
  ].filter(([source, target]) =>
    registry.pairs.some((pair) => pair.source === source && pair.target === target),
  );
  useEffect(() => {
    const sections = contents.map(([id]) => document.getElementById(id)).filter(Boolean);
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = sections[0]?.id;
      for (const section of sections)
        if (section.getBoundingClientRect().top <= 160) current = section.id;
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2)
        current = sections.at(-1)?.id;
      if (current) setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(schedule);
    if (readingColumn.current) observer.observe(readingColumn.current);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <>
      <InfoHero category="document">
        <h1>{pageMetadata['/help'].title}</h1>
        <p>
          Choose your file, find the right output and save the result. Follow the steps below,
          explore format tips, or find a practical fix when something goes wrong.{' '}
          {browser
            ? 'Files are processed inside your browser and are never uploaded for conversion.'
            : 'Every conversion runs through the local app on your computer.'}
        </p>
      </InfoHero>
      <div className="info-content help-content">
        <aside className="help-sidebar">
          <nav aria-label="Help contents">
            <p>On this page</p>
            {contents.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                aria-current={active === id ? 'location' : undefined}
                onClick={() => setActive(id)}
              >
                {label}
                <ArrowRight size={14} />
              </a>
            ))}
          </nav>
          <Link to="/" className="help-start-link">
            Open file converter <ArrowRight size={16} />
          </Link>
          <div className="help-sidebar-note">
            <LockKeyhole size={17} />
            <div>
              <strong>Local from start to finish</strong>
              <p>Your files are processed on this computer. No account needed.</p>
            </div>
          </div>
        </aside>
        <div className="help-reading-column" ref={readingColumn}>
          <section className="help-section" id="help-start" aria-labelledby="help-start-heading">
            <div className="help-section-heading">
              <h2 id="help-start-heading">Your first conversion</h2>
              <p>Three steps from the file you have to the format you need.</p>
            </div>
            <Surface className="help-guide-card" contentClassName="help-guide-content">
              <ol className="help-steps">
                <li>
                  <span className="help-step-icon">
                    <UploadCloud size={22} />
                  </span>
                  <div>
                    <h3>1. Select your files</h3>
                    <p>
                      Choose <strong>Select File</strong> or drag files into the upload area. The
                      app detects the source format from the filename and opens the matching
                      converter. Mixed file batches open <strong>Your conversions</strong>.
                    </p>
                    <p>
                      Add up to <strong>{fileLimit} files</strong>, with a limit of{' '}
                      <strong>{sizeLimit} per file</strong>. Keep the original extension: renaming a
                      file does not convert its contents.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="help-step-icon">
                    <SlidersHorizontal size={22} />
                  </span>
                  <div>
                    <h3>2. Set the output</h3>
                    <p>
                      Choose the output format beside each file. Only compatible conversions appear
                      in the picker. Open <strong>Options</strong> to adjust the settings available
                      for that file, then select <strong>Save options</strong>.
                    </p>
                    <div className="help-inline-tip">
                      <strong>A smaller image?</strong> Change Width in Options when it is
                      available. To keep transparent areas, choose a compatible PNG or WebP output
                      instead of JPEG.
                    </div>
                  </div>
                </li>
                <li>
                  <span className="help-step-icon">
                    <Download size={22} />
                  </span>
                  <div>
                    <h3>3. Convert and download</h3>
                    <p>
                      Press <strong>Convert</strong>. Files run one at a time, and the status beside
                      each file shows what is happening. When a file is marked{' '}
                      <strong>Finished</strong>, choose <strong>Download</strong> to save the
                      result.
                    </p>
                    <p>
                      Use <strong>Download all</strong> for a ZIP of the finished files shown in
                      that converter.{' '}
                      {browser ? (
                        <>
                          Save results before reloading or closing this tab, which clears the
                          workspace.
                        </>
                      ) : (
                        <>
                          Save your results within <strong>{minutes} minutes</strong>, before the
                          temporary copies expire.
                        </>
                      )}
                    </p>
                  </div>
                </li>
              </ol>
            </Surface>
          </section>

          <HelpPreparation browser={browser} />
          <section
            className="help-section"
            id="help-formats"
            aria-labelledby="help-formats-heading"
          >
            <div className="help-section-heading">
              <h2 id="help-formats-heading">Choose the right output</h2>
              <p>
                A format change can affect file size, quality, transparency or structure. Choose the
                output for what you plan to do next.
              </p>
            </div>
            <dl className="help-format-tips">
              <div>
                <dt>
                  <FileImage size={21} />
                  <span>Images</span>
                </dt>
                <dd>
                  JPEG works well for compact photographs. PNG keeps transparency and sharp
                  graphics. WebP is useful for website images. Review the result after changing
                  quality or dimensions.
                </dd>
              </div>
              <div>
                <dt>
                  <FileText size={21} />
                  <span>Documents & data</span>
                </dt>
                <dd>
                  Check text, tables and formatting after conversion. Some document tools extract
                  text rather than preserve the original page layout. CSV and JSON tools expect
                  structured, consistent records.
                </dd>
              </div>
              <div>
                <dt>
                  <FileAudio size={21} />
                  <span>Audio & video</span>
                </dt>
                <dd>
                  The codec, bitrate and resolution affect quality and size. The available options
                  depend on the selected output. Converting a video to an audio format keeps the
                  audio track and removes the picture.
                </dd>
              </div>
            </dl>
            <div className="help-example-links">
              <span>Try a converter</span>
              {examples.map(([source, target]) => (
                <Link key={`${source}-${target}`} to={`/${source}-to-${target}`}>
                  {upper(source)} <ArrowRight size={13} /> {upper(target)}
                </Link>
              ))}
            </div>
            <Link className="help-inline-link" to="/formats">
              Explore supported formats <ArrowRight size={15} />
            </Link>
          </section>

          <section
            className="help-section"
            id="help-downloads"
            aria-labelledby="help-downloads-heading"
          >
            <div className="help-section-heading">
              <h2 id="help-downloads-heading">Keep track of your files</h2>
              <p>
                Move between converters without losing your place. Use <strong>My files</strong> to
                return to the full workspace, or open a converter to see the files for that source
                and output.
              </p>
            </div>
            <div className="help-status-guide">
              <span>
                <Clock3 size={15} /> Queued
              </span>
              <i aria-hidden="true" />
              <span>
                <span className="help-processing-dot" /> Converting
              </span>
              <i aria-hidden="true" />
              <span>
                <Check size={15} /> Finished
              </span>
            </div>
            <ul className="help-download-tips">
              <li>
                <strong>Save before clearing.</strong> Download saves a result to the location you
                choose. Remove and Clear all delete temporary copies, not your originals or saved
                downloads.
              </li>
              <li>
                <strong>One converter or the whole batch.</strong> Download all includes finished
                results from the current converter. Open My files to work with results across your
                session.
              </li>
              <li>
                <strong>Stay inside the app while files are pending.</strong> Selected files survive
                navigation between pages, but not a tab reload or browser close. Convert or save
                what you need first.
              </li>
            </ul>
          </section>

          <HelpQuestions
            browser={browser}
            minutes={minutes}
            sizeLimit={sizeLimit}
            fileLimit={fileLimit}
          />
          <HelpReview />
          <FooterReading browser={browser} route="/help" />

          <section
            className="help-section"
            id="help-privacy"
            aria-labelledby="help-privacy-heading"
          >
            <div className="help-section-heading">
              <h2 id="help-privacy-heading">Your files, on your computer</h2>
              <p>
                {browser
                  ? 'Conversion engines run in this browser. File contents and text you enter are not uploaded for processing or included in site analytics. Your original files stay unchanged.'
                  : 'Conversions use the local app and installed tools. File contents are not sent to a third-party conversion service, and your original files stay unchanged.'}
              </p>
            </div>
            <dl className="help-limits">
              <div>
                <dt>Files per workspace</dt>
                <dd>{fileLimit}</dd>
              </div>
              <div>
                <dt>Maximum file size</dt>
                <dd>{sizeLimit}</dd>
              </div>
              <div>
                <dt>Temporary storage</dt>
                <dd>
                  {browser ? (
                    'Current tab'
                  ) : (
                    <>
                      {minutes} <span>minutes</span>
                    </>
                  )}
                </dd>
              </div>
            </dl>
            <p className="help-retention-note">
              {browser
                ? 'Keep this tab open while converting and downloading. Results stay in browser memory until you remove them, clear the workspace, reload or close the tab. Save downloads before doing so. Conversion engines may load from this site when first used.'
                : 'Keep the app running while converting and downloading. Download results before they expire; removing a file clears its temporary copies sooner.'}
            </p>
            <Link className="help-inline-link" to="/security">
              How local processing works <ArrowRight size={15} />
            </Link>
          </section>

          <Surface className="help-ready-card" contentClassName="help-ready-content">
            <div>
              <h2>Ready to convert a file?</h2>
              <p>Start with your file. Choose a compatible output. Save the result.</p>
            </div>
            <Link to="/" className="help-start-link">
              Open file converter <ArrowRight size={16} />
            </Link>
          </Surface>
        </div>
      </div>
    </>
  );
}
