import PageGuide from './PageGuide.jsx';
import { Surface } from './ui-kit.jsx';
import React from 'react';
import { upper } from '../lib/formats.js';
import { formatDescription } from '../lib/converter-content.js';
import FormatFileIcon from './FormatFileIcon.jsx';

export default function ConverterDetails({ pair, registry, pageGuide }) {
  const source = registry.formats.find((format) => format.id === pair.source);
  const target = registry.formats.find((format) => format.id === pair.target);
  return (
    <div className="converter-details">
      <section className="format-explanation">
        <div className="section-heading">
          <h2>
            About {upper(pair.source)}
            {pair.source !== pair.target ? ` and ${upper(pair.target)}` : ''}
          </h2>
        </div>
        <div className="format-explanation-grid">
          {[source, target].map((format, index) => (
            <Surface as="article" className="format-detail-card" key={`${format.id}-${index}`}>
              <span className={`detail-format-icon ${index ? 'target' : ''}`}>
                <FormatFileIcon format={format.id} />
              </span>
              <div>
                <small>{index ? 'Output format' : 'Source format'}</small>
                <h3>
                  {typeof format.label === 'string' ? format.label : upper(format.id)}{' '}
                  <span>.{format.id}</span>
                </h3>
                <p>{formatDescription(format)}</p>
              </div>
            </Surface>
          ))}
        </div>
      </section>
      <PageGuide page={pageGuide} />
    </div>
  );
}
