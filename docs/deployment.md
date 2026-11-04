# Build and deployment

Use Node.js 24 or newer, npm, disk space for model caches, and internet access for first-time asset preparation. Browser development requires no cloud credentials or environment variables.

```sh
npm ci
npm run build
```

If npm 12 blocks esbuild's installation script, run `node node_modules/esbuild/install.js` before building.

The build prepares codecs/models, bundles React into `dist`, then exports HTML, route guides, discovery files and assets into `dist-public`. Generated assets and output are ignored by Git. The conversion server and private files are not part of the website.

## Cloudflare Pages

Publish `dist-public`. For Git-based builds, use `npm run build`, output directory `dist-public`, and Node 24 or newer. Cold builds download public model weights; they are not committed to this repository.

Retain `_headers` and `_redirects`: they provide CSP, cross-origin isolation, canonical-host redirects and preview-host noindex rules. If creating a different Pages project, update hostname rules currently specific to `localconverter.pages.dev`.

The canonical domain remains `https://localconverter.tech`. Source publication does not change the current live deployment.

## Local preview

`npm run dev` starts browser development on port 3000. After a build, `npm start` serves `dist-public` on that port. Set `PORT` to use another port. Do not run both on the same port.

The exporter writes route titles/descriptions, canonicals, Open Graph/Twitter cards, JSON-LD, sitemap, robots and readable discovery files. The existing Analytics ID is public configuration, not a secret; it initializes only on the canonical HTTPS origin.

The social card is `public/social-card.png`, 1200 × 630. Its generator and vector brand master remain in the repository. README screenshots are documentation assets.

The optional legacy server stores data in `.local-data`; never publish that directory. Browser conversion jobs are held in tab memory. Keep downloaded results outside the source tree.
