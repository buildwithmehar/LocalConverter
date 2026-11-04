import { PDFDocument } from 'pdf-lib';
import { abort, decode, fail, textBytes } from './utility-common.js';
export const supportedToolIds = ['protect-pdf', 'unlock-pdf', 'extract-pdf-images', 'render-html'];
function boundedOptions(options) {
  const o = { format: 'pdf', width: 1280, height: 900, ...options };
  if (!['pdf', 'png'].includes(o.format)) fail('Choose PDF or PNG output.');
  for (const [key, min, max] of [
    ['width', 320, 2400],
    ['height', 200, 2400],
  ])
    if (!Number.isInteger(Number(o[key])) || Number(o[key]) < min || Number(o[key]) > max)
      fail('HTML viewport dimensions are out of range.');
  o.width = Number(o.width);
  o.height = Number(o.height);
  return o;
}
async function cssSafe(css, context = 'stylesheet') {
  if (css.length > 1048576) fail('CSS accepts up to 1 MB per file.');
  const { syntax } = await import('csso');
  let ast;
  try {
    ast = syntax.parse(css, { context, parseCustomProperty: true });
  } catch {
    fail('The uploaded CSS could not be parsed.');
  }
  syntax.walk(ast, {
    leave(node, item, list) {
      if (
        node.type === 'Atrule' &&
        ['import', 'namespace', 'font-face', 'document', '-moz-document'].includes(
          node.name.toLowerCase(),
        )
      ) {
        if (list && item) list.remove(item);
        return;
      }
      if (node.type === 'Declaration') {
        let unsafe = ['behavior', '-moz-binding'].includes(node.property.toLowerCase());
        syntax.walk(node.value, (child) => {
          if (
            child.type === 'Url' ||
            child.type === 'Raw' ||
            (child.type === 'Function' &&
              ['url', 'expression', 'image', 'image-set', '-webkit-image-set', 'paint'].includes(
                child.name.toLowerCase(),
              ))
          )
            unsafe = true;
        });
        if (unsafe && list && item) list.remove(item);
      }
    },
  });
  return syntax.generate(ast);
}
async function visualHtml(inputs, o, signal, onProgress) {
  if (!['html', 'htm'].includes(inputs[0].source)) fail('Upload an HTML document first.');
  if (inputs.some((input) => !['html', 'htm', 'css'].includes(input.source)))
    fail(
      'Browser HTML rendering currently accepts HTML and CSS files. Uploading image and font assets is not supported by this renderer.',
    );
  const { default: DOMPurify } = await import('dompurify'),
    parser = new DOMParser(),
    original = parser.parseFromString(
      decode(new Uint8Array(await inputs[0].file.arrayBuffer()), 2 * 1024 * 1024),
      'text/html',
    ),
    styles = [];
  for (const style of original.querySelectorAll('style'))
    styles.push(await cssSafe(style.textContent || ''));
  for (const input of inputs.slice(1)) {
    if (input.source !== 'css') fail('Only the first uploaded file can be HTML.');
    styles.push(await cssSafe(decode(new Uint8Array(await input.file.arrayBuffer()), 1048576)));
  }
  for (const node of original.querySelectorAll('[style]')) {
    const css = await cssSafe(node.getAttribute('style') || '', 'declarationList');
    if (css) node.setAttribute('style', css);
    else node.removeAttribute('style');
  }
  for (const node of original.querySelectorAll(
    'style,script,link,meta,base,iframe,frame,object,embed,img,source,video,audio,svg,math,canvas',
  ))
    node.remove();
  const clean = DOMPurify.sanitize(original.body.innerHTML, {
      FORBID_TAGS: [
        'script',
        'style',
        'link',
        'meta',
        'base',
        'iframe',
        'object',
        'embed',
        'form',
        'input',
        'button',
        'textarea',
        'select',
        'option',
        'img',
        'picture',
        'svg',
        'math',
        'video',
        'audio',
        'canvas',
      ],
      FORBID_ATTR: [
        'src',
        'srcset',
        'href',
        'xlink:href',
        'action',
        'formaction',
        'poster',
        'background',
        'ping',
      ],
      ALLOW_DATA_ATTR: false,
    }),
    iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-same-origin');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = `position:fixed;left:-100000px;top:0;width:${o.width}px;height:${o.height}px;border:0;pointer-events:none;`;
  const source = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; connect-src 'none'; img-src data:; font-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-src 'none'"><style>${styles.join('\n').replace(/<\/style/gi, '<\\/style')}</style></head><body>${clean}</body></html>`;
  iframe.srcdoc = source;
  let timer;
  const loaded = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('HTML preview took too long to load.')), 10000);
    iframe.onload = resolve;
  });
  document.body.append(iframe);
  try {
    await loaded;
    clearTimeout(timer);
    abort(signal);
    onProgress?.({ stage: 'Rendering uploaded HTML and CSS in your browser', progress: 40 });
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(iframe.contentDocument.documentElement, {
      width: o.width,
      height: o.height,
      windowWidth: o.width,
      windowHeight: o.height,
      x: 0,
      y: 0,
      backgroundColor: '#ffffff',
      scale: 1,
      allowTaint: false,
      useCORS: false,
      logging: false,
      removeContainer: true,
      imageTimeout: 1000,
      onclone: (doc) => {
        for (const node of doc.querySelectorAll(
          'script,iframe,object,embed,img,link,meta[http-equiv="refresh"]',
        ))
          node.remove();
      },
    });
    abort(signal);
    const png = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('HTML image encoding failed.'))),
        'image/png',
      ),
    );
    let blob = png,
      mime = 'image/png',
      filename = 'rendered.png';
    if (o.format === 'pdf') {
      const pdf = await PDFDocument.create(),
        image = await pdf.embedPng(await png.arrayBuffer()),
        page = pdf.addPage([o.width * 0.75, o.height * 0.75]);
      page.drawImage(image, { x: 0, y: 0, width: o.width * 0.75, height: o.height * 0.75 });
      blob = new Blob([await pdf.save()], { type: 'application/pdf' });
      mime = 'application/pdf';
      filename = 'rendered.pdf';
    }
    canvas.width = canvas.height = 0;
    return {
      blob,
      mime,
      filename,
      details: {
        networkAccess: false,
        javascript: false,
        rasterized: true,
        width: o.width,
        height: o.height,
        limitations:
          'Viewport image of sanitized HTML and inline/uploaded CSS. Scripts, images, font assets, external URLs, imports, frames and forms are omitted. Canvas rendering supports a subset of browser CSS; text in the PDF is not editable.',
      },
    };
  } finally {
    clearTimeout(timer);
    iframe.remove();
  }
}
function pdfWorker(operation, bytes, options, signal, onProgress) {
  return new Promise((resolve, reject) => {
    abort(signal);
    const worker = new Worker(new URL('./advanced-document-worker.js', import.meta.url), {
      type: 'module',
    });
    let done = false;
    const finish = (error, out) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
        worker.terminate();
        error ? reject(error) : resolve(out);
      },
      cancel = () => finish(new Error('Conversion cancelled.')),
      timer = setTimeout(
        () =>
          finish(new Error('PDF processing exceeded its browser deadline. Try a smaller file.')),
        120000,
      );
    signal?.addEventListener('abort', cancel, { once: true });
    worker.onerror = (e) => finish(new Error(e.message || 'PDF worker failed.'));
    worker.onmessage = ({ data }) => {
      if (data.progress) {
        onProgress?.(data.progress);
        return;
      }
      finish(data.error ? new Error(data.error) : null, data.result);
    };
    worker.postMessage({ operation, bytes, options }, [bytes.buffer]);
  });
}
export async function convert({ operation, inputs = [], options = {}, signal, onProgress }) {
  abort(signal);
  if (!supportedToolIds.includes(operation)) fail('Unsupported advanced document tool.');
  if (!inputs.length || inputs.length > 20 || inputs.some((i) => !(i.file instanceof Blob)))
    fail('Choose document files.');
  if (inputs.reduce((n, i) => n + i.file.size, 0) > 100 * 1024 * 1024)
    fail('Document inputs exceed 100 MB.');
  if (operation === 'render-html')
    return visualHtml(inputs, boundedOptions(options), signal, onProgress);
  if (inputs.length !== 1) fail('Choose exactly one PDF.');
  const bytes = new Uint8Array(await inputs[0].file.arrayBuffer());
  if (decode(bytes.subarray(0, 5)) !== '%PDF-') fail('File contents do not match PDF.');
  if (
    ['protect-pdf', 'unlock-pdf'].includes(operation) &&
    (typeof options.password !== 'string' || !options.password.length)
  )
    fail('Enter a nonempty password.');
  if (typeof Worker === 'undefined') fail('This document tool requires browser Web Workers.');
  onProgress?.({ stage: 'Loading the local PDF engine', progress: 5 });
  const out = await pdfWorker(operation, bytes, options, signal, onProgress);
  abort(signal);
  return {
    blob: new Blob([out.bytes], { type: out.mime }),
    filename: out.filename,
    mime: out.mime,
    details: out.details,
  };
}
export { cssSafe };
