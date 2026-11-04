# Publish the browser website

## Current production deployment — 26 October 2026

The browser website is now deployed to https://localconverter.tech through the owner-authorized Wrangler login. Production deployment: `7519e057-6789-4997-b97b-62bf15307628` (branch `main`). All346 public route responses passed canonical/module/H1/status checks. Original UI and browser conversion/download checks passed on the live domain, including PDF, images, schema validation, fonts/RAW, Pandoc, audio, speech and neural upscale. Pages-host noindex is live. Google tag configured once; test collection was blocked to avoid artificial visits. The www alias currently serves200 with the main-domain canonical. Evidence is in `.artifacts/verification/production-deployment.json`.

The canonical domain is https://localconverter.tech. Cloudflare Pages serves the static website and browser engine/model assets; selected files are processed on the visitor's device.

## Build and upload

```powershell
npm run build
```

Upload the newly generated **dist-public** directory to the existing Pages project. This directory now contains the original React application, 110 tool workspaces, 157 format pairs and 346 prerendered public routes. It is the complete browser website, replacing the historical documentation-only export. `npm run build:public` is an alias for the same build.

The owner runs the final production build manually. Isolated verification output under `.artifacts` is for tests, not the production upload instructions. Replace the earlier upload with this fresh output; source changes alone do not update the live website.

## Host configuration included

- Main canonical HTML is indexable. Pages hostname and deployment preview responses are noindex through host-specific X-Robots-Tag rules.
- Root 404.html returns an actual404 on unknown paths. Known routes use flat extensionless HTML; slash/www redirects are generated.
- CSP, cross-origin isolation, MIME types and model/worker assets support browser execution. The largest deployment file is checked against25MiB; Pandoc and speech files are compressed.
- Robots, sitemap, llms.txt, llms-full.txt, humans.txt and Markdown guides are generated from the browser registry.
- GA4 G-PNZFZ75FT9 initializes on the canonical HTTPS origin. See [Analytics](../analytics-and-discovery.md).

## After upload

Open home and tools, then perform actual conversion/download on the public domain. Check a direct tool URL, a mobile viewport, an unknown404 path, Pages-host noindex headers, canonical-host indexing, and Google Tag Assistant/Realtime. Submit the canonical sitemap to owner-verified Search Console after the live responses are correct. Search inclusion and rankings are decided by search engines.

The connected Cloudflare account previously could not find the Pages project; the user uploads through their own dashboard. No live deployment is claimed by local preparation.
