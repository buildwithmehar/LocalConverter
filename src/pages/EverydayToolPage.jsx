import InfoHero from '../components/InfoHero.jsx';
import PageGuide from '../components/PageGuide.jsx';
import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import BrowserToolResult from '../components/BrowserToolResult.jsx';
const ToolLivePreview = lazy(() => import('../components/ToolLivePreview.jsx'));

import {
  ArrowDownToLine,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Plus,
  X,
  LockKeyhole,
  Check,
  LoaderCircle,
  RotateCw,
  TriangleAlert,
} from 'lucide-react';

import { ActionButton } from '../components/ui-kit.jsx';

import { everydayIcons } from '../components/EverydayTools.jsx';

import { everydayTools, sourceFromName, toolDefaults } from '../../shared/everyday-tools.js';

import { bytes } from '../lib/formats.js';

import { Link } from '../lib/navigation.jsx';
import { isBrowserSite } from '../browser/site-mode.js';
import { jobDownloadUrl } from '../browser/client.js';

function ImagePreview({ file, crop, options, onOptions }) {
  const [preview, setPreview] = useState(null),
    stage = useRef(null),
    start = useRef(null);

  useEffect(() => {
    setPreview(null);
    if (!file) return;

    const url = URL.createObjectURL(file.file),
      image = new Image();
    let alive = true;

    image.onload = () => {
      if (!alive) return;
      setPreview({ url, width: image.naturalWidth, height: image.naturalHeight });
      if (crop && options.width === 1 && options.height === 1)
        onOptions({ left: 0, top: 0, width: image.naturalWidth, height: image.naturalHeight });
    };

    image.onerror = () => {
      if (alive) setPreview({ error: true });
    };
    image.src = url;

    return () => {
      alive = false;
      URL.revokeObjectURL(url);
    };
  }, [file?.id, crop]);

  if (!file) return null;

  if (preview?.error)
    return (
      <p className="utility-hint">
        This browser cannot preview the selected image. The local engine will check it when
        processing starts.
      </p>
    );

  if (!preview) return <p className="utility-hint">Preparing preview…</p>;

  const point = (event) => {
    const box = stage.current.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(
          preview.width - 1,
          Math.round(((event.clientX - box.left) / box.width) * preview.width),
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          preview.height - 1,
          Math.round(((event.clientY - box.top) / box.height) * preview.height),
        ),
      ),
    };
  };

  const move = (event) => {
    if (!start.current) return;
    const end = point(event),
      origin = start.current;
    onOptions({
      left: Math.min(origin.x, end.x),
      top: Math.min(origin.y, end.y),
      width: Math.max(1, Math.abs(end.x - origin.x)),
      height: Math.max(1, Math.abs(end.y - origin.y)),
    });
  };

  return (
    <div className="utility-preview">
      <div
        ref={stage}
        className={`utility-image-stage ${crop ? 'utility-crop-stage' : ''}`}
        style={{
          maxWidth: (preview.width / preview.height) * 340,
          aspectRatio: `${preview.width}/${preview.height}`,
        }}
        onPointerDown={
          crop
            ? (event) => {
                if (event.button !== 0) return;
                start.current = point(event);
                event.currentTarget.setPointerCapture(event.pointerId);
              }
            : undefined
        }
        onPointerMove={crop ? move : undefined}
        onPointerUp={
          crop
            ? (event) => {
                move(event);
                start.current = null;
              }
            : undefined
        }
        onPointerCancel={() => {
          start.current = null;
        }}
      >
        <img src={preview.url} alt="Selected image preview" draggable="false" />

        {crop && (
          <span
            className="utility-crop-selection"
            aria-hidden="true"
            style={{
              left: `${(options.left / preview.width) * 100}%`,
              top: `${(options.top / preview.height) * 100}%`,
              width: `${(Math.min(options.width, preview.width - options.left) / preview.width) * 100}%`,
              height: `${(Math.min(options.height, preview.height - options.top) / preview.height) * 100}%`,
            }}
          />
        )}
      </div>
      <p>
        {preview.width} × {preview.height} pixels
        {crop ? ' · Drag to select, or use the pixel fields.' : ''}
      </p>
    </div>
  );
}

function OutputImagePreview({ job, title }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="utility-output-text"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>View image preview</summary>
      {open && (
        <div className="utility-output-preview">
          <img loading="lazy" src={jobDownloadUrl(job.id)} alt={`${title} result preview`} />
        </div>
      )}
    </details>
  );
}

function OutputExtras({ job, original }) {
  const [html, setHtml] = useState(null),
    [message, setMessage] = useState(''),
    [source, setSource] = useState(null);
  useEffect(() => {
    if (!original) return;
    const url = URL.createObjectURL(original);
    setSource(url);
    return () => URL.revokeObjectURL(url);
  }, [original]);
  async function copy() {
    try {
      const response = await fetch(jobDownloadUrl(job.id));
      if (!response.ok) throw new Error('This result has expired.');
      await navigator.clipboard.writeText(await response.text());
      setMessage('Copied');
    } catch (e) {
      setMessage(e.message);
    }
  }
  async function preview() {
    try {
      const response = await fetch(jobDownloadUrl(job.id));
      if (!response.ok) throw new Error('This result has expired.');
      setHtml(await response.text());
    } catch (e) {
      setMessage(e.message);
    }
  }
  return (
    <>
      {job.details?.scanVerified && (
        <p className="utility-result-note">Scan verified — decoded content matches this QR.</p>
      )}
      {job.details?.warnings?.map((warning, i) => (
        <p className="utility-result-note" key={i}>
          {typeof warning === 'string' ? warning : warning.message}
        </p>
      ))}
      {source && /\.(jpg|png|webp)$/.test(job.outputName || '') && (
        <details className="utility-output-text">
          <summary>Compare original and result</summary>
          <div className="utility-compare">
            <figure>
              <img src={source} alt="Original image" />
              <figcaption>Original</figcaption>
            </figure>
            <figure>
              <img src={jobDownloadUrl(job.id)} alt="Compressed image" />
              <figcaption>Result</figcaption>
            </figure>
          </div>
        </details>
      )}
      {/\.(txt|json|csv|md|html|sql|js|css)$/.test(job.outputName || '') && (
        <div className="utility-result-actions">
          <ActionButton variant="secondary" onClick={copy}>
            Copy result
          </ActionButton>
          {/\.html$/.test(job.outputName || '') && (
            <ActionButton variant="secondary" onClick={preview}>
              View document
            </ActionButton>
          )}
          <span role="status">{message}</span>
        </div>
      )}
      {html !== null && (
        <iframe
          className="utility-document-preview"
          title="Document result preview"
          sandbox=""
          srcDoc={
            "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'none'\"><style>body{font:14px/1.7 Arial;padding:20px;overflow-wrap:anywhere}</style>" +
            html
          }
        />
      )}
    </>
  );
}

export default function EverydayToolPage({
  tool,
  registry,
  ready,
  draft,
  onDraft,
  onRun,
  jobs,
  onJobAction,
  sending,
  error,
  onError,
  pageGuide,
}) {
  const files = draft.files || [],
    options = {
      ...toolDefaults(tool.id),
      ...(isBrowserSite() ? tool.browserDefaults : {}),
      ...draft.options,
    },
    input = useRef(null);

  const [dragging, setDragging] = useState(false);
  const [browserBusy, setBrowserBusy] = useState(false),
    browserRun = useRef(null);

  const settings = (values) =>
    onDraft((current) => ({
      ...current,
      options: {
        ...toolDefaults(tool.id),
        ...(isBrowserSite() ? tool.browserDefaults : {}),
        ...current.options,
        ...values,
      },
    }));

  const maxBytes = registry.limits.maxBytes || 104857600,
    Icon = everydayIcons[tool.icon] || everydayIcons.images;

  function selectFiles(incoming) {
    const next = Array.from(incoming).map((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      size: file.size,
      source: sourceFromName(file.name),
    }));

    if (!tool.multiple && next.length > 1) {
      onError('Choose one file for this tool.');
      return;
    }

    const combined = tool.multiple ? [...files, ...next] : next;

    if (combined.length > 20) {
      onError('Choose up to 20 files.');
      return;
    }

    const unsupported = combined.find(
      (file) => (!tool.accept.includes('*') && !tool.accept.includes(file.source)) || !file.size,
    );

    if (unsupported) {
      onError(`${unsupported.name}: choose a supported, nonempty file.`);
      return;
    }

    if (combined.reduce((total, file) => total + file.size, 0) > maxBytes) {
      onError(`Selected files together must fit within ${bytes(maxBytes)}.`);
      return;
    }

    onError('');
    onDraft((current) => ({
      ...current,
      files: combined,
      ...(tool.id === 'crop-image' ? { options: toolDefaults(tool.id) } : {}),
    }));
    if (input.current) input.current.value = '';
  }

  function reorder(index, offset) {
    onDraft((current) => {
      const next = [...current.files];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return { ...current, files: next };
    });
  }

  const field = (key, label, min = 1, max = 8192) => (
    <label className="utility-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step="1"
        required
        value={options[key]}
        onChange={(event) =>
          settings({ [key]: event.target.value === '' ? '' : Number(event.target.value) })
        }
      />
    </label>
  );

  const choice = (key, label, values) => (
    <label className="utility-field">
      <span>{label}</span>
      <select
        aria-label={label}
        value={options[key]}
        onChange={(event) =>
          settings({ [key]: key === 'rotate' ? Number(event.target.value) : event.target.value })
        }
      >
        {values.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );

  const checkbox = (key, label) => (
    <label className="utility-check">
      <input
        type="checkbox"
        checked={Boolean(options[key])}
        onChange={(event) => settings({ [key]: event.target.checked })}
      />
      <span>{label}</span>
    </label>
  );

  const browser = isBrowserSite(),
    browserTool = registry.tools?.find((item) => item.id === tool.id);
  const available = ready && Boolean(browserTool) && !browserTool.browserUnavailable;

  return (
    <>
      <InfoHero category={tool.category}>
        <h1>{tool.title}</h1>
        <p>{tool.intro}</p>
      </InfoHero>

      <div className="utility-content">
        <nav className="utility-breadcrumb" aria-label="Breadcrumb">
          <Link to="/tools">All tools</Link>
          <ArrowRight size={13} />
          <span>{tool.title}</span>
        </nav>

        <div className="utility-workspace" data-appear="card">
          <section className="utility-files" aria-labelledby="utility-files-heading">
            <div className="utility-section-heading">
              <span className="everyday-tool-icon">
                <Icon size={22} />
              </span>
              <div>
                <h2 id="utility-files-heading">
                  {tool.generator
                    ? 'Choose your settings'
                    : tool.textInput
                      ? 'Choose your input'
                      : tool.multiple
                        ? 'Choose & arrange files'
                        : 'Choose your file'}
                </h2>
                <p>
                  {tool.accept.includes('*')
                    ? 'Any file'
                    : tool.accept.map((value) => value.toUpperCase()).join(', ')}{' '}
                  · {bytes(maxBytes)} total
                </p>
              </div>
            </div>

            <input
              ref={input}
              className="file-input"
              type="file"
              data-testid="utility-file-input"
              aria-label={`Choose files for ${tool.title}`}
              accept={
                tool.accept.includes('*')
                  ? undefined
                  : tool.accept
                      .map((ext) => `.${ext}`)
                      .concat(
                        tool.accept.includes('jpg') ? ['.jpeg'] : [],
                        tool.accept.includes('tiff') ? ['.tif'] : [],
                      )
                      .join(',')
              }
              multiple={tool.multiple}
              disabled={!available || sending}
              onChange={(event) => selectFiles(event.target.files)}
            />

            {!tool.generator && (
              <div
                className="utility-drop-zone"
                data-dragging={dragging}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!sending) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  if (available && !sending) selectFiles(event.dataTransfer.files);
                }}
              >
                <ActionButton
                  variant="secondary"
                  disabled={!available || sending}
                  onClick={() => input.current.click()}
                >
                  <Plus size={17} />
                  {files.length && tool.multiple
                    ? 'Add more files'
                    : 'Select ' + (tool.multiple ? 'files' : 'file')}
                </ActionButton>
                <span>or drop {tool.multiple ? 'them' : 'it'} here</span>
              </div>
            )}

            {tool.textInput && !tool.generator && (
              <div className="utility-text-input">
                <label className="utility-field">
                  <span>
                    {tool.id === 'color-palette'
                      ? 'Enter a colour'
                      : tool.id === 'create-code'
                        ? 'Text, URL or barcode digits'
                        : 'Or enter your text'}
                  </span>
                  <textarea
                    aria-label="Tool input text"
                    rows={tool.id === 'color-palette' ? 3 : 9}
                    maxLength={1000000}
                    spellCheck="false"
                    placeholder={tool.sample || 'Paste text here…'}
                    value={draft.text || ''}
                    disabled={sending || browserBusy || !available}
                    onChange={(event) =>
                      onDraft((current) => ({ ...current, text: event.target.value }))
                    }
                  />
                </label>
                <p className="utility-hint">
                  {tool.id === 'create-code'
                    ? 'Enter text and optionally upload one PNG/JPG/WebP logo, or select a TXT file first.'
                    : files.length
                      ? 'The selected file will be used. Remove it to use this text.'
                      : 'Text is processed on this computer.'}
                </p>
                {tool.sample && (
                  <ActionButton
                    variant="ghost"
                    onClick={() => onDraft((current) => ({ ...current, text: tool.sample }))}
                  >
                    Use example
                  </ActionButton>
                )}
              </div>
            )}
            {tool.generator && (
              <p className="utility-hint">
                No file needed. Choose settings and create your result.
              </p>
            )}
            {tool.livePreview && (
              <Suspense fallback={<p className="utility-hint">Loading preview…</p>}>
                <ToolLivePreview
                  kind={tool.livePreview}
                  text={draft.text || ''}
                  options={options}
                  files={files}
                />
              </Suspense>
            )}

            {!files.length && (
              <div className="utility-upload-guidance">
                <span className="home-eyebrow">Start with the original</span>
                <p>{tool.summary}</p>
                <div>
                  <span>
                    {tool.multiple
                      ? `Keep files in the order described below. Minimum ${tool.minFiles || 1}.`
                      : 'One source file. Your original stays unchanged.'}
                  </span>
                  <span>Adjust settings, then save your new result.</span>
                </div>
              </div>
            )}
            <ol className="utility-file-list">
              {files.map((file, index) => (
                <li key={file.id}>
                  <span className="utility-file-number">{index + 1}</span>
                  <div>
                    <strong title={file.name}>{file.name}</strong>
                    <small>{bytes(file.size)}</small>
                  </div>
                  <div className="utility-file-controls">
                    {tool.multiple && (
                      <>
                        <ActionButton
                          variant="icon"
                          aria-label={`Move ${file.name} up`}
                          disabled={sending || index === 0}
                          onClick={() => reorder(index, -1)}
                        >
                          <ArrowUp size={15} />
                        </ActionButton>
                        <ActionButton
                          variant="icon"
                          aria-label={`Move ${file.name} down`}
                          disabled={sending || index === files.length - 1}
                          onClick={() => reorder(index, 1)}
                        >
                          <ArrowDown size={15} />
                        </ActionButton>
                      </>
                    )}
                    <ActionButton
                      variant="icon"
                      aria-label={`Remove ${file.name}`}
                      disabled={sending}
                      onClick={() =>
                        onDraft((current) => ({
                          ...current,
                          files: current.files.filter((row) => row.id !== file.id),
                        }))
                      }
                    >
                      <X size={16} />
                    </ActionButton>
                  </div>
                </li>
              ))}
            </ol>

            {tool.category === 'image' &&
              files[0] &&
              ['jpg', 'png', 'webp', 'avif', 'tiff', 'bmp', 'gif', 'svg'].includes(
                files[0].source,
              ) && (
                <ImagePreview
                  file={files[0]}
                  crop={tool.id === 'crop-image'}
                  options={options}
                  onOptions={settings}
                />
              )}

            {tool.multiple && files.length > 0 && (
              <p className="utility-hint">
                {tool.id === 'images-to-pdf'
                  ? 'One image per page.'
                  : tool.engine
                    ? 'Files are processed in this order.'
                    : 'Documents are joined in this order.'}{' '}
                Use the arrow buttons to rearrange.
              </p>
            )}
          </section>

          <form
            className="utility-settings"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                files.length < (tool.minFiles || 1) &&
                !tool.generator &&
                !(tool.textInput && draft.text?.trim())
              ) {
                onError(
                  `Choose ${tool.minFiles || 1} ${tool.minFiles > 1 ? 'files' : 'file'}${tool.textInput ? ' or enter text' : ''} first.`,
                );
                return;
              }
              if (draft.browserOnly && !browser) browserRun.current?.run();
              else onRun();
            }}
          >
            <h2>Make it yours</h2>
            {browser && tool.browserNote && <p className="utility-hint">{tool.browserNote}</p>}
            <p className="utility-settings-intro">
              {tool.id === 'merge-pdf'
                ? 'Your documents, in one continuous PDF.'
                : 'Choose the result you need.'}
            </p>

            <fieldset disabled={sending || browserBusy || !available}>
              {tool.browserMode && !browser && (
                <label className="utility-field">
                  <span>Processing location</span>
                  <select
                    aria-label="Processing location"
                    value={draft.browserOnly ? 'browser' : 'server'}
                    onChange={(event) =>
                      onDraft((current) => ({
                        ...current,
                        browserOnly: event.target.value === 'browser',
                      }))
                    }
                  >
                    <option value="server">Local server — full format support</option>
                    <option value="browser">This browser — no file upload</option>
                  </select>
                  <small>
                    {tool.browserMode === 'image'
                      ? 'Browser mode supports PNG/JPEG/WebP/AVIF input. Multiple images produce a ZIP.'
                      : 'Browser mode accepts one document up to 10 MB. Pasted text is treated as Markdown.'}
                  </small>
                </label>
              )}

              {tool.id === 'compress-image' && (
                <>
                  {field('targetKB', 'Target size (KB)', 1, 102400)}
                  <div className="utility-presets" aria-label="Target size presets">
                    {[20, 50, 100, 200, 500].map((value) => (
                      <button
                        type="button"
                        key={value}
                        aria-pressed={options.targetKB === value}
                        onClick={() => settings({ targetKB: value })}
                      >
                        {value} KB
                      </button>
                    ))}
                  </div>
                  {checkbox('allowResize', 'Allow smaller dimensions if needed')}
                </>
              )}

              {tool.id === 'resize-image' && (
                <>
                  <div className="utility-field-grid">
                    {field('width', 'Width (px)')}
                    {field('height', 'Height (px)')}
                  </div>
                  {choice('fit', 'How the image fits', [
                    ['contain', 'Fit and pad — exact dimensions'],
                    ['cover', 'Fill and crop — exact dimensions'],
                    ['fill', 'Stretch — exact dimensions'],
                    ['inside', 'Fit inside — keep proportions'],
                  ])}
                  {choice('background', 'Padding background', [
                    ['white', 'White'],
                    ['transparent', 'Transparent (PNG/WebP)'],
                  ])}
                </>
              )}

              {tool.id === 'crop-image' && (
                <>
                  <div className="utility-field-grid">
                    {field('left', 'Crop left (px)', 0, 65535)}
                    {field('top', 'Crop top (px)', 0, 65535)}
                    {field('width', 'Crop width (px)', 1, 65535)}
                    {field('height', 'Crop height (px)', 1, 65535)}
                  </div>
                  {choice('rotate', 'Rotate after cropping', [
                    [0, 'No rotation'],
                    [90, '90° clockwise'],
                    [180, '180°'],
                    [270, '270° clockwise'],
                  ])}
                  {checkbox('flop', 'Flip horizontally')}
                  {checkbox('flip', 'Flip vertically')}
                </>
              )}

              {tool.id === 'split-pdf' && (
                <>
                  <label className="utility-field">
                    <span>Pages to keep</span>
                    <input
                      aria-label="Pages to keep"
                      aria-describedby="utility-pages-help"
                      type="text"
                      maxLength="1000"
                      placeholder="All pages, or 1-3, 5"
                      value={options.pages}
                      onChange={(event) => settings({ pages: event.target.value })}
                    />
                    <small id="utility-pages-help">Leave empty to include every page.</small>
                  </label>
                  {choice('mode', 'Download as', [
                    ['extract', 'One PDF with selected pages'],
                    ['separate', 'ZIP of separate PDF pages'],
                  ])}
                </>
              )}

              {tool.id === 'images-to-pdf' && (
                <>
                  {choice('paper', 'Page size', [
                    ['a4', 'A4 — auto orientation'],
                    ['letter', 'US Letter — auto orientation'],
                    ['original', 'Match each image'],
                  ])}
                  {field('margin', 'Page margin (points)', 0, 72)}
                </>
              )}

              {!tool.engine &&
                tool.category === 'image' &&
                choice('output', 'Output format', [
                  ['jpg', 'JPG — white background'],
                  ['png', 'PNG — transparency supported'],
                  ['webp', 'WebP — transparency supported'],
                ])}

              {tool.id === 'merge-pdf' && (
                <div className="utility-summary">
                  <strong>{files.length} documents</strong>
                  <span>One PDF · Original page order</span>
                  <small>Up to 100 pages in total.</small>
                </div>
              )}

              {(tool.fields || []).map((definition) => {
                const { key, label, type } = definition,
                  value = options[key];

                if (type === 'checkbox')
                  return <React.Fragment key={key}>{checkbox(key, label)}</React.Fragment>;

                if (type === 'select')
                  return (
                    <label className="utility-field" key={key}>
                      <span>{label}</span>
                      <select
                        aria-label={label}
                        value={value}
                        onChange={(event) =>
                          settings({
                            [key]: definition.options.find(
                              ([item]) => String(item) === event.target.value,
                            )?.[0],
                          })
                        }
                      >
                        {definition.options.map(([item, title]) => (
                          <option key={String(item)} value={item}>
                            {title}
                          </option>
                        ))}
                      </select>
                    </label>
                  );

                if (type === 'textarea')
                  return (
                    <label className="utility-field" key={key}>
                      <span>{label}</span>
                      <textarea
                        aria-label={label}
                        rows={5}
                        maxLength={definition.maxLength || 10000}
                        spellCheck="false"
                        value={value}
                        onChange={(event) => settings({ [key]: event.target.value })}
                      />
                    </label>
                  );

                return (
                  <label className="utility-field" key={key}>
                    <span>{label}</span>
                    <input
                      aria-label={label}
                      type={type}
                      min={definition.min}
                      max={definition.max}
                      step={type === 'number' ? definition.step || 1 : undefined}
                      maxLength={definition.maxLength || 10000}
                      autoComplete={type === 'password' ? 'off' : undefined}
                      value={value}
                      onChange={(event) =>
                        settings({
                          [key]:
                            type === 'number'
                              ? event.target.value === ''
                                ? ''
                                : Number(event.target.value)
                              : event.target.value,
                        })
                      }
                    />
                  </label>
                );
              })}
            </fieldset>

            {error && (
              <p className="utility-error" role="alert">
                <TriangleAlert size={17} />
                {error}
              </p>
            )}

            {!available && (
              <p className="utility-hint">
                {browserTool?.browserUnavailable ||
                  (ready
                    ? 'This tool is unavailable in the current build.'
                    : 'Preparing your tools…')}
              </p>
            )}

            <ActionButton
              type="submit"
              disabled={
                !available ||
                sending ||
                browserBusy ||
                (!tool.generator && !files.length && !(tool.textInput && draft.text?.trim()))
              }
            >
              {sending || browserBusy ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <ArrowRight size={17} />
              )}{' '}
              {sending ? 'Adding your files…' : browserBusy ? 'Processing…' : tool.action}
            </ActionButton>

            <p className="utility-privacy">
              <LockKeyhole size={13} /> Processed on this computer
            </p>
          </form>
        </div>
        {draft.browserOnly && !browser && (
          <BrowserToolResult
            ref={browserRun}
            tool={tool}
            draft={draft}
            options={options}
            onBusy={setBrowserBusy}
          />
        )}

        {jobs.length > 0 && (
          <section className="utility-results" aria-labelledby="utility-results-heading">
            <h2 id="utility-results-heading">Your results</h2>
            <p>
              Download finished files before removing them.{' '}
              {browser
                ? 'Results stay in this tab until removed or reloaded.'
                : `Temporary copies expire after ${registry.limits.retentionMinutes || 30} minutes.`}
            </p>
            <div aria-live="polite">
              {[...jobs].reverse().map((job) => {
                const running = ['queued', 'processing'].includes(job.status),
                  closest = job.details?.targetMet === false;

                return (
                  <article key={job.id} className="utility-result" data-status={job.status}>
                    <div className="utility-result-heading">
                      <span>
                        {running ? (
                          <LoaderCircle size={20} className="spin" />
                        ) : job.status === 'completed' ? (
                          <Check size={20} />
                        ) : (
                          <TriangleAlert size={20} />
                        )}
                      </span>
                      <div>
                        <h3>{job.outputName || job.name}</h3>
                        <p>
                          {bytes(job.size)}
                          {job.outputSize != null ? ` → ${bytes(job.outputSize)}` : ''}
                          {job.details?.width
                            ? ` · ${job.details.width} × ${job.details.height} px`
                            : ''}
                          {job.details?.pages ? ` · ${job.details.pages} pages` : ''}
                        </p>
                      </div>
                      <strong>
                        {running
                          ? job.stage
                          : job.status === 'completed'
                            ? closest
                              ? 'Closest result'
                              : 'Ready to download'
                            : job.status === 'cancelled'
                              ? 'Cancelled'
                              : 'Needs attention'}
                      </strong>
                    </div>

                    {job.status === 'completed' &&
                      /\.(png|jpg|jpeg|webp|gif)$/.test(job.outputName || '') && (
                        <OutputImagePreview job={job} title={tool.title} />
                      )}
                    {job.status === 'completed' && job.details?.preview && (
                      <details className="utility-output-text">
                        <summary>
                          Result preview
                          {job.details.previewTruncated ? ' (first 4,000 characters)' : ''}
                        </summary>
                        <pre>{job.details.preview}</pre>
                      </details>
                    )}
                    {job.status === 'completed' && (
                      <OutputExtras
                        job={job}
                        original={tool.id === 'compress-image' ? draft.previewFile : undefined}
                      />
                    )}
                    {job.details?.matches !== undefined && (
                      <p className="utility-result-note">
                        {job.details.matches
                          ? 'Checksum matches the expected value.'
                          : 'Checksum does not match the expected value.'}
                      </p>
                    )}
                    {closest && (
                      <p className="utility-result-note">
                        The {bytes(job.details.targetBytes)} target could not be reached with these
                        settings. This is the closest result; choose a larger target or allow
                        smaller dimensions.
                      </p>
                    )}

                    {job.error && (
                      <p className="utility-error" role="alert">
                        {job.error}
                      </p>
                    )}

                    <div className="utility-result-actions">
                      {job.status === 'completed' && (
                        <a
                          className="primary-button"
                          href={jobDownloadUrl(job.id)}
                          download={job.outputName}
                        >
                          <ArrowDownToLine size={16} />
                          {closest ? 'Download closest result' : 'Download result'}
                        </a>
                      )}
                      {running ? (
                        <ActionButton
                          variant="secondary"
                          onClick={() => onJobAction(job, 'cancel')}
                        >
                          Cancel
                        </ActionButton>
                      ) : ['failed', 'cancelled'].includes(job.status) ? (
                        <ActionButton variant="secondary" onClick={() => onJobAction(job, 'retry')}>
                          <RotateCw size={15} />
                          Retry
                        </ActionButton>
                      ) : null}
                      <ActionButton variant="ghost" onClick={() => onJobAction(job, 'remove')}>
                        Remove result
                      </ActionButton>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <PageGuide page={pageGuide} />
      </div>
    </>
  );
}
