import React from 'react';

import {
  ArrowRight,
  Minimize2,
  Scaling,
  Crop,
  Files,
  Scissors,
  Images,
  FileText,
  FileCode,
  Music,
  Film,
  Palette,
  Archive,
} from 'lucide-react';

import { everydayTools, essentialTools } from '../../shared/everyday-tools.js';

import { Link } from '../lib/navigation.jsx';

export const everydayIcons = {
  compress: Minimize2,
  resize: Scaling,
  crop: Crop,
  merge: Files,
  split: Scissors,
  images: Images,
  files: Files,
  data: FileCode,
  audio: Music,
  music: Music,
  video: Film,
  design: Palette,
  archive: Archive,
};

export default function EverydayTools({ registry, compact = false, query = '', category = '' }) {
  const available = (compact ? essentialTools : everydayTools).filter(
    (tool) =>
      registry.tools?.some((item) => item.id === tool.id) &&
      (!category || tool.category === category) &&
      query
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .every((token) => `${tool.title} ${tool.summary} ${tool.id}`.toLowerCase().includes(token)),
  );

  if (!available.length) return null;

  return (
    <section
      className={`everyday-tools ${compact ? 'everyday-tools-home' : ''}`}
      aria-labelledby="everyday-tools-heading"
    >
      <div className="everyday-tools-heading">
        <div>
          <span className="home-eyebrow">Find the right result</span>
          <h2 id="everyday-tools-heading">{compact ? 'Essential tools' : 'Your local toolbox'}</h2>
          <p>
            {compact
              ? 'Smaller images. The right dimensions. Documents in order.'
              : `${available.length} tools for images, documents, media and everyday tasks.`}
          </p>
        </div>
        {compact && (
          <Link to="/tools">
            All tools <ArrowRight size={16} />
          </Link>
        )}
      </div>

      <div className="everyday-tools-grid">
        {available.map((tool) => {
          const Icon = everydayIcons[tool.icon] || FileText;
          return (
            <Link
              key={tool.id}
              to={`/${tool.id}`}
              className="everyday-tool-card"
              data-appear="card"
            >
              <span className="everyday-tool-icon">
                <Icon size={21} />
              </span>
              <div>
                <strong>{tool.title}</strong>
                <p>{tool.summary}</p>
              </div>
              <ArrowRight size={16} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
