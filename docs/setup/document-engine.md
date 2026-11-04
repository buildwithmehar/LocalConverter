# Document engine implementation

Owned implementation: `shared/document-tools.js`, `server/conversion/document-toolbox.js`, `server/toolbox/document_worker.py`, `tests/document-toolbox.test.js`.

17 tool IDs cover the assigned 15 families. Existing merge/split/images-to-PDF remain controller-owned.

| Family | Tool IDs                | Actual output                                                                                             |
| ------ | ----------------------- | --------------------------------------------------------------------------------------------------------- |
| 25     | reorder-pdf, rotate-pdf | Selected/reordered pages, per-range rotation; readable PDFs                                               |
| 26     | compress-pdf            | Lossless structural optimization or explicitly lossy JPEG page rasterization; original/output byte counts |
| 27     | ocr-document            | English image/scanned-PDF OCR to UTF-8 text or image-preserving searchable PDF with aligned text          |
| 28     | office-render           | LibreOffice DOCX/XLSX/PPTX/ODF/RTF layout to PDF or rendered page PNG/JPG ZIP                             |
| 41     | protect-pdf, unlock-pdf | pikepdf AES-256 encryption and removal with a supplied known password                                     |
| 42     | stamp-pdf               | Text, page numbers, centered watermark, or a second PDF page overlay                                      |
| 43     | fill-pdf-form           | AcroForm text, boolean checkboxes, single-choice fields; optional flattening                              |
| 44     | extract-pdf-images      | Original embedded image bytes, separate transparency masks and page/object index in ZIP                   |
| 45     | compare-pdfs            | ZIP with per-page text diffs, visual changed-pixel ratios and difference PNGs                             |
| 46     | pdf-tables              | Selectable-text table detection to per-table CSV ZIP or Excel workbook                                    |
| 47     | pdf-markdown            | PyMuPDF4LLM layout-aware Markdown text/table extraction                                                   |
| 49     | render-html             | Chromium CSS-rendered A4 PDF or viewport PNG, uploaded local assets only                                  |
| 50     | convert-ebook           | Calibre unprotected EPUB/MOBI/AZW3 to EPUB/MOBI/AZW3/PDF/TXT                                              |
| 51     | semantic-document       | Pandoc Markdown/HTML/DOCX/RTF/ODT input; Markdown/HTML/DOCX/RTF/ODT/EPUB output                           |
| 52     | convert-font            | FontTools TTF/OTF/WOFF/WOFF2 to WOFF/WOFF2/original-flavour SFNT                                          |

## Local dependency state

Configured and executed successfully on this computer:

- Python `.tools/python/Scripts/python.exe`: PyMuPDF 2.0, pymupdf4llm 2.0, pikepdf 10.17.0, fonttools 4.67.0, Brotli 1.2.0, pypandoc-binary 1.17 (Pandoc 3.9), openpyxl 3.1.5, Pillow 12.3.0. Controller owns pip installation.
- Node: tesseract.js 7.0.0, Playwright 1.64.1 with existing local Chromium. Controller owns npm installation. Rendering uses Playwright library calls, no Playwright test suites or production server changes.
- LibreOffice 26.8.1.1: `.tools/native/libreoffice/program/soffice.com` (also includes soffice.exe).
- Calibre 9.16.0: `.tools/native/calibre/PFiles64/Calibre2/ebook-convert.exe`.
- English OCR language data: `.tools/models/document/eng.traineddata.gz`.

Both native MSI Authenticode signatures were verified **Valid**: The Document Foundation (LibreOffice), Kovid Goyal (Calibre). Applications were administratively extracted into this project, not installed system-wide.

### Reproducible downloads and extraction

Exact official upstream URLs and SHA-256:

| Asset             | URL                                                                                                            | SHA-256                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| LibreOffice MSI   | https://download.documentfoundation.org/libreoffice/stable/26.8.1/win/x86_64/LibreOffice_26.8.1_Win_x86-64.msi | C6298B10CFA1748BCBEDAD94C62CE771E240E5021BFD6D7A967CD571B04B5312 |
| Calibre MSI       | https://github.com/kovidgoyal/calibre/releases/download/v9.16.0/calibre-64bit-9.16.0.msi                       | 99BA538CA701C7C3B234D19B2236349C3AFF3B55244AB9016072F74E6294E40A |
| English OCR model | https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0/eng.traineddata.gz                            | ED350F3752F81EE8F38769EDC14D92D997DABABE23B565C59879372CC46A2468 |

From the project root in PowerShell, save the two MSI assets as `.tools/native/downloads/libreoffice.msi` and `calibre.msi`, and the language asset at the model path above. Verify hashes with `Get-FileHash -Algorithm SHA256` and signatures with `Get-AuthenticodeSignature` before extraction. Actual extraction commands used this argument form:

```powershell
$projectDir = (Get-Location).Path
$officeMsi = Join-Path $projectDir '.tools/native/downloads/libreoffice.msi'
$officeDir = Join-Path $projectDir '.tools/native/libreoffice'
$ebookMsi = Join-Path $projectDir '.tools/native/downloads/calibre.msi'
$ebookDir = Join-Path $projectDir '.tools/native/calibre'
Start-Process msiexec.exe -ArgumentList @('/a', ('"'+$officeMsi+'"'), '/qn', ('TARGETDIR="'+$officeDir+'"')) -WindowStyle Hidden -Wait
Start-Process msiexec.exe -ArgumentList @('/a', ('"'+$ebookMsi+'"'), '/qn', ('TARGETDIR="'+$ebookDir+'"')) -WindowStyle Hidden -Wait
& "$officeDir/program/soffice.com" --version
& "$ebookDir/PFiles64/Calibre2/ebook-convert.exe" --version
```

Native/model files are local runtime assets; they must be provisioned on another computer. No conversion silently substitutes another format when a dependency is missing.

## Boundaries and honest limits

- Inputs: 100 MB aggregate, 20 files; ordinary PDFs: at most 100 pages. OCR, raster compression, comparison and page-image rendering: at most 20 pages. Page rasters: at most 40 million pixels. Outputs: at most 200 MB. Native commands use argument arrays, no shell, hidden windows and timeouts. Passwords occur only in a temporary manifest, which is deleted after the Python call, and never in command arguments.
- HTML assets are fulfilled from an explicit uploaded-basename map at a synthetic origin. No real HTTP server, file URLs, network requests, JavaScript, frames, external fonts or external stylesheet downloads are permitted. PNG is a viewport screenshot; PDF paginates. SVG assets pass the existing self-contained SVG validator.
- Office/semantic archive preflight rejects external OOXML relationships, ODF linked graphics/external xlinks, scripts/macros, external spreadsheet formulas, dangerous ZIP paths, XML entities/DTDs (including UTF-16), and oversized package parts. RTF fields, templates and embedded objects must be removed. Every Office invocation receives a fresh UUID profile.
- OCR is English only. Blank/unrecognized documents fail clearly. Table extraction from scans requires running searchable-PDF OCR first, then text table detection; irregular layouts, merged cells and OCR mistakes require review. This engine exports editable CSV/XLSX; it does not supply an in-browser table editor.
- Lossless compression can make a small file larger. Raster compression removes text, links/forms and other interactive objects; metadata and UI note disclose this.
- Standard single-line Latin-1 stamps use Helvetica; overlays retain the overlay PDF's existing opacity. Unsupported stamp glyphs fail instead of being silently replaced. Forms are standard AcroForms, not XFA/radio buttons/signatures; field text rendering depends on the form's fonts.
- PDF Markdown and comparisons are extraction/pixel comparisons, not semantic equivalence or guaranteed reading-order reconstruction. Embedded-image export preserves image objects and separate masks, not vector artwork or an entire rendered page.
- Semantic conversion preserves structure rather than page layout. Embedded/external resources in semantic text conversion are rejected; use HTML rendering for uploaded visual assets. Ebook DRM is unsupported. Font SFNT output preserves CFF/TrueType outline flavour; it does not convert between outline types.

## Verification

`node --test tests/document-toolbox.test.js` exercises real, decoded outputs: PDF page content/rotation/overlay/compression, encrypted password failure/unlock, fillable/flattened fields and checkboxes, extracted PNG objects, comparison text/pixels, CSV/XLSX cells, Markdown, font container roundtrip, native DOCX and XLSX/PPTX imports, Office PDF/page images, EPUB/MOBI/AZW3 conversions, CSS-rendered PNG/PDF, English image/scanned-PDF searchable OCR, and preflight rejection of external Office resources/macros/entities/RTF fields. Latest full rerun is recorded below when complete.

Earlier full run: **11 passed, 0 failed** (135.5 s). Supplemental native XLSX/PPTX/AZW3 test: **passed** (59.2 s). Post-hardening external-resource negative regressions: **passed**; the expanded checkbox fixture exposed a parent-field value synchronization issue, which was fixed before the final full rerun.

Final expanded full run: **13 passed, 0 failed, 0 skipped**, exit 0, **229.8 seconds**. This includes native DOCX/XLSX/PPTX, EPUB/MOBI/AZW3, local rendered HTML, searchable scanned-PDF OCR, corrected live checkbox/text parent fields, flattened forms, overlay and external-resource rejection. Final Python/Node syntax checks also exited 0. Final focused resource-guard/comparison rerun: **2 passed, 0 failed**, exit 0, **41.2 seconds**, including extra assertions for relationship targets without TargetMode and ODF formula URLs.
