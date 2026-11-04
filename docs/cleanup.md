# Source publication cleanup

This GitHub checkout is a separate source copy. The original development folder, private data, installed engines, dependencies and deployment output are preserved.

Excluded from publication: dependencies, `.tools`, `.artifacts`, `.local-data`, `.wrangler`, generated build output, generated `public/tool-runtime`, logs, caches and credentials. Runtime assets are rebuilt by the source scripts.

Formatting is standardized with Prettier and EditorConfig. Conversion implementations and locked dependency versions are retained. The GitHub edition adds documentation, real desktop/mobile screenshots, a source link and consistent browser SEO/social metadata.

No automated test suite was run during cleanup at the owner's request. Historical verification documentation is retained as a dated record, not a new passing-test claim. The existing live site is unchanged by source publication; deployment remains separate.
