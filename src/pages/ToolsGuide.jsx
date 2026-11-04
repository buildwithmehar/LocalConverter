import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from '../lib/navigation.jsx';

export default function ToolsGuide() {
  return (
    <div id="tools-guide" className="tools-reading reading-guides">
      <section className="reading-editorial">
        <div className="reading-heading">
          <h2>Find a route that fits the job.</h2>
        </div>
        <div>
          <p>
            Search by the source format, the output you need, or a direction such as PNG to JPG. The
            category filter groups tools by their source file. A tool appears here only when the
            registry reports a supported conversion, so the directory reflects the installed local
            tools rather than a catalogue of promised formats.
          </p>
          <p>
            Open a converter to read its options and limitations before adding a file. The same
            extension can represent different internal features, and an engine may handle only part
            of what the original application supports. Keep the source available until the result
            has been checked in the app where you intend to use it.
          </p>
        </div>
      </section>
      <section>
        <div className="reading-heading">
          <h2>Choose by what the destination needs.</h2>
          <p>
            Start with the feature you need to keep. The smallest file or the most familiar
            extension is not always the right output.
          </p>
        </div>
        <div className="reading-two-columns">
          <article>
            <h3>Pictures and documents</h3>
            <p>
              Check transparency, dimensions, page order and whether you need editable text or an
              image of each page. A text extraction route is different from reconstructing a
              document layout. For logos and screenshots, inspect small text and edges after
              conversion instead of judging only by file size.
            </p>
          </article>
          <article>
            <h3>Tables, media and archives</h3>
            <p>
              Check identifiers, empty values, sound, timing and the contents of any ZIP output.
              Spreadsheet data conversion may not preserve formulas or workbook presentation. Media
              settings can trade file size for quality, while an archive packages files rather than
              making their internal formats interchangeable.
            </p>
          </article>
        </div>
      </section>
      <section className="reading-editorial">
        <div className="reading-heading">
          <h2>Understand the tools behind the list.</h2>
        </div>
        <div>
          <p>
            The installed-engine list identifies tools detected on this computer. Some capabilities
            come with the app and others depend on local executables. A tool being available does
            not prove that every possible input can be read, and a missing engine can reduce the
            routes offered by this installation.
          </p>
          <p>
            If a route is missing, first confirm the original file type. Use a supported export from
            the source application where possible. Renaming an extension does not change the
            contents, and repeatedly opening extra tabs does not install a missing converter. The
            Supported formats page is the best place to compare outputs for one source.
          </p>
          <Link className="learning-text-link" to="/formats">
            Browse formats and compatible outputs <ArrowRight size={15} />
          </Link>
        </div>
      </section>
      <section className="reading-final-note">
        <h2>Build a small, repeatable workflow.</h2>
        <p>
          Try one representative file with default settings, download the result and review the
          feature that matters to you. Change one option at a time if the converter offers it. Once
          the output suits your destination, continue with the rest of the batch and save completed
          results before clearing the workspace.
        </p>
        <p>
          Use My files to move between converter pages while keeping pending selections in this tab.
          Temporary outputs have a limited lifetime, and browser-held selections do not survive a
          full reload or close. Read the job’s message when something fails; a retry is most useful
          after you understand whether the problem is the file, the selected format or the local
          connection.
        </p>
        <div className="reading-links">
          <Link to="/how-it-works">
            Follow the workflow <ArrowRight size={15} />
          </Link>
          <Link to="/help">
            Find troubleshooting help <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </div>
  );
}
