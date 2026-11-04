# Contributing

Use Node.js 24 or newer. Install the locked dependencies with `npm ci`, then run `npm run dev` for the browser-only application.

Keep conversions on the visitor's device. Lazy-load large codecs and models, release object URLs when removing jobs, and retain file-size, timeout and archive-expansion limits. Do not add simulated tools, unsupported conversion routes, ratings or performance claims.

Keep format and operation descriptions in `shared/` consistent with the browser engines in `src/browser/`. Preserve the distinction between browser workspaces and the optional legacy server.

Run `npm run format` to apply the repository's formatting. Existing verification commands are documented in [docs/verification.md](docs/verification.md); native engine checks need their platform dependencies. No verification suite was run during this source-publication cleanup, at the owner's request.

Never commit `.env`, user files, `.local-data`, model caches, generated runtime bundles or build output. Retain third-party copyright and license notices when updating dependencies.

Documentation screenshots can be refreshed with `npm run screenshots`. This captures the real website without uploading files or running conversion jobs. Set `SCREENSHOT_ORIGIN` to capture a local preview instead.
