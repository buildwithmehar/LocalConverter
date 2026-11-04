import { ActionButton, Surface, EffectBeam, useUiMotion } from './ui-kit.jsx';
import React, { useEffect, useRef } from 'react';
import { Flipper } from 'react-flip-toolkit';
import { Plus, LockKeyhole, RefreshCw, LoaderCircle, Check, ArrowDownToLine } from 'lucide-react';
import FileRow from './FileRow.jsx';
import { isBrowserSite } from '../browser/site-mode.js';
import { downloadBrowserBatch } from '../browser/client.js';

export default function ConversionWorkspace({
  pending,
  jobs,
  registry,
  sending,
  pair,
  activity,
  onSelect,
  onClear,
  onConvert,
  onPicker,
  onOptions,
  onRemove,
  onCancel,
  onRetry,
  onDragOver,
  onDrop,
}) {
  const { reduced, foreground, input } = useUiMotion();
  const rows = [...pending, ...jobs];
  const animateRows = !reduced && foreground && input.current !== 'keyboard';
  const flipper = useRef(null);
  useEffect(() => {
    const instance = flipper.current;
    const cancel = () => {
      if (!instance) return;
      for (const entry of Object.values(instance.inProgressAnimations)) entry.destroy?.();
      instance.inProgressAnimations = {};
      instance.el?.querySelectorAll('[data-flip-id]').forEach((element) => {
        element.style.transform = '';
        element.style.opacity = '';
      });
    };
    if (!animateRows) cancel();
    return cancel;
  }, [animateRows]);
  const active = jobs.some((job) => ['queued', 'processing'].includes(job.status));
  const finished = jobs.filter((job) => job.status === 'completed');
  const step = !pending.length && !active && finished.length ? 3 : 2;
  const downloadUrl = `/api/download-all${pair ? `?source=${pair.source}&target=${pair.target}` : ''}`;
  return (
    <Surface
      appear={false}
      as="section"
      className={`queue workspace ${activity ? 'activity-workspace' : ''}`}
      aria-label="Files to convert"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ol className="conversion-steps" aria-label="Conversion steps">
        {['Choose files', 'Adjust & convert', 'Download'].map((label, index) => (
          <li
            key={label}
            className={step > index + 1 ? 'complete' : step === index + 1 ? 'current' : ''}
            aria-current={step === index + 1 ? 'step' : undefined}
          >
            <span>{step > index + 1 ? <Check size={14} /> : index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <div className="workspace-heading">
        <div>
          <h2>
            Your files <span>{pending.length + jobs.length}</span>
          </h2>
          <p>
            {pending.length
              ? 'Choose an output format and open Options to adjust the settings.'
              : active
                ? 'Converting your files on this computer.'
                : finished.length
                  ? 'Download your converted files before clearing the workspace.'
                  : 'Review the message below, then retry or choose different settings.'}
          </p>
        </div>
        <ActionButton
          variant="ghost"
          className="text-button clear-files-button"
          onClick={onClear}
          disabled={sending}
        >
          Clear all
        </ActionButton>
      </div>
      <Flipper
        ref={flipper}
        className="workspace-files"
        flipKey={rows.map((row) => row.id).join('|')}
        decisionData={animateRows}
        spring={{ stiffness: 560, damping: 42, overshootClamping: true }}
      >
        {rows.map((row) => (
          <FileRow
            key={row.id}
            row={row}
            animateLayout={animateRows}
            registry={registry}
            sending={sending}
            showConverterLink={activity}
            onPicker={onPicker}
            onOptions={() => onOptions(row)}
            onRemove={() => onRemove(row)}
            onCancel={() => onCancel(row)}
            onRetry={() => onRetry(row)}
          />
        ))}
      </Flipper>
      <ActionButton
        variant="secondary"
        className="add-files-button"
        disabled={!registry.pairs.length || sending}
        onClick={onSelect}
      >
        <Plus size={18} /> Add more files <span>or drop them here</span>
      </ActionButton>
      <div className="workspace-actions">
        <p>
          <LockKeyhole size={15} /> Processed on this computer
        </p>
        <div className="workspace-action-buttons">
          {finished.length > 0 && (
            <a
              className="secondary-button download-all"
              href={isBrowserSite() ? '#' : downloadUrl}
              onClick={
                isBrowserSite()
                  ? (event) => {
                      event.preventDefault();
                      void downloadBrowserBatch(finished).catch((error) =>
                        window.alert(error.message),
                      );
                    }
                  : undefined
              }
            >
              <ArrowDownToLine size={17} /> Download all
            </a>
          )}
          {pending.length ? (
            <ActionButton
              variant="primary"
              className="primary-button"
              disabled={sending}
              onClick={onConvert}
            >
              {sending ? <LoaderCircle size={18} className="spin" /> : <RefreshCw size={18} />}{' '}
              {sending ? 'Adding files…' : 'Convert'}
            </ActionButton>
          ) : active ? (
            <span className="active-label">
              <LoaderCircle size={18} className="spin" /> Converting…
            </span>
          ) : finished.length ? (
            <span className="done-label">
              <Check size={18} /> All files processed
            </span>
          ) : null}
        </div>
      </div>
      <p className="workspace-retention">
        {isBrowserSite()
          ? 'Results stay in this tab until removed or reloaded. Original files are unchanged.'
          : `Temporary copies expire after ${registry.limits.retentionMinutes || 30} minutes. Original files are unchanged.`}
      </p>
      <EffectBeam active={active || sending} />
    </Surface>
  );
}
