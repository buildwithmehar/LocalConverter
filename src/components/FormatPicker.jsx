import { motion, useIsPresent } from 'motion/react';
import { ActionButton, useUiMotion } from './ui-kit.jsx';
import React, { useState, useRef, useLayoutEffect } from 'react';
import { Search, X, FileText, Check } from 'lucide-react';
import { categoryIcons, categoryNames, formatLabel } from '../lib/formats.js';

function FormatPicker({ formats, picker, currentFormat, onSelect, onClose }) {
  const { reduced, foreground, input: inputMethod } = useUiMotion();
  const present = useIsPresent();
  const instant = reduced || !foreground || inputMethod.current === 'keyboard';
  const [query, setQuery] = useState('');
  const categories = [...new Set(formats.map((format) => format.category))];
  const selected = formats.find((format) => format.id === currentFormat);
  const [category, setCategory] = useState(selected?.category || categories[0]);
  const [position, setPosition] = useState({ left: 12, top: 12, width: 520, height: 468 });
  const root = useRef(null),
    input = useRef(null),
    results = useRef(null),
    categoryRail = useRef(null);
  useLayoutEffect(() => {
    if (!present) return;
    const calculate = () => {
      const rect = picker.anchor.getBoundingClientRect();
      const width = Math.min(520, window.innerWidth - 24);
      const height = Math.min(468, window.innerHeight - 24);
      const below = rect.bottom + 10;
      const top =
        below + height <= window.innerHeight - 12
          ? below
          : rect.top - height - 10 >= 12
            ? rect.top - height - 10
            : Math.max(12, window.innerHeight - height - 12);
      setPosition({
        width,
        height,
        left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
        top,
      });
    };
    calculate();
    input.current?.focus();
    const frame = requestAnimationFrame(() => {
      const rail = categoryRail.current;
      const active = rail?.querySelector('[aria-pressed=true]');
      if (rail && active && rail.clientHeight) {
        rail.scrollTop += Math.max(
          0,
          active.getBoundingClientRect().bottom - rail.getBoundingClientRect().bottom + 8,
        );
      }
    });
    window.addEventListener('resize', calculate);
    window.addEventListener('scroll', calculate, true);
    const outside = (event) => {
      if (!root.current?.contains(event.target) && !picker.anchor.contains(event.target)) onClose();
    };
    document.addEventListener('pointerdown', outside);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', calculate);
      window.removeEventListener('scroll', calculate, true);
    };
  }, [present]);
  const search = query.trim().toLowerCase().replace(/^\./, '');
  const visible = formats.filter((format) =>
    search
      ? `${format.id} ${format.label} ${categoryNames[format.category] || format.category}`
          .toLowerCase()
          .includes(search)
      : format.category === category,
  );
  const showCategories = !search && categories.length > 1;
  const chooseCategory = (value) => {
    setCategory(value);
    results.current?.scrollTo({ top: 0 });
  };
  return (
    <motion.div
      ref={root}
      initial={instant ? false : { y: -5, scale: 0.985, opacity: 0 }}
      animate={{ y: 0, scale: 1, opacity: 1 }}
      exit={{ y: -3, scale: 0.99, opacity: 0 }}
      transition={{ duration: instant ? 0 : present ? 0.18 : 0.1, ease: [0.22, 1, 0.36, 1] }}
      inert={!present || undefined}
      aria-hidden={!present || undefined}
      className="format-picker"
      style={{ ...position, transformOrigin: 'top right' }}
      role="dialog"
      aria-label={`Select ${picker.mode === 'source' ? 'input' : 'output'} format`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="picker-heading">
        <h2>Choose {picker.mode === 'source' ? 'input' : 'output'} format</h2>
        <ActionButton variant="icon" aria-label="Close format picker" onClick={onClose}>
          <X size={18} />
        </ActionButton>
      </header>
      <div className="picker-search">
        <Search size={17} />
        <input
          ref={input}
          aria-label="Search Format"
          placeholder="Search Format"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              results.current?.querySelector('button')?.focus();
            }
            if (event.key === 'Enter' && search && visible.length === 1) {
              event.preventDefault();
              onSelect(visible[0]);
            }
          }}
        />
        {query && (
          <ActionButton
            variant="icon"
            aria-label="Clear format search"
            onClick={() => {
              setQuery('');
              input.current?.focus();
            }}
          >
            <X size={15} />
          </ActionButton>
        )}
      </div>
      <div className={`picker-body${showCategories ? '' : ' picker-body-wide'}`}>
        {showCategories && (
          <>
            <div ref={categoryRail} className="picker-categories" aria-label="Format categories">
              <p className="picker-section-label">File types</p>
              {categories.map((value) => {
                const Icon = categoryIcons[value] || FileText;
                return (
                  <button
                    type="button"
                    aria-pressed={category === value}
                    key={value}
                    onClick={() => chooseCategory(value)}
                  >
                    <Icon size={16} />
                    <span>{categoryNames[value] || value}</span>
                    <small>{formats.filter((format) => format.category === value).length}</small>
                  </button>
                );
              })}
            </div>
            <label className="picker-mobile-category">
              <span>File type</span>
              <select
                aria-label="File type"
                value={category}
                onChange={(event) => chooseCategory(event.target.value)}
              >
                {categories.map((value) => (
                  <option key={value} value={value}>
                    {categoryNames[value] || value}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <section className="picker-format-list" aria-label="Available formats">
          <div className="picker-list-heading">
            <span>{search ? 'Search results' : categoryNames[category] || 'Formats'}</span>
            <small>
              {visible.length} {visible.length === 1 ? 'format' : 'formats'}
            </small>
          </div>
          <div ref={results} className="picker-results">
            {visible.length ? (
              visible.map((format) => (
                <button
                  type="button"
                  key={format.id}
                  aria-label={formatLabel(format)}
                  aria-pressed={currentFormat === format.id}
                  title={format.label}
                  onClick={() => onSelect(format)}
                >
                  <span className="picker-format-top">
                    <strong>{formatLabel(format)}</strong>
                    {currentFormat === format.id && <Check size={15} />}
                  </span>
                  <span className="picker-format-name">{format.label}</span>
                </button>
              ))
            ) : (
              <div className="picker-empty">
                <Search size={24} />
                <strong>No matching formats</strong>
                <p>Try an extension like PNG or a file type like audio.</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    input.current?.focus();
                  }}
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
      <footer className="picker-footer">
        <span>Choose a format to continue</span>
        <span className="picker-key-hint">
          <kbd>Esc</kbd> to close
        </span>
      </footer>
    </motion.div>
  );
}

export default FormatPicker;
