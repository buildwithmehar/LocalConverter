import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Surface } from './ui-kit.jsx';
import { Link } from '../lib/navigation.jsx';
import FormatFileIcon from './FormatFileIcon.jsx';
import { upper } from '../lib/formats.js';

const favorites = [
  ['png', 'jpg'],
  ['jpg', 'webp'],
  ['webp', 'png'],
  ['pdf', 'png'],
  ['mp4', 'mp3'],
  ['csv', 'xlsx'],
];
const descriptions = {
  jpg: 'A JPEG copy for uploads and sharing.',
  webp: 'Smaller images for your website.',
  png: 'A PNG copy for your next project.',
  mp3: 'Save the audio from your video.',
  xlsx: 'Open your table in a spreadsheet.',
};
export default function PopularConverters({ registry }) {
  const pairs = favorites.filter(([source, target]) =>
    registry.pairs.some((pair) => pair.source === source && pair.target === target),
  );
  return (
    <section className="popular-converters home-popular" aria-labelledby="home-popular-heading">
      <div className="popular-heading">
        <div>
          <span className="home-eyebrow">A good place to start</span>
          <h2 id="home-popular-heading">Popular converters</h2>
          <p>Pick a conversion, then choose your files.</p>
        </div>
        <Link to="/tools">
          All converters <ArrowRight size={17} />
        </Link>
      </div>
      <div className="popular-grid">
        {pairs.map(([source, target], index) => (
          <Link
            className={index === 0 ? 'featured-converter' : undefined}
            key={`${source}-${target}`}
            to={`/${source}-to-${target}`}
          >
            <Surface
              className="popular-magic-card"
              contentClassName={`home-popular-content ${index === 0 ? 'home-feature-content' : ''}`}
            >
              {index === 0 ? (
                <>
                  <span className="home-feature-label">Everyday essential</span>
                  <div className="home-format-preview" aria-hidden="true">
                    <span className="home-preview-file">
                      <span className="popular-icon">
                        <FormatFileIcon format={source} />
                      </span>
                      <span>{upper(source)}</span>
                    </span>
                    <ArrowRight size={22} />
                    <span className="home-preview-file home-preview-output">
                      <span className="home-output-icon">
                        <FormatFileIcon format={target} />
                      </span>
                      <span>{upper(target)}</span>
                    </span>
                  </div>
                  <div className="home-feature-copy">
                    <strong>
                      {upper(source)} to {upper(target)}
                    </strong>
                    <p>{descriptions[target]} Choose quality and width after adding your file.</p>
                  </div>
                  <span className="home-feature-cta">
                    Open converter <ArrowRight size={17} />
                  </span>
                </>
              ) : (
                <>
                  <span className="popular-icon">
                    <FormatFileIcon format={source} />
                  </span>
                  <div className="home-shortcut-copy">
                    <strong>
                      {upper(source)} <ArrowRight size={13} /> {upper(target)}
                    </strong>
                    <p>
                      {descriptions[target] ||
                        `${registry.formats.find((format) => format.id === target)?.label} converter`}
                    </p>
                  </div>
                  <ArrowRight className="popular-arrow" size={17} />
                </>
              )}
            </Surface>
          </Link>
        ))}
      </div>
      {!pairs.length && (
        <p className="home-checking">Checking the converters available on this computer…</p>
      )}
    </section>
  );
}
