import React, { useRef, useState } from 'react';
import { ArrowDownRight, ArrowRight, Check, Search, X, LockKeyhole } from 'lucide-react';
import { ActionButton, Surface } from './ui-kit.jsx';
import FormatFileIcon from './FormatFileIcon.jsx';
import { categoryIcons, categoryNames, upper } from '../lib/formats.js';
import { formatDescription } from '../lib/converter-content.js';

const categoryOrder = [
  'image',
  'document',
  'audio',
  'video',
  'archive',
  'spreadsheet',
  'data',
  'vector',
  'subtitle',
];

function ConversionCards({ format, pairs, formats, Link }) {
  const outgoing = pairs.filter((pair) => pair.source === format.id);
  const available = outgoing.length ? outgoing : pairs.filter((pair) => pair.target === format.id);
  return (
    <section className="format-library-results" aria-labelledby="format-results-heading">
      <div className="format-results-heading">
        <span className="format-current-icon">
          <FormatFileIcon format={format.id} />
        </span>
        <div>
          <h3 id="format-results-heading">
            {outgoing.length ? (
              <>Convert {upper(format.id)} to…</>
            ) : (
              <>Convert to {upper(format.id)}</>
            )}
          </h3>
          <p>
            {available.length} compatible {available.length === 1 ? 'conversion' : 'conversions'}
          </p>
        </div>
        <span className="format-results-direction" aria-hidden="true">
          <ArrowDownRight size={24} />
        </span>
      </div>
      <div key={format.id} className="format-conversion-grid">
        {available.map((pair) => {
          const output = formats.find((item) => item.id === pair.target);
          return (
            <Link
              className="format-conversion-link"
              key={`${pair.source}-${pair.target}`}
              to={`/${pair.source}-to-${pair.target}`}
              aria-label={`${upper(pair.source)} to ${upper(pair.target)} converter`}
            >
              <Surface
                as="article"
                className="format-conversion-card"
                contentClassName="format-conversion-content"
              >
                <div className="format-pair-title">
                  <span>{upper(pair.source)}</span>
                  <ArrowRight size={16} />
                  <strong>{upper(pair.target)}</strong>
                  {pair.source === pair.target && <small>Re-encode</small>}
                </div>
                <p>{formatDescription(output).split(/(?<=\.)\s/)[0]}</p>
                <span className="format-card-action">
                  Open converter <ArrowRight size={15} />
                </span>
              </Surface>
            </Link>
          );
        })}
      </div>
      <p className="format-library-privacy">
        <LockKeyhole size={14} /> Processed on this computer. No account required.
      </p>
    </section>
  );
}

export default function FormatCatalog({ registry, Link }) {
  const [category, setCategory] = useState('image');
  const [source, setSource] = useState('png');
  const [search, setSearch] = useState('');
  const searchInput = useRef(null);
  const categories = categoryOrder.filter((id) =>
    registry.formats.some((format) => format.category === id),
  );
  const selectedCategory = categories.includes(category) ? category : categories[0];
  const query = search.toLowerCase().trim().replace(/^\./, '');
  const tokens = query.split(/\s+/).filter(Boolean);
  const visibleFormats = registry.formats.filter((format) =>
    query
      ? tokens.every((token) =>
          `${format.id} ${format.label} ${categoryNames[format.category]}`
            .toLowerCase()
            .includes(token),
        )
      : format.category === selectedCategory,
  );
  const selected = visibleFormats.find((format) => format.id === source) || visibleFormats[0];
  const activeCategory = query ? selected?.category : selectedCategory;

  function chooseCategory(id) {
    setCategory(id);
    setSource(
      id === 'image' ? 'png' : registry.formats.find((format) => format.category === id)?.id,
    );
    setSearch('');
  }
  function clearSearch() {
    setSearch('');
    searchInput.current?.focus();
  }

  return (
    <section className="format-library" aria-labelledby="format-library-heading">
      <div className="format-library-toolbar">
        <div>
          <h2 id="format-library-heading">Browse formats</h2>
          <p>
            {registry.formats.length} formats. {registry.pairs.length} conversions. Find the right
            output for your file.
          </p>
        </div>
        <div className="format-library-search">
          <label htmlFor="format-library-search">Find a format</label>
          <div>
            <Search size={18} />
            <input
              id="format-library-search"
              ref={searchInput}
              type="search"
              value={search}
              placeholder="Search PNG, MP3, PDF…"
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') clearSearch();
              }}
            />
            {search && (
              <ActionButton variant="icon" aria-label="Clear format search" onClick={clearSearch}>
                <X size={16} />
              </ActionButton>
            )}
          </div>
        </div>
      </div>
      <div className="format-library-categories" role="group" aria-label="Format categories">
        {categories.map((id) => {
          const Icon = categoryIcons[id];
          return (
            <ActionButton
              variant="ghost"
              key={id}
              aria-pressed={activeCategory === id}
              onClick={() => chooseCategory(id)}
            >
              <Icon size={16} />
              <span>{categoryNames[id]}</span>
              <small>{registry.formats.filter((format) => format.category === id).length}</small>
            </ActionButton>
          );
        })}
      </div>
      <p className="sr-only" role="status">
        {query
          ? `${visibleFormats.length} matching formats`
          : `${categoryNames[selectedCategory]} selected`}
        . {selected ? `Showing ${upper(selected.id)} conversions.` : 'No matching formats.'}
      </p>
      {selected ? (
        <div className="format-library-layout">
          <Surface
            appear={false}
            as="aside"
            className="format-library-source"
            contentClassName="format-source-content"
            aria-label="Select a file format"
          >
            <div className="format-source-heading">
              <h3>{query ? 'Matching formats' : categoryNames[selectedCategory]}</h3>
              <p>Select the format of your file.</p>
            </div>
            <div className="format-source-list">
              {visibleFormats.map((format) => {
                const count = registry.pairs.filter((pair) => pair.source === format.id).length;
                return (
                  <ActionButton
                    variant="ghost"
                    className="format-source-button"
                    key={format.id}
                    aria-label={`Show ${upper(format.id)} conversions`}
                    aria-pressed={selected.id === format.id}
                    onClick={() => setSource(format.id)}
                  >
                    <span className="format-source-icon">
                      <FormatFileIcon format={format.id} />
                    </span>
                    <span className="format-source-name">
                      <strong>{upper(format.id)}</strong>
                      <small>
                        {format.label === upper(format.id) ? `.${format.id}` : format.label}
                      </small>
                    </span>
                    <span className="format-source-count">
                      {selected.id === format.id ? (
                        <Check size={16} />
                      ) : count ? (
                        <>
                          {count}
                          <ArrowRight size={13} />
                        </>
                      ) : (
                        'Output'
                      )}
                    </span>
                  </ActionButton>
                );
              })}
            </div>
            <div className="format-source-note">
              <p>{formatDescription(selected)}</p>
              <Link to={`/${selected.id}-converter`}>
                About {upper(selected.id)} <ArrowRight size={14} />
              </Link>
            </div>
          </Surface>
          <ConversionCards
            format={selected}
            pairs={registry.pairs}
            formats={registry.formats}
            Link={Link}
          />
        </div>
      ) : (
        <div className="format-library-empty">
          <Search size={27} />
          <h3>{registry.formats.length ? 'No matching formats' : 'Checking local formats…'}</h3>
          <p>
            {registry.formats.length
              ? 'Try a file extension such as PNG, a format name such as JPEG, or a category such as Audio.'
              : 'The formats available on this computer will appear here.'}
          </p>
          {query && (
            <ActionButton variant="secondary" onClick={clearSearch}>
              Clear search
            </ActionButton>
          )}
        </div>
      )}
    </section>
  );
}
