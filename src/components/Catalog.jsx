import { ActionButton } from './ui-kit.jsx';
import React, { useState } from 'react';
import { Shapes, FileText, ArrowRight } from 'lucide-react';
import { categoryIcons, categoryNames, upper } from '../lib/formats.js';
import FormatCatalog from './FormatCatalog.jsx';

function CompactCatalog({ registry, Link, full = false }) {
  const categories = [...new Set(registry.formats.map((format) => format.category))];
  const [category, setCategory] = useState('image');
  const selected = categories.includes(category) ? category : categories[0];
  const formats = registry.formats.filter((format) => format.category === selected);
  const pairs = registry.pairs
    .filter((pair) => formats.some((format) => format.id === pair.source))
    .slice(0, full ? undefined : 4);
  return (
    <section className={`catalog ${full ? 'catalog-full' : ''}`}>
      <h2>
        <Shapes size={17} /> Browse formats
      </h2>
      <p>
        {registry.formats.length
          ? `${registry.formats.length} formats across ${categories.length} categories. Choose a category to view compatible conversions.`
          : 'Checking the formats available on this computer.'}
      </p>
      <div className="catalog-tabs" role="tablist" aria-label="Format categories">
        {categories.map((value) => {
          const Icon = categoryIcons[value] || FileText;
          return (
            <ActionButton
              variant="ghost"
              role="tab"
              aria-selected={selected === value}
              key={value}
              onClick={() => setCategory(value)}
            >
              <Icon size={13} />
              {categoryNames[value] || value}
              <small>{registry.formats.filter((format) => format.category === value).length}</small>
            </ActionButton>
          );
        })}
      </div>
      <div className="catalog-details">
        <div>
          <h3>{categoryNames[selected] || selected} formats</h3>
          <div className="format-tags">
            {formats.map((format) => (
              <Link key={format.id} to={`/${format.id}-converter`} title={format.label}>
                {upper(format.id)}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h3>Conversions</h3>
          <div className="pair-links">
            {pairs.map((pair) => (
              <Link key={`${pair.source}-${pair.target}`} to={`/${pair.source}-to-${pair.target}`}>
                {upper(pair.source)} <ArrowRight size={12} /> {upper(pair.target)}
              </Link>
            ))}
          </div>
        </div>
      </div>
      {!full && (
        <Link to="/formats" className="more-link">
          View all supported formats <ArrowRight size={14} />
        </Link>
      )}
    </section>
  );
}

export default function Catalog(props) {
  return props.full ? (
    <FormatCatalog registry={props.registry} Link={props.Link} />
  ) : (
    <CompactCatalog {...props} />
  );
}
