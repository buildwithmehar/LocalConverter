# Browser-only website migration

## Agreed outcome

The owner wants the existing complete Local Converter interface on Cloudflare Pages, with files processed inside the visitor's browser. No localhost service, paid backend, hidden API requirement or replacement documentation-only page. Preserve the design and all tool routes. The owner runs the final build command manually.

## Design

Keep the existing React components and job UI. A browser runtime supplies the registry, session jobs, processing, cancellation and download Blob URLs in memory. Conversion workers/lazy engine modules process actual input bytes; no user files leave the device. Tool results and drafts are cleared on reload. Native-only operations must disclose precise browser limitations and cannot pretend to produce equivalent output.

The default production build becomes an interactive, indexable browser website. Existing guide HTML/metadata are attached to the same React routes for discovery, rather than exporting a replacement guide-only website. Keep GA on the public canonical origin, Pages hostname noindex, robots/sitemap/LLM resources and the original visual design. All deployment files must fit Cloudflare's 25 MiB per-file limit. Large engines load lazily from compressed local assets.

## Implementation plan

1. Browser engine modules: utility/data/report tools, image/PDF/document tools and audio/video tools. Common contract: `convert({operation,inputs,options,onProgress,signal})` returns `{blob,filename,mime,details?}`; inputs have `name`, `source` and `file` (a Blob/File). Each module exports `supportedToolIds`. Individual unsupported operations have explicit reasons, never fake success.
2. Browser runtime: initialize registry without API requests, keep isolated jobs in memory, convert real bytes, cancel/retry/remove, create/revoke Blob URLs and create batch ZIPs. Integrate existing file/result controls without changing the design.
3. Build/export: compress Pandoc and other oversized engines, retain original React app in public HTML, generate discovery content for actual browser capabilities, keep canonical indexing and host-specific noindex. Add an upload-size preflight.
4. Verification: meaningful engine-output tests plus a static-host browser suite with all `/api/` requests rejected. Verify original home/tool layout, representative tools, download bytes, navigation, mobile, no file uploads, no oversized deployment files and indexing differences between custom/Pages hosts.

## Execution record

- User explicitly authorized the browser-only migration after the architecture explanation. Proceed with the implementation; do not ask for repeated design approval.
- There is no Git repository in this folder. Work in the existing shared workspace, preserve the installed app and license files, and keep QA artifacts in `.artifacts`.
- Root owns App/runtime/build/SEO integration. Engine tasks use separate files so concurrent edits do not conflict.

## Implemented result

Original UI retained; all 110 tool IDs have browser implementations. Supported browser format routes total 157; 346 public pages retain React module scripts. Browser-specific format and algorithm limitations are documented in README and workspace notes. QA/review fixes include cancellation races, retained-input budgets, CRC checks, SVG external-resource defenses, explicit media trim limits, accurate guide copy and scoped worker CSP.
