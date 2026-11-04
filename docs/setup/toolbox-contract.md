# Local engine contract

Engine definitions live in `shared/image-tools.js`, `shared/media-tools.js` and `shared/document-tools.js`; additional utility metadata is in the other shared tool modules. The registry exposes only operations supported by available local engines.

Metadata includes a stable ID, family IDs, category, title, description, input formats, engine, defaults, fields and practical limits. Settings shown in the interface must map to implemented processing behavior. Generators and browser-only tools also declare their actual input/output behavior.

Local engine functions receive `{operation, inputs, outputDir, options, signal, onProgress}`. Inputs provide validated paths, source format, name and byte size. A successful conversion returns `{path, filename, mime, details?}` pointing to real verified output within the job directory. User-controlled paths must not escape it; changing a file extension does not constitute conversion.

Use the existing no-shell process runner with cancellation and time limits. Python workers receive a manifest path rather than interpolated executable code. Passwords must not enter command-line arguments or logs. Missing native dependencies produce actionable failures.

This installation keeps Python in `.tools/python`, native office/ebook engines in `.tools/native`, and models in `.tools/models`. Current setup and limitations are described in the adjacent image/document/media/data notes and [toolbox](../toolbox.md).

Engine tests belong in `tests/` and verify decoded output. Generated test data, screenshots and reports belong in `.artifacts/`; production jobs remain in `.local-data`. See [verification](../verification.md) for repeatable commands.
