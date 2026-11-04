import { motion, useIsPresent } from 'motion/react';
import { ActionButton, useUiMotion } from './ui-kit.jsx';
import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, X, Info } from 'lucide-react';
import { defaults, upper } from '../lib/formats.js';
import { settingDescription } from '../lib/converter-content.js';

function OptionsDialog({ row, pair, onClose, onSave }) {
  const { reduced, foreground, input } = useUiMotion();
  const present = useIsPresent();
  const instant = reduced || !foreground || input.current === 'keyboard';
  const [values, setValues] = useState({ ...defaults(pair), ...row.options });
  const root = useRef(null),
    previous = useRef(document.activeElement);
  useEffect(() => {
    root.current?.querySelector('input, select, button')?.focus();
    return () => previous.current?.focus();
  }, []);
  const trapFocus = (event) => {
    if (event.key !== 'Tab') return;
    const items = [
      ...root.current.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
      ),
    ];
    const first = items[0],
      last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  return (
    <motion.div
      initial={instant ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: instant ? 0 : present ? 0.2 : 0.12 }}
      inert={!present || undefined}
      aria-hidden={!present || undefined}
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.section
        initial={instant ? false : { y: 10, scale: 0.985 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 5, scale: 0.99 }}
        transition={{ duration: instant ? 0 : present ? 0.24 : 0.12, ease: [0.22, 1, 0.36, 1] }}
        className="options-dialog"
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-labelledby="options-title"
        onKeyDown={trapFocus}
      >
        <header>
          <div>
            <h2 id="options-title">Conversion options</h2>
            <p title={row.name}>
              {row.name} <ArrowRight size={13} /> {upper(row.target)}
            </p>
          </div>
          <ActionButton
            variant="icon"
            className="icon-button"
            aria-label="Close options"
            onClick={onClose}
          >
            <X size={21} />
          </ActionButton>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave(values);
          }}
        >
          <div className="options-fields">
            {pair?.options?.length ? (
              pair.options.map((option) => (
                <label
                  key={option.key}
                  className={`option-field ${option.type === 'checkbox' || option.type === 'boolean' ? 'checkbox-field' : ''}`}
                >
                  <span>{option.label.replace(/\s*\(.*\)/, '')}</span>
                  {option.type === 'select' ? (
                    <select
                      value={values[option.key] ?? ''}
                      onChange={(event) =>
                        setValues((current) => ({ ...current, [option.key]: event.target.value }))
                      }
                    >
                      {(option.choices || []).map((choice) => (
                        <option key={choice.value ?? choice} value={choice.value ?? choice}>
                          {choice.label ?? choice}
                        </option>
                      ))}
                    </select>
                  ) : option.type === 'checkbox' || option.type === 'boolean' ? (
                    <input
                      type="checkbox"
                      checked={Boolean(values[option.key])}
                      onChange={(event) =>
                        setValues((current) => ({ ...current, [option.key]: event.target.checked }))
                      }
                    />
                  ) : (
                    <input
                      type={option.type === 'number' ? 'number' : 'text'}
                      min={option.min}
                      max={option.max}
                      step={option.step || 'any'}
                      value={values[option.key] ?? ''}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          [option.key]:
                            option.type === 'number' && event.target.value !== ''
                              ? Number(event.target.value)
                              : event.target.value,
                        }))
                      }
                    />
                  )}{' '}
                  <small>{settingDescription(option)}</small>
                </label>
              ))
            ) : (
              <p>This conversion uses fixed settings. No adjustment is needed.</p>
            )}
            {pair?.limitations?.length > 0 && (
              <div className="limitations">
                <Info size={16} />
                <p>
                  {Array.isArray(pair.limitations) ? pair.limitations.join(' ') : pair.limitations}
                </p>
              </div>
            )}
          </div>
          <footer>
            <ActionButton
              variant="secondary"
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancel
            </ActionButton>
            <ActionButton variant="primary" className="primary-button" type="submit">
              Save options
            </ActionButton>
          </footer>
        </form>
      </motion.section>
    </motion.div>
  );
}

export default OptionsDialog;
