import { runAdvancedPdf } from './advanced-document-core.js';
let images;
self.onmessage = async ({ data }) => {
  try {
    const base = new URL('/tool-runtime/', self.location.href);
    const qpdfFactory = async (options) => {
      const { default: create } = await import(
        /* @vite-ignore */ new URL('qpdf/qpdf.mjs', base).href
      );
      return create({
        ...options,
        locateFile: (name) => new URL('qpdf/' + name.split('/').pop(), base).href,
      });
    };
    const imageFactory = async () => {
      if (!images) {
        const [{ createQpdfImageStreams }, codecs] = await Promise.all([
          import(/* @vite-ignore */ new URL('qpdf-images/index.js', base).href),
          import(/* @vite-ignore */ new URL('qpdf-images/codecs/index.js', base).href),
        ]);
        images = {
          api: await createQpdfImageStreams({
            locateFile: (name) => new URL('qpdf-images/' + name.split('/').pop(), base).href,
          }),
          decodeSamples: codecs.decodeSamples,
        };
      }
      return images.api;
    };
    if (data.operation === 'extract-pdf-images') await imageFactory();
    const out = await runAdvancedPdf(data.operation, data.bytes, data.options, {
      qpdfFactory,
      imageFactory,
      decodeSamples: images?.decodeSamples,
      onProgress: (update) => self.postMessage({ progress: update }),
    });
    self.postMessage({ result: out }, [out.bytes.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message || 'PDF processing failed.' });
  }
};
