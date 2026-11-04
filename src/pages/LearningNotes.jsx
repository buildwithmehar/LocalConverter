import React from 'react';
import { isBrowserSite } from '../browser/site-mode.js';
import { ArrowRight, FileCheck2, ShieldCheck } from 'lucide-react';
import { Link } from '../lib/navigation.jsx';

export function AboutStory({ browser = isBrowserSite() }) {
  return (
    <div className="reading-guides about-reading">
      <section className="reading-editorial" aria-labelledby="about-local-detail-heading">
        <div className="reading-heading" data-page-enter>
          <span className="home-eyebrow">What local means here</span>
          <h2 id="about-local-detail-heading">
            {browser
              ? 'A file workspace that runs in your browser.'
              : 'A browser workspace with local tools behind it.'}
          </h2>
        </div>
        <div>
          <p>
            {browser
              ? 'The file picker, output choices, conversion queue and conversion engines all run in your browser. When you press Convert, the selected file is read on your device and a browser engine creates the output. File contents, filenames and text you enter are not sent to a conversion service or included in site analytics. Your original stays where it was.'
              : 'The browser gives you the file picker, the output choices and the conversion queue. When you press Convert, it sends the selected file to the app’s server on this same computer. The installed conversion engine reads that temporary copy and creates an output that the browser can download. Your original stays where it was.'}
          </p>
          <p>
            {browser
              ? 'Different browser engines handle images, text, tables, archives and media. The website loads the required code or models when you use a tool. Keep this tab open while processing and save the results before reloading; the workspace is held in tab memory.'
              : 'This arrangement lets the interface stay simple while different engines handle images, text, tables, archives and media. Some engines are included with the app; others need to be installed locally. Once setup is complete, supported conversions do not need a remote conversion service. The app still needs its local server running while you work.'}
          </p>
          <Link className="learning-text-link" to="/security">
            Read the local processing details <ArrowRight size={15} />
          </Link>
        </div>
      </section>
      <section className="reading-editorial" aria-labelledby="about-handoffs-heading">
        <div className="reading-heading" data-page-enter>
          <span className="home-eyebrow">For the file you need next</span>
          <h2 id="about-handoffs-heading">Small hand-offs deserve a clear workflow.</h2>
        </div>
        <div>
          <p>
            A useful conversion begins with a destination. You might need a smaller image for an
            upload, a text copy of a document for editing, or a plain table for another tool. The
            app brings these tasks together, but keeps the choices tied to the source file. You see
            compatible outputs rather than an unrestricted list of extensions.
          </p>
          <p>
            Dedicated converter pages explain the selected pair. The format directory helps you
            compare the available routes, and the help center covers what to do when an input, a
            setting or a download needs attention. You can read those pages and return through My
            files without abandoning pending selections inside the current tab.
          </p>
        </div>
      </section>
      <section className="reading-editorial" aria-labelledby="about-expectations-heading">
        <div className="reading-heading" data-page-enter>
          <span className="home-eyebrow">Clear expectations</span>
          <h2 id="about-expectations-heading">A finished conversion is a file to review.</h2>
        </div>
        <div>
          <p>
            File formats have different strengths. One may store transparency, another may keep only
            plain text, and a third may compress sound or pictures to save space. A successful
            conversion means that the selected engine created an output; it does not promise that
            every feature of the original survived unchanged.
          </p>
          <p>
            For that reason, the interface includes pair-specific limits and settings. Keep
            important originals, inspect the result in its intended application and choose another
            output when a feature matters more than a small file size. The local workflow keeps you
            in control of those decisions instead of treating every extension as interchangeable.
          </p>
          <div className="reading-inline-note">
            <ShieldCheck size={20} />
            <p>
              Local processing describes where the work happens. It does not make every file safe to
              open.{' '}
              {browser
                ? 'Use files you trust, keep your browser current and review downloaded results before opening or sharing them.'
                : 'Use files you trust and keep the app and installed conversion tools updated.'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export function HowPractice({ registry }) {
  const browser = registry.mode === 'browser' || isBrowserSite();
  const imagePair = registry.pairs.find((pair) => pair.source === 'png' && pair.target === 'jpg');
  return (
    <div className="reading-guides how-reading">
      <section aria-labelledby="how-preparation-heading">
        <div className="reading-heading" data-page-enter>
          <span className="home-eyebrow">A better starting point</span>
          <h2 id="how-preparation-heading">Give the converter a file it can understand.</h2>
          <p>
            Before selecting a file, open it in the app that normally handles it. A converter cannot
            reliably repair a damaged original or turn a renamed extension into a different file
            structure. If the source was exported from another application, keep that original
            export available until you have checked the result.
          </p>
        </div>
        <div className="reading-two-columns">
          <article>
            <h3>Prepare a representative copy</h3>
            <p>
              When you are working with a large batch, try one typical file first. Check that the
              chosen output suits the destination and that the available options produce the result
              you expect. For a table, that might mean testing a few rows with empty cells or
              identifiers. For an image, include transparent edges or small text if those details
              matter.
            </p>
          </article>
          <article>
            <h3>Choose the settings with a purpose</h3>
            <p>
              Start with the defaults, then change one setting that solves a specific need. Reducing
              width can make an image easier to upload; changing audio bitrate can affect the size
              of a recording. Higher values are not always better, and options use different scales.
              Read the description beside each field before saving it.
            </p>
          </article>
        </div>
      </section>
      {imagePair && (
        <section className="reading-worked-example" aria-labelledby="how-example-heading">
          <div className="reading-heading" data-page-enter>
            <span className="home-eyebrow">One practical example</span>
            <h2 id="how-example-heading">A PNG screenshot for a JPEG upload.</h2>
            <p>
              Suppose a form accepts JPEG and your screenshot is a PNG. Open the PNG to JPG
              converter and select the screenshot. Keep the original on your computer so you can
              choose a different output later if needed.
            </p>
          </div>
          <ol>
            <li>
              <strong>Check the background.</strong> JPEG has no transparency. Transparent areas are
              flattened onto white, so a logo or cut-out may need a different destination format.
            </li>
            <li>
              <strong>Use the default size first.</strong> Width 0 keeps the original width. Set a
              smaller width only when the receiving form or your intended use calls for it.
            </li>
            <li>
              <strong>Review the new copy.</strong> Convert, download and inspect text, edges and
              overall dimensions before uploading it elsewhere. Raising quality cannot restore
              detail missing from the source.
            </li>
          </ol>
          <Link className="learning-text-link" to="/png-to-jpg">
            Open PNG to JPG <ArrowRight size={15} />
          </Link>
        </section>
      )}
      <section aria-labelledby="how-batch-heading">
        <div className="reading-heading" data-page-enter>
          <span className="home-eyebrow">More than one file</span>
          <h2 id="how-batch-heading">Treat a batch as a set of individual jobs.</h2>
          <p>
            Each selected file has its own output and options. You can keep different settings in
            the same workspace, and changing an output can move that file into another converter’s
            view. Use My files when you want to see the whole session rather than one
            source-and-output pair.
          </p>
          <p>
            Conversion runs one file at a time. A queued file is waiting for its turn, while a
            processing file is using a local engine. Large inputs or resource-intensive encoders can
            take longer. Percentages appear only when the engine supplies them; a visible processing
            state without a percentage is not a promise about the remaining time.
          </p>
        </div>
        <dl className="reading-status-list">
          <div>
            <dt>Queued</dt>
            <dd>
              The job is waiting for another file to finish. You can cancel it before it begins.
            </dd>
          </div>
          <div>
            <dt>Processing</dt>
            <dd>
              A local tool is working on the input. Wait for the result or cancel the job if you no
              longer need it.
            </dd>
          </div>
          <div>
            <dt>Finished</dt>
            <dd>
              The output is ready to download. Open the downloaded copy and check its contents.
            </dd>
          </div>
          <div>
            <dt>Failed or cancelled</dt>
            <dd>
              Read the explanation beside the file. Use Retry when you want the job to run again, or
              remove it from the workspace.
            </dd>
          </div>
        </dl>
      </section>
      <section className="reading-final-note" aria-labelledby="how-save-heading">
        <span className="reading-note-icon">
          <FileCheck2 size={22} />
        </span>
        <h2 id="how-save-heading">Save, open and compare.</h2>
        <p>
          Download all is scoped to the page you are using: a converter collects its finished
          results, while My files gives access to the session’s results. A ZIP groups those outputs
          for download; it does not change the formats inside it. If one file failed, check its
          message separately instead of assuming it is included with the finished files.
        </p>
        <p>
          {browser
            ? 'Keep this tab open until the downloads are saved. Results live in browser memory and are cleared when you remove them, clear the workspace, reload or close the tab. Originals and saved downloads remain in their own locations.'
            : 'Keep the local app running until the downloads are saved. Temporary results expire, and clearing the workspace removes the server’s temporary copies sooner. The originals and copies you have already downloaded remain in their own locations.'}{' '}
          For important work, compare a few representative parts of the result before moving on.
        </p>
      </section>
    </div>
  );
}
