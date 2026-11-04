# Complete Local Converter toolbox

79 dedicated tool pages implement all 70 families in the approved expansion roadmap. The original 161 directed conversions remain available. These are real queued operations with downloadable outputs, not navigation-only cards.

## Using the tools

Open [Local tools](http://127.0.0.1:3000/tools). Search by task and choose a category. Every page supplies its own accepted inputs, settings, file order, output and limits. Text utilities also accept pasted text. Pending selections survive navigation inside this tab; reloading closes that in-memory selection. Download completed results before their 30-minute temporary retention ends.

The home page keeps six common shortcuts. The full catalogue exposes every tool. Themes, opaque header, keyboard controls, reduced motion and the no-white-flash navigation behavior are retained.

## Installed local engines

This Windows installation has Python 3.11 at `.tools/python/Scripts/python.exe`, FFmpeg/FFprobe, 7-Zip, locally extracted LibreOffice 26.8.1.1, Calibre 9.16.0, Pandoc, Tesseract English OCR, U²-Net small segmentation, FSRCNN x2/x4 super-resolution and Whisper tiny CPU transcription. Runtime conversions do not download models or contact a conversion service. Processing is globally queued one job at a time.

Run `node scripts/check-toolbox.js` to check installed runtimes, model assets and all 70 families. Run `npm test`, `npm run build` and `npm run test:ui` for the engine, API and browser verification.

For another Windows machine, `npm ci` alone installs the Node dependencies; also provision the local runtimes:

1. Create the Python 3.11 environment with `py -3.11 -m venv .tools/python`, then run `.tools/python/Scripts/python.exe -m pip install -r docs/toolbox-requirements.txt`.
2. Install FFmpeg/FFprobe and 7-Zip. Run `npx playwright install chromium` for the isolated HTML/Lottie renderer.
3. Follow [image engine setup](setup/image-engine.md) for the exact model URLs and pinned checksums.
4. Download the four files `model.bin`, `config.json`, `tokenizer.json` and `vocabulary.txt` from the official Systran/faster-whisper-tiny Hugging Face repository to `.tools/models/media/whisper-tiny`. The worker uses local-files-only loading.
5. Follow [document engine setup](setup/document-engine.md) for signed official LibreOffice/Calibre MSI administrative extraction, exact paths, OCR model URL and checksums.
6. Run the runtime check, build and start the app. A missing engine produces an actionable error; it never produces a fabricated output.

## Practical limits

- 20 uploaded files and 100 MB aggregate input per job; 200 MB output. Archive expansion stays within 100 MB and 1,000 entries. Unsafe paths, links and encrypted archives are rejected. RAR creation is unavailable.
- Ordinary PDFs allow 100 pages; OCR, rendering, comparison and raster compression allow 20. OCR is English. Native Office files must be self-contained; external resources, macros, active fields and embedded objects are rejected before rendering.
- Media operations select up to 120 seconds. Animation allows 240 frames, 30 seconds and 64 million decoded pixels. Reverse video has stricter limits. These are short-clip utilities, not a full editing timeline.
- Target-size image/GIF compression returns an honest closest result when the target cannot be met. Lossless PDF optimization can increase size; lossy raster mode removes selectable text and forms.
- AI masks/transcripts and automatic scan cleanup need review. RAW supports LibRaw-compatible camera files; the fixture verifies real DNG decoding, not every camera. AMR/APE decoders are installed, but representative AMR/APE fixtures were not available.
- PSD/PSB exports are cached previews/rasterized layers. Lottie supports self-contained JSON/TGS, without external assets, expressions or .lottie ZIP bundles. Font conversion changes containers while preserving original outlines.
- XML formatters preserve mixed-content order and spaces; arbitrary XML-to-object conversion uses explicit attribute/text keys. Text tools accept up to 8 MB; pasted input is capped at one million characters.
- Processes run under the local Windows account with deadlines and output validation. They are not a hardened operating-system sandbox. Third-party runtime/model licences remain applicable; see the domain reports and dependency notices before redistributing the packaged app.

## Roadmap coverage

| Family | Implemented tool pages                                                                                                                                                                       |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | [heic-converter](http://127.0.0.1:3000/heic-converter)                                                                                                                                       |
| 2      | [bmp-converter](http://127.0.0.1:3000/bmp-converter)                                                                                                                                         |
| 3      | [icon-favicon](http://127.0.0.1:3000/icon-favicon)                                                                                                                                           |
| 4      | [jfif-converter](http://127.0.0.1:3000/jfif-converter)                                                                                                                                       |
| 5      | [jxl-converter](http://127.0.0.1:3000/jxl-converter)                                                                                                                                         |
| 6      | [raw-converter](http://127.0.0.1:3000/raw-converter)                                                                                                                                         |
| 7      | [image-vectorize](http://127.0.0.1:3000/image-vectorize)                                                                                                                                     |
| 8      | [compress-image](http://127.0.0.1:3000/compress-image)                                                                                                                                       |
| 9      | [resize-image](http://127.0.0.1:3000/resize-image), [resize-print-image](http://127.0.0.1:3000/resize-print-image)                                                                           |
| 10     | [crop-image](http://127.0.0.1:3000/crop-image)                                                                                                                                               |
| 11     | [passport-signature](http://127.0.0.1:3000/passport-signature)                                                                                                                               |
| 12     | [image-watermark](http://127.0.0.1:3000/image-watermark)                                                                                                                                     |
| 13     | [image-collage](http://127.0.0.1:3000/image-collage)                                                                                                                                         |
| 14     | [image-dpi](http://127.0.0.1:3000/image-dpi)                                                                                                                                                 |
| 15     | [image-metadata](http://127.0.0.1:3000/image-metadata)                                                                                                                                       |
| 16     | [gif-maker](http://127.0.0.1:3000/gif-maker)                                                                                                                                                 |
| 17     | [animation-to-video](http://127.0.0.1:3000/animation-to-video)                                                                                                                               |
| 18     | [animation-convert](http://127.0.0.1:3000/animation-convert)                                                                                                                                 |
| 19     | [animation-convert](http://127.0.0.1:3000/animation-convert)                                                                                                                                 |
| 20     | [video-to-animation](http://127.0.0.1:3000/video-to-animation)                                                                                                                               |
| 21     | [extract-frames](http://127.0.0.1:3000/extract-frames)                                                                                                                                       |
| 22     | [compress-gif](http://127.0.0.1:3000/compress-gif)                                                                                                                                           |
| 23     | [edit-animation](http://127.0.0.1:3000/edit-animation)                                                                                                                                       |
| 24     | [images-to-pdf](http://127.0.0.1:3000/images-to-pdf)                                                                                                                                         |
| 25     | [merge-pdf](http://127.0.0.1:3000/merge-pdf), [split-pdf](http://127.0.0.1:3000/split-pdf), [reorder-pdf](http://127.0.0.1:3000/reorder-pdf), [rotate-pdf](http://127.0.0.1:3000/rotate-pdf) |
| 26     | [compress-pdf](http://127.0.0.1:3000/compress-pdf)                                                                                                                                           |
| 27     | [ocr-document](http://127.0.0.1:3000/ocr-document)                                                                                                                                           |
| 28     | [office-render](http://127.0.0.1:3000/office-render)                                                                                                                                         |
| 29     | [compress-audio](http://127.0.0.1:3000/compress-audio)                                                                                                                                       |
| 30     | [compress-video](http://127.0.0.1:3000/compress-video)                                                                                                                                       |
| 31     | [transform-video](http://127.0.0.1:3000/transform-video)                                                                                                                                     |
| 32     | [join-audio](http://127.0.0.1:3000/join-audio), [join-video](http://127.0.0.1:3000/join-video)                                                                                               |
| 33     | [mute-video](http://127.0.0.1:3000/mute-video), [replace-video-audio](http://127.0.0.1:3000/replace-video-audio)                                                                             |
| 34     | [audio-waveform](http://127.0.0.1:3000/audio-waveform), [video-thumbnail](http://127.0.0.1:3000/video-thumbnail)                                                                             |
| 35     | [image-base64](http://127.0.0.1:3000/image-base64)                                                                                                                                           |
| 36     | [svg-gzip](http://127.0.0.1:3000/svg-gzip)                                                                                                                                                   |
| 37     | [remove-background](http://127.0.0.1:3000/remove-background)                                                                                                                                 |
| 38     | [photo-background](http://127.0.0.1:3000/photo-background)                                                                                                                                   |
| 39     | [ai-upscale](http://127.0.0.1:3000/ai-upscale)                                                                                                                                               |
| 40     | [lottie-render](http://127.0.0.1:3000/lottie-render)                                                                                                                                         |
| 41     | [protect-pdf](http://127.0.0.1:3000/protect-pdf), [unlock-pdf](http://127.0.0.1:3000/unlock-pdf)                                                                                             |
| 42     | [stamp-pdf](http://127.0.0.1:3000/stamp-pdf)                                                                                                                                                 |
| 43     | [fill-pdf-form](http://127.0.0.1:3000/fill-pdf-form)                                                                                                                                         |
| 44     | [extract-pdf-images](http://127.0.0.1:3000/extract-pdf-images)                                                                                                                               |
| 45     | [compare-pdfs](http://127.0.0.1:3000/compare-pdfs)                                                                                                                                           |
| 46     | [pdf-tables](http://127.0.0.1:3000/pdf-tables)                                                                                                                                               |
| 47     | [pdf-markdown](http://127.0.0.1:3000/pdf-markdown)                                                                                                                                           |
| 48     | [scan-cleanup](http://127.0.0.1:3000/scan-cleanup)                                                                                                                                           |
| 49     | [render-html](http://127.0.0.1:3000/render-html)                                                                                                                                             |
| 50     | [convert-ebook](http://127.0.0.1:3000/convert-ebook)                                                                                                                                         |
| 51     | [semantic-document](http://127.0.0.1:3000/semantic-document)                                                                                                                                 |
| 52     | [convert-font](http://127.0.0.1:3000/convert-font)                                                                                                                                           |
| 53     | [psd-export](http://127.0.0.1:3000/psd-export)                                                                                                                                               |
| 54     | [svg-optimize](http://127.0.0.1:3000/svg-optimize)                                                                                                                                           |
| 55     | [svg-sprite](http://127.0.0.1:3000/svg-sprite)                                                                                                                                               |
| 56     | [convert-native-video](http://127.0.0.1:3000/convert-native-video)                                                                                                                           |
| 57     | [convert-native-audio](http://127.0.0.1:3000/convert-native-audio)                                                                                                                           |
| 58     | [convert-subtitles](http://127.0.0.1:3000/convert-subtitles)                                                                                                                                 |
| 59     | [burn-subtitles](http://127.0.0.1:3000/burn-subtitles)                                                                                                                                       |
| 60     | [normalize-audio](http://127.0.0.1:3000/normalize-audio)                                                                                                                                     |
| 61     | [transcribe-media](http://127.0.0.1:3000/transcribe-media)                                                                                                                                   |
| 62     | [archive-browser](http://127.0.0.1:3000/archive-browser), [create-archive](http://127.0.0.1:3000/create-archive)                                                                             |
| 63     | [repack-tar](http://127.0.0.1:3000/repack-tar)                                                                                                                                               |
| 64     | [clean-csv](http://127.0.0.1:3000/clean-csv)                                                                                                                                                 |
| 65     | [structured-data](http://127.0.0.1:3000/structured-data)                                                                                                                                     |
| 66     | [format-data](http://127.0.0.1:3000/format-data)                                                                                                                                             |
| 67     | [file-checksum](http://127.0.0.1:3000/file-checksum)                                                                                                                                         |
| 68     | [create-code](http://127.0.0.1:3000/create-code), [read-code](http://127.0.0.1:3000/read-code)                                                                                               |
| 69     | [color-palette](http://127.0.0.1:3000/color-palette)                                                                                                                                         |
| 70     | [text-encoding](http://127.0.0.1:3000/text-encoding)                                                                                                                                         |

## Tool inventory

| Tool                                                                                     | Category | Result                                                                              |
| ---------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| [Compress image](http://127.0.0.1:3000/compress-image)                                   | image    | Make an image fit your upload limit.                                                |
| [Resize image](http://127.0.0.1:3000/resize-image)                                       | image    | Set the exact width and height you need.                                            |
| [Crop & rotate image](http://127.0.0.1:3000/crop-image)                                  | image    | Keep the part that matters.                                                         |
| [Merge PDF](http://127.0.0.1:3000/merge-pdf)                                             | document | Bring your documents into one PDF.                                                  |
| [Split PDF](http://127.0.0.1:3000/split-pdf)                                             | document | Save the pages you need.                                                            |
| [Images to PDF](http://127.0.0.1:3000/images-to-pdf)                                     | document | Turn selected images into one document.                                             |
| [HEIC / HEIF converter](http://127.0.0.1:3000/heic-converter)                            | image    | Open iPhone photos in the image format your next app accepts.                       |
| [BMP converter](http://127.0.0.1:3000/bmp-converter)                                     | image    | Convert a Windows bitmap or make a BMP from a photo.                                |
| [ICO and favicon pack](http://127.0.0.1:3000/icon-favicon)                               | design   | Make a crisp website icon in the sizes browsers and devices need.                   |
| [JFIF converter](http://127.0.0.1:3000/jfif-converter)                                   | image    | Save a JFIF photo as a regular JPG or transparent-capable PNG.                      |
| [JPEG XL converter](http://127.0.0.1:3000/jxl-converter)                                 | image    | Open a still JPEG XL image as PNG, JPG or WebP.                                     |
| [Camera RAW converter](http://127.0.0.1:3000/raw-converter)                              | image    | Develop a camera RAW file into a shareable image.                                   |
| [Raster to SVG vectorizer](http://127.0.0.1:3000/image-vectorize)                        | vector   | Trace a bitmap into editable, scalable SVG paths.                                   |
| [Resize in centimetres, millimetres or inches](http://127.0.0.1:3000/resize-print-image) | image    | Choose a printed size in millimetres, centimetres or inches.                        |
| [Passport photo / signature resizer](http://127.0.0.1:3000/passport-signature)           | image    | Set exact photo or signature dimensions, DPI and an optional upload limit.          |
| [Text or logo watermark](http://127.0.0.1:3000/image-watermark)                          | image    | Place your name or logo on a photo with controlled opacity.                         |
| [Join images / collage](http://127.0.0.1:3000/image-collage)                             | image    | Arrange photos on one canvas with consistent spacing.                               |
| [DPI checker and converter](http://127.0.0.1:3000/image-dpi)                             | image    | Inspect print resolution or write the DPI your printer needs.                       |
| [View / remove image metadata](http://127.0.0.1:3000/image-metadata)                     | image    | Inspect image metadata or save a clean copy without it.                             |
| [Remove background](http://127.0.0.1:3000/remove-background)                             | image    | Isolate a subject on a transparent background with local AI.                        |
| [Blur / replace photo background](http://127.0.0.1:3000/photo-background)                | image    | Keep the subject and blur, recolour or replace its background.                      |
| [AI upscale and denoise](http://127.0.0.1:3000/ai-upscale)                               | image    | Enlarge a small image with neural super-resolution and optional denoising.          |
| [Document scan cleanup](http://127.0.0.1:3000/scan-cleanup)                              | image    | Straighten a photographed page and improve its readability.                         |
| [PSD / PSB preview and layers](http://127.0.0.1:3000/psd-export)                         | design   | Open a Photoshop preview or export rasterized layers together.                      |
| [SVG optimizer](http://127.0.0.1:3000/svg-optimize)                                      | vector   | Reduce SVG markup while keeping its viewBox and element IDs.                        |
| [SVG icon sprite](http://127.0.0.1:3000/svg-sprite)                                      | vector   | Combine separate SVG icons into one reusable symbol sheet.                          |
| [Images to animated GIF](http://127.0.0.1:3000/gif-maker)                                | image    | Turn an ordered set of images into a looping animation.                             |
| [GIF to video](http://127.0.0.1:3000/animation-to-video)                                 | video    | Turn a GIF, WebP or APNG animation into a video.                                    |
| [Animated GIF, WebP and APNG](http://127.0.0.1:3000/animation-convert)                   | image    | Move between GIF, animated WebP and APNG with timing preserved.                     |
| [Video to animated WebP, APNG or GIF](http://127.0.0.1:3000/video-to-animation)          | video    | Take a short moment from a video and make it loop.                                  |
| [Extract video or GIF frames](http://127.0.0.1:3000/extract-frames)                      | video    | Save video or animation frames as a downloadable image sequence.                    |
| [Compress GIF to target size](http://127.0.0.1:3000/compress-gif)                        | image    | Try a smaller palette and dimensions to reach a GIF upload limit.                   |
| [Crop, trim and edit animation](http://127.0.0.1:3000/edit-animation)                    | image    | Crop, reverse, trim or change the pace of an animation.                             |
| [Compress or trim audio](http://127.0.0.1:3000/compress-audio)                           | audio    | Trim a recording and choose a smaller audio format or bitrate.                      |
| [Compress or trim video](http://127.0.0.1:3000/compress-video)                           | video    | Make a shorter, smaller video with clear quality controls.                          |
| [Crop, rotate, speed or reverse video](http://127.0.0.1:3000/transform-video)            | video    | Reframe, rotate or change the playback speed of a clip.                             |
| [Join audio clips](http://127.0.0.1:3000/join-audio)                                     | audio    | Bring several audio clips together in your chosen order.                            |
| [Join video clips](http://127.0.0.1:3000/join-video)                                     | video    | Combine video clips on one consistent canvas.                                       |
| [Mute video](http://127.0.0.1:3000/mute-video)                                           | video    | Save a copy of your video with its audio removed.                                   |
| [Replace video audio](http://127.0.0.1:3000/replace-video-audio)                         | video    | Pair a video with a new recording or soundtrack.                                    |
| [Audio waveform image](http://127.0.0.1:3000/audio-waveform)                             | audio    | Turn a recording into a waveform graphic.                                           |
| [Video thumbnail](http://127.0.0.1:3000/video-thumbnail)                                 | video    | Choose a moment and save it as a still image.                                       |
| [Lottie or TGS to animation](http://127.0.0.1:3000/lottie-render)                        | design   | Render a self-contained Lottie or Telegram TGS animation.                           |
| [AVI, FLV, WMV, MPEG or TS to video](http://127.0.0.1:3000/convert-native-video)         | video    | Make older AVI, FLV, WMV, MPEG and TS videos easier to play.                        |
| [AAC, Opus, WMA, AMR or APE to audio](http://127.0.0.1:3000/convert-native-audio)        | audio    | Open AAC, Opus, WMA, AMR or APE in a common audio format.                           |
| [ASS, SSA, SRT and VTT subtitles](http://127.0.0.1:3000/convert-subtitles)               | subtitle | Change subtitle format or shift the timing of every cue.                            |
| [Burn subtitles into video](http://127.0.0.1:3000/burn-subtitles)                        | video    | Make subtitles part of the video image so they travel with the clip.                |
| [Normalize loudness and fade audio](http://127.0.0.1:3000/normalize-audio)               | audio    | Balance a recording’s loudness and add a gentle fade.                               |
| [Transcribe audio or video locally](http://127.0.0.1:3000/transcribe-media)              | audio    | Turn spoken audio into text or timed subtitles with offline Whisper.                |
| [Reorder PDF pages](http://127.0.0.1:3000/reorder-pdf)                                   | document | Put PDF pages in a new order or keep only the pages you need.                       |
| [Rotate PDF pages](http://127.0.0.1:3000/rotate-pdf)                                     | document | Correct the orientation of selected PDF pages.                                      |
| [Compress PDF](http://127.0.0.1:3000/compress-pdf)                                       | document | Optimize PDF objects or trade selectable text for smaller page images.              |
| [OCR image or scanned PDF](http://127.0.0.1:3000/ocr-document)                           | document | Make a scan searchable or extract English text from an image.                       |
| [Office to PDF or page images](http://127.0.0.1:3000/office-render)                      | document | Render a document, spreadsheet or presentation as PDF or page images.               |
| [Password protect PDF](http://127.0.0.1:3000/protect-pdf)                                | document | Protect a PDF with an AES-256 open password.                                        |
| [Unlock PDF with known password](http://127.0.0.1:3000/unlock-pdf)                       | document | Save an unencrypted copy using the password you already know.                       |
| [PDF stamps and page numbers](http://127.0.0.1:3000/stamp-pdf)                           | document | Add a stamp, watermark, page numbers or another PDF as an overlay.                  |
| [Fill and flatten PDF forms](http://127.0.0.1:3000/fill-pdf-form)                        | document | Fill standard PDF form fields and optionally flatten the result.                    |
| [Extract original PDF images](http://127.0.0.1:3000/extract-pdf-images)                  | document | Retrieve embedded images without rendering the whole page.                          |
| [Compare two PDFs](http://127.0.0.1:3000/compare-pdfs)                                   | document | Compare text and page appearance across two versions of a PDF.                      |
| [PDF tables to CSV or Excel](http://127.0.0.1:3000/pdf-tables)                           | document | Extract selectable-text tables into CSV files or an Excel workbook.                 |
| [PDF to Markdown](http://127.0.0.1:3000/pdf-markdown)                                    | document | Bring a PDF’s text and tables into an editable Markdown document.                   |
| [Render local HTML and CSS](http://127.0.0.1:3000/render-html)                           | document | Render your HTML with uploaded styles and assets, without network access.           |
| [Convert EPUB, MOBI and AZW3](http://127.0.0.1:3000/convert-ebook)                       | document | Change an unprotected ebook’s format for another reader.                            |
| [Convert Markdown, HTML and Office text](http://127.0.0.1:3000/semantic-document)        | document | Move a document’s headings, paragraphs and tables between formats.                  |
| [Convert TTF, OTF, WOFF and WOFF2](http://127.0.0.1:3000/convert-font)                   | design   | Package a font for the web or restore its original TTF/OTF container.               |
| [Image ↔ Base64](http://127.0.0.1:3000/image-base64)                                     | image    | Move between an image and its Base64 or data URI representation.                    |
| [SVG ↔ SVGZ](http://127.0.0.1:3000/svg-gzip)                                             | vector   | Compress a self-contained SVG or restore a compressed SVGZ.                         |
| [Inspect & unpack archive](http://127.0.0.1:3000/archive-browser)                        | archive  | See the contents of an archive or save selected files together in a ZIP.            |
| [Create an archive](http://127.0.0.1:3000/create-archive)                                | archive  | Pack a selection of files into ZIP, 7Z or a compressed TAR.                         |
| [Repack compressed TAR](http://127.0.0.1:3000/repack-tar)                                | archive  | Move between TAR, TAR.GZ, TAR.BZ2 and TAR.XZ without changing file contents.        |
| [Clean CSV & delimiters](http://127.0.0.1:3000/clean-csv)                                | data     | Remove duplicate rows, trim cells and export a table with your preferred delimiter. |
| [JSON · XML · TOML · YAML](http://127.0.0.1:3000/structured-data)                        | data     | Convert structured data while preserving nested objects and arrays.                 |
| [Format & validate data](http://127.0.0.1:3000/format-data)                              | data     | Check syntax and create a readable or compact copy of JSON, XML or YAML.            |
| [File checksum](http://127.0.0.1:3000/file-checksum)                                     | data     | Calculate SHA-256 or SHA-512 and compare a file against an expected checksum.       |
| [QR & barcode maker](http://127.0.0.1:3000/create-code)                                  | data     | Create a QR code, Code 128 or EAN-13 barcode as PNG or SVG.                         |
| [Read QR & barcode](http://127.0.0.1:3000/read-code)                                     | data     | Read a QR code or common barcode from an image and download its text.               |
| [Colour converter & palette](http://127.0.0.1:3000/color-palette)                        | design   | Get HEX, RGB and HSL values with a matching light-to-dark palette.                  |
| [Text encoding & escapes](http://127.0.0.1:3000/text-encoding)                           | data     | Convert character encodings, Base64, URL encoding or HTML entities.                 |
