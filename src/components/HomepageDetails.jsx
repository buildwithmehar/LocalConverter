import React from 'react';
import { ArrowRight, Settings2, FilePlus2, Download, Workflow, FileCheck2 } from 'lucide-react';
import { Link } from '../lib/navigation.jsx';
import { Surface } from './ui-kit.jsx';

const steps = [
  {
    icon: FilePlus2,
    title: 'Select your files',
    text: 'Choose files from your computer or drop them into the upload area. The app finds the matching converter.',
  },
  {
    icon: Settings2,
    title: 'Choose the output',
    text: 'Pick a compatible format. Open Options to adjust quality, size or the settings available for that file.',
  },
  {
    icon: Download,
    title: 'Save the results',
    text: 'Press Convert, then download your finished files. Use Download all to save the results together as a ZIP.',
  },
];
export default function HomepageDetails() {
  return (
    <div className="homepage-details home-story">
      <section className="home-workflow" aria-labelledby="local-workflow-heading">
        <div className="home-story-heading" data-page-enter>
          <div>
            <span className="home-eyebrow">From file to finished</span>
            <h2 id="local-workflow-heading">How conversion works</h2>
            <p>Three simple steps. All on your computer.</p>
          </div>
          <Link className="home-text-link" to="/help">
            Read conversion guide <ArrowRight size={16} />
          </Link>
        </div>
        <ol className="home-workflow-steps">
          {steps.map(({ icon: Icon, title, text }, index) => (
            <li key={title}>
              <Surface className="home-step" contentClassName="home-step-body">
                <div className="home-step-top">
                  <span className="home-step-icon">
                    <Icon size={21} />
                  </span>
                  <span className="home-step-number" aria-hidden="true">
                    0{index + 1}
                  </span>
                </div>
                <h3>
                  {index + 1}. {title}
                </h3>
                <p>{text}</p>
              </Surface>
            </li>
          ))}
        </ol>
      </section>
      <Surface
        as="section"
        className="home-settings"
        contentClassName="home-settings-body"
        aria-labelledby="verified-heading"
      >
        <div className="home-settings-intro">
          <Settings2 size={22} />
          <div>
            <h2 id="verified-heading">Formats and settings</h2>
            <p>A little control where it matters.</p>
          </div>
        </div>
        <div className="home-settings-points">
          <div>
            <Workflow size={17} />
            <p>
              <strong>Compatible outputs</strong>The format picker shows what works with your source
              file.
            </p>
          </div>
          <div>
            <Settings2 size={17} />
            <p>
              <strong>Options for each file</strong>Use different supported settings in the same
              batch.
            </p>
          </div>
          <div>
            <FileCheck2 size={17} />
            <p>
              <strong>Keep your place</strong>Use My files to return to your workspace while
              browsing the app.
            </p>
          </div>
        </div>
        <p className="home-settings-note">
          Working with documents or structured data? Check the converter’s format notes when layout,
          metadata or exact values matter.
        </p>
      </Surface>
    </div>
  );
}
