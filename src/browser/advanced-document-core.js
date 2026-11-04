import { zipSync, zlibSync } from 'fflate';
import { abort, fail, textBytes } from './utility-common.js';
const take = (result) => {
  if (!result?.ok) fail(result?.error || 'The PDF engine could not read this file.');
  return result.value;
};
const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  let n = i;
  for (let b = 0; b < 8; b++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0);
  return n >>> 0;
});
function crc(bytes) {
  let n = 0xffffffff;
  for (const b of bytes) n = crcTable[(n ^ b) & 255] ^ (n >>> 8);
  return (n ^ 0xffffffff) >>> 0;
}
function concat(arrays) {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let p = 0;
  for (const a of arrays) {
    out.set(a, p);
    p += a.length;
  }
  return out;
}
function pngChunk(type, body) {
  const out = new Uint8Array(body.length + 12),
    view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  out.set(textBytes(type), 4);
  out.set(body, 8);
  view.setUint32(out.length - 4, crc(out.subarray(4, -4)));
  return out;
}
function rgbaPng({ width, height, data }) {
  const header = new Uint8Array(13),
    view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8;
  header[9] = 6;
  const rows = new Uint8Array(height * (width * 4 + 1));
  for (let y = 0; y < height; y++)
    rows.set(data.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  return concat([
    Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlibSync(rows, { level: 5 })),
    pngChunk('IEND', new Uint8Array()),
  ]);
}
export async function extractImageArchive(doc, { signal, decodeSamples } = {}) {
  const count = take(doc.getPageCount());
  if (count < 1 || count > 100) fail('Choose a PDF with 1 to 100 pages.');
  const catalog = take(doc.getImages({ recursive: true }));
  if (!catalog.length) fail('No embedded raster image objects were found.');
  if (catalog.length > 500) fail('PDF contains more than 500 image objects.');
  const files = Object.create(null),
    images = [];
  let total = 0,
    totalPixels = 0;
  for (const info of catalog) {
    abort(signal);
    if (
      !Number.isInteger(info.width) ||
      !Number.isInteger(info.height) ||
      info.width < 1 ||
      info.height < 1 ||
      info.width * info.height > 40000000
    )
      fail('Embedded image dimensions exceed 40 million pixels.');
    totalPixels += info.width * info.height;
    if (totalPixels > 100000000) fail('Embedded images exceed 100 million total pixels.');
    const encoded = take(doc.readImage(info.objId, info.generation)),
      kind = encoded.encoding.kind,
      stem = `image-${info.objId}-${info.generation}`,
      ext = { jpeg: 'jpg', jpeg2000: 'jpx', ccitt: 'ccitt', jbig2: 'jb2', samples: 'samples.bin' }[
        kind
      ];
    if (!ext) fail('The PDF contains an unknown image encoding.');
    const filename = `${stem}.${ext}`;
    files[filename] = encoded.data;
    total += encoded.data.length;
    if (total > 180 * 1024 * 1024) fail('Embedded image output exceeds 180 MB.');
    const entry = {
      file: filename,
      object: info.objId,
      generation: info.generation,
      width: info.width,
      height: info.height,
      firstPage: info.pages.length ? info.pages[0] + 1 : null,
      pages: info.pages.map((n) => n + 1),
      encoding: encoded.encoding,
      bitsPerComponent: info.bitsPerComponent,
      colorSpace: info.colorSpace,
      colorSpaceInfo: info.colorSpaceInfo,
      filters: info.filters,
      decode: info.decode,
      masks: info.masks,
      originalEncodedBytes: true,
    };
    if (kind === 'samples' && decodeSamples) {
      const decoded = decodeSamples(encoded, info);
      if (decoded.ok) {
        const preview = `${stem}.png`,
          png = rgbaPng(decoded.value);
        files[preview] = png;
        entry.pixelPreview = preview;
        entry.previewNote =
          'PNG generated from original sample bytes; original sample data is also included. ICC profiles are described in the index; previews use device/component colours.';
        total += png.length;
      } else entry.previewUnavailable = decoded.error;
    }
    if (['ccitt', 'jbig2'].includes(kind))
      entry.note =
        'Raw embedded image codec stream; parameters and globals references are in this index.';
    if (kind === 'jbig2' && encoded.encoding.globals) {
      const ref = encoded.encoding.globals,
        globals = doc.getRawImageStreamData(ref.objId, ref.generation);
      if (globals.ok) {
        const name = `image-${ref.objId}-${ref.generation}-globals.bin`;
        files[name] = globals.value;
        entry.globalsFile = name;
        total += globals.value.length;
      }
    }
    images.push(entry);
    if (total > 180 * 1024 * 1024) fail('Embedded image output exceeds 180 MB.');
  }
  files['index.json'] = textBytes(
    JSON.stringify(
      {
        images,
        scope:
          'Embedded raster image objects. JPEG/JPEG2000 codec bytes and raw samples are preserved; page rendering and vector drawings are not included.',
      },
      null,
      2,
    ),
  );
  return {
    bytes: zipSync(files, { level: 5 }),
    mime: 'application/zip',
    filename: 'embedded-images.zip',
    details: { images: images.length, originalEncodedBytes: true },
  };
}
export async function runAdvancedPdf(
  operation,
  bytes,
  options,
  { signal, onProgress, qpdfFactory, imageFactory, decodeSamples } = {},
) {
  abort(signal);
  if (operation === 'extract-pdf-images') {
    const api = await imageFactory(),
      doc = take(
        options.password ? api.loadPdfWithPassword(bytes, options.password) : api.loadPdf(bytes),
      );
    try {
      return await extractImageArchive(doc, { signal, decodeSamples });
    } finally {
      doc.close();
    }
  }
  const password = options.password;
  if (typeof password !== 'string' || !password.length) fail('Enter a nonempty password.');
  if (password.includes('\0') || textBytes(password).length > 127)
    fail('PDF passwords accept up to 127 UTF-8 bytes and cannot contain NUL.');
  const validationApi = await imageFactory(),
    checked = take(
      operation === 'unlock-pdf'
        ? validationApi.loadPdfWithPassword(bytes, password)
        : validationApi.loadPdf(bytes),
    );
  try {
    const pages = take(checked.getPageCount());
    if (pages < 1 || pages > 100) fail('Choose a PDF with 1 to 100 pages.');
    if (operation === 'unlock-pdf') {
      const output = take(checked.writePdf({ preserveEncryption: false }));
      if (output.length > 200 * 1024 * 1024) fail('PDF output exceeds 200 MB.');
      return {
        bytes: output,
        mime: 'application/pdf',
        filename: 'unlock-pdf.pdf',
        details: { encryption: 'none', pages },
      };
    }
  } finally {
    checked.close();
  }
  const logs = [],
    module = await qpdfFactory({
      noInitialRun: true,
      print: (text) => {
        if (logs.length < 50) logs.push(String(text).slice(0, 500));
      },
      printErr: (text) => {
        if (logs.length < 50) logs.push(String(text).slice(0, 500));
      },
    });
  module.FS.writeFile('/input.pdf', bytes);
  let output;
  try {
    abort(signal);
    const owner = crypto.randomUUID(),
      hex = (s) => [...textBytes(s)].map((n) => n.toString(16).padStart(2, '0')).join(''),
      args =
        operation === 'protect-pdf'
          ? [
              '--password-mode=hex-bytes',
              '--encrypt',
              hex(password),
              hex(owner),
              '256',
              '--',
              '/input.pdf',
              '/output.pdf',
            ]
          : [`--password=${password}`, '--decrypt', '/input.pdf', '/output.pdf'];
    let status;
    try {
      status = module.callMain(args);
    } catch (e) {
      if (typeof e.status === 'number') status = e.status;
      else throw e;
    }
    if (status !== undefined && status !== 0 && status !== 3)
      fail(
        /invalid password|password/i.test(logs.join(' '))
          ? 'The password is incorrect or required.'
          : 'The PDF engine could not process this document.',
      );
    output = module.FS.readFile('/output.pdf').slice();
    if (!output.length) fail('The PDF engine produced no output.');
    if (output.length > 200 * 1024 * 1024) fail('PDF output exceeds 200 MB.');
    abort(signal);
    return {
      bytes: output,
      mime: 'application/pdf',
      filename: operation + '.pdf',
      details: {
        encryption: operation === 'protect-pdf' ? 'AES-256' : 'none',
        ...(status === 3
          ? { warnings: ['The PDF engine recovered structural warnings. Review the output.'] }
          : {}),
      },
    };
  } finally {
    for (const name of ['/input.pdf', '/output.pdf'])
      try {
        module.FS.unlink(name);
      } catch {}
    bytes.fill(0);
  }
}
