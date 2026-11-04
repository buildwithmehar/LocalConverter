import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { imageTools } from '../../shared/image-tools.js';
import { readInput, safeSvg, runProcess, checkAbort, fail, LIMITS } from './common.js';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mime = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  json: 'application/json',
  zip: 'application/zip',
};
function settingsFor(tool, supplied) {
  if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied))
    fail('Invalid settings.');
  for (const key of Object.keys(supplied))
    if (!Object.hasOwn(tool.defaults, key)) fail(`Unsupported setting: ${key}`);
  const settings = { ...tool.defaults, ...supplied };
  for (const f of tool.fields) {
    const v = settings[f.key];
    if (
      f.type === 'number' &&
      (!Number.isFinite(v) ||
        ((f.step ?? 1) >= 1 && !Number.isInteger(v)) ||
        v < f.min ||
        v > f.max)
    )
      fail(`Invalid ${f.key}.`);
    if (f.type === 'select' && !f.options.some(([x]) => x === v)) fail(`Invalid ${f.key}.`);
    if (f.type === 'checkbox' && typeof v !== 'boolean') fail(`Invalid ${f.key}.`);
    if (f.type === 'text' && (typeof v !== 'string' || v.length > f.maxLength))
      fail(`Invalid ${f.key}.`);
    if (f.type === 'color' && (typeof v !== 'string' || !/^#[a-f\d]{6}$/i.test(v)))
      fail(`Invalid ${f.key}.`);
  }
  return settings;
}
export async function convertImageTool({
  operation,
  inputs,
  outputDir,
  options = {},
  signal,
  onProgress,
}) {
  const tool = imageTools.find((t) => t.id === operation);
  if (!tool) fail('Unsupported image tool.');
  const settings = settingsFor(tool, options);
  if (
    !Array.isArray(inputs) ||
    inputs.length < tool.minFiles ||
    inputs.length > (tool.multiple ? 20 : 1)
  )
    fail('Select the required number of input files.');
  if (inputs.some((i) => !tool.accept.includes(i.source)))
    fail('This tool does not support the selected input format.');
  if (operation === 'image-watermark' && inputs.length !== (settings.mode === 'logo' ? 2 : 1))
    fail('Text watermark needs one photo; logo watermark needs photo then logo.');
  if (operation === 'photo-background' && inputs.length !== (settings.mode === 'image' ? 2 : 1))
    fail('Background image mode needs subject then background; other modes need one photo.');
  checkAbort(signal);
  await fs.mkdir(outputDir, { recursive: true });
  const realOutput = await fs.realpath(outputDir),
    jobRoot = path.dirname(realOutput);
  let total = 0;
  for (const input of inputs) {
    const real = await fs.realpath(input.path);
    const relative = path.relative(jobRoot, real);
    if (relative.startsWith('..') || path.isAbsolute(relative))
      fail('Input path must remain inside the job directory.');
    const stat = await fs.stat(real);
    if (!stat.isFile() || !stat.size) fail('Input must be a nonempty file.');
    total += stat.size;
  }
  if (total > LIMITS.inputBytes) fail('Combined inputs exceed 100 MB.');
  let extension = settings.format || 'png';
  if (operation === 'image-vectorize' || operation.startsWith('svg-')) extension = 'svg';
  if (operation === 'icon-favicon')
    extension = settings.mode === 'pack' ? 'zip' : settings.mode === 'ico' ? 'ico' : 'png';
  if (operation === 'psd-export' && settings.mode === 'layers') extension = 'zip';
  if (
    (operation === 'image-metadata' && settings.mode === 'view') ||
    (operation === 'image-dpi' && settings.mode === 'check')
  )
    extension = 'json';
  const filename = `${operation}-${randomUUID().slice(0, 8)}.${extension}`,
    outputPath = path.join(realOutput, filename);
  let details = {};
  onProgress?.({ stage: 'Processing image locally', progress: null });
  if (operation.startsWith('svg-')) {
    const { optimize } = await import('svgo');
    const sources = [];
    let size = 0;
    for (const input of inputs) {
      const data = await readInput(input.path);
      size += data.length;
      if (size > 5_000_000) fail('SVG tools accept at most 5 MB combined.');
      sources.push(safeSvg(data));
    }
    let result;
    if (operation === 'svg-optimize') {
      result = optimize(sources[0], {
        floatPrecision: settings.precision,
        js2svg: { pretty: settings.pretty },
        plugins: [
          {
            name: 'preset-default',
            params: { overrides: { cleanupIds: false, removeDesc: false } },
          },
        ],
      }).data;
      safeSvg(Buffer.from(result));
      details = {
        inputBytes: Buffer.byteLength(sources[0]),
        outputBytes: Buffer.byteLength(result),
      };
    } else {
      if (!/^[a-zA-Z][\w-]{0,39}$/.test(settings.prefix))
        fail(
          'Symbol prefix must start with a letter and contain only letters, digits, underscores or hyphens.',
        );
      const symbols = sources.map((source, index) => {
        const id = `${settings.prefix}-${index + 1}`;
        const s = optimize(source, {
          plugins: [{ name: 'prefixIds', params: { prefix: id, delim: '-' } }],
        }).data;
        const m = s.match(/<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/i);
        if (!m) fail('SVG must contain a complete SVG root.');
        let attrs = m[1].replace(
          /\s+(?:xmlns(?::\w+)?|id|width|height)\s*=\s*(?:"[^"]*"|'[^']*')/gi,
          '',
        );
        if (!/\bviewBox\s*=/.test(attrs)) {
          const w = m[1].match(/\bwidth=["']([\d.]+)(?:px)?["']/),
            h = m[1].match(/\bheight=["']([\d.]+)(?:px)?["']/);
          if (!w || !h) fail('Every icon needs a viewBox or numeric width and height.');
          attrs += ` viewBox="0 0 ${w[1]} ${h[1]}"`;
        }
        return `<symbol id="${id}"${attrs}>${m[2]}</symbol>`;
      });
      result = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${symbols.join('')}</svg>`;
      safeSvg(Buffer.from(result));
      details = {
        symbols: symbols.length,
        ids: sources.map((_, i) => `${settings.prefix}-${i + 1}`),
      };
    }
    await fs.writeFile(outputPath, result, { flag: 'wx' });
  } else {
    const manifest = path.join(realOutput, `image-${randomUUID()}.json`);
    await fs.writeFile(
      manifest,
      JSON.stringify({
        operation,
        inputs: inputs.map((i) => ({ path: i.path, source: i.source, name: i.name })),
        output: outputPath,
        options: settings,
        models: path.join(project, '.tools/models/image'),
      }),
      { flag: 'wx' },
    );
    try {
      const stdout = await runProcess(
        path.join(project, '.tools/python/Scripts/python.exe'),
        [path.join(project, 'server/toolbox/image_worker.py'), manifest],
        { signal, timeout: 170000 },
      );
      details = JSON.parse(stdout.trim()).details || {};
    } finally {
      await fs.rm(manifest, { force: true });
    }
  }
  checkAbort(signal);
  const stat = await fs.stat(outputPath);
  if (!stat.size || stat.size > LIMITS.outputBytes)
    fail('Image output is empty or exceeds 200 MB.');
  return { path: outputPath, filename, mime: mime[extension], details };
}
