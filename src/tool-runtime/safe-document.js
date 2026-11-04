import DOMPurify from 'dompurify';
const config = {
  USE_PROFILES: { html: true },
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
    'video',
    'audio',
    'source',
  ],
  FORBID_ATTR: ['style', 'srcset'],
  ALLOWED_URI_REGEXP: /^(?:#|data:image\/(?:png|jpeg|gif|webp);base64,)/i,
};
export async function safeDocumentResult(result) {
  if (result.mime === 'text/html') {
    const body = DOMPurify.sanitize(new TextDecoder().decode(result.bytes), config);
    result.bytes = new TextEncoder().encode(
      '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; form-action \'none\'"><style>body{max-width:800px;margin:32px auto;padding:0 20px;font:16px/1.7 Arial;overflow-wrap:anywhere}img{max-width:100%}pre{white-space:pre-wrap}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px}</style></head><body>' +
        body +
        '</body></html>',
    );
  } else if (result.mime === 'application/epub+zip') {
    const { unzipSync, zipSync } = await import('fflate'),
      entries = unzipSync(result.bytes),
      decoder = new TextDecoder(),
      encoder = new TextEncoder();
    for (const [name, data] of Object.entries(entries))
      if (/\.(?:xhtml|html|htm)$/i.test(name)) {
        const fragment = DOMPurify.sanitize(decoder.decode(data), {
          ...config,
          RETURN_DOM_FRAGMENT: true,
          ADD_ATTR: ['epub:type'],
          ALLOWED_URI_REGEXP:
            /^(?:#|data:image\/(?:png|jpeg|gif|webp);base64,|(?:[\w.%-]+\/)*[\w.%-]+(?:#[\w.%-]+)?$)/i,
        });
        const body = new XMLSerializer().serializeToString(fragment);
        entries[name] = encoder.encode(
          '<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Document</title></head><body>' +
            body +
            '</body></html>',
        );
      } else if (/\.css$/i.test(name))
        entries[name] = encoder.encode('body { line-height: 1.6; } img { max-width: 100%; }');
    // EPUB requires the mimetype member first and uncompressed.
    const mime = entries.mimetype;
    delete entries.mimetype;
    result.bytes = zipSync({ mimetype: [mime, { level: 0 }], ...entries }, { level: 5 });
  }
  return result;
}
