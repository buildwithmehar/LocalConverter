import fs from 'node:fs/promises';
import { getRegistry } from '../server/conversion/registry.js';
import { operationPages } from '../server/page-content.js';
const registry = {
  ...(await getRegistry()),
  limits: { maxFiles: 20, maxBytes: 104857600, timeoutSeconds: 180, retentionMinutes: 30 },
};
const pages = operationPages(registry),
  parts = (value) =>
    typeof value === 'string'
      ? value
      : Array.isArray(value)
        ? value.map(parts).join(' ')
        : value && typeof value === 'object'
          ? Object.values(value).map(parts).join(' ')
          : '';
const inventory = [...pages.values()].map((page) => ({
  path: page.path,
  title: page.title,
  kind: page.kind,
  words: parts({
    lead: page.lead,
    steps: page.steps,
    settings: page.settings,
    example: page.example,
    review: page.review,
    limitations: page.limitations,
    faqs: page.faqs,
  }).split(/\s+/).length,
  steps: page.steps.length,
  faqs: page.faqs.length,
}));
const report = `# All operation pages\n\n${pages.size} separate operation URLs: ${registry.tools.length} tools and ${registry.pairs.length} format conversions. Each page has a functional workspace, four how-to steps, settings/output notes, example, result checks, limitations and six FAQs. See [operation-pages.md](../../../docs/operation-pages.md) for SEO setup and verification.\n\n| Page | Type | Guide words | How-to steps | FAQs |\n|---|---|---:|---:|---:|\n${inventory.map((page) => `| [${page.title.replaceAll('|', '/')}](http://127.0.0.1:3000${page.path}) | ${page.kind} | ${page.words} | ${page.steps} | ${page.faqs} |`).join('\n')}\n`;
const output = new URL('../.artifacts/reports/operation-pages/', import.meta.url);
await fs.mkdir(output, { recursive: true });
await fs.writeFile(new URL('all-operation-pages.md', output), report);
await fs.writeFile(new URL('inventory.json', output), JSON.stringify(inventory, null, 2));
console.log(
  `${pages.size} pages, ${Math.min(...inventory.map((page) => page.words))}–${Math.max(...inventory.map((page) => page.words))} guide words, ${inventory.reduce((total, page) => total + page.faqs, 0)} FAQ answers.`,
);
