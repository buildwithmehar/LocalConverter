import InfoHero from '../components/InfoHero.jsx';
import { Surface } from '../components/ui-kit.jsx';

import React, { useState } from 'react';

import { ArrowRight, CheckCircle2 } from 'lucide-react';

import { categoryNames, upper } from '../lib/formats.js';

import './tools.css';

import ToolsGuide from './ToolsGuide.jsx';

import EverydayTools from '../components/EverydayTools.jsx';

export default function ToolsPage({ registry, Link }) {
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('');

  const categories = [
    ...new Set([...registry.formats, ...(registry.tools || [])].map((f) => f.category)),
  ];

  const formats = new Map(registry.formats.map((f) => [f.id, f]));

  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);

  const direction = query
    .toLowerCase()
    .trim()
    .match(/^(\w+)\s*(?:\s+to\s+|→|->)\s*(\w+)$/);

  const pairs = registry.pairs.filter((pair) => {
    const input = formats.get(pair.source),
      output = formats.get(pair.target);

    const title = `${pair.source} to ${pair.target} ${input.label} ${output.label}`.toLowerCase();

    return (
      (!category || input.category === category) &&
      (direction
        ? pair.source === direction[1] && pair.target === direction[2]
        : tokens.every((token) => title.includes(token)))
    );
  });

  return (
    <>
      <InfoHero>
        <h1>Local conversion tools</h1>
        <p>
          Find a conversion by file format or category. Work with images, PDFs, animation, media and
          structured data, in one private local workspace.
        </p>
      </InfoHero>
      <div className="info-content">
        <p className="tools-summary">
          {registry.tools?.length || 0} dedicated tools and {registry.pairs.length} conversions
          across {registry.formats.length} file formats. Image tools include resizing and
          re-encoding.
        </p>

        <a className="tools-guide-jump" href="#tools-guide">
          How to choose a tool <ArrowRight size={14} />
        </a>

        <div className="tools-filters">
          <label>
            Search local tools
            <input
              type="search"
              aria-label="Search local tools"
              placeholder="For example, PNG to JPG"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            Category
            <select
              aria-label="Tool category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((id) => (
                <option key={id} value={id}>
                  {categoryNames[id] || id}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="tool-category-chips" role="group" aria-label="Browse tool categories">
          <button type="button" aria-pressed={!category} onClick={() => setCategory('')}>
            All tools <span>{(registry.tools?.length || 0) + registry.pairs.length}</span>
          </button>
          {categories.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={category === id}
              onClick={() => setCategory(id)}
            >
              {categoryNames[id] || 'Design'}
              <span>
                {(registry.tools || []).filter((tool) => tool.category === id).length +
                  registry.pairs.filter((pair) => formats.get(pair.source)?.category === id).length}
              </span>
            </button>
          ))}
        </div>
        <EverydayTools registry={registry} query={query} category={category} />

        <p className="tools-summary" role="status">
          {pairs.length} format {pairs.length === 1 ? 'converter' : 'converters'} shown
        </p>

        <div className="tool-list">
          {pairs.map((pair) => (
            <Link
              data-testid="tool-link"
              className="tool-link"
              key={`${pair.source}-${pair.target}`}
              to={`/${pair.source}-to-${pair.target}`}
            >
              <Surface className="tool-magic-card" contentClassName="tool-card-content">
                <span className="tool-category">
                  {categoryNames[formats.get(pair.source).category]}
                </span>
                <strong>
                  {upper(pair.source)} <ArrowRight size={14} /> {upper(pair.target)}
                </strong>
                <small>
                  {pair.source === pair.target
                    ? 'Resize or re-encode'
                    : `${formats.get(pair.source).label} to ${formats.get(pair.target).label}`}
                  {pair.options.length ? ' · Output settings' : ''}
                </small>
              </Surface>
            </Link>
          ))}
        </div>

        {!pairs.length && <p className="tools-empty">No matching local tools.</p>}

        <section className="local-engine-list" aria-label="Installed local engines">
          <h2>Installed conversion tools</h2>
          <ul>
            {registry.dependencies
              .filter((d) => d.available)
              .map((d) => (
                <li key={d.name}>
                  <CheckCircle2 size={15} />
                  {d.name}
                </li>
              ))}
          </ul>
        </section>

        <ToolsGuide />
      </div>
    </>
  );
}
