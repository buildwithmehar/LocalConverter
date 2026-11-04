import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowDown,
  HardDrive,
  FileCheck2,
  FilePlus2,
  ShieldCheck,
  Clock3,
  UserRoundCheck,
} from 'lucide-react';
import { Link } from '../lib/navigation.jsx';
import { categoryNames, categoryIcons, upper } from '../lib/formats.js';
import { ActionButton, Surface, useUiMotion } from './ui-kit.jsx';

const order = [
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
const descriptions = {
  image: 'Make a screenshot upload-ready or pick a format for the web.',
  document: 'Change document formats or extract text with the installed tools.',
  audio: 'Choose the audio format your next app needs.',
  video: 'Convert a video or save its audio track.',
  archive: 'Repack supported archives for sharing and storage.',
  spreadsheet: 'Move tables between spreadsheet and data formats.',
  data: 'Move structured records between supported text formats.',
  vector: 'Turn scalable graphics into a compatible image.',
  subtitle: 'Switch between the subtitle formats available here.',
};
const preferred = ['png-jpg', 'jpg-webp', 'webp-png', 'pdf-png', 'mp4-mp3', 'csv-xlsx'];

function HomeFormatBrowser({ registry }) {
  const [selected, setSelected] = useState('image');
  const { reduced, input } = useUiMotion();
  const categories = order.filter((id) =>
    registry.formats.some((format) => format.category === id),
  );
  const active = categories.includes(selected) ? selected : categories[0];
  const formats = registry.formats.filter((format) => format.category === active);
  const sourceIds = new Set(formats.map((format) => format.id));
  const pairs = registry.pairs.filter(
    (pair) => sourceIds.has(pair.source) && pair.source !== pair.target,
  );
  const rank = (pair) => {
    const index = preferred.indexOf(`${pair.source}-${pair.target}`);
    return index < 0 ? preferred.length : index;
  };
  const ranked = [...pairs].sort((a, b) => rank(a) - rank(b));
  const suggestions = [];
  for (const pair of ranked)
    if (!suggestions.some((item) => item.source === pair.source)) suggestions.push(pair);
  for (const pair of ranked) if (!suggestions.includes(pair)) suggestions.push(pair);
  return (
    <Surface
      as="section"
      className="home-browser"
      contentClassName="home-browser-body"
      aria-labelledby="home-formats-heading"
    >
      <div className="home-panel-heading">
        <div>
          <span className="home-eyebrow">Find your next format</span>
          <h2 id="home-formats-heading">Browse formats</h2>
        </div>
        <span className="home-registry-count">
          {registry.formats.length} formats <span> / </span> {categories.length} categories
        </span>
      </div>
      <p className="home-panel-intro">Start with a file type. See what you can turn it into.</p>
      <div className="home-category-grid" role="group" aria-label="Browse by file type">
        {categories.map((id) => {
          const Icon = categoryIcons[id];
          return (
            <ActionButton
              variant="secondary"
              key={id}
              data-category={id}
              aria-pressed={active === id}
              onClick={() => setSelected(id)}
            >
              <Icon size={17} />
              <span>{categoryNames[id]}</span>
              <small>{registry.formats.filter((f) => f.category === id).length}</small>
            </ActionButton>
          );
        })}
      </div>
      {active ? (
        <div
          className="home-category-detail"
          key={active}
          data-motion={reduced || input.current === 'keyboard' ? 'off' : 'on'}
        >
          <div className="home-category-caption">
            <h3>{categoryNames[active]}</h3>
            <span>
              {pairs.length} conversion{pairs.length === 1 ? '' : 's'}
            </span>
          </div>
          <p>{descriptions[active]}</p>
          <div className="home-format-tags" aria-label={`${categoryNames[active]} formats`}>
            {formats.map((format) => (
              <Link key={format.id} to={`/${format.id}-converter`}>
                {upper(format.id)}
                <ArrowRight size={12} />
              </Link>
            ))}
          </div>
          <div className="home-pair-links">
            {suggestions.slice(0, 4).map((pair) => (
              <Link key={`${pair.source}-${pair.target}`} to={`/${pair.source}-to-${pair.target}`}>
                <span>
                  {upper(pair.source)}
                  <ArrowRight size={12} />
                  {upper(pair.target)}
                </span>
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <p className="home-checking">Checking available formats…</p>
      )}
      <Link className="home-text-link home-browser-footer" to="/formats">
        View all supported formats <ArrowRight size={16} />
      </Link>
    </Surface>
  );
}

function HomePrivacy({ limits }) {
  return (
    <Surface
      as="section"
      className="home-privacy"
      contentClassName="home-privacy-body"
      aria-labelledby="home-privacy-heading"
    >
      <span className="home-privacy-mark">
        <ShieldCheck size={23} />
      </span>
      <h2 id="home-privacy-heading">Data security</h2>
      <p className="home-panel-intro">Local from start to finish.</p>
      <div
        className="home-file-flow"
        aria-label="Your file is processed on this computer and saved as your download"
      >
        <div>
          <FilePlus2 size={18} />
          <span>Your file</span>
        </div>
        <ArrowDown size={15} />
        <div className="home-local-node">
          <HardDrive size={21} />
          <span>
            This computer<small>Local processing</small>
          </span>
          <span className="home-local-dot" />
        </div>
        <ArrowDown size={15} />
        <div>
          <FileCheck2 size={18} />
          <span>Your download</span>
        </div>
      </div>
      <ul className="home-privacy-facts">
        <li>
          <ShieldCheck size={16} />
          <p>
            <strong>No remote conversion service.</strong> Files are processed by the local server
            on this computer.
          </p>
        </li>
        <li>
          <Clock3 size={16} />
          <p>
            <strong>Temporary copies.</strong> Results expire after {limits?.retentionMinutes || 30}{' '}
            minutes. Your originals stay unchanged.
          </p>
        </li>
        <li>
          <UserRoundCheck size={16} />
          <p>
            <strong>No account needed.</strong> Choose a file and get started.
          </p>
        </li>
      </ul>
      <Link className="home-text-link" to="/security">
        How files are handled <ArrowRight size={16} />
      </Link>
    </Surface>
  );
}

export default function HomeDiscovery({ registry }) {
  return (
    <div className="home-discovery">
      <HomeFormatBrowser registry={registry} />
      <HomePrivacy limits={registry.limits} />
    </div>
  );
}
