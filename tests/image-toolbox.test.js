import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { unzipSync } from 'fflate';
import { convertImageTool } from '../server/conversion/image-toolbox.js';
import { imageTools } from '../shared/image-tools.js';
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'image-toolbox-'));
const input = path.join(root, 'input.png');
await sharp({ create: { width: 120, height: 80, channels: 4, background: '#ff0000' } })
  .png()
  .toFile(input);
const inputs = [{ path: input, source: 'png', name: 'photo.png' }];
const run = (operation, options = {}, files = inputs) =>
  convertImageTool({ operation, options, inputs: files, outputDir: path.join(root, 'out') });
test.after(() => fs.rm(root, { recursive: true, force: true }));
test('passport output has exact editable dimensions and DPI', async () => {
  const r = await run('passport-signature', { width: 300, height: 400, dpi: 300 });
  const m = await sharp(r.path).metadata();
  assert.equal(m.width, 300);
  assert.equal(m.height, 400);
  assert.equal(m.density, 300);
});
test('BMP conversion writes actual BMP and can decode back', async () => {
  const bmp = await run('bmp-converter', { format: 'bmp' });
  assert.equal((await fs.readFile(bmp.path)).subarray(0, 2).toString(), 'BM');
  const png = await run('bmp-converter', { format: 'png' }, [
    { path: bmp.path, source: 'bmp', name: 'image.bmp' },
  ]);
  assert.equal((await sharp(png.path).metadata()).width, 120);
});
test('favicon pack includes decodable differently sized PNGs and multi-size ICO', async () => {
  const r = await run('icon-favicon', { mode: 'pack' });
  const z = unzipSync(await fs.readFile(r.path));
  assert.equal((await sharp(z['favicon-32.png']).metadata()).width, 32);
  assert.equal(Buffer.from(z['favicon.ico']).readUInt16LE(4), 5);
});
test('collage joins ordered images with requested spacing', async () => {
  const r = await run('image-collage', { columns: 2, cellWidth: 100, cellHeight: 100, gap: 10 }, [
    ...inputs,
    ...inputs,
  ]);
  const m = await sharp(r.path).metadata();
  assert.equal(m.width, 230);
  assert.equal(m.height, 120);
});
test('metadata is exported as JSON and DPI changes remain metadata-only', async () => {
  const r = await run('image-metadata', { mode: 'view' });
  const m = JSON.parse(await fs.readFile(r.path, 'utf8'));
  assert.equal(m.width, 120);
  const d = await run('image-dpi', { dpi: 600 });
  const dm = await sharp(d.path).metadata();
  assert.equal(dm.width, 120);
  assert.equal(dm.density, 600);
});
test('SVG sprite rewrites clashing IDs and rejects external resources', async () => {
  const p = path.join(root, 'a.svg');
  await fs.writeFile(
    p,
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><defs><linearGradient id="g"><stop stop-color="red"/></linearGradient></defs><path fill="url(#g)" d="M0 0H20V20H0Z"/></svg>',
  );
  const f = [
    { path: p, source: 'svg', name: 'one.svg' },
    { path: p, source: 'svg', name: 'two.svg' },
  ];
  const r = await run('svg-sprite', {}, f);
  const s = await fs.readFile(r.path, 'utf8');
  assert.match(s, /icon-1-g/);
  assert.match(s, /icon-2-g/);
  assert.equal((s.match(/<symbol/g) || []).length, 2);
  await fs.writeFile(p, '<svg><image href="https://example.com/a.png"/></svg>');
  await assert.rejects(run('svg-optimize', {}, [f[0]]), /self-contained/);
});
test('tool settings reject unknown keys and disguised formats', async () => {
  await assert.rejects(run('passport-signature', { width: 0 }), /width/);
  await assert.rejects(run('bmp-converter', { evil: true }), /setting/);
  await assert.rejects(run('heic-converter', {}, inputs), /format|support/i);
  assert.ok(imageTools.length >= 18);
});
test('traced SVG contains paths rather than a bitmap wrapper', async () => {
  const r = await run('image-vectorize');
  const s = await fs.readFile(r.path, 'utf8');
  assert.match(s, /<path/);
  assert.doesNotMatch(s, /<image/);
  await sharp(Buffer.from(s)).png().toBuffer();
});
test('watermark changes visible pixels and enforces ordered logo roles', async () => {
  const r = await run('image-watermark', {
    text: 'TEST',
    fontSize: 20,
    position: 'center',
    opacity: 100,
  });
  const original = await sharp(input).ensureAlpha().raw().toBuffer();
  const changed = await sharp(r.path).ensureAlpha().raw().toBuffer();
  assert.notDeepEqual(changed, original);
  await assert.rejects(run('image-watermark', { mode: 'logo' }), /photo then logo/);
});
test('SVG optimizer keeps accessibility, viewBox and reusable IDs', async () => {
  const p = path.join(root, 'accessible.svg');
  await fs.writeFile(
    p,
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" role="img" aria-labelledby="title"><title id="title">Red square</title><desc>Test</desc><path id="shape" d="M0 0H20V20H0Z" fill="red"/></svg>',
  );
  const r = await run('svg-optimize', {}, [{ path: p, source: 'svg', name: 'a.svg' }]);
  const s = await fs.readFile(r.path, 'utf8');
  assert.match(s, /viewBox="0 0 20 20"/);
  assert.match(s, /aria-labelledby="title"/);
  assert.match(s, /id="shape"/);
  assert.match(s, /<title id="title">Red square/);
});
test('AI super-resolution runs both local models and preserves alpha', async () => {
  for (const scale of [2, 4]) {
    const r = await run('ai-upscale', { scale, denoise: 0 });
    const m = await sharp(r.path).metadata();
    assert.equal(m.width, 120 * scale);
    assert.equal(m.height, 80 * scale);
    assert.equal(m.hasAlpha, true);
    assert.equal(r.details.model, `FSRCNN_x${scale}`);
  }
});
test('local segmentation produces variable alpha and composites a replacement colour', async () => {
  const p = path.join(root, 'subject.png');
  await sharp(
    Buffer.from(
      '<svg width="240" height="240"><rect width="240" height="240" fill="white"/><ellipse cx="120" cy="130" rx="48" ry="80" fill="#df3322"/><circle cx="120" cy="60" r="30" fill="#deaa77"/><path d="M88 40Q120 0 152 40Z" fill="#222"/></svg>',
    ),
  )
    .png()
    .toFile(p);
  const file = [{ path: p, source: 'png', name: 'subject.png' }];
  const r = await run('remove-background', {}, file);
  const { data, info } = await sharp(r.path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let min = 255,
    max = 0;
  for (let i = 3; i < data.length; i += info.channels) {
    min = Math.min(min, data[i]);
    max = Math.max(max, data[i]);
  }
  assert.ok(max - min > 50, 'segmentation must yield foreground and background alpha');
  assert.equal(r.details.model, 'u2netp');
  const bg = await run('photo-background', { mode: 'color', background: '#0000ff' }, file);
  const pixel = await sharp(bg.path)
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .raw()
    .toBuffer();
  assert.ok(pixel[2] > pixel[0]);
});
test('scan cleanup yields binary document pixels and preserves bounded dimensions', async () => {
  const p = path.join(root, 'scan.png');
  await sharp(
    Buffer.from(
      '<svg width="300" height="240"><rect width="300" height="240" fill="#ccccbb"/><rect x="20" y="20" width="260" height="200" fill="white"/><text x="35" y="80" font-size="20">Document scan</text><path d="M35 100H250M35 130H250M35 160H200" stroke="black" stroke-width="3"/></svg>',
    ),
  )
    .png()
    .toFile(p);
  const r = await run('scan-cleanup', {}, [{ path: p, source: 'png', name: 'scan.png' }]);
  const { data, info } = await sharp(r.path).raw().toBuffer({ resolveWithObject: true });
  assert.ok(info.width <= 300);
  assert.ok(info.height <= 240);
  assert.ok(data.every((v) => v === 0 || v === 255));
});
test('real HEIC and JPEG XL fixtures decode into actual PNG pixels', async () => {
  const { runProcess } = await import('../server/conversion/common.js');
  const py = path.resolve('.tools/python/Scripts/python.exe');
  const heic = path.join(root, 'fixture.heic'),
    jxl = path.join(root, 'fixture.jxl');
  await runProcess(py, [
    '-c',
    'import sys,pillow_heif,pillow_jxl;from PIL import Image;pillow_heif.register_heif_opener();im=Image.new("RGB",(64,48),(20,80,180));im.save(sys.argv[1],format="HEIF");im.save(sys.argv[2],format="JXL",lossless=True)',
    heic,
    jxl,
  ]);
  for (const [op, p, source] of [
    ['heic-converter', heic, 'heic'],
    ['jxl-converter', jxl, 'jxl'],
  ]) {
    const r = await run(op, {}, [{ path: p, source, name: path.basename(p) }]);
    const { data, info } = await sharp(r.path).raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 64);
    assert.equal(info.height, 48);
    assert.ok(data[2] > 150);
  }
});
test('PSD preview and layer ZIP decode into usable pixels', async () => {
  const { runProcess } = await import('../server/conversion/common.js');
  const p = path.join(root, 'fixture.psd');
  await runProcess(path.resolve('.tools/python/Scripts/python.exe'), [
    '-c',
    'import sys;from PIL import Image;from psd_tools import PSDImage;from psd_tools.api.layers import PixelLayer;psd=PSDImage.new("RGB",(64,48));PixelLayer.frompil(Image.new("RGB",(64,48),"red"),psd,name="Red layer");psd.save(sys.argv[1])',
    p,
  ]);
  const file = [{ path: p, source: 'psd', name: 'fixture.psd' }];
  const r = await run('psd-export', {}, file);
  assert.equal((await sharp(r.path).metadata()).width, 64);
  const z = unzipSync(await fs.readFile((await run('psd-export', { mode: 'layers' }, file)).path));
  assert.equal((await sharp(z['layer-001.png']).metadata()).height, 48);
  assert.equal(JSON.parse(Buffer.from(z['layers.json']).toString())[0].name, 'Red layer');
});
test('JFIF compatibility validates JPEG content and ICO decodes back to PNG', async () => {
  const p = path.join(root, 'fixture.jfif');
  await sharp(input).jpeg().toFile(p);
  const r = await run('jfif-converter', { format: 'png' }, [
    { path: p, source: 'jfif', name: 'x.jfif' },
  ]);
  assert.equal((await sharp(r.path).metadata()).format, 'png');
  const ico = await run('icon-favicon');
  const png = await run('icon-favicon', { mode: 'png', size: 64 }, [
    { path: ico.path, source: 'ico', name: 'favicon.ico' },
  ]);
  assert.equal((await sharp(png.path).metadata()).width, 64);
});
test('input paths outside a job and animated still-image inputs fail', async () => {
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'outside-image-job-'));
  try {
    const p = path.join(outside, 'a.png');
    await fs.copyFile(input, p);
    await assert.rejects(
      run('bmp-converter', {}, [{ path: p, source: 'png', name: 'a.png' }]),
      /job directory/,
    );
  } finally {
    await fs.rm(outside, { recursive: true, force: true });
  }
  const p = path.join(root, 'anim.webp');
  const { runProcess } = await import('../server/conversion/common.js');
  await runProcess(path.resolve('.tools/python/Scripts/python.exe'), [
    '-c',
    'import sys;from PIL import Image;a=Image.new("RGB",(20,20),"red");b=Image.new("RGB",(20,20),"blue");a.save(sys.argv[1],save_all=True,append_images=[b],duration=100,loop=0)',
    p,
  ]);
  await assert.rejects(
    run('bmp-converter', {}, [{ path: p, source: 'webp', name: 'a.webp' }]),
    /still images/,
  );
});
test('LibRaw converts a real CFA DNG fixture and rejects a fake RAW extension', async () => {
  const { runProcess } = await import('../server/conversion/common.js');
  const p = path.join(root, 'fixture.dng');
  await runProcess(path.resolve('.tools/python/Scripts/python.exe'), [
    '-c',
    'import sys,tifffile,numpy as np;a=np.tile(np.linspace(1000,50000,128,dtype=np.uint16),(128,1));tags=[(50706,"B",4,(1,4,0,0),False),(50707,"B",4,(1,1,0,0),False),(50708,"s",0,"Test camera",False),(271,"s",0,"Test",False),(272,"s",0,"Camera",False),(33421,"H",2,(2,2),False),(33422,"B",4,(0,1,1,2),False),(50717,"I",1,65535,False),(50721,"2i",9,(1,1,0,1,0,1,0,1,1,1,0,1,0,1,0,1,1,1),False),(50778,"H",1,21,False)];tifffile.imwrite(sys.argv[1],a,photometric=32803,metadata=None,extratags=tags)',
    p,
  ]);
  const r = await run('raw-converter', { format: 'png' }, [
    { path: p, source: 'dng', name: 'fixture.dng' },
  ]);
  const m = await sharp(r.path).metadata();
  assert.equal(m.width, 128);
  assert.equal(m.height, 128);
  await assert.rejects(
    run('raw-converter', {}, [{ path: input, source: 'dng', name: 'fake.dng' }]),
    /unsupported|not supported|corrupt/i,
  );
});
test('metadata removal drops EXIF and DPI resampling changes actual pixel count', async () => {
  const p = path.join(root, 'exif.jpg');
  await sharp(input)
    .withMetadata({ density: 150, exif: { IFD0: { Artist: 'Fixture author' } } })
    .jpeg()
    .toFile(p);
  const f = [{ path: p, source: 'jpg', name: 'exif.jpg' }];
  const view = JSON.parse(await fs.readFile((await run('image-metadata', {}, f)).path, 'utf8'));
  assert.equal(view.exif.Artist, 'Fixture author');
  const stripped = await run('image-metadata', { mode: 'remove' }, f);
  assert.equal((await sharp(stripped.path).metadata()).exif, undefined);
  const resized = await run('image-dpi', { dpi: 300, resample: true }, f);
  const m = await sharp(resized.path).metadata();
  assert.equal(m.width, 240);
  assert.equal(m.height, 160);
  assert.equal(m.density, 300);
});
test('physical resizing maps 25.4 mm at 100 DPI to 100 pixels with print metadata', async () => {
  const r = await run('resize-print-image', { width: 25.4, height: 25.4, unit: 'mm', dpi: 100 });
  const m = await sharp(r.path).metadata();
  assert.equal(m.width, 100);
  assert.equal(m.height, 100);
  assert.equal(m.density, 100);
});
