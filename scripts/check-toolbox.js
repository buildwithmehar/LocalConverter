import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runProcess } from '../server/conversion/common.js';
import { getRegistry } from '../server/conversion/registry.js';
const root = fileURLToPath(new URL('../', import.meta.url)),
  registry = await getRegistry();
const expected = [...Array(100)].map((_, i) => i + 1),
  families = new Set(registry.tools.flatMap((t) => t.family || []));
const missing = expected.filter((n) => !families.has(n));
console.log(
  `${registry.tools.length} tool pages; ${registry.pairs.length} directed conversions; ${families.size}/100 roadmap families.`,
);
for (const dependency of registry.dependencies)
  console.log(`${dependency.available ? 'OK' : 'MISSING'} ${dependency.name}`);
let python = false;
try {
  const probe = await runProcess(
    path.join(root, '.tools/python/Scripts/python.exe'),
    [
      '-c',
      'import PIL,pillow_heif,pillow_jxl,rawpy,psd_tools,cv2,onnxruntime,pymupdf,pikepdf,fontTools,pypandoc,faster_whisper,vtracer,openpyxl; print("Python toolbox imports verified")',
    ],
    { timeout: 60000 },
  );
  console.log(probe.trim());
  python = true;
} catch (error) {
  console.error(error.message);
}
const modelFiles = [
  'image/u2netp.onnx',
  'image/FSRCNN_x2.pb',
  'image/FSRCNN_x4.pb',
  'media/whisper-tiny/model.bin',
  'media/whisper-tiny/config.json',
  'media/whisper-tiny/tokenizer.json',
  'media/whisper-tiny/vocabulary.txt',
  'document/eng.traineddata.gz',
];
let models = true;
for (const model of modelFiles) {
  const ok = await fs
    .stat(path.join(root, '.tools/models', model))
    .then((s) => s.size > 0)
    .catch(() => false);
  console.log(`${ok ? 'OK' : 'MISSING'} model ${model}`);
  if (!ok) models = false;
}
if (missing.length || !python || !models || registry.dependencies.some((d) => !d.available))
  process.exitCode = 1;
