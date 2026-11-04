import InfoHero from '../components/InfoHero.jsx';
import { isBrowserSite } from '../browser/site-mode.js';
import React from 'react';
import {
  ArrowRight,
  UploadCloud,
  HardDrive,
  Download,
  Settings2,
  ShieldCheck,
  FolderOpen,
  Clock3,
} from 'lucide-react';
import { Surface } from '../components/ui-kit.jsx';
import { Link } from '../lib/navigation.jsx';
import { bytes, upper } from '../lib/formats.js';
import { pageMetadata } from '../lib/page-metadata.js';
import FormatFileIcon from '../components/FormatFileIcon.jsx';
import '../learning-pages.css';
import { AboutStory, HowPractice } from './LearningNotes.jsx';
import FooterReading from './FooterReading.jsx';

function FileJourney({ browser = isBrowserSite() }) {
  const stages = [
    { icon: UploadCloud, title: 'Your file', text: 'Choose it in your browser.' },
    {
      icon: HardDrive,
      title: 'This computer',
      text: browser
        ? 'Browser engines process the conversion.'
        : 'Local tools process the conversion.',
    },
    { icon: Download, title: 'Your download', text: 'Save the result where you need it.' },
  ];
  return (
    <section className="learning-journey" aria-labelledby="learning-journey-heading">
      <div className="learning-section-heading" data-page-enter>
        <span className="home-eyebrow">The file journey</span>
        <h2 id="learning-journey-heading">A short trip. On your computer.</h2>
        <p>
          {browser
            ? 'The browser reads the files you select and processes their bytes on your device. File contents and text you enter are never uploaded for conversion.'
            : 'Files pass from your browser to the local server on this machine. A third-party conversion service is not part of the process.'}
        </p>
      </div>
      <Surface className="learning-flow" contentClassName="learning-flow-body">
        <ol>
          {stages.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <span className="learning-flow-icon">
                <Icon size={23} />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
              <ArrowRight className="learning-flow-arrow" size={18} aria-hidden="true" />
            </li>
          ))}
        </ol>
      </Surface>
    </section>
  );
}

function StartConverting({ help = false }) {
  return (
    <Surface as="section" className="learning-cta" contentClassName="learning-cta-body">
      <div>
        <h2>Start with a file.</h2>
        <p>Choose what you want to convert. The app will guide you to the next step.</p>
      </div>
      <div className="learning-cta-links">
        {help && (
          <Link to="/help" className="learning-text-link">
            Open help center <ArrowRight size={16} />
          </Link>
        )}
        <Link to="/" className="primary-button">
          Choose a file <ArrowRight size={16} />
        </Link>
      </div>
    </Surface>
  );
}

function AboutContent({ registry }) {
  const browser = registry.mode === 'browser' || isBrowserSite();
  const categories = new Set(registry.formats.map((format) => format.category));
  return (
    <>
      <section className="learning-about-intro" aria-labelledby="about-purpose-heading">
        <div className="learning-copy" data-page-enter>
          <span className="home-eyebrow">Made for the everyday file</span>
          <h2 id="about-purpose-heading">Your files. Your computer.</h2>
          <p>
            A screenshot needs a different format. A spreadsheet needs to open in another app. A
            video needs an audio copy. Local Converter brings those small jobs into one workspace.
          </p>
          <p>
            Choose a file, pick a compatible output and adjust the settings that matter.{' '}
            {browser
              ? 'Browser conversion engines create a result you can download. No account or desktop installation is needed.'
              : 'The app uses local conversion tools to create a result you can download.'}
          </p>
          <Link to="/how-it-works" className="learning-text-link">
            See how it works <ArrowRight size={16} />
          </Link>
        </div>
        <Surface
          as="aside"
          className="about-availability"
          contentClassName="about-availability-body"
          aria-labelledby="about-tools-heading"
        >
          <span className="learning-note-icon">
            <FolderOpen size={23} />
          </span>
          <h2 id="about-tools-heading">
            {browser ? 'Available in your browser' : 'Available on this computer'}
          </h2>
          {registry.formats.length ? (
            <dl>
              <div>
                <dt>File formats</dt>
                <dd>{registry.formats.length}</dd>
              </div>
              <div>
                <dt>Conversion pairs</dt>
                <dd>{registry.pairs.length}</dd>
              </div>
              <div>
                <dt>Categories</dt>
                <dd>{categories.size}</dd>
              </div>
            </dl>
          ) : (
            <p>
              {browser
                ? 'Loading available browser conversions…'
                : 'Checking the installed conversion tools…'}
            </p>
          )}
          <p>
            {browser
              ? 'These numbers reflect the browser engines in this website. Each converter lists its supported options and limitations.'
              : 'These numbers reflect the current local setup. Each converter lists its supported options and limitations.'}
          </p>
          <Link to="/formats" className="learning-text-link">
            Explore supported formats <ArrowRight size={16} />
          </Link>
        </Surface>
      </section>
      <FileJourney browser={browser} />
      <section className="learning-principles" aria-labelledby="about-approach-heading">
        <div className="learning-section-heading" data-page-enter>
          <span className="home-eyebrow">A clear way to work</span>
          <h2 id="about-approach-heading">The useful controls, within reach.</h2>
        </div>
        <dl>
          <div>
            <dt>
              <Settings2 size={20} />
              Settings that change the output
            </dt>
            <dd>
              Options are specific to each conversion. Adjust supported quality, size or other
              settings for each file in your batch.
            </dd>
          </div>
          <div>
            <dt>
              <ShieldCheck size={20} />
              Local processing, explained
            </dt>
            <dd>
              No account is required.{' '}
              {browser
                ? 'Files are processed in this tab, and results stay in memory until you remove them or reload the page.'
                : 'Files are processed by the local server, and temporary copies expire automatically.'}{' '}
              <Link to="/security">
                Read how files are handled <ArrowRight size={13} />
              </Link>
            </dd>
          </div>
          <div>
            <dt>
              <FolderOpen size={20} />
              One workspace across pages
            </dt>
            <dd>
              Move between converters and information pages, then return through My files. Keep the
              tab open until you have converted and saved your files.
            </dd>
          </div>
        </dl>
      </section>
      <AboutStory browser={browser} />
      <section className="learning-credits" aria-labelledby="about-credits-heading">
        <h2 id="about-credits-heading">Credits and licenses</h2>
        <p>
          Local Converter is an independent application built around local conversion tools. The
          components and icons used in its interface retain their original licenses.
        </p>
        <div>
          <article>
            <h3>Interface components</h3>
            <p>
              Selected interface components use{' '}
              <a href="https://github.com/magicuidesign/magicui">Magic UI</a>, licensed under MIT.{' '}
              <a href="/licenses/magicui.txt">Read the Magic UI license</a>.
            </p>
          </article>
          <article>
            <h3>File icons</h3>
            <p>
              Font Awesome Free 7.3.1 by Fonticons, Inc., licensed under CC BY 4.0. SVG paths are
              unmodified; colours and sizes follow this app’s theme.{' '}
              <a href="/licenses/fontawesome.txt">Read the icon license</a> ·{' '}
              <a href="https://fontawesome.com/">Font Awesome</a>.
            </p>
          </article>
        </div>
      </section>
      <StartConverting />
    </>
  );
}

function HowItWorksContent({ registry }) {
  const browser = registry.mode === 'browser' || isBrowserSite();
  const limits = registry.limits || {},
    minutes = limits.retentionMinutes || 30;
  const example =
    registry.pairs.find((pair) => pair.source === 'png' && pair.target === 'jpg') ||
    registry.pairs.find((pair) => pair.source !== pair.target);
  const steps = [
    [
      'Add your files',
      'Use Select File or drag files into the upload area. The app identifies the source from the filename extension and opens the matching converter. Mixed file types open together in Your conversions.',
    ],
    [
      'Choose the output and settings',
      'Pick a compatible output beside each file. Open Options to adjust the settings available for that conversion, then save them. Settings apply to that file, so a batch can use different choices.',
    ],
    [
      'Convert on this computer',
      browser
        ? 'Press Convert. Browser engines process files one at a time on your device. The first use of a tool may load its engine from this site. Watch the reported status; Cancel stops a queued or running conversion.'
        : 'Press Convert. Files are processed one at a time by the local server using the installed conversion tools. Watch the reported status; Cancel stops a queued or running conversion.',
    ],
    [
      'Save your results',
      'Use Download beside each finished file, or Download all to save the finished results from that converter as a ZIP. Save your downloads before removing files or clearing the workspace.',
    ],
  ];
  return (
    <>
      <div className="learning-walkthrough">
        <section aria-labelledby="learning-steps-heading">
          <div className="learning-section-heading" data-page-enter>
            <span className="home-eyebrow">From selection to saved</span>
            <h2 id="learning-steps-heading">Four steps to your next format.</h2>
            <p>Start with the original. Finish with a file you can use.</p>
          </div>
          <ol className="learning-steps">
            {steps.map(([title, text], index) => (
              <li key={title}>
                <span className="learning-step-number" aria-hidden="true">
                  0{index + 1}
                </span>
                <div>
                  <h3>
                    {index + 1}. {title}
                  </h3>
                  <p>{text}</p>
                  {index === 1 && example && (
                    <Link
                      className="learning-example"
                      to={`/${example.source}-to-${example.target}`}
                    >
                      <FormatFileIcon format={example.source} />
                      <span>
                        Try {upper(example.source)} <ArrowRight size={13} /> {upper(example.target)}
                      </span>
                      <ArrowRight size={16} />
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
        <Surface
          as="aside"
          className="learning-limits"
          contentClassName="learning-limits-body"
          aria-labelledby="learning-limits-heading"
        >
          <Clock3 size={23} />
          <h2 id="learning-limits-heading">Before you start</h2>
          <dl>
            <div>
              <dt>Files per batch</dt>
              <dd>Up to {limits.maxFiles || 20}</dd>
            </div>
            <div>
              <dt>File size</dt>
              <dd>Up to {bytes(limits.maxBytes || 104857600)} each</dd>
            </div>
            <div>
              <dt>Temporary results</dt>
              <dd>
                {browser ? 'Until removed or tab reloaded' : <>Expire after {minutes} minutes</>}
              </dd>
            </div>
          </dl>
          <p>
            {browser
              ? 'Keep this tab open until your downloads are saved. Reloading or closing it clears selections and results. Browser memory and tool-specific limits apply.'
              : 'Keep the local app running while converting and downloading. The available outputs depend on your original file and the tools installed here.'}
          </p>
          <Link to="/formats" className="learning-text-link">
            Check available formats <ArrowRight size={15} />
          </Link>
        </Surface>
      </div>
      <FileJourney browser={browser} />
      <HowPractice registry={registry} />
      <section className="learning-recovery" aria-labelledby="learning-recovery-heading">
        <div>
          <span className="home-eyebrow">If a file needs another try</span>
          <h2 id="learning-recovery-heading">Read the message. Find the next step.</h2>
          <p>
            A failed conversion shows an explanation beside the file. Check that the original opens
            correctly, try the default settings, then select Retry. The help center covers formats,
            downloads and common errors.
          </p>
        </div>
        <Link to="/help" className="secondary-button">
          Find an answer <ArrowRight size={16} />
        </Link>
      </section>
      <StartConverting help />
    </>
  );
}

export default function LearningPage({ kind, registry }) {
  const about = kind === 'about',
    route = about ? '/about' : '/how-it-works';
  return (
    <>
      <InfoHero>
        <h1>{pageMetadata[route].title}</h1>
        <p>
          {about
            ? 'A simpler way to convert everyday files. Choose an output, adjust what matters and keep the processing on your computer.'
            : 'Select a file. Choose its next format. Convert locally and save the result. Here is what happens at each step.'}
        </p>
      </InfoHero>
      <div className={`learning-content ${about ? 'learning-about' : 'learning-how'}`}>
        {about ? <AboutContent registry={registry} /> : <HowItWorksContent registry={registry} />}
        <FooterReading browser={registry.mode === 'browser' || isBrowserSite()} route={route} />
      </div>
    </>
  );
}
