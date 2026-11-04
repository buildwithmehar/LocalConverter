import { browserRegistry } from './registry.js';
import { createBrowserRuntime } from './runtime.js';
import { isBrowserSite } from './site-mode.js';
import { toolById } from '../../shared/everyday-tools.js';

async function convert(args) {
  if (args.operation) {
    if (args.operation === 'convert-font') {
      const { convertFontInWorker } = await import('./font-client.js');
      return convertFontInWorker(args);
    }
    if (
      ['protect-pdf', 'unlock-pdf', 'extract-pdf-images', 'render-html'].includes(args.operation)
    ) {
      const engine = await import('./advanced-document-engine.js');
      return engine.convert(args);
    }
    const tool = toolById(args.operation),
      group = tool?.engine;
    const engine =
      group === 'media'
        ? await import('./media-engine.js')
        : ['productivity', 'data', 'reports'].includes(group)
          ? await import('./utility-engine.js')
          : await import('./image-document-engine.js');
    if (!engine.supportedToolIds.includes(args.operation))
      throw new Error(
        'This operation is not supported by the browser engine yet. Your file has not been uploaded.',
      );
    return engine.convert(args);
  }
  if (
    ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aiff', 'mp4', 'webm', 'mov', 'mkv'].includes(args.source)
  ) {
    const engine = await import('./media-engine.js');
    return engine.convertPair(args);
  }
  if (
    ['csv', 'tsv', 'json', 'yaml', 'xlsx', 'srt', 'vtt', 'zip', 'gz', 'tar'].includes(
      args.source,
    ) ||
    (args.source === 'txt' && ['zip', 'gz'].includes(args.target))
  ) {
    const engine = await import('./utility-engine.js');
    return engine.convertDataPair(args);
  }
  const engine = await import('./image-document-engine.js');
  return engine.convertPair(args);
}
let runtime;
export const getBrowserRuntime = () =>
  (runtime ||= createBrowserRuntime({ registry: browserRegistry(), convert }));
export const browserRequest = (path, init) => getBrowserRuntime().request(path, init);
export function jobDownloadUrl(id) {
  return isBrowserSite() ? getBrowserRuntime().downloadUrl(id) : `/api/jobs/${id}/download`;
}
export async function downloadBrowserBatch(jobs) {
  const blob = await getBrowserRuntime().batchBlob(jobs.map((job) => job.id)),
    url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = 'converted-files.zip';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
