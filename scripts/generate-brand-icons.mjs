import sharp from 'sharp';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = `${root}src/assets/brand/lc-monogram.svg`;
const original = await readFile(source, 'utf8');
const paths = [...original.matchAll(/<path fill="([^"]+)" d="([^"]+)"\s*\/>/g)].map(
  ([, fill, d]) => ({ fill, d }),
);
if (paths.length !== 3) throw new Error('The LC master must contain its three vector paths.');

// Shared geometry for the theme-aware React logo and exported icon family.
await writeFile(
  `${root}src/assets/brand/lc-monogram.json`,
  JSON.stringify({ viewBox: '96 176 1128 904', paths }, null, 2) + '\n',
);
await mkdir(`${root}public/brand`, { recursive: true });
await copyFile(source, `${root}public/brand/lc-monogram.svg`);
const shapes = paths.map(({ fill, d }) => `<path fill="${fill}" d="${d}"/>`).join('');
const iconSvg = (scale = 1) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="1280" viewBox="0 0 1280 1280"><rect width="1280" height="1280" rx="256" fill="#f5f5f6"/><g transform="translate(640 640) scale(${scale}) translate(-640 -640)">${shapes}</g></svg>`;
const standard = Buffer.from(iconSvg());
await writeFile(`${root}public/favicon.svg`, standard);
for (const [file, size] of [
  ['favicon-96x96.png', 96],
  ['apple-touch-icon.png', 180],
  ['web-app-manifest-192x192.png', 192],
  ['web-app-manifest-512x512.png', 512],
]) {
  await sharp(standard).resize(size, size).png().toFile(`${root}public/${file}`);
}
await sharp(Buffer.from(iconSvg(0.76)))
  .resize(512, 512)
  .png()
  .toFile(`${root}public/web-app-maskable-512x512.png`);

// ICO supports PNG payloads. Include actual 16, 32 and 48 px images for old tabs/bookmarks.
const sizes = [16, 32, 48];
const images = await Promise.all(
  sizes.map((size) => sharp(standard).resize(size, size).png().toBuffer()),
);
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
images.forEach((image, index) => {
  const entry = 6 + index * 16;
  directory[entry] = directory[entry + 1] = sizes[index];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(image.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile(`${root}public/favicon.ico`, Buffer.concat([directory, ...images]));
console.log('Generated LC SVG, ICO, touch and manifest icons from the vector master.');
