# Media engine implementation

23 definitions in `shared/media-tools.js`; conversion entry point `convertMediaTool` in `server/conversion/media-toolbox.js`; Pillow/Whisper worker in `server/toolbox/media_worker.py`.

| Families | Tool IDs and behavior                                                                                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16       | `gif-maker`: ordered images, fitted transparent canvas, configurable delay/loops, GIF/WebP/APNG output.                                                                    |
| 17       | `animation-to-video`: animated GIF/WebP/APNG to H.264 MP4/MOV/MKV or VP9 WebM; configurable transparency background.                                                       |
| 18–19    | `animation-convert`: GIF/WebP/APNG frame/timing/loop preservation through Pillow; source loop retained by default.                                                         |
| 20       | `video-to-animation`: bounded video frames to GIF/WebP/APNG.                                                                                                               |
| 21       | `extract-frames`: bounded PNG/JPG sequence ZIP.                                                                                                                            |
| 22       | `compress-gif`: six attempts varying palette and dimensions; smallest valid result includes `targetMet` and actual bytes.                                                  |
| 23       | `edit-animation`: crop, trim, playback speed, reverse, loops.                                                                                                              |
| 29–30    | `compress-audio`, `compress-video`: same-format compression/trimming and alternate output. MP3/WAV/FLAC/OGG/M4A/AIFF and MP4/WebM/MOV/MKV outputs.                         |
| 31       | `transform-video`: crop/rotate/speed/reverse, matching audio tempo/reversal. Trimming occurs before buffered reverse filters.                                              |
| 32       | `join-audio`, `join-video`: ordered joins, normalized streams, stereo 48 kHz audio; silent video clips receive silence. Video clips are fitted to a 16:9 canvas at 25 fps. |
| 33       | `mute-video`, `replace-video-audio`: explicit stream selection; replacement audio padded to the selected video duration.                                                   |
| 34       | `audio-waveform`, `video-thumbnail`: real decoded PNG images.                                                                                                              |
| 40       | `lottie-render`: bundled lottie-web in headless local Chromium, frame screenshots, GIF/WebP/APNG export. TGS uses bounded gzip decompression.                              |
| 56       | `convert-native-video`: forced AVI/FLV/ASF/MPEG/MPEG-TS demuxers and ordinary video inputs to MP4/WebM/MOV/MKV.                                                            |
| 57       | `convert-native-audio`: AAC/Opus/WMA/AMR/APE and ordinary audio inputs. Actual installed FFmpeg decoder availability determines successful decoding.                       |
| 58       | `convert-subtitles`: ASS/SSA/SRT/VTT parsing, timestamp shifting/clamping, default ASS/SSA styles, plain SRT/VTT cues.                                                     |
| 59       | `burn-subtitles`: local libass subtitle filter; video first, subtitle second.                                                                                              |
| 60       | `normalize-audio`: EBU R128 loudnorm target and fades applied after trimming.                                                                                              |
| 61       | `transcribe-media`: local faster-whisper CPU int8 model, extracted mono 16 kHz audio, TXT/SRT/VTT. No fabricated transcript fallback.                                      |

## Dependencies

- Existing FFmpeg/FFprobe and their installed codecs/filters; confirmed libass `subtitles`, `loudnorm`, AMR-NB/WB and APE decoders.
- Existing sharp, fflate and Playwright Chromium. Bundled lottie-web was centrally installed by controller.
- Controller's `.tools/python/Scripts/python.exe` with Pillow and faster-whisper/ctranslate2/ONNX dependencies.
- Controller downloaded `Systran/faster-whisper-tiny` assets into `.tools/models/media/whisper-tiny`. Worker uses `local_files_only=True` and never downloads during a job.
- Environment override `LOCAL_CONVERTER_PYTHON` supports an alternate packaged interpreter.

## Bounds and validation

100 MB aggregate uploaded input, at most 20 files; 200 MB output; forced non-playlist demuxers, file/pipe protocols only and no-shell child processes. Maximum general input duration two hours; jobs select at most 120 seconds. Frame size at most 8.3 million pixels in FFmpeg tools. Animations have at most 240 frames, 30 seconds and 64 million decoded pixels; Pillow also rejects individual frames above 16 million pixels. Reverse video is limited to 15 seconds and 64 million estimated decoded pixels. Join output is capped at 120 seconds. Lottie disallows expressions, external image/font paths, network requests and excessive JSON structure; it is capped at 240 rendered frames and 64 million pixels. TGS decompression is capped at 5 MB.

Outputs are nonempty and size checked. Media outputs are probed and sample decoded; PNG outputs are decoded with sharp; animation outputs are reopened and every frame decoded with Pillow. Tests unzip/decode frame exports. Cancellation propagates to native workers and is checked for each Lottie frame. Missing runtime/model dependencies produce actionable failures.

## Validation

`node --test tests/media-toolbox.test.js`: 12 tests passed, zero skipped, approximately 25 seconds. Fixtures cover all 23 tools, GIF/WebP/APNG animation frame/loop/timing roundtrips, GIF editing/target compression, GIF-to-video, video-to-APNG, PNG frame ZIP decoding, audio/video trim/compression, loudness/fades, waveforms/thumbnails, crop/rotate/speed/reverse, both joins, mute/replacement, ASS/SSA/SRT/VTT shifts and subtitle burn, Lottie/TGS rendering, AVI/FLV/WMV/MPEG/TS and AAC/Opus/WMA conversions, and invalid-input/budget rejection. Whisper recognized a real Windows System.Speech synthesized sentence locally in TXT/SRT/VTT; tests assert recognized speech words and timestamp structures. This speech fixture test skips on non-Windows machines or without the local model.

## Remaining limitations

- AMR and APE inputs use confirmed installed decoders but were not tested with representative AMR/APE fixture files. Decoder support alone cannot guarantee every damaged or unusual file.
- GIF has binary transparency and palette limitations. Lossless exact visual preservation across animation formats is not promised. Identical consecutive frames may be coalesced by the encoder while preserving display duration.
- GIF target compression returns the smallest result even if the requested size cannot be met, explicitly marked `targetMet:false`.
- Lottie ZIP `.lottie` bundles, expressions, remote images/fonts and arbitrary third-party assets are rejected. Unsupported lottie-web features can differ visually; rendering does not claim pixel identity with every authoring tool.
- ASS/SSA conversion supports standard event field order and deliberately drops styling when exporting SRT/VTT. Subtitle burn uses installed fonts; it does not upload custom fonts.
- Loudness uses FFmpeg's bounded single-pass dynamic loudnorm; it is not a two-pass measured mastering workflow. Tiny Whisper accuracy varies and transcripts need review.
- Engine APIs and metadata are ready; shared integration/UI/package manifest edits belong to controller and were not edited here.
