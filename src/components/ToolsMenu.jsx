import React, { useRef, useState } from 'react';

import { ArrowRight, ChevronRight, FileText } from 'lucide-react';

import { categoryIcons, categoryNames, upper } from '../lib/formats.js';

import { Link } from '../lib/navigation.jsx';

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
  'design',
];

const popularTools = ['png-jpg', 'jpg-webp', 'webp-png', 'pdf-png', 'mp4-mp3', 'csv-xlsx'];

export default function ToolsMenu({ registry, route }) {
  const formats = new Map(registry.formats.map((format) => [format.id, format]));

  const categories = categoryOrder.filter(
    (category) =>
      registry.pairs.some((pair) => formats.get(pair.source)?.category === category) ||
      (registry.tools || []).some((tool) => tool.category === category),
  );

  const currentPair = registry.pairs.find((pair) => route === `/${pair.source}-to-${pair.target}`);

  const sourceFormat = registry.formats.find(
    (format) => route === `/${format.id}-converter` || route === `/to-${format.id}`,
  );

  const routeCategory =
    formats.get(currentPair?.source)?.category ||
    sourceFormat?.category ||
    categories.find((category) => route === `/${category}-converter`);

  const [selected, setSelected] = useState(routeCategory || categories[0]);

  const active = categories.includes(selected) ? selected : categories[0];

  const priority = (pair) =>
    pair.source === pair.target
      ? 100
      : popularTools.includes(`${pair.source}-${pair.target}`)
        ? popularTools.indexOf(`${pair.source}-${pair.target}`)
        : 50;

  const pairs = registry.pairs
    .filter((pair) => formats.get(pair.source)?.category === active)
    .sort((a, b) => priority(a) - priority(b));

  const quickTools = (registry.tools || []).filter((tool) => tool.category === active);

  const buttons = useRef({});

  const list = useRef(null);

  const Icon = categoryIcons[active] || FileText;

  function categoryKey(event, category) {
    const index = categories.indexOf(category);

    let next;

    if (event.key === 'ArrowDown') next = categories[(index + 1) % categories.length];

    if (event.key === 'ArrowUp')
      next = categories[(index - 1 + categories.length) % categories.length];

    if (event.key === 'Home') next = categories[0];

    if (event.key === 'End') next = categories.at(-1);

    if (next) {
      event.preventDefault();
      buttons.current[next]?.focus();
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      list.current?.querySelector('a')?.focus();
    }
  }

  return (
    <>
      <div className="tools-menu-top">
        <span>Conversion tools</span>
        <Link to="/tools">
          All local tools <ArrowRight size={14} />
        </Link>
      </div>

      {categories.length ? (
        <div className="tools-menu-body">
          <div className="tools-menu-categories" aria-label="Tool categories">
            {categories.map((category) => {
              const CategoryIcon = categoryIcons[category] || FileText;

              return (
                <button
                  type="button"
                  key={category}
                  id={`tools-category-${category}`}
                  ref={(element) => {
                    buttons.current[category] = element;
                  }}

                  aria-expanded={active === category}
                  aria-controls="tools-category-converters"

                  onPointerEnter={(event) => {
                    if (event.pointerType === 'mouse') setSelected(category);
                  }}

                  onFocus={() => setSelected(category)}
                  onClick={() => setSelected(category)}
                  onKeyDown={(event) => categoryKey(event, category)}
                >
                  <CategoryIcon size={16} />
                  <span>{categoryNames[category] || 'Design'}</span>
                  <ChevronRight size={13} />
                </button>
              );
            })}
          </div>

          <section
            className="tools-menu-converters"
            id="tools-category-converters"
            aria-labelledby={`tools-category-${active}`}
          >
            <div className="tools-menu-heading">
              <span>
                <Icon size={17} />
                {categoryNames[active] || 'Design'} tools
              </span>
              <small>{pairs.length} converters</small>
            </div>

            {quickTools.length > 0 && (
              <div className="tools-menu-quick" aria-label="Essential tools">
                {quickTools.slice(0, 4).map((tool) => (
                  <Link key={tool.id} to={`/${tool.id}`}>
                    {tool.title}
                    <ArrowRight size={12} />
                  </Link>
                ))}
              </div>
            )}

            <div
              className="tools-menu-links"
              ref={list}
              key={active}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') {
                  event.preventDefault();
                  buttons.current[active]?.focus();
                }
              }}
            >
              {pairs.map((pair) => (
                <Link
                  key={`${pair.source}-${pair.target}`}
                  to={`/${pair.source}-to-${pair.target}`}
                  aria-label={`${upper(pair.source)} to ${upper(pair.target)}`}
                  aria-current={route === `/${pair.source}-to-${pair.target}` ? 'page' : undefined}
                >
                  <span>
                    <strong>{upper(pair.source)}</strong>
                    <ArrowRight size={12} />
                    <strong>{upper(pair.target)}</strong>
                  </span>
                  <ChevronRight size={13} />
                </Link>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <p className="tools-menu-empty">
          {registry.formats.length
            ? 'No conversion tools are available.'
            : 'Connecting to your local tools…'}
        </p>
      )}
    </>
  );
}
