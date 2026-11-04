import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
const compress = promisify(gzip),
  root = resolve(import.meta.dirname, '..');
export async function prepareSpeechModel() {
  const cache = join(root, '.tools/browser-models/whisper-tiny'),
    output = join(root, 'public/tool-runtime/models/whisper-tiny');
  const names = [
    'config.json',
    'generation_config.json',
    'tokenizer.json',
    'tokenizer_config.json',
    'preprocessor_config.json',
    'special_tokens_map.json',
    'added_tokens.json',
    'vocab.json',
    'merges.txt',
    'normalizer.json',
    'onnx/encoder_model_quantized.onnx',
    'onnx/decoder_model_merged_quantized.onnx',
  ];
  const files = {};
  for (let i = 0; i < names.length; i += 3)
    await Promise.all(
      names.slice(i, i + 3).map(async (name) => {
        const saved = join(cache, name);
        await mkdir(dirname(saved), { recursive: true });
        if (
          !(await stat(saved)
            .then((s) => s.size > 0)
            .catch(() => false))
        ) {
          const response = await fetch(
            'https://huggingface.co/Xenova/whisper-tiny/resolve/main/' + name,
            { signal: AbortSignal.timeout(120000) },
          );
          if (!response.ok)
            throw new Error(`Speech model download failed (${response.status}): ${name}`);
          const data = new Uint8Array(await response.arrayBuffer());
          if (!data.length || data.length > 64 * 1024 * 1024)
            throw new Error('Invalid speech model asset size.');
          await writeFile(saved, data);
        }
        const bytes = await readFile(saved),
          dest = join(output, name);
        await mkdir(dirname(dest), { recursive: true });
        if (name.endsWith('.onnx')) {
          const encoded = await compress(bytes, { level: 9 }),
            parts = [],
            multipart = encoded.length > 25 * 1024 * 1024,
            partSize = multipart ? 20 * 1024 * 1024 : encoded.length;
          for (let offset = 0; offset < encoded.length; offset += partSize) {
            const suffix = multipart ? `.gz.part${parts.length}` : '.gz',
              file = dest + suffix;
            await writeFile(file, encoded.subarray(offset, offset + partSize));
            parts.push('/tool-runtime/models/whisper-tiny/' + name + suffix);
          }
          files[name] = parts;
        } else await writeFile(dest, bytes);
      }),
    );
  await writeFile(
    join(output, 'manifest.json'),
    JSON.stringify({ model: 'Xenova/whisper-tiny', files }, null, 2) + '\n',
  );
  console.log('Local browser speech model prepared with deployment-sized compressed assets.');
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename))
  await prepareSpeechModel();
