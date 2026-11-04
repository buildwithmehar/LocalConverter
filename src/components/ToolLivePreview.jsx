import React, { useEffect, useRef, useState } from 'react';
const wrap = (html) =>
  `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; form-action 'none'"><style>body{font:14px/1.7 Arial,sans-serif;color:#222;background:#fff;padding:18px;margin:0;overflow-wrap:anywhere}pre{white-space:pre-wrap}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px}svg{max-width:100%;height:auto}</style></head><body>${html}</body></html>`;
export default function ToolLivePreview({ kind, text, options, files = [] }) {
  const [state, setState] = useState({}),
    sequence = useRef(0);
  const source = files.find((f) => ['txt', 'md', 'markdown', 'mmd'].includes(f.source)),
    [uploadedText, setUploadedText] = useState('');
  useEffect(() => {
    let active = true;
    setUploadedText('');
    if (source) {
      if (source.file.size > 1048576) setState({ error: 'Live text previews accept up to 1 MB.' });
      else
        source.file
          .text()
          .then((value) => {
            if (active) setUploadedText(value);
          })
          .catch(() => {
            if (active) setState({ error: 'This file could not be read for preview.' });
          });
    }
    return () => {
      active = false;
    };
  }, [source?.id]);
  text = source ? uploadedText : text;
  useEffect(() => {
    const n = ++sequence.current;
    let blobUrl;
    const timer = setTimeout(async () => {
      if (!text?.trim()) {
        setState({});
        return;
      }
      try {
        if (kind === 'markdown') {
          const [{ default: MarkdownIt }, { default: purify }] = await Promise.all([
            import('markdown-it'),
            import('dompurify'),
          ]);
          const html = purify.sanitize(
            new MarkdownIt({ html: false, linkify: true, typographer: true }).render(text),
            {
              FORBID_TAGS: ['img', 'script', 'iframe', 'object', 'embed', 'style'],
              FORBID_ATTR: ['href', 'src', 'style'],
            },
          );
          if (sequence.current === n) setState({ html: wrap(html) });
        }
        if (kind === 'diagram') {
          const { renderLocalDiagram } = await import('../tool-runtime/diagram-renderer.js');
          const svg = await renderLocalDiagram(text, options.theme);
          if (sequence.current === n) setState({ html: wrap(svg) });
        }
        if (kind === 'qr' && options.kind === 'qr') {
          const { default: QRCodeStyling } = await import('qr-code-styling');
          const { qrPayload } = await import('../../shared/qr-payload.js');
          const logo = files.find((f) => f.source !== 'txt');
          if (logo) blobUrl = URL.createObjectURL(logo.file);
          const qr = new QRCodeStyling({
              type: 'svg',
              width: 360,
              height: 360,
              margin: 24,
              data: qrPayload(text, options),
              ...(blobUrl ? { image: blobUrl } : {}),
              qrOptions: { errorCorrectionLevel: 'H' },
              imageOptions: { imageSize: 0.18, margin: 4 },
              dotsOptions: { type: options.dots, color: options.foreground },
              cornersSquareOptions: { type: options.corners, color: options.foreground },
              backgroundOptions: { color: options.background },
            }),
            blob = await qr.getRawData('svg');
          const src = URL.createObjectURL(blob);
          if (sequence.current === n)
            setState((prev) => {
              if (prev.src) URL.revokeObjectURL(prev.src);
              return { src };
            });
          else URL.revokeObjectURL(src);
        }
      } catch (error) {
        if (sequence.current === n) setState({ error: error.message });
      } finally {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
    };
  }, [kind, text, JSON.stringify(options), files.map((f) => f.id).join(',')]);
  useEffect(
    () => () => {
      sequence.current++;
    },
    [],
  );
  useEffect(
    () => () => {
      if (state.src) URL.revokeObjectURL(state.src);
    },
    [state.src],
  );
  if (!state.html && !state.src && !state.error) return null;
  return (
    <div className="utility-live-preview">
      <p className="utility-hint">Live {kind === 'qr' ? 'QR' : kind} preview</p>
      {state.error ? (
        <p className="utility-error" role="status">
          {state.error}
        </p>
      ) : state.html ? (
        <iframe
          sandbox=""
          title={kind === 'markdown' ? 'Live Markdown preview' : 'Live diagram preview'}
          srcDoc={state.html}
        />
      ) : (
        <img src={state.src} alt="Live QR preview" />
      )}
    </div>
  );
}
