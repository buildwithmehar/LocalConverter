# Public browser Analytics and discovery

The canonical public website is https://localconverter.tech. The current default build publishes the original interactive React application in `dist-public`, with 110 browser tool workspaces, 157 format pairs and 346 public routes.

Google Analytics 4 Measurement ID `G-PNZFZ75FT9` is included once per public HTML document. The initializer collects only on the exact canonical HTTPS origin. Canonical page-view URLs exclude query parameters and fragments; referrers are reduced to their origin. The application does not supply selected file contents, filenames, pasted input, passwords or private job IDs as event parameters. Preview builds still contain the production Google loader; the initializer suppresses collection there. Local browser verification mocks that loader so it sends no synthetic visits.

The public privacy page explains Analytics cookies and technical visit information separately from local browser processing. File conversion does not upload selected files to an API. Engine and model downloads are same-origin asset requests.

Generated resources include robots.txt, sitemap.xml, llms.txt, llms-full.txt, humans.txt and one Markdown counterpart per public page. They now describe browser execution rather than an installed-server guide site. Markdown/LLM resources receive noindex headers to avoid duplicate search pages; HTML remains indexable on the canonical domain.

`public/_headers` supplies host-specific noindex for localconverter.pages.dev and its preview subdomains. Generated headers retain those rules alongside the app CSP and cross-origin isolation needed by RAW processing. JSON Schema and font codecs have narrowly scoped worker policies; the main document does not enable general JavaScript eval. Browser metadata also noindexes noncanonical preview origins after initialization.

Run `npm run build` to regenerate the deployable website. The owner uploads that newly generated `dist-public` folder. Source changes and local test results do not establish that a new live deployment or Google indexing has occurred.
