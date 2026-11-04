> Historical verification record from the original project. No automated test suite was run for the November 2026 GitHub source cleanup, at the owner’s request. The results below are not a fresh certification of this checkout.

# Browser website verification — 26 October 2026

The default public export now includes the original React application with browser-only processing, 110 tool workspaces, 157 format pairs and 346 public prerendered routes. Legacy Node-server tests remain separate from static-site operation.

The focused engine/runtime/API run passed **88 Node tests**. Engine browser checks exercised real codecs, PDF contents, OCR, speech, AI/RAW/HEIC/JXL, font conversion, SVG validation, QR/barcode decoding, structured data and document outputs. Those checks recorded no external conversion requests or file uploads. Model/engine asset reads are same-origin GETs.

The static-site suite blocks all `/api/` requests and uses the generated production CSP/isolation headers. It verifies the original home/header/tools layout, mobile/themes, generators, JSON Schema worker, image conversion, PDF merge, compressed Pandoc DOCX, font and RAW workers. Final run results and limitations are appended below.

Artifacts:

- `.artifacts/verification/browser-node-final.txt`
- `.artifacts/verification/browser-production-build.txt`
- `.artifacts/verification/browser-static-ui.txt`
- `.artifacts/qa/browser-image/`, `.artifacts/qa/browser-media/`
- `.artifacts/qa/browser-utility-results.json` and `.artifacts/qa/browser-advanced-document-results.json`

`npm run test:browser` prepares an isolated verification build. The owner runs `npm run build` manually for deployment and publishes the newly generated `dist-public` folder. Neither live deployment nor post-deployment search indexing is claimed by local test results.

## Final observed results

- 88 focused Node checks passed with zero failures.
- Six complete static-site browser checks passed under generated production CSP/isolation, with all /api/ requests blocked. This includes real speech, media and neural image outputs.
- SEO/AEO/GEO discovery audit: all 346 pages have unique titles/descriptions, correct canonicals, readable heading/guide content and structured entities. All 346 are reachable from home and appear in the sitemap. LLM resource links resolve; UTF-8 declarations/BOM handling and Pages-host noindex rules pass.
- All 110 registered tool IDs have browser implementations; unsupported subformats/algorithm differences are disclosed in workspaces and README.
- Largest generated asset: 21,596,019 bytes, below the 25 MiB upload limit. No oversized Pandoc asset remains.
- Fresh npm audit reports zero known dependency vulnerabilities.

The owner still runs the final production build and uploads its output. Existing live hosting is not changed by these local checks.

## Live deployment verification — 26 October 2026

Production deployment7519e057 is live at https://localconverter.tech. All346 HTTP route checks pass. Five browser scenarios passed in the initial public run; the image/PDF scenario hit a transient QUIC transport error before loading, then passed its focused recheck with QUIC disabled. All six functional scenarios are verified. Pages-host noindex and canonical-host HTML indexing were observed. Google tag initialization was checked with metric collection intercepted. The platform-injected Cloudflare performance beacon is blocked by the existing app CSP; Google Analytics and conversion features are unaffected.
