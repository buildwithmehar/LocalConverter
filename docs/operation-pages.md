# Operation pages

The current installation exposes **271 operation routes**: 110 tools plus 161 directed conversions. Another 81 discovery/information routes produce **352 public guide pages**.

Each operation model provides a dedicated workspace, practical steps, settings, an example, result checks, limits, related tools and FAQs. Source models in `server/page-content.js` and `shared/` drive the local rendered HTML, browser navigation and public export.

The local app executes conversions using the available installed engines. Local responses remain private/noindex. The public `dist-public` export is documentation for that installed app, accepts no uploads, and identifies its SoftwareApplication accurately. It includes canonical metadata, structured data and sitemap/discovery resources for https://localconverter.tech.

Run `npm run report:operations` to regenerate the inventory and readable report in `.artifacts/reports/operation-pages/`. Run `npm run build:public` after source changes, followed by `npm run test:seo`.

See [verification](verification.md), [public launch requirements](seo-audit/PUBLIC-LAUNCH.md) and [Analytics/discovery configuration](analytics-and-discovery.md). Historical inventories and copy-review evidence are retained in the recovery archive described in [cleanup.md](cleanup.md).
