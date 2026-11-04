import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { getRegistry, convert } from '../server/conversion/index.js';

test('installed local tools expose image optimization and complete media output profiles', async () => {
  const registry = await getRegistry();
  for (const id of ['jpg', 'png', 'webp', 'avif', 'gif', 'tiff'])
    assert.ok(
      registry.pairs.some((p) => p.source === id && p.target === id),
      `${id} optimization`,
    );
  if (registry.dependencies.find((d) => d.name === 'FFmpeg / FFprobe')?.available) {
    for (const [source, target] of [
      ['mp4', 'mov'],
      ['mov', 'mkv'],
      ['webm', 'flac'],
      ['mkv', 'm4a'],
    ])
      assert.ok(
        registry.pairs.some((p) => p.source === source && p.target === target),
        `${source} to ${target}`,
      );
  }
});

test('same-format image resize is real and unsafe archive paths are rejected', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'local-tools-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'input.png');
  await sharp({ create: { width: 80, height: 60, channels: 3, background: 'blue' } })
    .png()
    .toFile(file);
  const output = await convert({
    inputPath: file,
    outputDir: root,
    source: 'png',
    target: 'png',
    options: { width: 20 },
  });
  assert.equal((await sharp(output.path).metadata()).width, 20);
  const registry = await getRegistry();
  if (registry.pairs.some((p) => p.source === 'zip' && p.target === '7z')) {
    await fs.writeFile(file, zipSync({ '../escape.txt': strToU8('secret') }));
    await assert.rejects(
      convert({ inputPath: file, outputDir: root, source: 'zip', target: '7z' }),
      /unsafe/i,
    );
    assert.equal(
      (await fs.readdir(root)).some((name) => name.startsWith('.archive-')),
      false,
    );
  }
});

test('native archives reject TAR traversal, links and corrupt data without leaving staging files', async (t) => {
  const registry = await getRegistry();
  if (!registry.pairs.some((p) => p.source === 'tar' && p.target === 'zip'))
    return t.skip('7-Zip is unavailable');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'local-archive-security-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'input.tar');
  function tar(name, type = '0') {
    const header = Buffer.alloc(512);
    header.write(name, 0, 100, 'utf8');
    header.write('0000644\0', 100);
    header.write('0000000\0', 108);
    header.write('0000000\0', 116);
    header.write('00000000000\0', 124);
    header.write('00000000000\0', 136);
    header.fill(32, 148, 156);
    header.write(type, 156);
    header.write('outside.txt', 157);
    header.write('ustar\0', 257);
    header.write('00', 263);
    const sum = header.reduce((a, b) => a + b, 0);
    header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    return Buffer.concat([header, Buffer.alloc(1024)]);
  }
  for (const data of [tar('../escape.txt'), tar('link.txt', '2'), Buffer.from('broken TAR')]) {
    await fs.writeFile(file, data);
    await assert.rejects(
      convert({ inputPath: file, outputDir: root, source: 'tar', target: 'zip' }),
    );
    assert.deepEqual(
      (await fs.readdir(root)).filter((name) => name !== path.basename(file)),
      [],
    );
  }
});

test('native archive roundtrip preserves nested files and compression settings affect actual output', async (t) => {
  const registry = await getRegistry();
  if (!registry.pairs.some((p) => p.source === 'zip' && p.target === '7z'))
    return t.skip('7-Zip is unavailable');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'local-archive-roundtrip-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const input = path.join(root, 'input.zip');
  const text = 'Hello Local Converter\n'.repeat(5000);
  await fs.writeFile(
    input,
    zipSync({
      'folder/hello.txt': strToU8(text),
      'second.txt': strToU8('Second file'),
      'empty/': new Uint8Array(),
    }),
  );
  const low = await convert({
    inputPath: input,
    outputDir: root,
    source: 'zip',
    target: '7z',
    options: { compression: 0 },
  });
  const high = await convert({
    inputPath: input,
    outputDir: root,
    source: 'zip',
    target: '7z',
    options: { compression: 9 },
  });
  assert.ok((await fs.stat(high.path)).size < (await fs.stat(low.path)).size / 2);
  const tar = await convert({ inputPath: high.path, outputDir: root, source: '7z', target: 'tar' });
  const zip = await convert({ inputPath: tar.path, outputDir: root, source: 'tar', target: 'zip' });
  const files = unzipSync(await fs.readFile(zip.path));
  assert.equal(strFromU8(files['folder/hello.txt']), text);
  assert.equal(strFromU8(files['second.txt']), 'Second file');
  assert.equal(
    (await fs.readdir(root)).some((name) => name.startsWith('.archive-')),
    false,
  );
});
