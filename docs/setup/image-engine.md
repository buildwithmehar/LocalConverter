# Image toolbox implementation report

Implemented in `shared/image-tools.js`, `server/conversion/image-toolbox.js`, `server/toolbox/image_worker.py` and `tests/image-toolbox.test.js`. The original six everyday tools and all production server/UI files were left untouched. Controller owns registry/UI/server integration.

## Coverage

| Family | Tool ID            | Actual local output                                                                           |
| ------ | ------------------ | --------------------------------------------------------------------------------------------- |
| 1      | heic-converter     | Verified HEIC/HEIF decoding through pillow-heif; JPG/PNG/WebP                                 |
| 2      | bmp-converter      | Real BMP input/output plus JPG/PNG/WebP                                                       |
| 3      | icon-favicon       | Multi-size ICO; ICO-to-PNG; favicon ZIP with PNGs and webmanifest                             |
| 4      | jfif-converter     | JPEG-content validation and JPG/PNG export                                                    |
| 5      | jxl-converter      | Actual JPEG XL decoding through pillow-jxl-plugin                                             |
| 6      | raw-converter      | LibRaw camera RAW development via rawpy; camera white balance, sRGB                           |
| 7      | image-vectorize    | vtracer colour/monochrome SVG path tracing; detail/speckle settings                           |
| 9      | resize-print-image | mm/cm/in dimensions, decimal values, DPI, crop/pad/stretch, PNG/JPG                           |
| 11     | passport-signature | Editable exact dimensions, DPI, crop/pad, optional bounded JPG KB search                      |
| 12     | image-watermark    | Text or ordered uploaded logo, position, opacity, size/colour                                 |
| 13     | image-collage      | Ordered bounded grid/single-row composition, spacing/background                               |
| 14     | image-dpi          | DPI inspection JSON; metadata-only DPI writing or pixel resampling                            |
| 15     | image-metadata     | Metadata/EXIF/GPS JSON and dedicated metadata stripping                                       |
| 37     | remove-background  | Real local U²-Net small ONNX segmentation, alpha PNG, soft/cutoff mask                        |
| 38     | photo-background   | Real segmentation followed by blur, solid colour or uploaded replacement                      |
| 39     | ai-upscale         | Actual FSRCNN 2×/4× neural inference; optional non-local-means denoise and CLAHE              |
| 48     | scan-cleanup       | Contour-based perspective detection, Hough deskew, lighting cleanup, binary/gray/colour modes |
| 53     | psd-export         | PSD/PSB cached composite PNG/JPG or raster-layer ZIP and layer-position manifest              |
| 54     | svg-optimize       | SVGO with precision/formatting controls, preserved IDs, viewBox and accessibility             |
| 55     | svg-sprite         | Namespaced symbols and rewritten internal IDs/URL references                                  |

20 definitions with complete defaults/fields, explicit multiple-file roles and applicable limitations. No successful placeholders, embedded-bitmap SVG tracing or renamed source bytes.

## Dependencies and assets

Controller installed npm `svgo` and Python Pillow, pillow-heif, pillow-jxl-plugin, rawpy, psd-tools, opencv-contrib-python-headless, onnxruntime and vtracer. Test fixture generation also uses installed tifffile/numpy. Windows Arial is used for text watermarks when installed, with Pillow font fallback. No user API keys or remote service calls during conversion.

Downloaded model assets directly from upstream into `.tools/models/image`. Each model's SHA-256 is pinned in the Python worker and checked before inference; missing or modified assets fail explicitly.

| Model        | Upstream URL                                                                          | SHA-256                                                          |
| ------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| u2netp.onnx  | https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx             | 309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8 |
| FSRCNN_x2.pb | https://raw.githubusercontent.com/Saafke/FSRCNN_Tensorflow/master/models/FSRCNN_x2.pb | 366b33f0084c7b3f2bf6724f0a2c77bca94fcec9d7b6d72389d330073b380d5c |
| FSRCNN_x4.pb | https://raw.githubusercontent.com/Saafke/FSRCNN_Tensorflow/master/models/FSRCNN_x4.pb | 5c68d18db561aed8ead4ffedf1b897ea615baaf60ebf6c35f8e641f8fa4a21bf |

Segmentation uses ONNX Runtime's CPU provider directly; super-resolution uses OpenCV DNN SuperRes. Neither worker auto-downloads models or code. U²-Net and the FSRCNN upstream repositories identify Apache-2.0. The JPEG XL plugin repository identifies GPL-3.0; review third-party licences before distributing the packaged application. Upstream references: https://github.com/Isotr0py/pillow-jpegxl-plugin, https://github.com/xuebinqin/U-2-Net, https://github.com/Saafke/FSRCNN_Tensorflow.

## Verification

Fresh command: `node --test tests/image-toolbox.test.js`.

Result: **20 passed, 0 failed, 0 skipped**, approximately 18.0 seconds on this Windows host. Fixtures exercise actual decoding/inference rather than mocks:

- Exact passport pixels and DPI; literal 25.4 mm at 100 DPI produces 100×100 pixels and 100 DPI.
- BMP round trip; HEIC and JPEG XL real encoders followed by decoder output checks; JFIF JPEG content; multi-resolution ICO and decodable favicon ZIP assets.
- Real 128×128 CFA DNG with DNG TIFF tags decoded via LibRaw; a PNG disguised as DNG is rejected.
- SVG contains vector paths and rasterizes; sprite IDs are distinct; optimization retains title/ARIA/viewBox/IDs and rejects external resources.
- Text watermark changes pixels; invalid file-role combinations fail; collage dimensions/order spacing are checked.
- Metadata JSON contains real EXIF; stripped image has no EXIF; DPI resampling changes pixel dimensions.
- FSRCNN x2 and x4 both run and produce expected dimensions and alpha; U²-Net produces variable foreground/background alpha and a blue replacement background.
- Scan cleanup yields binary pixels with bounded perspective output; PSD cached composite and layer ZIP both decode.
- Animated input to still-image tools and input paths outside the job directory are rejected.

Controller owns project-wide test/build and browser integration. No Playwright runs or production server changes were made by this domain worker.

## Bounds and remaining limitations

- Combined inputs <=100 MB/20 files; resolved input paths must stay inside the parent of outputDir (the job directory). Python receives a private JSON manifest, not user-supplied shell arguments; runtime is bounded to 170 seconds and honors cancellation.
- Still images only. Maximum 40 million pixels per image/output and 100 million aggregate decoded pixels. Tracing <=4 million; segmentation/scan <=16 million; AI input <=1 million (up to16 million output); SVG inputs <=5 MB combined. PSD layer export <=100 layers/100 million total layer pixels; allocation budget and header limits guard PSD decoding. Outputs <=200 MB and raster/ZIP/JSON outputs are decoded/checked before returning.
- Camera-format availability depends on LibRaw and camera variants; the integration fixture proves DNG, not every listed manufacturer's body or RAW compression variant.
- AI cutout quality varies, especially hair and low-contrast edges. Threshold refinement is available; there is no brush-based mask editor. FSRCNN is a small CPU super-resolution model; denoising is explicitly classical non-local-means, and enhancement is CLAHE, without claiming generative detail recovery.
- Scan corners are detected automatically; there is no manual four-corner editor. Detection may fail to identify the page; cleanup then processes the full image.
- PSD preview requires cached merged data. Layers are raster pixels and retain placement metadata, but Photoshop text/adjustments/effects are not recreated or guaranteed to match. PSB uses the same reader; the automated fixture covers PSD.
- Watermark photo/logo and replacement subject/background ordering are strict. There is no multi-photo batch watermark mode in this engine.
- Passport/signature dimensions are editable; official acceptance is not promised. PNG KB targets are reported honestly without claiming a lossless target can always be met. DPI writing offers PNG/JPG because WebP does not provide matching print-DPI metadata support.
- Physical dimension fields use `step:0.1`; the controller UI must preserve decimal values when parsing them.
