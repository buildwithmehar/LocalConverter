import { build } from 'vite';
import { resolve } from 'node:path';
import { exportBrowserSite } from './export-browser-site.mjs';
// Verification uses an isolated folder; the owner's deployment build stays manual.
const app = resolve('.artifacts/browser-app'),
  output = resolve('.artifacts/browser-website');
await build({ build: { outDir: app, emptyOutDir: true } });
await exportBrowserSite({ appDirectory: app, output });
