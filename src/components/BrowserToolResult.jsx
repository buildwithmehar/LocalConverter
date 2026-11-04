import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActionButton } from './ui-kit.jsx';
import { bytes } from '../lib/formats.js';
export default forwardRef(function BrowserToolResult({ tool, draft, options, onBusy }, ref) {
  const worker = useRef(null),
    timer = useRef(null),
    url = useRef(null),
    [state, setState] = useState(null);
  const stop = () => {
    worker.current?.terminate();
    worker.current = null;
    clearTimeout(timer.current);
    onBusy(false);
  };
  useEffect(
    () => () => {
      worker.current?.terminate();
      clearTimeout(timer.current);
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );
  useImperativeHandle(ref, () => ({
    run() {
      stop();
      if (url.current) {
        URL.revokeObjectURL(url.current);
        url.current = null;
      }
      setState({ stage: 'Preparing browser processing…' });
      onBusy(true);
      const w = new Worker(new URL('../tool-runtime/browser-worker.js', import.meta.url), {
        type: 'module',
      });
      worker.current = w;
      const fail = (message) => {
        stop();
        setState({ error: message });
      };
      timer.current = setTimeout(
        () =>
          fail('Browser processing timed out. Try a smaller file or use local server processing.'),
        180000,
      );
      w.onerror = (event) => fail(event.message || 'Browser engine could not load.');
      w.onmessage = async (event) => {
        const m = event.data;
        if (m.error) return fail(m.error);
        if (m.stage) setState({ stage: m.stage });
        if (m.result) {
          try {
            let result = m.result;
            if (result.mime === 'text/html' || result.mime === 'application/epub+zip') {
              const { safeDocumentResult } = await import('../tool-runtime/safe-document.js');
              result = await safeDocumentResult(result);
            }
            if (worker.current !== w) return;
            url.current = URL.createObjectURL(new Blob([result.bytes], { type: result.mime }));
            stop();
            setState({ ...result, url: url.current, byteSize: result.bytes.length });
          } catch (error) {
            fail(error.message);
          }
        }
      };
      w.postMessage({
        kind: tool.browserMode,
        files: (draft.files || []).map((f) => f.file),
        text: draft.text || '',
        options,
      });
    },
  }));
  if (!state) return null;
  return (
    <section className="utility-results" data-testid="browser-result" aria-live="polite">
      <h2>Your browser result</h2>
      <article className="utility-result">
        <div className="utility-result-heading">
          <div>
            <h3>{state.filename || tool.title}</h3>
            <p>
              {state.byteSize !== undefined ? bytes(state.byteSize) : 'Processed in this browser'}
            </p>
          </div>
          <strong>
            {state.url ? 'Ready to download' : state.error ? 'Needs attention' : state.stage}
          </strong>
        </div>
        {state.error && (
          <p className="utility-error" role="alert">
            {state.error}
          </p>
        )}
        {state.report?.map((r) => (
          <p className="utility-result-note" key={r.file}>
            {r.file}: {bytes(r.inputBytes)} → {bytes(r.outputBytes)} · {r.width} × {r.height} ·{' '}
            {r.targetMet ? 'Target reached' : 'Closest result — target not reached'}
          </p>
        ))}
        {state.url && state.mime?.startsWith('image/') && (
          <div className="utility-output-preview">
            <img src={state.url} alt="Browser compression result" />
          </div>
        )}
        <div className="utility-result-actions">
          {state.url ? (
            <a className="primary-button" href={state.url} download={state.filename}>
              Download result
            </a>
          ) : (
            !state.error && (
              <ActionButton
                variant="secondary"
                onClick={() => {
                  stop();
                  setState({ error: 'Processing cancelled.' });
                }}
              >
                Cancel
              </ActionButton>
            )
          )}
        </div>
        <p className="utility-hint">
          Save this result before leaving or reloading the page. Browser results are not stored in
          My files.
        </p>
      </article>
    </section>
  );
});
