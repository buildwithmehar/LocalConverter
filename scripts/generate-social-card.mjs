import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const logo = await readFile(new URL('../public/favicon.svg', import.meta.url));
const card = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#202125"/><path d="M0 1H1200M0 629H1200" stroke="#57403c"/><rect x="64" y="64" width="72" height="72" rx="18" fill="#f4f4f6"/><text x="160" y="114" font-family="Arial,sans-serif" font-weight="700" font-size="36" fill="#f4f4f6">Local Converter</text><text x="64" y="286" font-family="Arial,sans-serif" font-size="66" font-weight="700" fill="#f4f4f6">Your files.</text><text x="64" y="366" font-family="Arial,sans-serif" font-size="66" font-weight="700" fill="#f4f4f6">Your computer.</text><text x="64" y="440" font-family="Arial,sans-serif" font-size="25" fill="#b9bec8">Image, PDF, document, media and developer tools.</text><text x="64" y="550" font-family="Arial,sans-serif" font-size="22" fill="#d99183">localconverter.tech</text></svg>`,
);
await sharp(card)
  .composite([{ input: await sharp(logo).resize(72, 72).png().toBuffer(), left: 64, top: 64 }])
  .png()
  .toFile(fileURLToPath(new URL('../public/social-card.png', import.meta.url)));
console.log('Generated 1200 × 630 social card from existing brand artwork.');
