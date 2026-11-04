# Forty toolbox additions and upgrades

Implemented on 2026-10-23 using the existing Local Converter workspace, typography, theme variables, cards, settings, local jobs, result actions and responsive layouts. The catalog now has 110 dedicated tools: the original 79, 30 new roadmap families, and a dedicated DOCX preview route supporting an upgrade. The ten upgrades below are features of workflows, not ten duplicate pages.

## Implementation map

| #   | Approved item          | Route / implementation                                                                                                                       |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | UUID / ULID            | `/generate-id`: secure UUID v4 and ULID, 1–1,000 identifiers                                                                                 |
| 2   | Password / passphrase  | `/generate-password`: secure random selection, enabled-character guarantees, 2,048-word passphrase dictionary                                |
| 3   | JWT decoder            | `/decode-jwt`: header, payload, expiry, explicit unverified status                                                                           |
| 4   | Timestamp/timezone     | `/convert-timestamp`: seconds/milliseconds, strict ISO calendar dates and IANA zones                                                         |
| 5   | Cron explanation       | `/explain-cron`: five-field cron description and timezone-aware next runs                                                                    |
| 6   | Regex tester           | `/test-regex`: JavaScript patterns, match indices and captures, isolated deadline                                                            |
| 7   | Text hash/HMAC         | `/hash-text`: SHA-256/SHA-512 and keyed HMAC                                                                                                 |
| 8   | URL inspector          | `/inspect-url`: HTTP(S) components, duplicate query keys, fragment                                                                           |
| 9   | Query strings          | `/query-string`: parse/build, ordered pairs and duplicate keys                                                                               |
| 10  | Number bases           | `/number-base`: signed exact BigInt binary/octal/decimal/hex                                                                                 |
| 11  | Text comparison        | `/compare-text`: second text or ordered pair of uploaded files; added/removed/unchanged lines                                                |
| 12  | Word/character counts  | `/count-text`: Unicode-aware words, code points, paragraphs, sentences, estimated reading time                                               |
| 13  | Case/slug conversion   | `/change-case`: lower, upper, title, camel, Pascal, snake, kebab and slug                                                                    |
| 14  | Line cleanup           | `/clean-lines`: optional trimming, empty-line removal, deduplication and stable text sorting                                                 |
| 15  | Placeholder text       | `/placeholder-text`: exact word count or paragraph count                                                                                     |
| 16  | Units                  | `/convert-units`: dimension checks; length, mass, affine temperature, area and binary/decimal data sizes                                     |
| 17  | JSON comparison        | `/compare-json`: escaped JSON Pointer paths and before/after values                                                                          |
| 18  | JSONPath               | `/query-json`: property/index/wildcard/recursive selections; executable expressions rejected                                                 |
| 19  | JSON Schema            | `/validate-json-schema`: local draft-07 validation, errors and a bounded worker                                                              |
| 20  | SQL formatting         | `/format-sql`: generic SQL, PostgreSQL, MySQL, SQLite and BigQuery                                                                           |
| 21  | Code formatting        | `/format-code`: actual HTML/CSS/JavaScript formatting and minification without execution                                                     |
| 22  | Markdown editor        | `/markdown-editor`: file/pasted input, live sanitized preview, Markdown/HTML download                                                        |
| 23  | Diagrams               | `/diagram-studio`: Mermaid live preview; local isolated SVG/PNG rendering                                                                    |
| 24  | Metadata comparison    | `/compare-metadata`: exactly two images; before/after fields and changes                                                                     |
| 25  | Photo privacy          | `/photo-privacy`: detected location, device, author and timestamp metadata                                                                   |
| 26  | PDF metadata           | `/pdf-metadata`: inspection, edit or removal of document information/XMP metadata                                                            |
| 27  | PDF page sizing        | `/pdf-page-size`: A4/Letter/custom, margins, source crop/rotation preservation without revealing cropped content                             |
| 28  | Contact sheets         | `/pdf-contact-sheet`: page-numbered PDF thumbnail sheet, PNG/PDF                                                                             |
| 29  | Document statistics    | `/document-stats`: TXT/Markdown/HTML/DOCX/selectable PDF; explicit paragraph/heading counts where available                                  |
| 30  | File signatures        | `/inspect-file`: supported binary signatures, ZIP Office/EPUB inspection and extension comparison; honest unknown state                      |
| 31  | Styled QR              | `/create-code`: QR Code Styling colours, dots/corners, optional local raster logo; Wi-Fi/contact/email/SMS/WhatsApp presets                  |
| 32  | QR verification        | `/create-code`: output is decoded before success when verification is enabled; existing `/read-code` remains                                 |
| 33  | Metadata explorer      | `/image-metadata`: ExifReader EXIF/IPTC/XMP fields plus image properties; original strip operation retained                                  |
| 34  | Metadata exports       | `/image-metadata`: case-insensitive field/value search, JSON or formula-escaped CSV                                                          |
| 35  | Compression comparison | `/compress-image`: source/result previews, actual sizes and target status                                                                    |
| 36  | Browser compression    | `/compress-image`, Processing location → This browser: locally bundled Squoosh-derived MozJPEG/WebP codecs and PNG encoder                   |
| 37  | Batch optimization     | `/compress-image`: ordered images, separate encoded files and per-file compression JSON report in ZIP                                        |
| 38  | DOCX preview           | `/docx-preview`: sanitized Mammoth HTML, readable preview, extraction warnings and copy/download actions                                     |
| 39  | Advanced Markdown      | `/markdown-editor`: Markdown-it tables, typography, links and fenced code; safe preview/export. Existing conversion engines retained         |
| 40  | Browser documents      | `/semantic-document`, Processing location → This browser: local Pandoc WASM, Markdown/HTML/DOCX/RTF/ODT input and supported semantic outputs |

## Processing and limits

Default operations use the existing session-owned local queue, cancellation, retry, expiry and download handling. Generators create their input marker internally; people do not have to upload a dummy file. Comparison text may be supplied in the second input or as two files. More than two comparison files are rejected.

Browser modes use dedicated module workers. They do not post files to `/api/tools/*/jobs`; assets and WASM are served from this computer. Cancel or navigation terminates the worker. Browser results must be downloaded before navigating/reloading and are explicitly described as separate from My files. Source and generated Blob URLs are released on replacement/unmount.

- Text utilities: 1 MB per source, bounded JSON depth/node counts, finite JSON numbers only.
- Regex: 1-second isolated execution; at most 1,000 matches. Schema: 3-second isolated execution. Neither can hang the app server.
- JSONPath: no executable filters or prototype access. Remote schema references are not fetched.
- Browser compression: PNG/JPEG/WebP/AVIF inputs; JPEG/PNG/WebP outputs. TIFF and other native-supported inputs use local server mode. Targets are best-effort and failures are labelled honestly. PNG does not promise palette reduction in browser mode.
- Browser documents: one input up to 10 MB; no direct PDF generation. Markdown is used for pasted text. HTML and EPUB downloads remove active/external resources; EPUB XHTML is XML-serialized and its styles are simplified. This is semantic conversion, not exact layout reconstruction.
- PDF tools: at most 100 pages, bounded pixels for contact sheets. Page sizing rebuilds pages; interactive forms, bookmarks, annotations and signatures may not carry over.
- Metadata reports cover supported embedded fields, not all possible privacy clues. The existing stripping operation re-encodes rather than field-by-field editing.
- JWT payloads are explicitly unverified. No token authenticity is implied. Generated passwords and HMAC secrets are omitted from public option records where applicable.

## Dependencies and source provenance

No IT Tools application source was copied. The utility implementations use focused libraries and the existing React framework. No Squoosh analytics or hosted application was embedded. jSquash supplies Squoosh-derived image codecs. Mermaid, QR Code Styling, ExifReader, Markdown-it, Mammoth and Pandoc WASM are locally installed/bundled as needed; PDF operations reuse pdf-lib/PDF.js instead of adding a redundant PDF generation engine.

Locked dependency versions and collected license notices are in `dependency-licenses.md` and `THIRD-PARTY-NOTICES.txt`. Pandoc WASM declares GPL-2.0-or-later; ExifReader declares MPL-2.0. Preserve the applicable notices and corresponding-source obligations if redistributing these components. Local bundle preparation is `npm run tool-assets`, included in `npm run build`.

## Verification

Targeted functional tests exercise all 30 new families and upgrade outputs. Regression fixtures cover JSON overflow, Unicode-set zero-width regex, extra comparison files, visible PDF crop boundaries, explicit HTML paragraph/table boundaries, active-content removal, browser file-upload previews, QR decoding and navigation cancellation. `npm test` runs the new Node tests with the original suite. `npm run test:ui` includes original and roadmap browser tests; `npm run test:roadmap` runs only the new browser tests.

Historical logs and screenshots are retained in the recovery archive described in [cleanup.md](cleanup.md). New browser results and captures are generated in `.artifacts/`.

Final results: **283/283 Node tests**, **65/65 browser tests**, successful production build and **0 known runtime dependency vulnerabilities**. The browser suite includes all 271 operation URLs and both existing and new tool workspaces. Source review findings were corrected with regression tests; no functional finding remains deferred. The large Mermaid/Pandoc assets load only for the relevant tool or selected browser operation.
