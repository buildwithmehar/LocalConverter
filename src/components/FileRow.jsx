import { ActionButton } from './ui-kit.jsx';
import React from 'react';
import { Flipped } from 'react-flip-toolkit';
import LocalProgress from './LocalProgress.jsx';
import {
  FileText,
  ArrowRight,
  LoaderCircle,
  Check,
  AlertCircle,
  ArrowDownToLine,
  RefreshCw,
  X,
  ChevronDown,
  Settings2,
} from 'lucide-react';
import { categoryIcons, upper, bytes } from '../lib/formats.js';
import { Link } from '../lib/navigation.jsx';
import { toolById } from '../../shared/everyday-tools.js';
import { jobDownloadUrl } from '../browser/client.js';

function FileRow({
  row,
  registry,
  sending,
  showConverterLink,
  animateLayout,
  onPicker,
  onOptions,
  onRemove,
  onCancel,
  onRetry,
}) {
  const Icon =
    categoryIcons[registry.formats.find((format) => format.id === row.source)?.category] ||
    FileText;
  const running = ['queued', 'processing'].includes(row.status);
  const tool = toolById(row.operation);
  return (
    <Flipped
      flipId={`file-${row.id}`}
      translate
      scale={false}
      opacity={false}
      shouldFlip={(_previous, current) => Boolean(current && animateLayout)}
    >
      <article
        className={`file-row status-${row.status}`}
        aria-label={`File: ${row.name}`}
        data-motion-engine="react-flip-toolkit"
      >
        <div className="file-info">
          <span className="file-icon-tile">
            <Icon className="file-icon" size={24} />
          </span>
          <div>
            <strong title={row.name}>{row.name}</strong>
            <span>
              {bytes(row.size)}
              {row.outputSize != null && row.status === 'completed'
                ? ` → ${bytes(row.outputSize)}`
                : ''}
              {row.status === 'pending' && <span className="file-ready">Ready to convert</span>}
            </span>
            {showConverterLink && (
              <Link
                className="file-converter-link"
                to={tool ? `/${tool.id}` : `/${row.source}-to-${row.target}`}
              >
                {tool ? tool.title : `${upper(row.source)} to ${upper(row.target)} converter`}{' '}
                <ArrowRight size={12} />
              </Link>
            )}
          </div>
        </div>
        <div className="file-controls">
          {row.status === 'pending' ? (
            <>
              <span className="format-small">{upper(row.source)}</span>
              <span className="to-label">
                <ArrowRight size={15} />
              </span>
              <ActionButton
                variant="secondary"
                className="target-small"
                aria-label={`Output format for ${row.name}: ${upper(row.target)}`}
                disabled={sending}
                onClick={(event) => onPicker(event, 'target', row)}
              >
                {upper(row.target)}
                <ChevronDown size={14} />
              </ActionButton>
              <ActionButton
                variant="secondary"
                className="options-button"
                aria-label={`Options for ${row.name}`}
                disabled={sending}
                onClick={onOptions}
              >
                <Settings2 size={16} />
                <span>Options</span>
              </ActionButton>
            </>
          ) : (
            <>
              <span className="format-static">
                {upper(row.source)} <ArrowRight size={13} /> {upper(row.target)}
              </span>
              {running ? (
                <div className="job-progress" role="status">
                  <span>
                    <LoaderCircle size={15} className="spin" />
                    {row.stage || (row.status === 'queued' ? 'Queued' : 'Converting')}
                    {typeof row.progress === 'number' ? ` ${Math.round(row.progress)}%` : ''}
                  </span>
                  {typeof row.progress === 'number' && (
                    <LocalProgress
                      value={row.progress}
                      label={`Conversion progress for ${row.name}`}
                    />
                  )}
                </div>
              ) : (
                <span className={`status-label ${row.status}`}>
                  {row.status === 'completed' ? <Check size={16} /> : <AlertCircle size={16} />}{' '}
                  {row.status === 'completed'
                    ? 'Finished'
                    : row.status === 'cancelled'
                      ? 'Cancelled'
                      : 'Failed'}
                </span>
              )}
              {row.status === 'completed' && (
                <a
                  className="download-button"
                  href={jobDownloadUrl(row.id)}
                  download={row.outputName || row.name}
                  aria-label={`Download ${row.outputName || row.name}`}
                >
                  <ArrowDownToLine size={17} /> Download
                </a>
              )}
              {['failed', 'cancelled'].includes(row.status) && (
                <ActionButton
                  variant="secondary"
                  className="secondary-button retry-button"
                  onClick={onRetry}
                  aria-label={`Retry ${row.name}`}
                >
                  <RefreshCw size={15} /> Retry
                </ActionButton>
              )}
              {running && (
                <ActionButton
                  variant="ghost"
                  className="text-button"
                  aria-label={`Cancel ${row.name}`}
                  onClick={onCancel}
                >
                  Cancel
                </ActionButton>
              )}
            </>
          )}
          <ActionButton
            variant="icon"
            className="icon-button delete-button"
            disabled={sending}
            aria-label={`Remove ${row.name}`}
            onClick={onRemove}
          >
            <X size={18} />
          </ActionButton>
        </div>
        {row.error && (
          <p className="job-error" role="alert">
            <AlertCircle size={15} />
            {row.error}
          </p>
        )}
      </article>
    </Flipped>
  );
}

export default FileRow;
