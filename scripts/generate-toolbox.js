import fs from 'node:fs/promises';
import { everydayTools } from '../shared/everyday-tools.js';
const families = Array.from({ length: 70 }, (_, index) => index + 1);
const coverage = families.map((family) => ({
  family,
  tools: everydayTools.filter((tool) => tool.family.includes(family)).map((tool) => tool.id),
}));
if (coverage.some((row) => !row.tools.length)) throw new Error('Incomplete roadmap coverage.');
const content = `# Complete Local Converter toolbox

${everydayTools.length} dedicated tool pages implement all 70 families in the approved expansion roadmap. The original 161 directed conversions remain available. These are real queued operations with downloadable outputs, not navigation-only cards.

## Using the tools

Open [Local tools](http://127.0.0.1:3000/tools). Search by task and choose a category. Every page supplies its own accepted inputs, settings, file order, output and limits. Text utilities also accept pasted text. Pending selections survive navigation inside this tab; reloading closes that in-memory selection. Download completed results before their 30-minute temporary retention ends.

The home page keeps six common shortcuts. The full catalogue exposes every tool. Themes, opaque header, keyboard controls, reduced motion and the no-white-flash navigation behavior are retained.

## Installed local engines

This Windows installation has Python 3.11 at \`.tools/python/Scripts/python.exe\`, FFmpeg/FFprobe, 7-Zip, locally extracted LibreOffice 26.8.1.1, Calibre 9.16.0, Pandoc, Tesseract English OCR, U²-Net small segmentation, FSRCNN x2/x4 super-resolution and Whisper tiny CPU transcription. Runtime conversions do not download models or contact a conversion service. Processing is globally queued one job at a time.

Run \`node scripts/check-toolbox.js\` to check installed runtimes, model assets and all 70 families. Run \`npm test\`, \`npm run build\` and \`npm run test:ui\` for the engine, API and browser verification.

For another Windows machine, \`npm ci\` alone installs the Node dependencies; also provision the local runtimes:

1. Create the Python 3.11 environment with \`py -3.11 -m venv .tools/python\`, then run \`.tools/python/Scripts/python.exe -m pip install -r docs/toolbox-requirements.txt\`.
2. Install FFmpeg/FFprobe and 7-Zip. Run \`npx playwright install chromium\` for the isolated HTML/Lottie renderer.
3. Follow [image engine setup](setup/image-engine.md) for the exact model URLs and pinned checksums.
4. Download the four files \`model.bin\`, \`config.json\`, \`tokenizer.json\` and \`vocabulary.txt\` from the official Systran/faster-whisper-tiny Hugging Face repository to \`.tools/models/media/whisper-tiny\`. The worker uses local-files-only loading.
5. Follow [document engine setup](setup/document-engine.md) for signed official LibreOffice/Calibre MSI administrative extraction, exact paths, OCR model URL and checksums.
6. Run the runtime check, build and start the app. A missing engine produces an actionable error; it never produces a fabricated output.

## Practical limits

- 20 uploaded files and 100 MB aggregate input per job; 200 MB output. Archive expansion stays within 100 MB and 1,000 entries. Unsafe paths, links and encrypted archives are rejected. RAR creation is unavailable.
- Ordinary PDFs allow 100 pages; OCR, rendering, comparison and raster compression allow 20. OCR is English. Native Office files must be self-contained; external resources, macros, active fields and embedded objects are rejected before rendering.
- Media operations select up to 120 seconds. Animation allows 240 frames, 30 seconds and 64 million decoded pixels. Reverse video has stricter limits. These are short-clip utilities, not a full editing timeline.
- Target-size image/GIF compression returns an honest closest result when the target cannot be met. Lossless PDF optimization can increase size; lossy raster mode removes selectable text and forms.
- AI masks/transcripts and automatic scan cleanup need review. RAW supports LibRaw-compatible camera files; the fixture verifies real DNG decoding, not every camera. AMR/APE decoders are installed, but representative AMR/APE fixtures were not available.
- PSD/PSB exports are cached previews/rasterized layers. Lottie supports self-contained JSON/TGS, without external assets, expressions or .lottie ZIP bundles. Font conversion changes containers while preserving original outlines.
- XML formatters preserve mixed-content order and spaces; arbitrary XML-to-object conversion uses explicit attribute/text keys. Text tools accept up to 8 MB; pasted input is capped at one million characters.
- Processes run under the local Windows account with deadlines and output validation. They are not a hardened operating-system sandbox. Third-party runtime/model licences remain applicable; see the domain reports and dependency notices before redistributing the packaged app.

## Roadmap coverage

| Family | Implemented tool pages |
|---|---|
${coverage.map((row) => `| ${row.family} | ${row.tools.map((id) => `[${id}](http://127.0.0.1:3000/${id})`).join(', ')} |`).join('\n')}

## Tool inventory

| Tool | Category | Result |
|---|---|---|
${everydayTools.map((tool) => `| [${tool.title}](http://127.0.0.1:3000/${tool.id}) | ${tool.category} | ${tool.summary.replaceAll('|', '/')} |`).join('\n')}
`;
await fs.writeFile(new URL('../docs/toolbox.md', import.meta.url), content);
await fs.writeFile(
  new URL('../docs/toolbox-coverage.json', import.meta.url),
  JSON.stringify({ toolCount: everydayTools.length, familyCount: 70, coverage }, null, 2),
);
console.log(`Documented ${everydayTools.length} tools and all 70 families.`);
