import { roadmapGuides } from './roadmap-guides.js';
// Tool-specific editorial guides. Settings and processing limits live in the tool definitions.
const guide = (lead, useCases, steps, example, faqs) => ({
  lead,
  useCases,
  steps: steps.map(([title, text]) => ({ title, text })),
  example: { title: example[0], text: example[1] },
  faqs,
});

export const toolGuides = {
  ...roadmapGuides,
  'structured-data': guide(
    'Translate nested data between JSON, XML, TOML and YAML for a configuration or integration workflow. Choose both input and output syntax explicitly, then inspect the resulting structure before using it. Each format has different type and naming rules, so this is a data representation conversion rather than a promise of identical source formatting.',
    [
      'Convert a JSON configuration to YAML',
      'Create JSON from supported XML data',
      'Export a root-object configuration as TOML',
    ],
    [
      [
        'Provide the structured source',
        'Upload a supported text file or paste its contents, keeping the source within eight megabytes. Select the actual input syntax rather than relying only on its filename extension.',
      ],
      [
        'Choose the destination syntax',
        'Select JSON, XML, TOML or YAML as output. Ensure the data can be represented there, including a root object for TOML and suitable element names for XML.',
      ],
      [
        'Parse and create the result',
        'Run Create result to parse the source and serialize the data in the selected syntax. Invalid input or unsupported structures are reported rather than silently repaired.',
      ],
      [
        'Compare the nested structure',
        'Download the output and check objects, arrays, text values and XML attributes. Validate it with the destination application’s schema or expectations before replacing a configuration file.',
      ],
    ],
    [
      'A configuration from JSON to YAML',
      'A JSON configuration contains nested service settings and an array of hostnames. Choose JSON input and YAML output, then convert. Check nesting, quoted strings and array values in the YAML before using it in the application that consumes the configuration.',
    ],
    [
      [
        'How are XML attributes represented?',
        'XML conversion uses explicit attribute keys prefixed with @_ and text keys such as #text where needed. Inspect these mappings in JSON or YAML output, since they represent XML structure rather than ordinary field names chosen by your application.',
      ],
      [
        'Can TOML represent a root array?',
        'This tool requires an object at the root when producing TOML. A source whose top level is an array or scalar must be intentionally restructured before conversion rather than expecting the serializer to invent an appropriate object wrapper.',
      ],
      [
        'Are comments and source formatting preserved?',
        'The workflow parses data and writes a new representation, so comments and original formatting are not the primary output. Review semantic values and destination conventions rather than expecting source indentation, quoting style or comments to survive unchanged.',
      ],
      [
        'What happens to date values?',
        'Parsed date values are exported as ISO strings. Check the destination application’s expected date handling, because a textual ISO representation and a format-specific date type may behave differently when a configuration or integration loads the output.',
      ],
    ],
  ),
  'format-data': guide(
    'Check JSON, XML or YAML syntax and create readable formatting, a compact representation or a validation report. Use it to inspect a small configuration file or prepare cleaner text for review. Syntax validation does not establish that values match an application’s schema, so review the actual data requirements separately.',
    [
      'Pretty-print a compact JSON response',
      'Check YAML syntax before editing',
      'Create a compact XML copy for an integration',
    ],
    [
      [
        'Provide the data text',
        'Upload JSON, XML, YAML or text, or paste the content into the page. Keep the source within eight megabytes and choose its actual syntax.',
      ],
      [
        'Choose the result mode',
        'Select readable formatting, compact formatting or a validation report. Choose the mode according to whether you need revised text or a syntax-check result.',
      ],
      [
        'Parse and generate output',
        'Run Create result so the parser checks the selected syntax. Malformed source is rejected; successful validation creates a JSON report with the syntax and parsed root type.',
      ],
      [
        'Check meaning before reuse',
        'Download and inspect the result in a text editor or destination application. Confirm values and structural expectations, since a valid parse does not establish application-level correctness.',
      ],
    ],
    [
      'Readable JSON for debugging',
      'A compact JSON response is difficult to inspect during debugging. Select JSON and readable formatting, then create the output. Open the formatted copy to follow nested fields and arrays, while separately checking whether those fields match the application’s expected response contract.',
    ],
    [
      [
        'Does validation check a JSON Schema?',
        'No. The report indicates that the selected syntax parsed successfully and identifies the root type. It does not check a JSON Schema, business rule or application-specific configuration contract, which needs a separate suitable validation step.',
      ],
      [
        'Does compact formatting change data values?',
        'The tool parses and serializes the data in a compact representation. Values should be reviewed, especially when format-specific parsing rules affect types, and original comments or cosmetic source formatting should not be expected to remain unchanged.',
      ],
      [
        'How is mixed-content XML handled?',
        'For XML containing interleaved text and elements, the formatter avoids adding indentation that would change meaningful text spacing. The result can therefore remain less visibly indented than a simple element-only XML document in readable mode.',
      ],
      [
        'Can it automatically repair malformed files?',
        'No. Invalid JSON, XML or YAML produces a parse error rather than a guessed repair. Correct the source intentionally, including quotation marks, delimiters or indentation as appropriate, then rerun the syntax check or formatting operation.',
      ],
    ],
  ),
  'file-checksum': guide(
    'Calculate a SHA-256 or SHA-512 checksum for a file and optionally compare it with an expected hexadecimal value. Download a JSON report containing the algorithm, byte count, checksum and match status when supplied. Use it to compare file bytes across a handoff, while obtaining expected checksums from a source you trust.',
    [
      'Compare a download with a published checksum',
      'Check whether two copies contain identical bytes',
      'Record a file checksum for a handoff',
    ],
    [
      [
        'Choose the file to hash',
        'Upload the exact file whose bytes you want to check. A checksum covers the full file representation, so use the final copy rather than an earlier draft.',
      ],
      [
        'Select the hashing algorithm',
        'Choose SHA-256 or SHA-512 to match the expected checksum’s algorithm. Different algorithms produce different digest lengths and cannot be compared directly with one another.',
      ],
      [
        'Add an expected value if available',
        'Paste only the expected hexadecimal checksum, or leave it blank to calculate one. Run Create result to hash the file and perform the optional comparison.',
      ],
      [
        'Read the verification report',
        'Download the JSON and review the checksum, byte count and matches field when present. Investigate mismatches before assuming the selected file is the expected version.',
      ],
    ],
    [
      'Checking a supplied package',
      'A package arrives with a separately published SHA-256 value. Upload the package, choose SHA-256 and paste the expected hexadecimal digest. Review the report’s match status and file byte count before treating the package as the same bytes described by that expected value.',
    ],
    [
      [
        'What does a matching checksum establish?',
        'A match indicates that the calculated digest equals the supplied expected value for the chosen algorithm. Its usefulness depends on trusting that expected value; the calculation alone does not identify who created the file or whether its contents are appropriate.',
      ],
      [
        'Why do visually identical PDFs have different checksums?',
        'Checksums cover every file byte, including metadata, internal ordering and encoding details. Two documents can render similarly yet have different bytes, so a mismatch does not by itself identify which visible content changed between them.',
      ],
      [
        'What expected-checksum format is accepted?',
        'Use a hexadecimal digest of the correct length for SHA-256 or SHA-512. The comparison ignores letter case and surrounding whitespace, but filenames, algorithm labels or other text from a checksum listing should not be included.',
      ],
      [
        'Can a checksum find a corrupted location?',
        'No. The result tells you whether the complete digest matches an expected value; it does not locate the changed byte or repair a file. Obtain another trusted copy or use an appropriate comparison workflow to investigate a mismatch.',
      ],
    ],
  ),
  'create-code': guide(
    'Generate a QR code, Code 128 or EAN-13 barcode as PNG or SVG from entered text or digits. Choose the format for screen use or placement in a design, then test the generated code with the intended reader. Code type determines the accepted content, so not every text value suits every barcode option.',
    [
      'Create a QR code for a URL',
      'Generate a Code 128 identifier label',
      'Calculate an EAN-13 check digit from twelve digits',
    ],
    [
      [
        'Enter the code content',
        'Paste a URL, text or barcode digits, or upload a text file. Check the exact content because the generated symbol represents it rather than validating the linked destination.',
      ],
      [
        'Choose the code type',
        'Select QR, Code 128 or EAN-13. For EAN-13, supply twelve digits to calculate a check digit or thirteen digits with a valid existing check digit.',
      ],
      [
        'Choose output and create',
        'Select PNG or SVG and set the QR size when creating a QR code. Run Create result to generate the symbol with its required surrounding space.',
      ],
      [
        'Test in its intended form',
        'Download and scan the result using the intended reader. Test again at the printed or displayed size, preserving a clear border and enough contrast around the symbol.',
      ],
    ],
    [
      'A QR code for an event page',
      'An event poster needs a QR link to its registration page. Enter the complete URL, select QR and SVG, then generate it. Place the symbol in the poster without trimming its border and test a printed sample before producing the final copies.',
    ],
    [
      [
        'Does QR size also control barcode width?',
        'The size field applies to QR output. Code 128 and EAN-13 use their own generated barcode geometry, so inspect the downloaded PNG or SVG and scale it appropriately without distorting bar proportions or removing surrounding space.',
      ],
      [
        'What happens with twelve EAN digits?',
        'EAN-13 accepts twelve digits and calculates the required check digit, or thirteen digits whose check digit is already valid. Supply the intended numeric identifier and verify the resulting full code with your normal product or inventory workflow.',
      ],
      [
        'Does a QR code verify a URL is safe?',
        'No. The generated code represents the text you provide. Check the actual destination and spelling before creating the symbol, and scan the result yourself to verify that the reader opens the intended URL rather than a mistyped one.',
      ],
      [
        'Should I choose PNG or SVG?',
        'PNG is convenient for direct image use, while SVG can scale cleanly in compatible design workflows. In either case, preserve contrast and the clear border, and test the code at the final displayed or printed size.',
      ],
    ],
  ),
  'read-code': guide(
    'Read the text from one clearly visible QR code or common barcode in an image and save the decoded value. Use it to inspect a supplied label or recover a URL without manually typing the symbol’s contents. A clear, large, flat code gives the reader a better chance than a blurry or crowded photograph.',
    [
      'Read a QR URL from a screenshot',
      'Recover text from a clear barcode image',
      'Inspect the content of a supplied label',
    ],
    [
      [
        'Choose the code image',
        'Upload a supported PNG, JPG, WebP or TIFF image containing one clear code. Avoid very small symbols, strong blur or curved surfaces when preparing the source.',
      ],
      [
        'Focus on one readable symbol',
        'No code-format setting is required. If the photo contains several codes or distracting background, prepare a crop around the intended symbol while keeping its clear border.',
      ],
      [
        'Decode the image',
        'Run Create result so the reader searches the image for a supported code. If no readable symbol is found, try a clearer or closer source image.',
      ],
      [
        'Inspect the decoded text',
        'Download and read the text before using it. For URLs or commands, review the actual value intentionally rather than assuming that successful decoding establishes a trustworthy destination.',
      ],
    ],
    [
      'A QR value from a screenshot',
      'A colleague supplies a screenshot containing a large QR code. Upload the image and run the reader, then inspect the decoded URL in the text output. Check its spelling and destination before copying it into a browser or another document.',
    ],
    [
      [
        'Can I decode several codes at once?',
        'This workflow is intended to read one clearly visible symbol and returns a single decoded text result. Crop or prepare separate images when a source contains multiple codes and you need to inspect each value independently.',
      ],
      [
        'Why can a visible code fail to read?',
        'A symbol can be too small, blurred, curved, damaged or missing its clear surrounding border. Try a sharper image with one large, flat code, or crop distractions without cutting off the border needed for detection.',
      ],
      [
        'Does decoding open the URL automatically?',
        'The result is decoded text for you to inspect and download. Read it before deciding how to use it, since a successfully decoded URL can still point somewhere different from what the surrounding label suggests.',
      ],
      [
        'Can I read a code from a PDF directly?',
        'This tool accepts supported image formats rather than PDF pages. Render or export the relevant PDF page to a clear still image first, then crop around the intended code while preserving its surrounding clear area.',
      ],
    ],
  ),
  'color-palette': guide(
    'Convert one entered colour into HEX, RGB and HSL values and generate a light-to-dark palette based on that colour. Choose three to twelve steps and download a ZIP containing JSON values and an SVG colour sheet. Use it for early visual exploration, then evaluate the chosen colours in their actual design context.',
    [
      'Create lighter and darker variants of a brand colour',
      'Convert a HEX colour into RGB and HSL',
      'Export a small palette sheet for design review',
    ],
    [
      [
        'Enter a supported colour value',
        'Provide a colour as HEX, RGB or HSL, such as #336699. Use the supported numeric syntax rather than a named colour or an unrelated stylesheet fragment.',
      ],
      [
        'Choose the palette length',
        'Set the number of palette steps between three and twelve. Consider how many distinct shades you actually need for the design rather than generating unnecessary near-duplicates.',
      ],
      [
        'Create the palette package',
        'Run Create result to calculate the base colour values and lighter-to-darker variants. The output ZIP contains palette.json and a self-contained palette.svg colour sheet.',
      ],
      [
        'Evaluate colours in context',
        'Download and inspect the sheet and JSON values. Test selected shades in the actual interface or artwork, including text contrast, before adopting them as a final design palette.',
      ],
    ],
    [
      'Shades for an early interface sketch',
      'An interface sketch starts with #336699 and needs a small tonal range. Enter that colour, choose seven steps and create the palette. Review the SVG sheet, then test candidate shades behind real text and controls before copying values into the project.',
    ],
    [
      [
        'Which colour input forms are supported?',
        'Use HEX such as #336699 or #369, integer RGB such as rgb(51, 102, 153), or numeric HSL such as hsl(210, 50%, 40%). The parser does not accept every possible CSS colour notation or named colour.',
      ],
      [
        'Is this a complementary colour generator?',
        'The generated colours are lighter and darker variants derived from the entered base, rather than a selected complementary or analogous harmony system. Use the output for tonal exploration and make broader palette choices according to your design needs.',
      ],
      [
        'Are the palette steps guaranteed accessible?',
        'No. A light-to-dark palette alone does not establish text or interface contrast. Evaluate the specific foreground and background pairs at the sizes and contexts where they will be used before adopting them in a finished design.',
      ],
      [
        'What files are included in the result?',
        'The ZIP includes palette.json with the base and generated colour values and palette.svg with a self-contained visual colour sheet. The JSON is useful for copying values, while the SVG makes the range easier to review visually.',
      ],
    ],
  ),
  'text-encoding': guide(
    'Change a text file’s character encoding or convert text with Base64, URL encoding and HTML entities. Choose the exact operation and, for character-set conversion, the original and destination encodings. Use it for interoperability or inspecting escaped values, while checking that text content and meaningful characters survive the conversion as intended.',
    [
      'Convert a Windows-1252 text file to UTF-8',
      'Decode a URL-encoded value',
      'Convert HTML entities back into readable text',
    ],
    [
      [
        'Provide the original text',
        'Upload a supported text-like file or enter text in the page. Use the original bytes when correcting a file encoding rather than an already mis-decoded copied version.',
      ],
      [
        'Choose the operation',
        'Select character encoding, Base64 encode/decode, URL encode/decode or HTML entity encode/decode. These operations solve different representation problems, so choose the one that matches the source.',
      ],
      [
        'Set relevant encodings and run',
        'For character encoding, select the actual input and desired output character sets. Run Create result; unrepresentable characters in a character-set conversion cause an error instead of silent substitution.',
      ],
      [
        'Verify the text in context',
        'Download the output and inspect accented letters, non-Latin characters and punctuation in an editor using the intended encoding. Test escaped values in their expected context before reuse.',
      ],
    ],
    [
      'A legacy CSV as UTF-8 text',
      'A CSV export is known to use Windows-1252 and contains accented names. Choose character encoding, Windows-1252 input and UTF-8 output. Inspect the downloaded text for correct names and punctuation, then import it with explicit UTF-8 settings in the destination application.',
    ],
    [
      [
        'Can the tool automatically identify the source encoding?',
        'The character-conversion workflow asks you to choose the input encoding. Selecting the wrong one can produce incorrect characters even when conversion completes, so use source documentation or a known-good original to determine the actual character set.',
      ],
      [
        'What happens if the output character set lacks a character?',
        'The tool checks whether the selected destination encoding can represent the decoded text and rejects conversions that lose characters. Choose a suitable encoding such as UTF-8 when the intended text cannot fit within a more limited character set.',
      ],
      [
        'Is Base64 an encryption method?',
        'No. Base64 changes a byte representation into ordinary encoded text and is reversible without a secret key. Use it for a destination that expects that syntax, rather than treating the output as protected or confidential content.',
      ],
      [
        'Are URL encoding and HTML entities interchangeable?',
        'No. URL encoding escapes text for a URL-component representation, while HTML entities represent characters in HTML text. Choose the operation expected by the receiving context and avoid repeatedly encoding an already escaped value unless that is intentional.',
      ],
    ],
  ),
  'image-base64': guide(
    'Encode an image as Base64 text or a data URI, or restore a supported image from a Base64 representation. Use it when moving small image assets through text-based configuration or inspecting an embedded image value. The operation changes representation rather than compressing the picture, so text output can be larger than the file.',
    [
      'Create a data URI for a small icon',
      'Restore a supplied Base64 image',
      'Produce bare Base64 for a text-based integration',
    ],
    [
      [
        'Choose the representation direction',
        'Select Image to Base64 for an image file, or Base64 to image for entered text or a text file. Use a supported image format for the chosen direction.',
      ],
      [
        'Add the source content',
        'Upload the image or provide its Base64 text. A data URI can include the media-type prefix; bare Base64 is also accepted when restoring supported image content.',
      ],
      [
        'Set prefix and create result',
        'For encoding, decide whether to include the data URI prefix, then run Create result. Decoding validates the Base64 and checks that the restored bytes form a supported image.',
      ],
      [
        'Inspect the restored or encoded copy',
        'Download the text or image and test it in the destination. Check the media-type prefix when embedding text and inspect restored dimensions and appearance after decoding.',
      ],
    ],
    [
      'A small icon as a data URI',
      'A self-contained SVG icon needs to be embedded in a text-based configuration. Choose encoding with the data URI prefix enabled and create the result. Copy the downloaded value into the intended field and test the icon’s appearance in that application.',
    ],
    [
      [
        'Does Base64 reduce image size?',
        'No. Base64 is a text representation of binary bytes and typically needs more characters than the original byte count. Use image compression or resizing first when storage or transfer size is the main concern for the asset.',
      ],
      [
        'What does the data URI prefix add?',
        'It adds a media type and a base64 marker before the encoded image data, such as data:image/png;base64,. Some destination fields expect that full value while others want only the Base64 payload, so follow the integration’s expected syntax.',
      ],
      [
        'Does decoding accept any binary file?',
        'No. Decoded bytes must form a supported image, and SVG content is checked for supported self-contained content. A Base64 value for an unrelated archive or document is not treated as an image simply because its syntax is valid.',
      ],
      [
        'Can I paste text instead of uploading it?',
        'Yes. The page supports text input for Base64 values as well as file input. Use a complete value with valid padding and content, and avoid unrelated quotation marks or escaped wrappers from a surrounding configuration file.',
      ],
    ],
  ),
  'svg-gzip': guide(
    'Compress a self-contained SVG into SVGZ or restore an SVGZ into ordinary SVG markup. Direction follows the input format, so no separate mode selection is needed. Use it when a workflow explicitly expects gzip-compressed SVG, while checking destination support and keeping expanded content within the bounded decompression limit.',
    [
      'Create an SVGZ from self-contained artwork',
      'Restore compressed SVG markup for editing',
      'Prepare an SVG file from an SVGZ asset',
    ],
    [
      [
        'Choose SVG or SVGZ',
        'Upload one self-contained SVG to compress or one SVGZ to expand. The filename format determines the operation, and the actual SVG content is checked.',
      ],
      [
        'Check resource dependencies',
        'Make sure the drawing does not depend on unsupported external or active resources. This workflow changes gzip packaging rather than resolving linked fonts, images or scripts.',
      ],
      [
        'Create the compressed or expanded file',
        'Run Create result to gzip the SVG or safely decompress the SVGZ. Expansion is bounded to one hundred megabytes and invalid compressed data is rejected.',
      ],
      [
        'Test the destination support',
        'Download the resulting SVGZ or SVG and open it in the intended workflow. Keep a plain SVG copy when the receiving application cannot interpret gzip-compressed SVG assets.',
      ],
    ],
    [
      'An SVGZ supplied for editing',
      'A design asset arrives as SVGZ while an editor expects plain SVG. Add the SVGZ and create the result. Open the expanded SVG in the editor and inspect its geometry and definitions before making edits or choosing a different output packaging.',
    ],
    [
      [
        'How is the conversion direction chosen?',
        'An SVG input is gzip-compressed into SVGZ, while an SVGZ input is decompressed and checked as SVG. There is no separate format menu because the supported counterpart is determined directly from the uploaded input type.',
      ],
      [
        'Does SVGZ optimization change the drawing paths?',
        'This tool changes gzip packaging rather than intentionally simplifying SVG geometry or precision. Use SVG optimizer if you want markup optimization, and compare the drawing visually after any separate operation that modifies its source structure.',
      ],
      [
        'Can I expand an arbitrarily large SVGZ?',
        'No. Gzip expansion is bounded to one hundred megabytes, and the restored content must pass the supported SVG checks. Highly compressed inputs are not allowed to expand without a limit merely because their uploaded size is small.',
      ],
      [
        'Will every browser or editor open SVGZ?',
        'Support depends on the receiving application and, for web delivery, its handling of compressed content. Test the actual destination and use ordinary SVG when it expects plain markup rather than assuming a new extension is universally interchangeable.',
      ],
    ],
  ),
  'archive-browser': guide(
    'Inspect supported archive contents as a JSON inventory or save matching entries together in a ZIP. Filter paths with an optional contains value to focus on useful files. The tool checks archive paths and expansion limits, rejects encrypted or symbolic-link entries, and supports RAR as an extraction input rather than a creation format.',
    [
      'List the files inside an archive',
      'Extract only paths containing a project name',
      'Unpack supported RAR content into a ZIP',
    ],
    [
      [
        'Choose a supported archive',
        'Upload one ZIP, 7Z, TAR, RAR or supported compressed file. Encrypted archives, symbolic links and unsafe member paths are rejected rather than extracted into the result.',
      ],
      [
        'Choose inventory or extraction',
        'Select File inventory for a JSON list or Files as a safe ZIP for extracted content. Enter optional path text to keep only matching entries.',
      ],
      [
        'Inspect and create the result',
        'Run Create result to read and filter the contents. The archive is limited to one thousand entries and one hundred megabytes of expanded content.',
      ],
      [
        'Review names before reuse',
        'Download the inventory or ZIP and inspect the listed paths and sizes. Extracted files still need to be opened in their appropriate applications for the work you intend.',
      ],
    ],
    [
      'Finding project documents inside a ZIP',
      'A handoff archive includes several project folders and only alpha documents are needed. Enter alpha in the path filter and choose inventory to inspect matches. If they are correct, run extraction to package those matching entries into a new ZIP.',
    ],
    [
      [
        'Is the path filter case-sensitive?',
        'No. The contains filter matches text against paths without regard to letter case. It is a substring match rather than a filename pattern language, so a broad word may match both directory names and file names.',
      ],
      [
        'Can I create a RAR archive?',
        'No. RAR is accepted for inspection and extraction only. Extracted content can be packaged as a safe ZIP here; use Create an archive for the supported creation formats such as ZIP, 7Z and compressed TAR.',
      ],
      [
        'Why are symbolic links rejected?',
        'The extraction workflow supports safe file and directory content and rejects symbolic-link entries and unsafe paths. This avoids treating an archive link as an ordinary file and ensures the output remains within the supported extraction representation.',
      ],
      [
        'What do inventory entries contain?',
        'The JSON inventory lists matching paths, byte sizes and whether an entry represents a directory. It is an overview of extracted archive members rather than a preview of each document’s content or a guarantee that every file is usable.',
      ],
    ],
  ),
  'create-archive': guide(
    'Pack selected files into ZIP, 7Z, TAR or a supported compressed TAR without changing their contents. Use a single archive to organize a short handoff or combine related assets for download. Each source needs a unique basename, and the chosen format should be one that the receiving application can unpack.',
    [
      'Bundle project deliverables in a ZIP',
      'Create a compressed TAR of selected files',
      'Package related images and documents together',
    ],
    [
      [
        'Add the files to package',
        'Select the files that belong in the archive, up to the upload-list limit. Give them unique filenames before uploading, because duplicate basenames cannot coexist in this package.',
      ],
      [
        'Choose the archive format',
        'Select ZIP, 7Z, TAR, TAR.GZ, TAR.BZ2 or TAR.XZ. Prefer a format the recipient already supports rather than choosing an extension solely for potential compression.',
      ],
      [
        'Create the package',
        'Run Create result to write the selected files into the chosen container. The operation packages bytes rather than converting the individual documents or images inside the archive.',
      ],
      [
        'Inspect the finished archive',
        'Download and open the result with a compatible archiver. Check that the expected filenames are present and that their contents open correctly before using the package for a handoff.',
      ],
    ],
    [
      'A compact project handoff',
      'A handoff includes report.pdf, data.csv and preview.png. Give each a unique name, upload them and choose ZIP. Open the downloaded archive to verify all three files are present, then inspect the documents before using the package in the delivery process.',
    ],
    [
      [
        'Can two uploaded files share the same name?',
        'No. Files are packaged using their basenames, and duplicate names are rejected to prevent one input from replacing another. Rename duplicate sources meaningfully before selecting them, particularly when they originated in different folders.',
      ],
      [
        'Does packaging convert the enclosed files?',
        'No. The archive contains the uploaded file bytes. A PDF remains a PDF and a photo remains its original image format, so perform any document conversion or image resizing before adding the prepared outputs to the archive.',
      ],
      [
        'Can this create encrypted archives?',
        'The available controls choose the archive format and do not include password encryption. Use this tool for an ordinary package, and follow a suitable separate workflow if your intended archive requires a password feature.',
      ],
      [
        'Is RAR available as an output?',
        'No. Supported creation outputs are ZIP, 7Z, TAR and the listed compressed TAR variants. The archive browser can inspect and unpack RAR, but that extraction support does not include creating a new RAR file.',
      ],
    ],
  ),
  'repack-tar': guide(
    'Move a TAR archive between uncompressed TAR, TAR.GZ, TAR.BZ2 and TAR.XZ packaging while retaining its extracted file content. Use it when another system expects a particular TAR compression wrapper. Entries are read through the archive safety checks, so this is a content repack rather than a byte-identical metadata-preserving archive rewrite.',
    [
      'Convert TAR.GZ into TAR.XZ',
      'Remove gzip compression from a TAR package',
      'Prepare a supported compressed TAR for another tool',
    ],
    [
      [
        'Choose a TAR-based source',
        'Upload TAR, TAR.GZ, TAR.BZ2 or TAR.XZ. A file with a compressed TAR extension must actually expand to a TAR archive rather than unrelated compressed content.',
      ],
      [
        'Select the destination wrapper',
        'Choose TAR or a supported gzip, bzip2 or xz compressed TAR format. Check that the receiving tool accepts the selected compression type before creating the package.',
      ],
      [
        'Repack the checked entries',
        'Run Create result to read the bounded archive contents and package them again. Unsafe paths, encrypted inputs and symbolic-link entries are outside the supported workflow.',
      ],
      [
        'Verify files in the new archive',
        'Download and inspect the output with a compatible archiver. Compare expected file names and contents with the source, rather than expecting identical archive bytes or preserved original metadata.',
      ],
    ],
    [
      'A different compression wrapper for delivery',
      'A tool accepts TAR.GZ but the supplied package is TAR.XZ. Upload the TAR.XZ, select TAR.GZ and create the result. Inspect the repacked archive’s file list and representative contents before handing it to the receiving tool.',
    ],
    [
      [
        'Are the file contents converted?',
        'No. The supported extracted file contents are packaged into the selected TAR wrapper without document or image conversion. The archive itself is rewritten, so its binary checksum can change even when the enclosed file bytes remain the same.',
      ],
      [
        'Are original TAR metadata fields preserved exactly?',
        'This workflow reads checked entries and creates a new archive, so it does not promise byte-identical TAR headers or preservation of all original ownership, timestamp and permission metadata. Use it when file content and compatible packaging are the goals.',
      ],
      [
        'Can I use a plain .gz file?',
        'This tool is specifically for TAR and the listed compressed TAR variants. Use the archive browser for a standalone gzip-compressed file, since a compressed stream does not necessarily contain a TAR archive or multiple member files.',
      ],
      [
        'What expansion limits apply?',
        'The archive safety workflow bounds expansion to one hundred megabytes and one thousand entries, and rejects unsafe paths or unsupported entry types. A small compressed source can still exceed these limits once its content is expanded.',
      ],
    ],
  ),
  'clean-csv': guide(
    'Clean a delimited text table by trimming cell edges, removing empty rows and eliminating exact duplicate rows. Choose the source delimiter or automatic detection, then export comma, semicolon, tab or pipe-delimited text. Use it to prepare a small import table while preserving the distinction between row cleanup and data-type interpretation.',
    [
      'Remove duplicate rows from a CSV export',
      'Convert semicolon-delimited text to comma CSV',
      'Trim surrounding spaces before a table import',
    ],
    [
      [
        'Provide the table text',
        'Upload CSV, TSV or text, or enter the table content in the text input. Keep text within eight megabytes and the table within one hundred thousand cells.',
      ],
      [
        'Choose input and output delimiters',
        'Use automatic detection or select the actual source delimiter, then choose the delimiter expected by your destination. Quoted cell content must still form valid delimited data.',
      ],
      [
        'Select cleanup operations',
        'Enable trimming, empty-row removal and duplicate-row removal as needed, then run Create result. Deduplication compares complete rows after any selected trimming has been applied.',
      ],
      [
        'Review the exported table',
        'Download and inspect the output in the target importer or text editor. Check column alignment, significant spaces and row counts before replacing the original table export.',
      ],
    ],
    [
      'A cleaner contact-list export',
      'A semicolon-delimited export has surrounding cell spaces and repeated rows. Choose semicolon input, comma output and the desired cleanup options, then create the result. Inspect names and identifier columns as text before importing so leading zeros and meaningful spaces are handled intentionally.',
    ],
    [
      [
        'How are duplicate rows identified?',
        'Duplicate removal compares the complete sequence of cell values in each row, after trimming if that option is enabled. It does not merge records by one key column or decide which of two conflicting records is more authoritative.',
      ],
      [
        'Can trimming change meaningful data?',
        'Yes. Trimming removes surrounding whitespace from every cell, which can be undesirable when spaces are intentional content. Disable it for such tables and inspect representative rows before using the cleaned output in another application.',
      ],
      [
        'Does the tool convert dates and numbers?',
        'The workflow cleans and serializes cell text rather than inferring spreadsheet data types. A spreadsheet application may interpret values when opening the file, so control its import settings when dates, identifiers or leading zeros must remain unchanged.',
      ],
      [
        'Why does the output sometimes use .tsv?',
        'Selecting a tab output delimiter creates a TSV file. Other supported delimiters use the CSV extension, so the importer still needs to know whether the actual separator is comma, semicolon or pipe when opening that result.',
      ],
    ],
  ),
  'stamp-pdf': guide(
    'Add a text stamp, page number, watermark or PDF overlay to selected pages. Use simple Latin-1 text with the bundled Helvetica font, or supply a second PDF for an overlay. The settings make it useful for draft labels and review copies while keeping the original document available for later edits.',
    [
      'Label a PDF as a draft',
      'Add original-position page numbers',
      'Overlay a prepared letterhead PDF',
    ],
    [
      [
        'Choose the destination PDF',
        'Upload the PDF to be stamped first. For overlay mode, upload the overlay PDF second; other stamp modes use the destination document alone.',
      ],
      [
        'Select stamp and pages',
        'Choose text, numbers, watermark or overlay and enter page positions or ranges. Leave the page selection blank when the stamp should appear throughout the document.',
      ],
      [
        'Set relevant text appearance',
        'For text-based modes, choose font size and opacity and enter a single-line Latin-1 label when needed. Run Process document after checking the text fits the page.',
      ],
      [
        'Review the stamped copy',
        'Download the PDF and inspect a selected and an unselected page. Check readability, original-position numbering and whether an overlay obscures content that must remain visible.',
      ],
    ],
    [
      'A draft review copy',
      'A report needs a visible draft watermark on every page. Choose watermark, enter DRAFT and set moderate opacity with a suitable font size. Create the PDF and check the label against text-heavy and image-heavy pages before distributing the review copy.',
    ],
    [
      [
        'Do page numbers restart for selected pages?',
        'No. Numbers follow the original physical page positions. If you stamp only pages five through eight, those pages receive their existing positions rather than a new one-through-four sequence, which helps preserve references to the source document.',
      ],
      [
        'Which characters can text stamps use?',
        'Text stamps use bundled Helvetica and support single-line Latin-1 content. Multiline text and characters beyond that range are rejected. Prepare a PDF overlay with the required typography when a simple supported text label is insufficient.',
      ],
      [
        'How many pages can an overlay contain?',
        'The overlay PDF must contain one page or the same number of pages as the destination. A single page is reused, while a matching multipage overlay uses the corresponding original page position for each selected destination page.',
      ],
      [
        'Does text opacity affect a PDF overlay?',
        'The overlay keeps its own existing opacity rather than receiving the text-opacity control. Prepare the overlay PDF with the transparency you need and review its appearance on the destination, especially over dark graphics or dense text.',
      ],
    ],
  ),
  'fill-pdf-form': guide(
    'Fill supported standard AcroForm fields by supplying a JSON object keyed by field name. Text, checkbox and single-choice fields are supported, with optional flattening for a less editable final copy. This is useful for repeatable form preparation when you know the actual field names and can review every completed value.',
    [
      'Fill named text fields in a PDF form',
      'Set supported checkboxes using JSON booleans',
      'Flatten completed AcroForm fields into page content',
    ],
    [
      [
        'Choose a standard PDF form',
        'Upload an unprotected PDF with standard AcroForm fields. A scanned blank form has no interactive fields to fill, and dynamic XFA forms are unsupported.',
      ],
      [
        'Enter named JSON values',
        'Provide an object mapping field names to values, such as {"name":"Alex","approved":true}. Use JSON booleans for checkboxes and an available exact value for a choice field.',
      ],
      [
        'Choose whether to flatten',
        'Enable Flatten fields when the completed widgets should become page content, or disable it to retain supported editable fields. Run Process document after checking the JSON syntax.',
      ],
      [
        'Inspect every completed field',
        'Download the form and check names, choices and checkbox states in a PDF reader. If flattened, confirm the visible values are correct before using the completed document.',
      ],
    ],
    [
      'A simple review form',
      'A standard AcroForm contains name, department and approved fields. Enter a JSON object using those exact names and a boolean for approved. Keep flattening off for further review, then inspect the saved form’s text and checkbox state in a reader.',
    ],
    [
      [
        'How do I find the actual field names?',
        'Use the form’s authoring information when available. If you submit unknown field names, the tool returns an error with available names, which can help you correct the JSON keys rather than guessing from visible page labels.',
      ],
      [
        'What values should checkboxes receive?',
        'Checkbox fields require JSON true or false, without quotation marks. The tool maps those booleans to the field’s own checked or unchecked state, avoiding the need to guess internal PDF checkbox export values.',
      ],
      [
        'What does flattening change?',
        'Flattening turns supported completed form widgets into page content so they no longer behave as editable form fields. Review the values before using that copy, and retain the source if later form edits may be necessary.',
      ],
      [
        'Can this fill XFA or scanned forms?',
        'Dynamic XFA forms are rejected, and a scan without AcroForm widgets has no named fields for this operation. Use a suitable authoring workflow to create standard fields or prepare a visual overlay for those different document types.',
      ],
    ],
  ),
  'extract-pdf-images': guide(
    'Export embedded raster image objects from a PDF in their available original encodings, packaged with a JSON index. Use it to inspect photographs or scanned image assets without rendering complete pages. Vector drawings and page text are separate PDF content and are not converted into image objects by this operation.',
    [
      'Recover embedded photographs from a PDF',
      'Inspect raster assets in a document',
      'Export scan-image objects with an index',
    ],
    [
      [
        'Choose the source PDF',
        'Upload one working, unprotected PDF of up to one hundred pages. This tool looks for embedded raster image objects rather than taking screenshots of every page.',
      ],
      [
        'Check the intended extraction',
        'No image-format settings are required. Confirm that you need embedded assets, since a complete page containing text and vector drawings requires a rendering workflow instead.',
      ],
      [
        'Extract the image objects',
        'Run Process document to collect embedded images and available mask images. Reused image objects are exported once, with the index identifying their first page occurrence.',
      ],
      [
        'Review the ZIP and index',
        'Download and unpack the ZIP, then inspect index.json alongside the image files. Check dimensions and mask references before reusing assets that depended on PDF compositing.',
      ],
    ],
    [
      'Photos from an image-heavy brochure',
      'A brochure contains several embedded product photographs that need inspection. Run extraction, unpack the ZIP and use index.json to find each image’s first page and dimensions. Compare a photograph with its page appearance before assuming that crops or transparency are already applied.',
    ],
    [
      [
        'Does this export a picture of every page?',
        'No. It extracts embedded raster image objects, which may be smaller assets or full-page scans depending on the PDF. A page made from text and vector graphics may have no extractable raster image at all.',
      ],
      [
        'Why are there separate mask files?',
        'Some PDF images use a separate mask object for transparency. The ZIP exports available masks separately and records a mask reference in the index, so the standalone image may need compositing to match its appearance on the PDF page.',
      ],
      [
        'Why is a repeated logo exported only once?',
        'The extractor tracks embedded image object references and avoids duplicate exports of the same object. The index records its first page occurrence rather than writing a separate identical file every time the PDF reuses that image.',
      ],
      [
        'Will vector artwork appear in the ZIP?',
        'Vector drawings are separate page instructions rather than embedded raster images, so this operation does not export them as PNGs. Use page rendering for a visual copy of the complete page, including its text and vector artwork.',
      ],
    ],
  ),
  'compare-pdfs': guide(
    'Compare two PDF versions page by page using extracted text and rendered pixel differences. Download a ZIP with a JSON report and difference images for changed pages. Use it to investigate edits or layout shifts in short documents, then interpret the results with the source versions rather than treating pixel changes as semantic conclusions.',
    [
      'Review changes between report versions',
      'Find shifted page content after re-export',
      'Inspect text and visual differences in a short PDF',
    ],
    [
      [
        'Add the two versions',
        'Upload exactly two PDFs with the earlier version first and the later version second. Each document may contain up to twenty pages for this comparison.',
      ],
      [
        'Choose comparison resolution',
        'Set the visual comparison DPI between seventy-two and one hundred twenty. Higher resolution can reveal more fine differences but increases the amount of rendered pixel data.',
      ],
      [
        'Create the comparison package',
        'Run Process document to compare corresponding page positions. The output includes extracted-text changes, pixel-difference statistics and PNG difference images when rendered pages differ.',
      ],
      [
        'Interpret changes alongside sources',
        'Download and unpack the ZIP, then review comparison.json and the difference PNGs. Check the original versions to distinguish meaningful edits from rendering or layout changes.',
      ],
    ],
    [
      'A report after a layout revision',
      'Two twelve-page report versions should differ only in a corrected caption. Add the earlier PDF first and compare at ninety DPI. Review the text diff and changed-page PNGs to see whether the export also introduced unexpected page shifts or font changes.',
    ],
    [
      [
        'Does comparison automatically align moved pages?',
        'The tool compares pages at corresponding physical positions rather than finding a best match across reordered documents. An inserted cover or moved section can therefore produce differences on many later positions; interpret the report with page order in mind.',
      ],
      [
        'Do pixel changes always mean text changed?',
        'No. Font rendering, layout shifts, image changes and page-size differences can alter pixels even when extracted text is identical. The report separates text and visual equality so you can examine both kinds of evidence together.',
      ],
      [
        'What happens when page counts differ?',
        'The report records both page counts and compares through the longer document. A missing counterpart is represented in the visual comparison, so added or removed pages can be identified alongside text differences at those positions.',
      ],
      [
        'Can this compare a long document?',
        'Comparison is limited to twenty pages per input PDF, with an additional rendered-pixel bound per page. Extract relevant sections first when investigating a larger file, and keep the two selections aligned by corresponding page position.',
      ],
    ],
  ),
  'pdf-tables': guide(
    'Extract tables from selectable-text PDFs into an Excel workbook or a ZIP of CSV files. Choose line-based detection for ruled tables or text-based detection where spacing carries the structure. Use the result as a starting table for analysis, with a careful review of merged cells, headers and values against the source pages.',
    [
      'Extract a ruled table into Excel',
      'Create CSV tables from a report',
      'Recover table-like text after searchable-PDF OCR',
    ],
    [
      [
        'Choose a text-based PDF',
        'Upload one working PDF whose table text can be selected. For a scan, create a searchable PDF with OCR first and review recognition quality.',
      ],
      [
        'Choose detection and output',
        'Select lines for tables defined by ruling or text for spacing-based structure. Choose XLSX for workbook sheets or CSV for separate table files in a ZIP.',
      ],
      [
        'Extract detected tables',
        'Run Process document to detect tables across the PDF. The combined extraction is bounded to one hundred thousand cells, so focus on relevant pages for a large report.',
      ],
      [
        'Validate headers and values',
        'Download the workbook or unpack CSV files and compare them with the PDF. Check merged headings, blank cells, column shifts and numbers before performing calculations or imports.',
      ],
    ],
    [
      'A ruled table for spreadsheet review',
      'A report contains selectable text in clearly ruled tables. Choose lines and XLSX, then extract. Open the workbook and compare row counts, headers and representative values with the original pages, correcting merged-cell interpretations before using the data in calculations.',
    ],
    [
      [
        'Which strategy should I try first?',
        'Use lines when visible ruling defines the table cells. Use text when rows and columns are implied by text spacing, including searchable OCR output. If no table is found, inspect the source and try the other suitable strategy.',
      ],
      [
        'Does this directly recognize a scanned table?',
        'The extractor needs selectable text. For a scanned page, first run English OCR to make a searchable PDF, then try text detection. Recognition errors and irregular spacing can still affect the table, so compare extracted cells with the scan.',
      ],
      [
        'Why are numeric cells stored as text?',
        'The XLSX output writes extracted values as text, preserving their displayed strings rather than guessing numeric types. Review separators, dates and leading zeros before converting selected columns into numbers or dates in your spreadsheet application.',
      ],
      [
        'How are multiple tables packaged?',
        'XLSX output places detected tables on separate sheets named by page and table position. CSV output creates separate table files inside a ZIP, allowing you to inspect each detected structure before combining or importing them elsewhere.',
      ],
    ],
  ),
  'pdf-markdown': guide(
    'Extract selectable PDF text and table structure into a Markdown document for editing or further document conversion. The layout-aware extraction aims to represent reading structure, but complex columns and page design need review. Scanned pages require OCR first, and embedded images are not exported as part of this Markdown workflow.',
    [
      'Make an editable Markdown draft from a report',
      'Extract headings and tables for review',
      'Prepare text from a searchable PDF for restructuring',
    ],
    [
      [
        'Choose a readable PDF',
        'Upload one working, unprotected PDF with selectable text and up to one hundred pages. If it is a scan, create and review a searchable PDF first.',
      ],
      [
        'Check extraction suitability',
        'No format settings are required for Markdown output. Consider columns, footnotes and complex layouts, since a visual page design may not map neatly into a linear text document.',
      ],
      [
        'Create the Markdown draft',
        'Run Process document to extract layout-aware text and tables. The output is a Markdown file rather than a page rendering or an image asset package.',
      ],
      [
        'Review reading structure',
        'Download and open the Markdown, then compare headings, table rows and paragraph order with the PDF. Correct repeated headers, split words or layout-induced order errors before reuse.',
      ],
    ],
    [
      'A report section for editing',
      'A selectable-text PDF report needs to become an editable draft. Run PDF to Markdown, then inspect headings, lists and tables in the downloaded file. Compare any multi-column sections with the original pages before using the text in a revised document.',
    ],
    [
      [
        'Does Markdown preserve exact PDF layout?',
        'No. Markdown represents text structure rather than fixed page geometry. Headings and tables may be extracted usefully, but columns, sidebars and visual placement need review when the PDF is converted into a linear editable document.',
      ],
      [
        'Are images included in the output?',
        'This workflow does not write or embed PDF images into the Markdown file. Use Extract original PDF images for embedded raster assets, and inspect page renderings separately when understanding the document depends on its visual layout.',
      ],
      [
        'Why does a scanned PDF fail?',
        'A scan may contain only page images without selectable text. Run the English OCR tool first to create a searchable PDF, then review recognition before extracting Markdown so that OCR mistakes are not carried into the editable draft.',
      ],
      [
        'Should I review multi-column pages?',
        'Yes. Reading order is inferred from layout and can differ from the intended flow in complex pages. Compare column transitions, captions, footnotes and tables with the source before relying on the extracted text for another document.',
      ],
    ],
  ),
  'render-html': guide(
    'Render local HTML and CSS into a PDF or a PNG screenshot using uploaded relative assets. Add the HTML first, followed by the styles, images and fonts it needs, using basenames for asset references. Network access and JavaScript are disabled, making this a static rendering workflow rather than a live website capture.',
    [
      'Render a self-contained HTML report as PDF',
      'Capture a static HTML layout as PNG',
      'Preview local CSS with uploaded fonts and images',
    ],
    [
      [
        'Add HTML before its assets',
        'Upload the HTML file first, then required CSS, images and fonts. Reference uploaded assets by their basenames so the renderer can resolve the intended local resources.',
      ],
      [
        'Choose viewport and output',
        'Select PDF or PNG and set viewport width and height. These dimensions affect responsive layout, and PNG captures the configured viewport rather than an automatic full-page image.',
      ],
      [
        'Render the static document',
        'Run Process document to render the supplied content with network access and JavaScript disabled. Make sure required text and layout exist without client-side application code.',
      ],
      [
        'Inspect layout and asset loading',
        'Download the result and check fonts, images, responsive breaks and clipped content. For PNG, confirm the intended content fits within the selected viewport height.',
      ],
    ],
    [
      'A local report with a stylesheet',
      'A static report.html references report.css and logo.png by basename. Upload the HTML first, followed by both assets, then choose PDF and a suitable viewport width. Inspect the PDF for loaded styles, logo placement and page breaks before sharing the report.',
    ],
    [
      [
        'Can I provide a website URL?',
        'This tool renders uploaded local HTML and its supplied assets rather than fetching a remote website. Network access is disabled, so download or prepare a suitable self-contained static source through your normal workflow before using this renderer.',
      ],
      [
        'Will JavaScript generate the page content?',
        'No. JavaScript is disabled in this rendering workflow. A single-page application that needs scripts to create its content may therefore appear blank or incomplete; prepare static HTML with the necessary content and styles already present.',
      ],
      [
        'How should asset paths be written?',
        'Use the basenames of uploaded files, such as logo.png or report.css, rather than remote URLs or folder paths. Upload the HTML first and its required assets afterward, then inspect the result for missing fonts or images.',
      ],
      [
        'Does PNG include the entire scrollable page?',
        'PNG captures the selected viewport, so content beyond its height is not automatically included in a full-page image. Adjust the viewport within its bounds or choose PDF when the intended document should span rendered pages.',
      ],
    ],
  ),
  'convert-ebook': guide(
    'Convert an unprotected EPUB, MOBI or AZW3 into another supported ebook format, PDF or plain text using the local Calibre engine. Use it to prepare a reading copy for a compatible application or inspect book text. DRM-protected ebooks are unsupported, and fixed PDF pagination can differ from reflowable reading layouts.',
    [
      'Prepare an unprotected EPUB for another reader',
      'Create a plain-text ebook copy',
      'Render an ebook into a review PDF',
    ],
    [
      [
        'Choose an unprotected ebook',
        'Add one EPUB, MOBI or AZW3 with supported contents. For EPUB, required resources must be bundled locally rather than relying on external images, styles or fonts.',
      ],
      [
        'Select the reading format',
        'Choose EPUB, MOBI, AZW3, PDF or TXT for the intended use. Consider whether you need reflowable book structure, fixed pages or a simpler text copy.',
      ],
      [
        'Convert with Calibre',
        'Run Process document and let the local ebook engine create the result. DRM-protected inputs and unsupported resource dependencies fail rather than being silently bypassed.',
      ],
      [
        'Review in the target reader',
        'Download and open the output in its intended application. Check the contents, chapter transitions and illustrations, and review PDF pagination if you chose fixed pages.',
      ],
    ],
    [
      'An EPUB copy for text review',
      'An unprotected EPUB contains a short manuscript that needs plain-text review. Choose TXT and convert, then inspect chapter transitions and punctuation in the downloaded file. Retain the EPUB for any illustrations or reading structure that the plain-text copy cannot represent.',
    ],
    [
      [
        'Can this remove ebook DRM?',
        'No. DRM-protected or encrypted ebooks are unsupported. Use an unprotected ebook that you can legitimately process, and obtain an appropriate source copy through the publisher or owner when encryption prevents a normal conversion workflow.',
      ],
      [
        'Will PDF look like an ebook reader screen?',
        'Not necessarily. Reflowable ebooks adapt to reader settings, while PDF uses fixed pages determined during conversion. Review page breaks, image sizing and text flow in the actual PDF rather than assuming the source reading layout is preserved.',
      ],
      [
        'Can EPUB depend on online images?',
        'The EPUB workflow requires resources to be bundled locally and rejects external resource dependencies. Prepare a self-contained source through your authoring workflow before converting, then check the output illustrations and styles in the target reader.',
      ],
      [
        'What is lost in a plain-text copy?',
        'Plain text is useful for words and simple review but cannot retain the ebook’s visual styling, interactive navigation or illustrations as a full reading experience. Keep the original ebook when those structural and visual features remain important.',
      ],
    ],
  ),
  'semantic-document': guide(
    'Convert self-contained text documents between Markdown, HTML, DOCX, RTF, ODT and EPUB with Pandoc. The workflow focuses on headings, paragraphs, lists and other semantic structure rather than matching page layout. Use it for editable drafts and publishing pipelines, with a review of structure and formatting in the destination application.',
    [
      'Turn Markdown prose into DOCX',
      'Create HTML from a structured text document',
      'Convert an ODT draft into Markdown',
    ],
    [
      [
        'Choose a self-contained source',
        'Add a supported Markdown, HTML, DOCX, RTF or ODT file. Remove unsupported active or external resources and use a text-focused source suitable for structural conversion.',
      ],
      [
        'Select the destination syntax',
        'Choose Markdown, HTML, DOCX, RTF, ODT or EPUB. Consider the destination’s representation of headings, lists and tables rather than expecting identical physical pages.',
      ],
      [
        'Convert document structure',
        'Run Process document to translate the source with Pandoc. The conversion writes a standalone output and rejects unsupported resource dependencies instead of fetching them remotely.',
      ],
      [
        'Review the editable document',
        'Download and open the output in an appropriate editor. Check heading levels, lists, emphasis and tables before applying any destination-specific page layout or publication styles.',
      ],
    ],
    [
      'A Markdown draft for Word review',
      'A text-focused Markdown draft has headings, paragraphs and lists and needs reviewer comments in Word. Select DOCX and convert. Open the result to check heading hierarchy and list numbering, then apply any page-layout styling needed by the reviewing organisation.',
    ],
    [
      [
        'Will the output match every original page?',
        'No. Pandoc converts semantic document structure rather than acting as a page-layout renderer. Use Office to PDF or local HTML rendering when the task depends on visual pagination, fonts and precise placement instead of editable structure.',
      ],
      [
        'Can Markdown include images in this workflow?',
        'Text inputs with embedded or external resource references are restricted, including Markdown image syntax in this workflow. Prepare a self-contained text-focused source without those resources, or use a rendering tool better suited to page assets and visual layout.',
      ],
      [
        'Does this run scripts from HTML or Office?',
        'No. Active content and unsupported external resources are rejected. The workflow is intended for document structure conversion, so prepare a source without scripts, macros, RTF fields or external document dependencies before processing it.',
      ],
      [
        'What should I check after conversion?',
        'Review headings, list nesting, emphasis, tables and paragraph order in the target editor. Different formats have different structural conventions, so an editable result can still need adjustments before it matches the destination’s publishing or review style.',
      ],
    ],
  ),
  'convert-font': guide(
    'Convert a font between supported TTF, OTF, WOFF and WOFF2 containers while preserving its underlying outlines. Choose WOFF or WOFF2 for a web-font container, or SFNT to restore TTF or OTF according to the original outline flavour. This changes packaging rather than redesigning glyphs or converting CFF outlines into TrueType.',
    [
      'Package a supported font as WOFF2',
      'Restore a web font to its SFNT container',
      'Create a WOFF version for a compatible web workflow',
    ],
    [
      [
        'Choose one font file',
        'Upload a supported TTF, OTF, WOFF or WOFF2 font. Check that it is the correct family and style before creating a different container copy.',
      ],
      [
        'Select the output container',
        'Choose WOFF, WOFF2 or SFNT. SFNT produces TTF or OTF according to the original font’s outline flavour rather than forcing a different glyph-outline technology.',
      ],
      [
        'Create the converted font',
        'Run Process document to load and repackage the font. The resulting file is reopened for validation before it is returned as a downloadable font asset.',
      ],
      [
        'Test text rendering',
        'Download the font and test representative text in the intended application or page. Check glyph coverage and weight selection, and keep the source for later packaging choices.',
      ],
    ],
    [
      'A font container for a web prototype',
      'A project has a supported TTF and needs WOFF2 for its web prototype. Select WOFF2 and convert, then add the new file to the prototype’s font-face configuration. Check representative glyphs, bold selection and text wrapping before adopting the asset.',
    ],
    [
      [
        'Does SFNT always mean TTF?',
        'No. SFNT restores an uncompressed font container according to the original outline flavour. A font with CFF outlines produces OTF, while a TrueType-outline font produces TTF, so the expected extension depends on the source structure.',
      ],
      [
        'Can this convert CFF outlines to TrueType?',
        'No. The tool converts containers while preserving the original outline representation. It does not redesign glyphs or translate CFF outlines into TrueType curves, so use a dedicated font-authoring workflow for that different kind of transformation.',
      ],
      [
        'Does packaging add missing characters?',
        'No. Container conversion retains the font’s existing outlines and supported character coverage. Test the actual text your application needs, since a new WOFF2 extension does not supply glyphs that were absent from the original font.',
      ],
      [
        'Does a successful conversion grant font usage rights?',
        'No. The operation creates a technical container copy and does not determine or change the source font’s usage permissions. Use the converted asset within the permissions already applicable to that font and your intended project.',
      ],
    ],
  ),
  'reorder-pdf': guide(
    'Create a PDF with pages arranged in an explicit new sequence, keeping only the pages you list. Enter individual positions or ascending ranges in the order they should appear. This is useful for correcting a scanned packet, moving a cover sheet or removing irrelevant pages while building the intended reading sequence.',
    [
      'Move a cover sheet to the front',
      'Correct a scanned document sequence',
      'Reorder and keep selected report sections',
    ],
    [
      [
        'Add the source document',
        'Choose one working, unprotected PDF with up to one hundred pages. Inspect the actual page positions, including covers and unnumbered pages, before constructing the new sequence.',
      ],
      [
        'Enter the new page order',
        'List page positions in the desired order, such as 3,1,2. Use ascending ranges where useful and include every page that should remain in the output.',
      ],
      [
        'Create the rearranged PDF',
        'Run Process document after checking that no page appears twice. Omitted pages are removed from the output rather than automatically appended to the end.',
      ],
      [
        'Review sequence and completeness',
        'Download the result and inspect the first page, section transitions and final page. Compare the output page count with the number of pages you intended to retain.',
      ],
    ],
    [
      'A misplaced cover sheet',
      'A three-page PDF has its cover at position three. Enter 3,1,2 and create the new document. Review the downloaded PDF to confirm the cover is first and the two content pages still follow in their intended reading order.',
    ],
    [
      [
        'What happens to pages I leave out?',
        'Any page omitted from the list is removed from the output. This is useful for selecting sections, but it also means a short order such as 3,1,2 does not automatically keep later pages in a longer document.',
      ],
      [
        'Can I include the same page twice?',
        'No. Each source page may appear only once in the selection. If your task requires deliberate duplicate pages, prepare separate source documents and use an appropriate PDF assembly workflow rather than repeating a number in this tool.',
      ],
      [
        'Do printed page labels determine the order?',
        'The tool uses physical page positions starting at one, not labels printed on the page. Account for covers, title pages and Roman-numeral introductions when translating a document’s visible page numbering into the selection field.',
      ],
      [
        'Can I use ranges in a different section order?',
        'Yes. Enter ascending ranges in your desired section order, such as 5-8,1-4, provided every page is valid and appears once. A range itself must ascend; use separate individual positions when arranging pages in another pattern.',
      ],
    ],
  ),
  'rotate-pdf': guide(
    'Rotate selected PDF pages clockwise by ninety, one hundred eighty or two hundred seventy degrees and save a new document. Leave the page field blank to rotate every page, or specify positions and ranges for isolated orientation problems. Use it to correct sideways scans while preserving the existing page sequence.',
    [
      'Correct sideways scanned pages',
      'Turn an upside-down PDF upright',
      'Rotate only landscape appendix pages',
    ],
    [
      [
        'Choose the PDF to correct',
        'Upload one working, unprotected PDF of up to one hundred pages. Check each incorrectly oriented page in a viewer so the requested rotation matches the problem.',
      ],
      [
        'Select affected page positions',
        'Enter page numbers or ascending ranges, or leave the field blank for every page. Do not repeat a page position in the same selection.',
      ],
      [
        'Choose a clockwise rotation',
        'Select ninety, one hundred eighty or two hundred seventy degrees and run Process document. The chosen rotation is added to each selected page’s existing orientation.',
      ],
      [
        'Check the new orientation',
        'Download the PDF and inspect the rotated pages alongside their neighbours. Confirm the content is upright and that pages excluded from the selection remain appropriately oriented.',
      ],
    ],
    [
      'Two sideways pages in a report',
      'A ten-page PDF has sideways scans at positions four and seven. Enter 4,7 and choose the clockwise rotation that makes them upright. Create the result and review both corrected pages before replacing the copy used for reading.',
    ],
    [
      [
        'Does a blank selection mean no pages?',
        'No. A blank page field selects all pages in the PDF. Enter an explicit list if only a few pages need correction, and review that list before applying a rotation across a mixed-orientation document.',
      ],
      [
        'Which direction is the rotation?',
        'The offered angles are clockwise and are added to a page’s existing rotation. A ninety-degree choice and a two-hundred-seventy-degree choice turn in opposite effective directions, so inspect the downloaded result if the source orientation is confusing.',
      ],
      [
        'Will rotation change page order?',
        'This operation changes orientation on selected pages and keeps their existing sequence. Use Reorder PDF pages if the document also has a misplaced cover or sections that need a different order after orientation is corrected.',
      ],
      [
        'Can I rotate by a small angle?',
        'This PDF tool provides quarter-turn rotations rather than arbitrary deskew angles. For photographed page images with a slight tilt, use the scan cleanup workflow before assembling a PDF, checking that automatic correction retains the full page content.',
      ],
    ],
  ),
  'compress-pdf': guide(
    'Try lossless PDF optimization or create an image-based PDF at a chosen raster resolution and JPEG quality. Lossless mode may retain the existing structure without reducing file size; raster mode changes pages more substantially. Choose according to whether selectable text, links and forms need to remain available in the output.',
    [
      'Try reducing a PDF without rasterizing pages',
      'Create a smaller image-based review PDF',
      'Reduce resolution for a short scan-like document',
    ],
    [
      [
        'Choose a working PDF',
        'Add one unprotected PDF and consider the features it contains. Decide whether text selection, links or form fields must survive in the copy you are creating.',
      ],
      [
        'Choose the compression mode',
        'Select lossless optimization first when preserving page structure matters. Choose raster mode only when replacing each page with an encoded image is acceptable for the task.',
      ],
      [
        'Set raster detail if needed',
        'For raster mode, choose DPI and JPEG quality and keep the source within twenty pages. Run Process document to create the newly optimized or rasterized PDF.',
      ],
      [
        'Compare size and usefulness',
        'Download the result and check actual file size, text clarity and required interactive features. Keep the original when the compressed copy loses functionality needed elsewhere.',
      ],
    ],
    [
      'A small review copy of a scan packet',
      'A twelve-page scan-like PDF needs a smaller review copy. Try lossless mode first and compare sizes. If necessary, use raster mode at 120 DPI with moderate JPEG quality, then inspect small text and confirm that image-only pages suit the review task.',
    ],
    [
      [
        'Does lossless mode always reduce size?',
        'No. Optimization can reorganize and compress PDF data, but an already efficient document may show little reduction or even a larger output. Compare the reported original and output sizes instead of assuming the mode guarantees a smaller file.',
      ],
      [
        'What does raster mode remove?',
        'Raster mode renders each page and replaces its content with a JPEG image. Selectable text, links and form functionality are removed, so use it only when a visual copy is sufficient and retain the original document.',
      ],
      [
        'How many pages can raster mode handle?',
        'Raster compression is limited to twenty pages, with a separate rendered-pixel limit per page. Lossless operations use the broader one-hundred-page PDF bound, so the permissible source size depends on the mode you choose.',
      ],
      [
        'How should I choose DPI and quality?',
        'Lower DPI reduces page pixel dimensions, while lower JPEG quality adds stronger image compression. Inspect fine text, diagrams and signatures after changing either setting, since a small file is less useful if its necessary details become unreadable.',
      ],
    ],
  ),
  'ocr-document': guide(
    'Recognize English text in a still image or scanned PDF and export plain text or a searchable PDF. Searchable output retains the page image with an aligned text layer, making it useful for finding words in scanned material. Review the recognized text, especially names, numbers, small print and unusual layouts.',
    [
      'Make an English scanned PDF searchable',
      'Extract draft text from a photographed page',
      'Recognize printed English text from a still scan',
    ],
    [
      [
        'Choose a clear scan',
        'Add one supported still image or an unprotected scanned PDF with no more than twenty pages. Upright text and clear contrast improve the recognition task.',
      ],
      [
        'Choose text or searchable PDF',
        'Select TXT for recognized words or PDF to retain page images with an aligned text layer. This OCR workflow uses the local English recognition model.',
      ],
      [
        'Recognize the page content',
        'Run Process document and wait for the pages to be rendered and recognized. Avoid treating completion as evidence that every word or reading order is correct.',
      ],
      [
        'Review against the scan',
        'Download the result and compare meaningful passages with the original. In searchable PDF output, test search and text selection as well as the visible page image.',
      ],
    ],
    [
      'A searchable English archive scan',
      'A ten-page English instruction packet exists only as scanned pages. Choose PDF output and run OCR. Open the searchable copy, search for a known heading and verify a few selected passages against the visible image before using extracted text elsewhere.',
    ],
    [
      [
        'Which language does this OCR support?',
        'This workflow uses local English OCR. Other languages or mixed scripts may produce poor recognition and should not be assumed supported. Choose a suitable language-specific OCR workflow when accurate recognition depends on a different writing system.',
      ],
      [
        'Will searchable PDF replace the scan image?',
        'No. Searchable output includes the original page image representation together with an aligned recognized-text layer. The visible scan remains useful for comparison, while search and selection depend on the accuracy and placement of the recognized text.',
      ],
      [
        'How many PDF pages can be recognized?',
        'The render-and-OCR workflow accepts up to twenty pages. For a longer document, prepare a relevant smaller PDF selection first and review recognition in manageable sections rather than expecting the full one-hundred-page PDF limit here.',
      ],
      [
        'Can I trust every recognized number?',
        'No. OCR can confuse similar characters, punctuation, table columns and faint marks. Check meaningful quantities, dates, names and identifiers against the page image before relying on them, especially when copying the result into another document or table.',
      ],
    ],
  ),
  'office-render': guide(
    'Render a self-contained Office or OpenDocument file into PDF, or export its pages as PNG or JPG images in a ZIP. LibreOffice interprets the layout, so installed fonts and complex document features can affect the result. Prepare external links, macros and active resources before conversion, then inspect the rendered pages.',
    [
      'Create a PDF from a self-contained DOCX',
      'Export presentation pages as a PNG ZIP',
      'Render an RTF document without fields or objects',
    ],
    [
      [
        'Prepare the self-contained document',
        'Upload a supported Office, OpenDocument or RTF file after removing external links, macros and active resources. Linked graphics need an appropriate self-contained source export.',
      ],
      [
        'Choose PDF or page images',
        'Select PDF, PNG or JPG. For image output, choose resolution and keep the rendered document within twenty pages; PDF output can contain up to one hundred pages.',
      ],
      [
        'Render through LibreOffice',
        'Run Process document to render the document locally. Image modes first produce a PDF representation, then package its rendered pages into one downloadable ZIP.',
      ],
      [
        'Review the resulting layout',
        'Download the PDF or unpack the page images. Check fonts, page breaks, tables, chart placement and spreadsheet print areas against the source’s intended appearance.',
      ],
    ],
    [
      'A document for visual review',
      'A self-contained DOCX needs a PDF review copy. Remove external relationships and confirm that the required fonts are available, then choose PDF. Review headings, table widths and page breaks in the downloaded document before sending it to reviewers.',
    ],
    [
      [
        'Why are external links rejected?',
        'The conversion workflow requires self-contained content and rejects external document relationships, linked resources and active features. Prepare the source by embedding suitable assets and removing links or macros before upload, including relationships that seem unrelated to visible page content.',
      ],
      [
        'Will the layout match Microsoft Office exactly?',
        'LibreOffice renders the layout, and differences in fonts or complex features can change line breaks, pagination and object placement. Inspect the actual PDF or page images rather than assuming the result exactly matches another application’s rendering.',
      ],
      [
        'What do PNG and JPG modes download?',
        'They create a ZIP of rendered document page images at the selected resolution. These are visual page representations rather than editable slides or spreadsheet cells, and image output is limited to twenty rendered pages.',
      ],
      [
        'Can RTF include fields or embedded objects?',
        'No. RTF fields, templates, external references and embedded objects are rejected in this workflow. Export a simpler self-contained RTF from the authoring application before converting, and compare the resulting page layout with the intended document.',
      ],
    ],
  ),
  'protect-pdf': guide(
    'Create an AES-256 encrypted PDF that asks for a password when opened. Choose a nonempty password for a working unprotected source, then verify it in a PDF reader after downloading. Keep the password through your own appropriate storage process, since this tool does not provide a password recovery workflow.',
    [
      'Create a password-opening PDF copy',
      'Prepare a protected document for a controlled handoff',
      'Add encryption to an existing PDF attachment',
    ],
    [
      [
        'Choose an unprotected PDF',
        'Add one working PDF with up to one hundred pages. If it is already locked, first create a readable copy using its known open password.',
      ],
      [
        'Enter an open password',
        'Choose a nonempty password of up to 256 characters. Enter it for this operation and keep it through your own password-storage process rather than embedding it in filenames.',
      ],
      [
        'Create the protected copy',
        'Run Process document to encrypt the new PDF using AES-256. Wait for output verification before downloading the protected result for your intended handoff.',
      ],
      [
        'Verify opening behaviour',
        'Download the PDF and open it in a compatible reader. Check that the chosen password opens the document and retain access to the source when a different copy is needed.',
      ],
    ],
    [
      'A protected document handoff',
      'A project document needs a password-opening copy for a specific recipient. Choose a new password, create the protected PDF and test it in a reader. Keep the password in your own approved storage and provide it through the intended handoff process.',
    ],
    [
      [
        'Which encryption is used?',
        'The tool creates an AES-256 encrypted PDF with the supplied open password. Test the output in the recipient’s PDF reader, since the ability to open an encrypted document depends on that application supporting the resulting PDF encryption.',
      ],
      [
        'Can the password field be empty?',
        'No. The operation requires a password between one and 256 characters. Choose a value you can retain appropriately, and avoid putting passwords into document titles, example text or filenames that may be displayed elsewhere.',
      ],
      [
        'Does the tool recover a forgotten password?',
        'No. Protection creates a new encrypted copy, and the separate unlock workflow requires the correct known password. Keep your source document and password accessible through your own process if you need to revise or unlock the result later.',
      ],
      [
        'Can I protect an already locked PDF directly?',
        'The protection workflow expects a source it can open without a password. Use the known-password unlock tool to create an unprotected copy first, then protect that copy with the intended new open password.',
      ],
    ],
  ),
  'unlock-pdf': guide(
    'Create an unencrypted PDF copy by supplying the correct known open password for a protected document. This is useful when you need a readable input for page operations or a permitted working copy. The tool verifies the password and writes a new file; it does not recover or guess unknown passwords.',
    [
      'Prepare a known-password PDF for merging',
      'Create an unencrypted working copy',
      'Remove an open-password requirement using the correct password',
    ],
    [
      [
        'Choose the protected document',
        'Upload one PDF of up to one hundred pages. Have its correct open password available before running the operation, rather than trying guesses through the tool.',
      ],
      [
        'Enter the known password',
        'Type the current open password into the password field. Use the exact characters and avoid copying surrounding spaces from another source unless those spaces belong to it.',
      ],
      [
        'Create the unlocked copy',
        'Run Process document so the engine authenticates the password and saves an unencrypted result. An incorrect password produces an error instead of a partial document.',
      ],
      [
        'Check the working document',
        'Download and open the new PDF without entering the original password. Review the content and use this copy for the intended merge, extraction or other document operation.',
      ],
    ],
    [
      'An input for a document packet',
      'A supplied PDF has a known open password but needs to join an unprotected project packet. Upload it, enter the correct password and create the unlocked copy. Verify it opens normally, then use that copy in the PDF merge workflow.',
    ],
    [
      [
        'Does this discover an unknown password?',
        'No. The tool requires the correct known open password and does not provide password recovery or guessing. If the password is unavailable, obtain it through the document owner’s normal process before attempting to create a working copy.',
      ],
      [
        'What happens if the password is incorrect?',
        'The PDF engine rejects an incorrect password and returns an error. Check the exact value, including character case and intentional spaces, rather than expecting the tool to create an incomplete or partially decrypted document.',
      ],
      [
        'Will the downloaded file still ask for that password?',
        'The output is saved without the original PDF encryption and should open without that password in a compatible reader. Test the downloaded copy before using it as input to another document tool or handing it off.',
      ],
      [
        'Can I change the password instead?',
        'Create the unlocked copy with the known current password, then use Password protect PDF to create a separate copy with a new open password. Verify the new result and retain passwords through your own appropriate storage process.',
      ],
    ],
  ),
  'lottie-render': guide(
    'Render a self-contained Lottie JSON or TGS animation as GIF, animated WebP or APNG. Choose a short time window, width, frame rate and loop setting to create a raster animation for compatible viewers. The renderer supports bounded compositions without external resources, expressions or ZIP-based .lottie bundles.',
    [
      'Preview a self-contained motion graphic',
      'Convert a supported TGS to GIF',
      'Make an animated WebP from Lottie JSON',
    ],
    [
      [
        'Choose JSON or TGS',
        'Upload one self-contained Lottie JSON or TGS file. Remove external fonts, image dependencies and expressions in the authoring workflow before preparing the file for rendering.',
      ],
      [
        'Select the render window',
        'Enter start, length and frames per second. The selection must contain between one and two hundred forty frames and remain within thirty seconds.',
      ],
      [
        'Choose raster animation settings',
        'Select GIF, WebP or APNG, output width and loop behaviour. Larger dimensions and more frames must still remain within the decoded-pixel budget for the complete render.',
      ],
      [
        'Review the rendered motion',
        'Run the tool and download the animation. Compare shapes, timing, text and transparency with the intended composition before using the raster version in another application.',
      ],
    ],
    [
      'A small motion graphic as WebP',
      'A self-contained three-second Lottie composition needs a browser-friendly raster preview. Choose WebP, width 480 and 15 frames per second. Create the forty-five-frame animation and review its shape motion and transparent edges against the original design intent.',
    ],
    [
      [
        'Can I upload a .lottie ZIP bundle?',
        'No. This tool accepts JSON and TGS, not ZIP-based .lottie bundles. Export a supported self-contained JSON composition from your source workflow and check that it does not depend on external images, fonts or expressions.',
      ],
      [
        'Why are expressions rejected?',
        'The renderer works with a bounded, self-contained animation structure and does not support expression-based behaviour or scripts. Bake the intended motion into supported keyframes in the authoring application before exporting the composition for this tool.',
      ],
      [
        'How many frames can be rendered?',
        'A render can contain one to two hundred forty frames, with a maximum thirty-second selection and a sixty-four-million-decoded-pixel budget. A high frame rate or large output width may therefore require a shorter animation window.',
      ],
      [
        'Does this keep vector animation data?',
        'The result is a raster animation in GIF, WebP or APNG, not an editable Lottie project. Retain the original JSON or TGS if you need vector scalability, editable keyframes or a later export at different dimensions.',
      ],
    ],
  ),
  'convert-native-video': guide(
    'Turn a supported AVI, FLV, WMV, MPEG, TS or other accepted video into a short MP4, WebM, MOV or MKV copy. Choose the useful segment, maximum width and quality for a current viewing workflow. The engine decodes and re-encodes media rather than changing the extension of the original container.',
    [
      'Make an MP4 excerpt from AVI footage',
      'Prepare a WebM copy of an older video',
      'Convert a short transport-stream segment for review',
    ],
    [
      [
        'Add the legacy video',
        'Select one supported source file with readable video and a known duration. The decoder checks the actual streams, not just the container extension in its filename.',
      ],
      [
        'Choose a short segment',
        'Enter start and length in seconds for the content you need. The output segment is bounded to 120 seconds and must start before the source ends.',
      ],
      [
        'Set destination encoding',
        'Choose MP4, WebM, MOV or MKV, maximum width and quality. Run the conversion to create a newly encoded video with supported picture and audio handling.',
      ],
      [
        'Test the converted clip',
        'Download and play the result in the intended application. Check image shape, motion, sound and the selected start point before using the new copy.',
      ],
    ],
    [
      'An AVI excerpt for modern playback',
      'An older AVI recording contains a useful forty-second example starting at two minutes. Set start 120 and length 40, choose MP4 and width 1280, then convert. Play the saved clip to confirm that both picture and sound decode correctly.',
    ],
    [
      [
        'Does every AVI or MKV contain supported media?',
        'A container can hold different codecs, so its extension alone does not establish that every stream is decodable. The local media engine inspects the source and reports a failure if the contents cannot be processed within its limits.',
      ],
      [
        'Can I convert a full feature-length recording?',
        'Sources can have a known duration of up to two hours, but the selected output segment is limited to 120 seconds. Choose the useful excerpt here rather than expecting one operation to encode an entire long recording.',
      ],
      [
        'Which output is a convenient default?',
        'MP4 is a practical choice when your destination accepts it, while WebM, MOV or MKV may suit particular workflows. Check the destination’s actual requirements and test the saved clip rather than relying on a container name alone.',
      ],
      [
        'Is this a lossless container remux?',
        'No. The tool re-encodes video using the chosen width and quality, with available audio handled for the selected output. Keep the original file when you need the source encoding or a later higher-quality conversion.',
      ],
    ],
  ),
  'convert-native-audio': guide(
    'Convert supported AAC, Opus, WMA, AMR, APE and other accepted audio sources into an ordinary listening or editing copy. Select a short segment and export MP3, WAV, FLAC, OGG, M4A or AIFF. Use bitrate controls for lossy output and check speech or music quality after re-encoding.',
    [
      'Create an MP3 from a WMA excerpt',
      'Make a WAV copy of a supported voice memo',
      'Export an Opus recording segment as FLAC',
    ],
    [
      [
        'Choose the source audio',
        'Upload one supported audio recording and check the useful portion. The source must have a readable audio track and a known duration within the supported source bounds.',
      ],
      [
        'Select the audio excerpt',
        'Enter start and length in seconds. Keep the requested excerpt within 120 seconds and use length as a duration after start rather than an ending timestamp.',
      ],
      [
        'Choose the output format',
        'Select the audio format and a bitrate for lossy encoding when relevant. Run the tool to decode the source and encode the new audio copy.',
      ],
      [
        'Listen in the destination player',
        'Download the output and play the full selected passage. Check the first and last words, musical detail and compatibility with the application that will use it.',
      ],
    ],
    [
      'A voice memo for a WAV workflow',
      'A supported AMR voice memo needs to be reviewed in software that expects WAV. Select a useful sixty-second passage and choose WAV. Download the new audio, listen for complete speech and retain the AMR source for any later conversion choices.',
    ],
    [
      [
        'Does WAV make a compressed source lossless?',
        'WAV stores the decoded signal without another lossy encoding step here, but it cannot restore information lost in an AMR, AAC or other compressed source. It may also be much larger than the original recording.',
      ],
      [
        'Which formats use the bitrate control?',
        'The bitrate setting affects lossy outputs such as MP3, OGG and M4A. WAV and AIFF use PCM, while FLAC uses lossless compression, so those choices do not become low-bitrate lossy files merely because of the field value.',
      ],
      [
        'Can I convert a two-hour recording at once?',
        'The source duration can be up to two hours when readable and known, but the selected output excerpt is bounded to 120 seconds. Choose the segment you need rather than expecting a full long-form audio export.',
      ],
      [
        'Will conversion improve noisy speech?',
        'Changing the audio format does not remove background noise or recover unclear speech. This tool handles decoding, segment selection and encoding; evaluate the source quality separately and listen carefully if the recording is important to your task.',
      ],
    ],
  ),
  'convert-subtitles': guide(
    'Convert supported ASS, SSA, SRT and VTT cues into another subtitle format and shift their timestamps by a chosen number of seconds. Use it to fit a player’s accepted format or correct a consistent timing offset. Review cue text and synchronization because complex styling is not preserved through plain subtitle formats.',
    [
      'Convert SRT captions to WebVTT',
      'Shift subtitle timing by a constant offset',
      'Export ASS dialogue as plain SRT cues',
    ],
    [
      [
        'Add the subtitle file',
        'Choose one ASS, SSA, SRT or VTT file with valid cues. Embedded subtitle attachments are unsupported, so use a text-based cue file without attached fonts or graphics.',
      ],
      [
        'Choose the cue format',
        'Select SRT, VTT, ASS or SSA for the destination player. Expect plain or default styling rather than preservation of every source style and position.',
      ],
      [
        'Set a timestamp shift',
        'Enter a positive shift to delay captions or a negative shift to move them earlier. Run the conversion after checking the sign of the intended adjustment.',
      ],
      [
        'Review cues with the video',
        'Download the subtitle output and load it beside the intended video. Check early and late cues, line breaks and any timestamps affected by clamping at zero.',
      ],
    ],
    [
      'Captions for an HTML video player',
      'A video has SRT captions that appear one second early. Select VTT and a positive one-second shift, then convert. Load the WebVTT file in the player and verify several spoken lines, including the first caption and a later cue.',
    ],
    [
      [
        'Which direction does a positive shift move captions?',
        'A positive value adds time to each cue and makes it appear later. A negative value moves cues earlier. Check against spoken dialogue at several points to distinguish a constant offset from gradual synchronization drift.',
      ],
      [
        'What happens to negative timestamps?',
        'Shifted timestamps below zero are clamped to zero. Moving early cues too far backward can therefore shorten or overlap their visible timing, so inspect the beginning of the converted subtitle file alongside the video.',
      ],
      [
        'Are ASS styles and positioning retained?',
        'ASS and SSA styling and positioning are lost when exporting plain SRT or VTT cues. Outputs using ASS or SSA receive a default style rather than a complete reconstruction of the source’s elaborate subtitle presentation.',
      ],
      [
        'Does this translate subtitle text?',
        'No. The operation converts cue structure and adjusts timestamps while keeping the dialogue text. Translation, correction of recognition mistakes and changes to the wording require a separate editing step before or after format conversion.',
      ],
    ],
  ),
  'burn-subtitles': guide(
    'Render subtitle text permanently into a selected video segment so it remains visible without a separate subtitle file. Upload the video first and ASS, SSA, SRT or VTT second, then choose video output settings. Use it for a captioned review copy when viewers cannot load external subtitle tracks.',
    [
      'Create a permanently captioned demonstration',
      'Make a review clip with visible subtitles',
      'Prepare a captioned video for a simple player',
    ],
    [
      [
        'Upload video then subtitles',
        'Add exactly two files in role order: the video first and its subtitle file second. Use supported text cues without embedded font or graphic attachments.',
      ],
      [
        'Choose the video segment',
        'Enter start and length, keeping subtitle times aligned with the source video timeline. Select a short excerpt within the supported 120-second media segment bound.',
      ],
      [
        'Set encoding and render',
        'Choose output format, maximum width and quality, then run the tool. FFmpeg’s libass renderer draws the subtitle appearance directly into the video picture.',
      ],
      [
        'Read the finished captions',
        'Download and watch the clip with sound. Check line timing, glyph appearance, readable size and contrast, especially after scaling to the selected output width.',
      ],
    ],
    [
      'A captioned clip for review',
      'A demonstration has matching SRT captions but its review player cannot load subtitle files. Add the video followed by SRT, select the required twenty-second excerpt and export MP4. Watch the result and check that captions match the spoken instructions.',
    ],
    [
      [
        'Can viewers turn the subtitles off?',
        'No. Burning subtitles draws them into the output video pixels. Keep the original video and subtitle file if you also need a version where viewers can disable captions or choose a different subtitle language.',
      ],
      [
        'Which file should I upload first?',
        'The video must be first and the subtitle file second, with exactly two inputs. The tool uses those positions to identify the picture and cue source, so inspect the upload list before starting the render.',
      ],
      [
        'Do subtitle times restart at the excerpt?',
        'Use cues aligned to the source video timeline when selecting a segment. The subtitles are rendered against the source before the output timeline is reset, so already rebased excerpt cues can appear at the wrong moment.',
      ],
      [
        'Why can subtitle appearance differ?',
        'The libass renderer uses available font rendering and the selected output scale. Complex styling or missing fonts can change appearance, so review glyphs, line wrapping and contrast in the actual downloaded video rather than the subtitle source alone.',
      ],
    ],
  ),
  'normalize-audio': guide(
    'Create a short audio copy with a chosen loudness target and optional fades at the beginning or end. Select the segment before setting fades, then choose a supported audio format. Use it to prepare clearer transitions or more consistent listening levels, with a final listening check for the specific recording.',
    [
      'Apply a fade to a short music excerpt',
      'Prepare a voice clip at a chosen loudness',
      'Soften the start and end of an audio sample',
    ],
    [
      [
        'Choose an audio segment',
        'Upload one supported recording and enter start and length. The selected segment can be up to 120 seconds and defines the available space for fades.',
      ],
      [
        'Set loudness and fades',
        'Choose the loudness target in LUFS, then enter fade-in and fade-out durations. Each fade must be no longer than the selected clip’s duration.',
      ],
      [
        'Select the output encoding',
        'Choose the audio format and bitrate where relevant, then run the tool. The loudness filter and requested fades are applied before the result is encoded.',
      ],
      [
        'Listen at a normal level',
        'Download the output and listen through both ends and louder passages. Check that fades do not hide words and that the perceived level suits the recording’s destination.',
      ],
    ],
    [
      'A smoother music excerpt',
      'A twenty-second music sample needs gentle edges for a presentation. Choose the segment, set a loudness target of minus sixteen LUFS and add one-second fades. Export the audio and listen to the opening, loudest passage and ending before inserting it.',
    ],
    [
      [
        'What does LUFS control?',
        'LUFS is a measure used for perceived programme loudness. The target guides the normalization filter, while the source content and encoding still affect the finished listening experience. Review the output instead of assuming one value suits every destination.',
      ],
      [
        'Can a fade be longer than the clip?',
        'No. Each fade duration must fit within the selected audio segment. Choose the excerpt first and then set fades that leave enough unaffected content, especially when the clip contains a short spoken sentence.',
      ],
      [
        'Does normalization remove background noise?',
        'No. Loudness normalization changes level according to the filter’s analysis and target. It is not a noise-removal or speech-restoration process, so unwanted background sound can remain audible or become more noticeable after level adjustment.',
      ],
      [
        'Is this a broadcast compliance certificate?',
        'No. The tool creates a normalized audio file using its configured filter and settings. It does not provide a standards compliance report; assess the destination’s requirements separately and use appropriate measurement when a formal delivery specification applies.',
      ],
    ],
  ),
  'transcribe-media': guide(
    'Turn a short audio or video excerpt into text with the bundled local Whisper tiny model. Choose plain text, SRT or VTT, and use automatic language detection or a supported language code. The selected audio is limited to 120 seconds, and every transcript needs review for names, timing and recognition errors.',
    [
      'Draft notes from a short voice memo',
      'Create initial subtitles for a video excerpt',
      'Transcribe a brief spoken explanation',
    ],
    [
      [
        'Choose a recording with speech',
        'Upload one supported audio or video containing an audio track. Clear speech with limited background noise gives the small local recognition model a better starting point.',
      ],
      [
        'Select the speech excerpt',
        'Enter start and length in seconds, with a maximum selected length of 120 seconds. Choose the relevant passage rather than expecting transcription of a complete long recording.',
      ],
      [
        'Choose language and text format',
        'Select TXT, SRT or VTT and use auto language detection or a supported language code. Run the tool with the bundled Whisper tiny model available locally.',
      ],
      [
        'Correct the transcript',
        'Download the text or subtitles and review them while listening. Correct names, numbers and missed words, and check cue timing before using the output as captions.',
      ],
    ],
    [
      'Draft captions for a short explanation',
      'A sixty-second video explanation needs initial captions. Select the relevant minute, choose SRT and the known language code, then transcribe. Listen while editing the downloaded cues, correcting technical names and checking each timing boundary before sharing the captioned version.',
    ],
    [
      [
        'How much audio can be transcribed?',
        'The selected segment is limited to 120 seconds. A longer supported source can be used to select a short passage, but this workflow does not automatically divide and transcribe an entire long recording in one operation.',
      ],
      [
        'Are subtitle times relative to the source?',
        'Recognition runs on the extracted audio segment, so SRT and VTT timestamps are relative to that excerpt’s beginning. If you need captions aligned to the original source timeline, adjust the resulting times by the excerpt’s start offset.',
      ],
      [
        'Why can names or numbers be wrong?',
        'Whisper tiny is a small recognition model, and accents, background noise, overlapping speech and unfamiliar terms can produce errors. Treat the transcript as a draft and verify meaningful names, quantities and statements against the actual recording.',
      ],
      [
        'Does the tool work without the local model?',
        'No. It requires the bundled Whisper tiny model files, and reports an error if they are unavailable. Language auto-detection and transcription run through that local model rather than falling back to an unconfigured remote service.',
      ],
    ],
  ),
  'compress-audio': guide(
    'Make a short audio copy with a chosen format and, for lossy outputs, a chosen bitrate. Select a start time and length to keep only the useful segment. Use it for voice excerpts, reference recordings or smaller listening copies, then compare the sound and actual file size before sharing.',
    [
      'Trim a voice recording for review',
      'Create a lower-bitrate MP3 excerpt',
      'Export a short recording as WAV',
    ],
    [
      [
        'Choose the audio recording',
        'Add one supported audio file with a known duration of at most two hours. Check the useful section before choosing a short output segment.',
      ],
      [
        'Select start and length',
        'Enter the segment start and its length in seconds. Length is a duration, not an ending timestamp, and the selected segment is limited to 120 seconds.',
      ],
      [
        'Choose format and bitrate',
        'Select the output format and bitrate for lossy encoding. WAV, FLAC and AIFF do not use the bitrate setting in the same way as MP3 or M4A.',
      ],
      [
        'Encode and listen',
        'Run the tool, download the audio and listen through the start and end. Compare speech clarity and actual size before using the copy in another workflow.',
      ],
    ],
    [
      'A voice excerpt for feedback',
      'A recording contains a useful thirty-second passage beginning at ninety seconds. Enter start 90 and length 30, then choose MP3 at 96 kbps. Download the excerpt and listen for intelligible speech and complete opening and closing words before sending it.',
    ],
    [
      [
        'Does a lower bitrate always improve compression?',
        'For lossy formats, a lower bitrate generally reduces storage per second but can reduce audible detail. The result also depends on duration and format, so listen to the output rather than selecting bitrate solely from the smallest number.',
      ],
      [
        'Why is WAV not smaller at 64 kbps?',
        'WAV and AIFF use uncompressed PCM in this workflow, while FLAC uses lossless encoding. The bitrate control is applied to lossy outputs such as MP3, OGG and M4A, rather than forcing those other formats to a lossy bitrate.',
      ],
      [
        'Is length an end time?',
        'No. Length is the duration after the chosen start. Start 90 and length 30 selects up to thirty seconds beginning ninety seconds into the source, with the actual segment shortened if the recording ends earlier.',
      ],
      [
        'Can this improve an already compressed recording?',
        'Re-encoding cannot restore audio information lost in an earlier compressed source. It can create a more convenient format or smaller excerpt, but repeated lossy encoding may add artefacts, so use the best source you have.',
      ],
    ],
  ),
  'compress-video': guide(
    'Create a shorter or smaller video copy by selecting a segment, maximum width and encoding quality. Choose MP4, WebM, MOV or MKV for the receiving application. This re-encodes the video rather than promising a fixed file size, so review the actual result and playback quality before sharing it.',
    [
      'Make a short video attachment',
      'Reduce a clip’s frame dimensions',
      'Export a demonstration excerpt as MP4',
    ],
    [
      [
        'Choose a supported video',
        'Add one video or GIF source and identify the useful section. Sources need a known duration of at most two hours and supported frame dimensions.',
      ],
      [
        'Set the selected segment',
        'Enter start and length in seconds, keeping the requested length within 120 seconds. The length field describes time after start rather than an absolute end point.',
      ],
      [
        'Choose size and quality',
        'Select output format, maximum width and quality. Lower quality-number values retain more detail, while a smaller width can reduce the amount of video data substantially.',
      ],
      [
        'Encode and review playback',
        'Run the tool and download the result. Check motion, small text, sound and actual size, then adjust the settings if the clip remains larger than your destination allows.',
      ],
    ],
    [
      'A demonstration for an attachment',
      'A long recording contains a twenty-second demonstration starting at forty seconds. Select that segment, choose MP4 with a maximum width of 960 and quality 28. Download and play the result, checking interface readability and the actual attachment size.',
    ],
    [
      [
        'Is there a target file-size setting?',
        'This tool controls format, maximum width, quality and segment duration rather than a target number of KB. Actual size depends on the image content and sound, so compare the output with any destination size requirement.',
      ],
      [
        'Why does a lower quality number look better?',
        'The quality field uses a constant-rate-factor style value: lower numbers request higher visual quality and usually more data. Higher values allow stronger compression, which can introduce visible artefacts in movement, fine texture or small text.',
      ],
      [
        'Will maximum width enlarge a small clip?',
        'The regular video encode uses width as a ceiling and does not enlarge frames that are already smaller. Dimensions are also adjusted for compatible even pixel sizes, so inspect the final output if a destination demands exact dimensions.',
      ],
      [
        'Does this remove the sound?',
        'Ordinary video compression retains an available source audio track. Use Mute video when the intended result must be silent, or Replace video audio when a different recording should accompany the selected visual segment.',
      ],
    ],
  ),
  'transform-video': guide(
    'Create an edited video segment with crop, quarter-turn rotation, speed changes or reversed playback. The tool also provides output format, width and quality controls for the new clip. Use it for focused demonstrations and short motion experiments, with special attention to audio timing and the tighter limits on reversal.',
    [
      'Crop a demonstration to its useful region',
      'Rotate a sideways video',
      'Create a short reversed or accelerated clip',
    ],
    [
      [
        'Choose the useful segment',
        'Upload one supported video and enter start and length. Keep the segment short when reversing, because reversal has stricter duration and decoded-pixel bounds.',
      ],
      [
        'Set crop and orientation',
        'Enter both crop dimensions and their left/top position, or leave both dimensions zero. Select a rotation of zero, ninety, one hundred eighty or two hundred seventy degrees.',
      ],
      [
        'Set playback and encoding',
        'Choose the speed factor and optional reverse, then select output format, maximum width and quality. Run the transformation after checking the crop stays inside the frame.',
      ],
      [
        'Check picture and sound',
        'Download the video and play it through. Inspect crop boundaries and orientation, and listen for the intended speed and direction of the available audio track.',
      ],
    ],
    [
      'A faster cropped demonstration',
      'A ten-second recording shows a task inside a large desktop frame. Set a crop around the application and choose speed two. Export MP4 and review the roughly five-second result, ensuring the accelerated instructions and cropped interface remain understandable.',
    ],
    [
      [
        'What does speed two do?',
        'Speed two plays the selected segment at twice its original rate, reducing its output duration by half. Available audio is adjusted in tempo as well, so listen to the result when spoken content must remain understandable.',
      ],
      [
        'How much video can I reverse?',
        'Reverse is limited to fifteen seconds and sixty-four million decoded pixels. Resolution and source frame rate affect the pixel total, so even a clip shorter than fifteen seconds may require smaller source dimensions or a shorter segment.',
      ],
      [
        'Does rotation happen before cropping?',
        'The crop filter is applied before rotation in this workflow. Enter the rectangle against the source frame’s coordinates, then choose the quarter-turn rotation that should apply to the selected picture area in the finished video.',
      ],
      [
        'Can only one crop dimension be set?',
        'No. Enter both crop width and crop height or leave both at zero for no crop. The complete rectangle, including left and top offsets, must fit inside the original frame rather than requesting extra border area.',
      ],
    ],
  ),
  'join-audio': guide(
    'Combine ordered audio clips into one listening file using a common segment selection for every input. The engine converts selected clips to stereo at 48 kHz before joining them. Choose the output format and bitrate for a short combined recording, with the complete joined output limited to 120 seconds.',
    [
      'Combine short voice takes',
      'Join a set of sound examples',
      'Assemble brief audio excerpts in order',
    ],
    [
      [
        'Add clips in playback order',
        'Choose at least two supported audio files and arrange their upload order. Every input must contain a readable audio track to join successfully.',
      ],
      [
        'Set a shared segment selection',
        'Enter start and length knowing that the same values apply independently to each clip. Use start zero to take the opening portion of every input.',
      ],
      [
        'Choose encoding and join',
        'Select output format and bitrate where applicable, then run the tool. Clips are normalized to stereo 48 kHz and concatenated in the chosen order.',
      ],
      [
        'Listen across the joins',
        'Download the combined file and inspect each transition. Check missing words, abrupt level changes and the total duration before using the joined recording elsewhere.',
      ],
    ],
    [
      'Three brief voice examples',
      'Three recordings each contain a useful opening ten-second example. Add them in presentation order, set start zero and length ten, then export MP3. Listen to the roughly thirty-second result and check that transitions do not cut through spoken words.',
    ],
    [
      [
        'Does length apply to the whole result?',
        'The same start and length are applied to each input separately. Their selected durations are then added together, and the complete joined result must remain within 120 seconds. A shorter source contributes only its available selected duration.',
      ],
      [
        'Can each clip have different trim settings?',
        'This join tool exposes one shared start and length for every clip. If the useful sections differ, prepare each clip separately with the audio trim tool, then join those prepared copies using start zero.',
      ],
      [
        'Does joining normalize loudness?',
        'The join workflow normalizes sample rate and channel layout to stereo 48 kHz; that is different from matching perceived loudness. Use the loudness normalization tool if the completed recording needs a chosen loudness target or fades.',
      ],
      [
        'Are crossfades added between clips?',
        'The clips are concatenated in order without a crossfade control. Listen at each boundary for clicks, pauses or abrupt level changes, and prepare smoother source excerpts if the transitions need a more deliberate edit.',
      ],
    ],
  ),
  'join-video': guide(
    'Assemble ordered video clips into one short video with a consistent 16:9 canvas at 25 frames per second. Each input uses the same start and length settings, with audio normalized and silence supplied for silent clips. The combined output can be up to 120 seconds and uses your chosen video format.',
    [
      'Assemble short demonstration clips',
      'Join portrait and landscape snippets in one canvas',
      'Combine silent and narrated video examples',
    ],
    [
      [
        'Arrange the source clips',
        'Add at least two supported videos and put them in playback order. Every file must contain video, even when some clips have no audio track.',
      ],
      [
        'Set the common excerpt',
        'Enter start and length for each input using the shared controls. Add the selected durations mentally to ensure the combined result stays within 120 seconds.',
      ],
      [
        'Choose the output canvas',
        'Select output format, width and quality, then run the join. Each video is fitted into a 16:9 frame at twenty-five frames per second.',
      ],
      [
        'Review transitions and sound',
        'Download the finished video and check every join. Inspect padding around differing source proportions and listen for silent sections or abrupt changes between the source recordings.',
      ],
    ],
    [
      'A three-clip training example',
      'Three demonstrations need to play together in a single MP4. Add them in teaching order, take the opening fifteen seconds from each and choose width 1280. Review the forty-five-second result for letterboxing, sound transitions and the silent clip’s intended pause.',
    ],
    [
      [
        'Will portrait clips be stretched?',
        'No. Clips are proportionally fitted into a common 16:9 canvas and padded where necessary. A portrait clip will have side space rather than being distorted, so inspect whether its main subject remains large enough to follow.',
      ],
      [
        'What happens to a silent input clip?',
        'A clip with no audio receives a matching silent audio segment. This lets it join with clips that contain sound, but the tool does not add music or narration to fill that silence automatically.',
      ],
      [
        'Can I trim each clip differently?',
        'The start and length settings are shared across all inputs. Prepare clips individually when their useful sections begin at different times, then upload those prepared excerpts in order and join them from start zero.',
      ],
      [
        'Does joining preserve original frame rates?',
        'The joined output uses twenty-five frames per second on the common canvas, rather than retaining a separate source rate for each clip. Review fast movement and screen recordings if matching the original temporal detail matters.',
      ],
    ],
  ),
  'mute-video': guide(
    'Create a video copy without an audio track while choosing a useful segment and output encoding. Select start, length, maximum width and quality to prepare a silent demonstration or visual-only clip. The tool re-encodes the picture and removes sound from the resulting file, which should be checked before publishing.',
    [
      'Remove room sound from a demonstration',
      'Prepare a silent visual loop',
      'Create a video excerpt without narration',
    ],
    [
      [
        'Choose the source video',
        'Add one supported video and identify the section you want to keep. A video that already lacks sound can also be encoded as a silent copy.',
      ],
      [
        'Select the visual segment',
        'Enter start and length in seconds, up to the supported 120-second segment length. These settings determine which portion of the source picture is retained.',
      ],
      [
        'Choose format and mute',
        'Set output format, maximum width and quality, then run Mute video. The output is encoded without mapping a source audio track into the new file.',
      ],
      [
        'Verify the silent output',
        'Download and play the complete clip. Check the selected pictures and confirm that the destination player has no audio from the original recording.',
      ],
    ],
    [
      'A silent product demonstration',
      'A short product recording includes unwanted room conversation. Select its twenty-second demonstration, choose MP4 and an appropriate width, then run Mute video. Play the new file with sound enabled in the player to verify that the recording’s audio is absent.',
    ],
    [
      [
        'Is the audio just turned down?',
        'The output is created without an audio track rather than retaining the original sound at a low volume. This is useful when the saved file should be a silent visual asset in a presentation or page.',
      ],
      [
        'Does muting preserve the original video encoding?',
        'The tool re-encodes the picture using the selected format, width and quality. It is not a stream-copy-only operation, so inspect motion and small details if you need the muted version to remain visually close to the source.',
      ],
      [
        'Can I mute only part of the sound?',
        'This tool removes audio from the complete selected output segment. It does not provide a timeline for muting particular words while retaining other sound. Prepare separate edits in an audio/video editor for that kind of selective treatment.',
      ],
      [
        'How do I add different audio afterward?',
        'Use the downloaded silent video as the first file in Replace video audio, followed by a separate audio file. Choose matching trim settings and review synchronization, since replacing audio is a separate output creation step.',
      ],
    ],
  ),
  'replace-video-audio': guide(
    'Replace a video’s existing sound with a separate audio recording and save a new encoded clip. Upload the video first and the audio second, then select the shared start and length. The replacement is trimmed or padded with silence to fit the selected video duration rather than mixed with the old track.',
    [
      'Add narration to a silent demonstration',
      'Replace unwanted room sound with music',
      'Pair a short visual clip with a separate recording',
    ],
    [
      [
        'Add video followed by audio',
        'Upload exactly two files with the video first and replacement audio second. The first must contain video and the second must contain a readable audio track.',
      ],
      [
        'Set the shared time selection',
        'Enter start and length for the output, remembering that the audio trim also uses those values. Use prepared excerpts when the sources need different starting positions.',
      ],
      [
        'Choose video output settings',
        'Select format, maximum width and quality, then run the replacement. The source video’s audio is replaced, with silence added if the selected replacement sound ends early.',
      ],
      [
        'Listen for synchronization',
        'Download and play the result from beginning to end. Check narration timing, the start position and any silent tail before using the newly paired video and audio.',
      ],
    ],
    [
      'Narration for a silent walkthrough',
      'A twenty-second silent walkthrough needs a separate narration. Prepare the audio so its speech starts at the beginning, upload video first and audio second, and use start zero. Create MP4 and check that each instruction matches the visible action.',
    ],
    [
      [
        'Does replacement mix both soundtracks?',
        'No. The result uses the selected audio from the second file in place of the video’s original track. It does not expose volume mixing between old and new sound, so prepare a combined soundtrack separately if needed.',
      ],
      [
        'What if the replacement audio is too short?',
        'The selected replacement is padded with silence to cover the video duration when needed. This avoids shortening the visual clip, but it can leave an unintended silent ending, so listen through the complete downloaded result.',
      ],
      [
        'Can video and audio use different start values?',
        'There is one shared start setting in this tool. It applies to the video selection and the replacement audio trimming, so prepare separately trimmed source copies when narration should begin at a different source timestamp.',
      ],
      [
        'Can I upload more than two files?',
        'This operation requires exactly two files in role order: video first and replacement audio second. Join or edit multiple audio recordings into one prepared soundtrack before using it as the replacement input here.',
      ],
    ],
  ),
  'audio-waveform': guide(
    'Create a PNG waveform image from a selected audio segment to show how its visible amplitude varies over time. Set the image width and height to fit a document or presentation. Use the result as a visual reference for a recording, with the audio itself retained separately for listening.',
    [
      'Illustrate a voice recording in a report',
      'Create a waveform graphic for a presentation',
      'Compare visible amplitude patterns in short excerpts',
    ],
    [
      [
        'Choose the audio file',
        'Add one supported recording with an audio track. Identify the segment you want represented rather than assuming the image will cover an entire long source.',
      ],
      [
        'Select start and duration',
        'Enter the segment start and length in seconds. The selected waveform excerpt can be up to 120 seconds and must begin before the source ends.',
      ],
      [
        'Choose the graphic dimensions',
        'Set image width and height for the intended layout, then run Audio waveform image. The engine creates one blue waveform graphic as a PNG.',
      ],
      [
        'Inspect the visual reference',
        'Download the PNG and review it at its intended display size. Keep the source audio nearby if the graphic accompanies discussion of a particular recorded moment.',
      ],
    ],
    [
      'A waveform for a voice excerpt',
      'A report needs a graphic for a thirty-second voice sample. Select that excerpt and set an image size of 1200 by 300 pixels. Create the PNG and place it beside the recording description, using the actual audio for any listening assessment.',
    ],
    [
      [
        'Does the waveform contain playable audio?',
        'No. The output is a static PNG graphic showing the selected segment’s waveform. It is suitable for illustration or comparison, but readers need the original audio or a separate audio file to hear the recording.',
      ],
      [
        'Can I choose the waveform colour?',
        'This tool uses a fixed blue waveform style and exposes image dimensions plus segment selection. It does not include a colour or theme control, so make further graphic styling changes in an image editor if required.',
      ],
      [
        'Is this a frequency spectrum?',
        'No. The waveform depicts variation in the audio signal over the selected time interval. It is not a frequency-spectrum analysis, transcription or loudness compliance report, so use specialized analysis for those different questions.',
      ],
      [
        'What happens with a silent recording?',
        'A silent or nearly silent segment produces correspondingly little visible waveform activity. Confirm the source and time selection if the graphic appears empty; the image alone cannot explain whether the quiet section is intentional.',
      ],
    ],
  ),
  'video-thumbnail': guide(
    'Save one video frame as a PNG at a selected timestamp and width. Use it to create a reference still, illustrate a written walkthrough or choose a candidate thumbnail without a manual screenshot. Inspect the extracted moment for motion blur and framing before adding labels or publishing the image.',
    [
      'Select a thumbnail candidate from a video',
      'Capture a still for a walkthrough',
      'Create a reference image from a recorded moment',
    ],
    [
      [
        'Choose the video source',
        'Upload one supported video or GIF with readable video frames. Locate an approximate moment that clearly represents the clip’s subject or the action you want to illustrate.',
      ],
      [
        'Enter the timestamp',
        'Set the timestamp in seconds from the start of the source. Choose a point before the recording ends, with fractional seconds when useful for selecting a moment.',
      ],
      [
        'Set image width and extract',
        'Choose the output width and run Video thumbnail. The engine decodes one frame around that position and scales it proportionally into a PNG image.',
      ],
      [
        'Check the chosen moment',
        'Download and inspect the still at the intended display size. Try a nearby timestamp if the frame catches a blink, motion blur or an incomplete transition.',
      ],
    ],
    [
      'A reference still for a tutorial',
      'A tutorial recording shows the completed result around eighteen seconds. Enter timestamp 18 and width 800, then extract the PNG. Inspect the labels and cursor position, and try a nearby timestamp if a menu or transition obscures the final state.',
    ],
    [
      [
        'Does this create a thumbnail grid?',
        'No. This tool extracts one PNG frame at the chosen timestamp. Use Extract video or GIF frames when you want several sampled moments packaged together, then select or arrange those images into a contact sheet.',
      ],
      [
        'Can I get an exact source frame number?',
        'The control uses a timestamp in seconds rather than a frame-number index. Seeking and decoding determine the extracted frame around that point, so try nearby fractional timestamps when choosing a precise expression or a clear action state.',
      ],
      [
        'Does the output keep the source aspect ratio?',
        'Yes. The selected width is used with proportional height scaling, so the still retains the source frame’s proportions. This tool does not expose a thumbnail crop; use the image crop tool afterward for a different rectangle.',
      ],
      [
        'What if the timestamp is beyond the end?',
        'The timestamp must be before the media ends. Check the source duration and enter an earlier value; a long source still needs a known supported duration so the engine can validate and decode the requested frame.',
      ],
    ],
  ),
  'gif-maker': guide(
    'Build an animation from ordered image files using a shared canvas and a fixed delay for each image. Choose GIF, animated WebP or APNG, set canvas dimensions and control looping. This is useful for simple product sequences, slide-like explainers or a short animated comparison without a video timeline editor.',
    [
      'Animate a sequence of product views',
      'Make a short image-based explainer',
      'Create a looping before-and-after comparison',
    ],
    [
      [
        'Arrange the source images',
        'Add at least two supported images and put them in playback order. Start with still frames when you want one predictable animation frame per file.',
      ],
      [
        'Set canvas and timing',
        'Enter the canvas width and height, then set the per-image delay in milliseconds. Images are proportionally fitted on a transparent canvas without stretching.',
      ],
      [
        'Choose animation output',
        'Select GIF, WebP or APNG and the loop behaviour. Check start and length as well, because these controls can select only part of the assembled sequence.',
      ],
      [
        'Create and play the result',
        'Run the tool and download the animation. Play the complete sequence to check frame order, timing, padding and whether the loop behaves as intended.',
      ],
    ],
    [
      'A four-view product loop',
      'Four still product views need a simple rotating showcase. Add them in view order, choose a 480 by 480 canvas and a 500 millisecond delay. Export GIF with continuous looping and check that every view remains visible inside the padded canvas.',
    ],
    [
      [
        'Does frame delay apply to every input?',
        'The selected delay applies to each decoded frame used by the maker. Still input images provide a predictable frame sequence; animated inputs can contribute several frames, so review the total playback duration when combining them.',
      ],
      [
        'Are different image proportions stretched?',
        'No. Each frame is fitted within the shared canvas and centred with transparent padding. Select canvas proportions that suit the whole sequence, since unusually wide or tall inputs may appear much smaller than other frames.',
      ],
      [
        'How long can the animation be?',
        'Animation output is limited to thirty seconds, two hundred forty frames and sixty-four million decoded pixels. Canvas size, frame count and delay all affect those bounds, so reduce one of them if the sequence is too large.',
      ],
      [
        'Why is only part of my sequence present?',
        'The start and length settings select a window from the assembled animation. Check that start is zero and length covers your intended sequence, while staying within the duration and frame limits supported by the tool.',
      ],
    ],
  ),
  'animation-to-video': guide(
    'Convert a GIF, animated WebP or APNG into a regular video clip for a presentation or video workflow. Select a short segment, maximum width, quality and a solid background for transparency. The result has no audio track, so it works as a visual clip rather than a narrated video.',
    [
      'Insert a GIF sequence as an MP4',
      'Make an animation playable in a video workflow',
      'Flatten transparent animation over a chosen colour',
    ],
    [
      [
        'Add the source animation',
        'Choose one GIF, animated WebP or APNG. Inspect its length and select a useful segment instead of expecting every loop repetition to become video content.',
      ],
      [
        'Set the segment and appearance',
        'Enter start and length, maximum width and a six-digit background colour for transparency. Choose the video format and quality appropriate to the destination application.',
      ],
      [
        'Encode the video clip',
        'Run the conversion and wait for the new video. Transparent areas are composited onto the chosen background and the output is created without audio.',
      ],
      [
        'Check playback and framing',
        'Download and play the video in the intended destination. Verify timing, colour behind transparent areas and the selected segment’s first and last visible frames.',
      ],
    ],
    [
      'A short GIF in a slide deck',
      'A five-second transparent GIF needs to play as MP4 in a presentation. Select a white background and a segment covering the animation, then convert. Play the MP4 inside the deck to confirm that the flattened background blends with the slide.',
    ],
    [
      [
        'Will the video preserve transparency?',
        'This workflow places transparent areas over the selected solid background and encodes a regular video. Choose a background colour suited to the destination, because the downloaded clip does not retain an editable transparent animation layer.',
      ],
      [
        'Does the result include audio?',
        'No. Animation-to-video output is explicitly created without an audio track. To pair it with narration or music, use the resulting video with the Replace video audio tool and review the new clip’s timing.',
      ],
      [
        'Why does maximum width not enlarge the video?',
        'The regular video encoder treats width as a maximum and avoids enlarging an already smaller frame in this workflow. Choose a suitable source size and inspect the output instead of assuming the field forces a specific larger resolution.',
      ],
      [
        'Can every animated WebP be converted?',
        'Animated WebP and APNG pass through the bounded animation decoder before video encoding. Inputs must satisfy its frame, duration and decoded-pixel limits, so a very large animation may need a smaller or shorter source export.',
      ],
    ],
  ),
  'animation-convert': guide(
    'Move a short animation between GIF, animated WebP and APNG while controlling maximum width, looping and the selected time window. Use it to prepare a format suited to a browser, document or messaging workflow. Compare playback and transparency after conversion because animation formats handle colours and timing differently.',
    [
      'Make an animated WebP from a GIF',
      'Export an APNG for a compatible application',
      'Create a smaller-width copy of an animation',
    ],
    [
      [
        'Choose the animation source',
        'Upload one GIF, WebP, APNG or supported PNG image. Check that the intended motion is present in the file before changing its output format.',
      ],
      [
        'Choose format and width',
        'Select GIF, WebP or APNG and set the maximum width. Smaller frames reduce the decoded-pixel load and may make the output easier to share.',
      ],
      [
        'Select timing and looping',
        'Enter start and length for the portion you want. Keep loop at minus one to use source behaviour, or choose the available explicit loop setting.',
      ],
      [
        'Create and compare playback',
        'Run the conversion, download the animation and play it through. Check frame timing, transparent edges, palette changes and the loop behaviour in the destination viewer.',
      ],
    ],
    [
      'A GIF converted for web use',
      'A short looping GIF needs a WebP version for a compatible page. Select WebP, a maximum width of 480 and source loop behaviour. Create the output and compare its visual quality, actual size and playback with the original GIF.',
    ],
    [
      [
        'Does conversion always make the file smaller?',
        'No. File size depends on frame content, dimensions, timing and the selected format. Animated WebP can be useful for some artwork, while APNG may retain sharp transparent graphics at a larger size. Compare the actual result.',
      ],
      [
        'What does loop minus one mean?',
        'Minus one uses the source animation’s loop behaviour when that information is available. Zero requests continuous looping, and positive values request the selected loop count. Check playback in the application that will display the output.',
      ],
      [
        'Are the original frame delays kept?',
        'The converter uses source frame delays for the selected time window, subject to supported minimum timing and encoding behaviour. Different viewers can still interpret very short delays differently, so test fast animations in their intended destination.',
      ],
      [
        'Which limits apply to conversion?',
        'The animation workflow permits up to two hundred forty decoded frames, thirty seconds of output and sixty-four million decoded pixels. Large dimensions multiplied across many frames can exceed the pixel bound before reaching the frame-count limit.',
      ],
    ],
  ),
  'video-to-animation': guide(
    'Turn a selected video moment into a silent GIF, animated WebP or APNG. Choose start time, length, width and frame rate to balance motion smoothness against animation size. It is useful for short demonstrations or previews where a lightweight looping visual is more convenient than a full video player.',
    [
      'Create a looping interface demonstration',
      'Make a short product-motion preview',
      'Share a silent excerpt as animated WebP',
    ],
    [
      [
        'Choose the video moment',
        'Add one supported video or GIF source and identify the useful start point. Keep the intended excerpt short enough for a compact animation.',
      ],
      [
        'Set length and sampling',
        'Enter start, length and frames per second. Duration multiplied by frame rate must fit within the two-hundred-forty-frame export bound before encoding begins.',
      ],
      [
        'Choose format and dimensions',
        'Select GIF, WebP or APNG and the output width. Keep the complete decoded frame sequence within sixty-four million pixels and thirty seconds of animation.',
      ],
      [
        'Generate and inspect motion',
        'Run the conversion and download the animation. Check smoothness, first and last frames and loop timing; reduce width or frame rate if the result is unnecessarily large.',
      ],
    ],
    [
      'A five-second interface preview',
      'A screen recording contains a useful five-second interaction starting at twelve seconds. Enter start 12, length 5 and 10 frames per second, then choose WebP at width 480. Review the resulting fifty-frame animation for readable interface labels and a sensible loop.',
    ],
    [
      [
        'Will the animation contain sound?',
        'No. GIF, animated WebP and APNG are image animations in this workflow, and audio is not included. Keep a regular video format when spoken instructions, music or other sound is essential to understanding the excerpt.',
      ],
      [
        'How do I reduce output size?',
        'Use a shorter segment, lower frame rate or smaller width. These choices reduce the number of encoded pixels and motion samples. Preview the result so that reducing size does not make text unreadable or movement too abrupt.',
      ],
      [
        'Why is my selected frame rate rejected?',
        'The selected duration and frame rate together must produce no more than two hundred forty frames, and decoded pixels are also bounded. A frame rate valid by itself may exceed those limits when paired with a long or large clip.',
      ],
      [
        'Does a twelve-second segment at ten fps fit?',
        'That combination requests about one hundred twenty frames, within the frame-count bound. It must also satisfy duration and decoded-pixel bounds, so a very wide or tall frame can still require a smaller output width.',
      ],
    ],
  ),
  'extract-frames': guide(
    'Sample still frames from a video or GIF and download them together in a ZIP. Choose a segment, sampling rate, width and PNG or JPG output to create reference images without taking manual screenshots. Use the frame set for review, contact sheets or selecting a useful visual moment.',
    [
      'Collect reference frames from a clip',
      'Create screenshots at regular intervals',
      'Find candidate stills for a contact sheet',
    ],
    [
      [
        'Add a video or GIF',
        'Choose one supported source with a known duration. Identify the segment whose frames you need rather than sampling an entire long file unnecessarily.',
      ],
      [
        'Choose sampling and size',
        'Enter start, length, frames per second and maximum width. The export is limited to two hundred forty frames and sixty-four million decoded pixels.',
      ],
      [
        'Select a frame format',
        'Choose PNG for sharp image content or JPG for photographic reference frames. Run the extraction to encode the sampled frames and package them in a ZIP.',
      ],
      [
        'Inspect the frame collection',
        'Download and unpack the ZIP, then review the numbered images in sequence. Check sampling density and dimensions before selecting frames for a report or contact sheet.',
      ],
    ],
    [
      'Regular stills from a demonstration',
      'A ten-second demonstration needs one reference image per second. Set start to the demonstration’s beginning, length 10 and frame rate 1, then export PNG at width 800. Unpack the ZIP and choose the clearest frames for a written walkthrough.',
    ],
    [
      [
        'Does this save every source frame?',
        'The selected frames-per-second setting samples the video at that rate rather than guaranteeing every original frame. Increase the rate for denser sampling, while keeping the resulting frame count and decoded-pixel total within the export bounds.',
      ],
      [
        'What is included in the ZIP?',
        'The ZIP contains numbered PNG or JPG still images from the selected segment. It does not contain a reconstructed video, audio track or separate animation project, so use it as a collection of image assets.',
      ],
      [
        'Why can a short export exceed limits?',
        'Decoded pixels depend on frame dimensions multiplied by the sampled frame count. A short but high-resolution sequence can exceed sixty-four million pixels even below two hundred forty frames; reduce width or sampling rate to fit.',
      ],
      [
        'Which frame format is best for a screen recording?',
        'PNG is often useful for interface text and sharp lines because it avoids JPEG compression artefacts. JPG can be suitable for photographic footage when smaller reference images matter more than perfectly crisp text or edges.',
      ],
    ],
  ),
  'compress-gif': guide(
    'Try to reduce a GIF toward a requested size in KB by limiting its palette and reducing frame dimensions across a bounded search. Choose the useful time window and maximum width first. The result reports whether the target was reached and returns the smallest valid animation found during the attempts.',
    [
      'Reduce a GIF for an attachment limit',
      'Make a smaller-width reaction animation',
      'Trim and compress a short interface GIF',
    ],
    [
      [
        'Choose the source GIF',
        'Upload one GIF within the animation decoding bounds. Check its useful content and avoid retaining long pauses or unrelated frames when a short excerpt will suffice.',
      ],
      [
        'Set target and palette',
        'Enter target KB, maximum palette colours and maximum width. A lower colour limit can reduce size but may simplify gradients, shadows and photographic texture.',
      ],
      [
        'Choose timing and compress',
        'Set start, length and looping, then run the tool. It tries up to six combinations of palette and dimension reduction within the supported bounds.',
      ],
      [
        'Review the target status',
        'Download the result and check whether the target was met. Play the animation to inspect reduced dimensions, colour banding and readability before accepting the smaller copy.',
      ],
    ],
    [
      'A GIF for a 500 KB attachment',
      'A short interface GIF needs to fit a 500 KB attachment limit. Set the target to 500, reduce maximum width to 480 and try 128 colours. Check the reported status and make sure small labels are still readable in the returned animation.',
    ],
    [
      [
        'Is the KB target guaranteed?',
        'No. The tool tries six bounded reductions and returns the smallest valid GIF found. If that remains above the requested size, the result reports that the target was not met rather than claiming a successful size match.',
      ],
      [
        'Will compression keep the same dimensions?',
        'Not necessarily. The search can reduce frame dimensions as well as palette size. Inspect the returned width and visible detail if the GIF must fit a specific layout, and consider a less restrictive target when necessary.',
      ],
      [
        'What does the colour setting control?',
        'It limits the GIF palette used during the compression search. Fewer colours can reduce storage but introduce banding or altered shading, particularly in photographs. Flat interface graphics often tolerate palette reduction better than textured footage.',
      ],
      [
        'Can I get WebP from this tool?',
        'This compression tool produces GIF output. Use the animation converter when you want to compare animated WebP or APNG, since changing the format is a different decision from searching for a smaller GIF at a particular target.',
      ],
    ],
  ),
  'edit-animation': guide(
    'Crop a short animation, select a playback window, change speed or reverse its frame order, then export GIF, WebP or APNG. Set both crop dimensions when trimming the picture area. This is useful for focusing a demonstration or creating a short reversed motion while retaining an animated image format.',
    [
      'Crop an animated interface demonstration',
      'Reverse a short animation',
      'Create a faster excerpt from a GIF',
    ],
    [
      [
        'Choose an animated source',
        'Add one GIF, animated WebP or APNG within the decoding bounds. Check its frame size before entering crop coordinates or choosing a smaller output width.',
      ],
      [
        'Set crop and playback speed',
        'Enter left, top, crop width and crop height, or leave both dimensions at zero. Choose a speed factor and enable reverse if required.',
      ],
      [
        'Choose the time window',
        'Set start and length with the speed-adjusted timeline in mind. Choose output format, maximum width and loop behaviour, then run Create output.',
      ],
      [
        'Play the edited result',
        'Download and play the complete output. Check that the crop fits every frame, the selected window contains the intended motion and reversing produces a useful sequence.',
      ],
    ],
    [
      'A focused loop from a demonstration',
      'An animation includes interface borders around the useful action. Enter a crop inside the source frame, keep speed at one and select a three-second window. Export WebP, then check every frame for clipped labels and a smooth return at the loop boundary.',
    ],
    [
      [
        'How are speed and trimming combined?',
        'Frame delays are adjusted by the selected speed before the time window is selected. Start and length therefore refer to that speed-adjusted timeline. Review the result when changing speed, since an earlier trim choice may select different content.',
      ],
      [
        'Must both crop dimensions be entered?',
        'Yes. Set both crop width and crop height to positive values, or leave both at zero to keep the picture area unchanged. The crop rectangle must remain inside the source frame rather than extending into added padding.',
      ],
      [
        'Does reverse change the source file?',
        'Reverse changes the selected output frame sequence and its associated delays. The tool writes a new animation file, so keep the source available if you want a different crop, playback direction or timing choice later.',
      ],
      [
        'Can I edit a long animation?',
        'The workflow is bounded to two hundred forty decoded frames, sixty-four million decoded pixels and thirty seconds of output. A large source may exceed decoding limits before a short trim can be selected, requiring a smaller source export.',
      ],
    ],
  ),
  'remove-background': guide(
    'Separate the main subject from a photograph and save it on a transparent PNG background. A local segmentation model estimates the subject mask, with a soft edge by default and an optional cutoff. Use the result for product layouts or presentation cutouts, then inspect delicate edges before placing it.',
    [
      'Prepare a product cutout',
      'Isolate a portrait for a slide',
      'Remove a simple photo background',
    ],
    [
      [
        'Choose a clear photograph',
        'Add one supported still image with a distinct subject, within sixteen million pixels. Good separation between the subject and background gives the model a clearer task.',
      ],
      [
        'Choose edge behaviour',
        'Leave mask cutoff at zero for soft edges, or set a cutoff to turn the estimated mask into a harder selection around the subject.',
      ],
      [
        'Create the transparent cutout',
        'Run Create output to apply the local subject mask. The result is a transparent PNG, and existing source transparency is retained in the combined mask.',
      ],
      [
        'Inspect the subject edges',
        'Download the PNG and examine hair, holes and low-contrast edges against a contrasting background. Refine the cutout elsewhere if the automatic mask misses important details.',
      ],
    ],
    [
      'A product cutout for a slide',
      'A small product photograph needs to sit on a coloured presentation slide. Leave the cutoff at zero and create the transparent PNG. Place it over the slide colour and inspect reflections, fine handles and the outer edge for unwanted background remnants.',
    ],
    [
      [
        'What does mask cutoff change?',
        'Zero keeps the model’s soft mask, including partially transparent edges. A nonzero cutoff converts the mask to a harder selection. That can remove faint background but can also make hair or other fine details look abrupt.',
      ],
      [
        'Can I choose the subject manually?',
        'The tool estimates the subject with a local U²-Net small segmentation model. It does not provide a painted selection or manual subject picker, so difficult scenes may need further editing after the PNG is created.',
      ],
      [
        'Why are some edges imperfect?',
        'Fine hair, transparent materials and low contrast between subject and background can confuse segmentation. Inspect the PNG over its intended background, since an edge that looks acceptable on white may reveal remnants on a dark slide.',
      ],
      [
        'What image size is supported?',
        'Background removal accepts at most sixteen million input pixels. The broader still-image limit does not override this smaller model-specific bound; resize a larger photo while retaining useful subject detail before trying it here.',
      ],
    ],
  ),
  'photo-background': guide(
    'Keep the estimated subject while blurring the original background, replacing it with a solid colour or using another image. Adjust the segmentation cutoff and the relevant background settings to create a new PNG. This works best for clear subjects, with a final edge check against the chosen replacement.',
    [
      'Blur a portrait’s surroundings',
      'Place a product on a solid colour',
      'Replace a photo background with another image',
    ],
    [
      [
        'Add the subject first',
        'Upload the subject photo first. For image replacement, add exactly one replacement background as the second file; blur and solid-colour modes use the subject alone.',
      ],
      [
        'Select the background treatment',
        'Choose blur, solid colour or second image. Set blur radius or background colour where relevant, and leave cutoff at zero to retain a soft subject mask.',
      ],
      [
        'Create the composite PNG',
        'Run Create output. The local model estimates the subject, then places it over the selected background treatment while fitting an uploaded background to the photo dimensions.',
      ],
      [
        'Review the composite edges',
        'Download the PNG and inspect hair, transparent objects and contact edges. Check whether the replacement’s lighting and colours suit the subject before using the final image.',
      ],
    ],
    [
      'A portrait on a neutral background',
      'A portrait has a distracting room behind it. Choose solid-colour mode and a light neutral background, keeping the soft mask initially. Create the PNG and check the hair and shoulder edges before placing the portrait in a team page layout.',
    ],
    [
      [
        'Which uploaded image supplies the background?',
        'In image mode, the first file supplies the subject and the second supplies the replacement background. The replacement is fitted to the original photo dimensions, so its own edges may be cropped to fill the area.',
      ],
      [
        'Does blur affect the subject?',
        'The tool blurs a copy of the original photo behind the estimated foreground. The mask aims to keep the subject sharp, but segmentation mistakes can leave blurred edges or retain small background regions around a difficult subject.',
      ],
      [
        'Can this create a transparent cutout?',
        'This tool composites the estimated subject over a background treatment and exports PNG. Use Remove background when your intended result is the subject with transparent surroundings for later placement over multiple different backgrounds.',
      ],
      [
        'How should I prepare a large photo?',
        'The subject photo must remain within sixteen million pixels for segmentation. Resize larger photos first, and prefer a clear, well-separated subject so the model can estimate its outline without relying on tiny ambiguous details.',
      ],
    ],
  ),
  'ai-upscale': guide(
    'Enlarge a small still image using local FSRCNN neural super-resolution at two or four times its width and height. Optional denoising and local contrast enhancement can change texture as well as size. Use it for modest source images and compare the generated PNG closely with the original detail.',
    [
      'Enlarge a small product photo',
      'Prepare a larger copy of a compact illustration',
      'Try denoising before neural enlargement',
    ],
    [
      [
        'Choose a small source',
        'Upload one supported still image of no more than one million pixels. Keep the original available so you can judge whether the generated texture is useful.',
      ],
      [
        'Set enlargement and denoising',
        'Choose two-times or four-times scaling. Set denoise strength to zero to disable it, or increase it cautiously when noise competes with useful fine detail.',
      ],
      [
        'Run the local model',
        'Enable local contrast enhancement if needed and run Create output. The CPU model enlarges each dimension by the selected factor and produces a PNG.',
      ],
      [
        'Compare actual detail',
        'Download the PNG and compare edges, faces and textures at similar viewing sizes. Check for artificial patterns or smoothing before using the image in a layout.',
      ],
    ],
    [
      'A small image for a larger mockup',
      'An 800 by 600 product photo needs a larger mockup copy. Select two-times enlargement and light denoising, then create the PNG. The output is 1600 by 1200 pixels; inspect product lettering and textured surfaces before accepting the enlargement.',
    ],
    [
      [
        'What do two-times and four-times mean?',
        'The factor applies to both width and height. Four-times scaling therefore creates sixteen times as many pixels. A one-million-pixel source can produce a sixteen-million-pixel result, which is the maximum output bound for this workflow.',
      ],
      [
        'Does the model recover original detail?',
        'The model estimates an enlarged image from the source pixels. It can improve perceived edges, but it cannot establish details that were never recorded. Check text, faces and fine patterns instead of treating generated texture as original information.',
      ],
      [
        'When should denoising be disabled?',
        'Set denoising to zero when the source is already clean or when fine texture is more important than smoothing. Stronger denoising can remove grain along with useful details, especially before a large enlargement factor.',
      ],
      [
        'Why can I not upload a large photo?',
        'The local CPU super-resolution workflow accepts at most one million input pixels and sixteen million output pixels. These model-specific bounds are smaller than the standard still-image limit and help keep processing and memory requirements bounded.',
      ],
    ],
  ),
  'scan-cleanup': guide(
    'Improve a photographed document using automatic page perspective correction, small-angle deskew and a choice of black-and-white, grayscale or colour cleanup. The output is a new PNG image suited to reading or a later OCR step. Review page borders and handwriting because automatic cleanup can remove useful faint marks.',
    [
      'Straighten a photographed printed page',
      'Improve contrast before English OCR',
      'Create a clearer grayscale receipt scan',
    ],
    [
      [
        'Choose one page image',
        'Add a supported still scan of no more than sixteen million pixels. A clearly visible page boundary helps the automatic perspective detector identify the document.',
      ],
      [
        'Select geometry correction',
        'Enable page perspective correction for an angled photograph and deskew for small text-line tilts. Disable a correction when the original framing is already accurate.',
      ],
      [
        'Choose cleanup and run',
        'Select black and white, clean grayscale or contrast-enhanced colour. Run Create output to apply the chosen corrections and save a cleaned PNG image.',
      ],
      [
        'Check retained page content',
        'Download the result and compare its borders, faint writing and small print with the original. Confirm the page detector has not cropped away necessary content.',
      ],
    ],
    [
      'A photographed page before OCR',
      'A printed page is photographed at a slight angle with uneven lighting. Enable perspective and deskew, then try black-and-white cleanup. Inspect the PNG for lost punctuation or handwriting before sending the clearer image to the English OCR tool.',
    ],
    [
      [
        'Does cleanup recognize the document text?',
        'No. Cleanup changes the image’s geometry and appearance and exports PNG. To obtain text or a searchable PDF, pass the cleaned image through the separate English OCR tool after checking that the content remains intact.',
      ],
      [
        'Which cleanup mode retains colour?',
        'Contrast-enhanced colour retains a colour image while adjusting local contrast. Grayscale removes colour, and black-and-white thresholding simplifies the page most aggressively. Choose the mode according to whether colour or faint markings carry useful information.',
      ],
      [
        'Why was the page border detected incorrectly?',
        'Automatic perspective detection depends on clear page edges and a plausible document contour. Background objects, shadows or a clipped page can confuse it. Disable perspective correction when the detected geometry removes or distorts required content.',
      ],
      [
        'Can cleanup restore unreadable handwriting?',
        'Cleanup can improve contrast but does not reconstruct missing strokes or guarantee handwriting readability. Aggressive thresholding may remove faint marks, so compare the result with the original and prefer grayscale or colour when subtle tones matter.',
      ],
    ],
  ),
  'psd-export': guide(
    'Get a cached merged preview from a PSD or PSB, or export available rasterized layers in a ZIP with their positions. Choose PNG or JPG for the preview and use the layer package for inspection or reuse. Photoshop-specific effects, fonts and adjustments may differ from the original editing environment.',
    [
      'Preview a supplied Photoshop document',
      'Export raster layer images for inspection',
      'Recover layer positions from a packaged manifest',
    ],
    [
      [
        'Choose the Photoshop file',
        'Add one PSD or PSB within the decoded image bounds. For preview mode, the document must include a cached composite saved by its author.',
      ],
      [
        'Select preview or layers',
        'Choose merged preview for one image, or Layer PNG ZIP for available raster layer exports. Select PNG or JPG when creating the merged preview.',
      ],
      [
        'Export the available pixels',
        'Run Create output. Preview uses the cached composite; layer mode writes raster images and a layers.json manifest with names, positions, visibility and opacity.',
      ],
      [
        'Check the intended representation',
        'Download the result and inspect it against your expectations. For layers, use the manifest positions and remember that the PNGs are raster exports rather than editable Photoshop objects.',
      ],
    ],
    [
      'Inspecting a design handoff',
      'A designer sends a PSD and a colleague needs its visible composition for review. Choose merged preview and PNG. If the file lacks a cached preview, ask its author to save with compatibility enabled; layer export provides a different representation of available content.',
    ],
    [
      [
        'Why can a PSD have no preview?',
        'A PSD may be saved without a cached merged composite. Preview mode requires that stored representation and reports its absence. The author can save the document with Photoshop’s compatibility option enabled to include an appropriate composite preview.',
      ],
      [
        'Are text layers still editable?',
        'No. Layer exports are raster PNG images, including any text that can be rasterized from the stored layer content. They do not preserve editable type, Photoshop adjustment controls or the full behaviour of effects and smart objects.',
      ],
      [
        'How do I position exported layers?',
        'The ZIP includes layers.json with each exported layer’s bounds and related properties. Use those positions when reconstructing a composition, while reviewing effects and visibility because raster layer exports can differ from Photoshop’s complete final rendering.',
      ],
      [
        'How many layers can be exported?',
        'Layer mode permits up to one hundred descendant layers, with additional total pixel and output-size bounds. A document with groups or large raster layers can therefore reach a limit before producing a useful full export.',
      ],
    ],
  ),
  'svg-optimize': guide(
    'Reduce unnecessary SVG markup and numeric precision while retaining viewBox, element IDs and accessibility attributes. Choose compact or readable formatting for a self-contained icon or illustration. The result remains SVG, making it useful for source control or web delivery after a visual comparison with the original artwork.',
    [
      'Compact a self-contained web icon',
      'Reduce excess precision in an SVG illustration',
      'Make optimized SVG source easier to review',
    ],
    [
      [
        'Add a self-contained SVG',
        'Upload one SVG whose required artwork is contained in the file. External resources or active content must be removed before using this optimisation workflow.',
      ],
      [
        'Choose precision and formatting',
        'Set numeric precision from one to eight digits and enable readable formatting if needed. Lower precision can reduce source size but may affect delicate geometry.',
      ],
      [
        'Optimize the SVG source',
        'Run Create output to simplify the markup under the supported preservation rules. The tool keeps the viewBox, accessibility attributes and element IDs needed by downstream uses.',
      ],
      [
        'Compare rendering and references',
        'Download the SVG and compare it with the original at small and large sizes. Check important element references and any fine curves affected by reduced numerical precision.',
      ],
    ],
    [
      'A smaller icon source for a website',
      'A self-contained SVG icon has long coordinate decimals and verbose formatting. Choose precision three and compact formatting, then create the output. Compare its outline at normal icon size and a larger zoom before replacing the website asset.',
    ],
    [
      [
        'Can lower precision change the drawing?',
        'Yes. Rounding coordinates can slightly change curves, narrow gaps or alignment, particularly in detailed artwork. Use a higher precision when geometry is sensitive and compare the rendered output instead of judging success from file size alone.',
      ],
      [
        'Will viewBox and IDs be removed?',
        'This optimiser retains viewBox, element IDs and accessibility attributes under its configured preservation rules. Still check the result in its destination if scripts, styles or references elsewhere depend on particular details of the SVG markup.',
      ],
      [
        'Does it download linked fonts or images?',
        'No. The input must be self-contained, and the workflow rejects unsupported external or active resources. Embed or simplify required artwork in the authoring application before optimising the SVG for use in a page or application.',
      ],
      [
        'Is readable formatting the smallest output?',
        'Readable formatting adds whitespace to make source easier to inspect, while compact output is more appropriate when minimising markup size matters. Both modes use the selected numeric precision and should be checked visually before deployment.',
      ],
    ],
  ),
  'svg-sprite': guide(
    'Combine self-contained SVG icons into one reusable symbol sprite with predictable names. Choose a prefix, arrange the source files and let the tool namespace internal IDs so definitions from different icons do not collide. The output is useful when integrating a small icon collection into a website or application.',
    [
      'Bundle navigation icons into one sprite',
      'Avoid collisions between icon gradient IDs',
      'Create predictable symbol names for an icon set',
    ],
    [
      [
        'Add the SVG icons',
        'Upload the self-contained SVG files in the intended symbol order. Remove external resource dependencies so each icon can be represented within the combined sprite.',
      ],
      [
        'Choose a symbol prefix',
        'Choose a prefix beginning with a letter and containing only letters, digits, underscores or hyphens. Symbols follow upload order with numbered names such as icon-1 and icon-2.',
      ],
      [
        'Build the combined sprite',
        'Run Create output to create reusable SVG symbols. Internal IDs and references are namespaced separately for each icon to reduce collisions in the combined document.',
      ],
      [
        'Integrate and test symbols',
        'Download the SVG sprite and reference its generated symbols in your website. Check icon sizing, colour behaviour and any gradients or clipping paths in the destination layout.',
      ],
    ],
    [
      'A navigation icon collection',
      'Five navigation icons use overlapping internal gradient names. Upload them in menu order and choose nav as the prefix. The sprite provides nav-1 through nav-5 with isolated internal references; render each symbol in the navigation before replacing the individual files.',
    ],
    [
      [
        'How are symbol names chosen?',
        'The prefix is followed by a hyphen and the one-based upload position, such as nav-1. Arrange sources consistently if application code relies on those names, since changing order changes which drawing belongs to each numbered symbol.',
      ],
      [
        'What happens to duplicate internal IDs?',
        'Each icon’s internal IDs and their references are namespaced for that icon. This helps separate gradients, clipping paths and other definitions that would otherwise collide when multiple independently authored SVG files share the same ID names.',
      ],
      [
        'Can I use SVGs with linked assets?',
        'Inputs must be self-contained SVGs, each with a viewBox or numeric width and height. Linked external artwork or active resources are unsupported, so simplify the icons before combining them into a reusable symbol sprite.',
      ],
      [
        'Does creating a sprite update my website?',
        'The result is a downloadable SVG asset. You still need to add it to your project and reference the generated symbol IDs in your markup or components, then verify rendering in the layout where those icons are used.',
      ],
    ],
  ),
  'compress-image': guide(
    'Prepare a photo or graphic for an upload form with a size limit in KB. This tool searches compression settings and can also reduce dimensions when allowed. Choose JPG, PNG or WebP, then check the actual output size and whether your requested target was reached.',
    [
      'Fit a profile photo under an upload limit',
      'Reduce a product photo for a listing',
      'Make a screenshot easier to attach',
    ],
    [
      [
        'Choose the image',
        'Add one still JPG, PNG, WebP, AVIF or TIFF image. Use the original photo when available so compression starts with the most useful detail.',
      ],
      [
        'Set a realistic target',
        'Enter the maximum size in KB and select JPG, PNG or WebP. Allow smaller dimensions if keeping the original pixel count is less important.',
      ],
      [
        'Compress the copy',
        'Run Compress image and wait for the size search to finish. The engine tries supported quality settings and, when permitted, several smaller dimensions.',
      ],
      [
        'Check size and appearance',
        'Review whether the target was met, then download the result. Check small text, faces and edges before submitting the image to your destination.',
      ],
    ],
    [
      'A photo for a 100 KB form',
      'A large portrait needs to fit a form with a 100 KB limit. Choose JPG, set 100 KB and permit resizing. Download the result only after checking the reported target status and that the face remains clear.',
    ],
    [
      [
        'Is the target size guaranteed?',
        'No. The search uses a bounded range of quality settings and optional smaller dimensions. If none meets the target, the tool returns its smallest candidate and reports that the target was missed.',
      ],
      [
        'Why can PNG look different?',
        'PNG compression here can reduce the colour palette. That can make a screenshot smaller, but gradients or photographs may show colour changes. Compare the result at normal viewing size before using it.',
      ],
      [
        'Should I allow resizing?',
        'Allow resizing when the upload limit matters more than the original dimensions. Leave it disabled when another application requires a fixed pixel size, and consider a more suitable format or a less restrictive target.',
      ],
      [
        'Does JPG keep transparency?',
        'JPG cannot store transparent areas. The tool places transparency on white when producing JPG, so select PNG or WebP when the image needs a transparent background for use over other colours.',
      ],
    ],
  ),
  'resize-image': guide(
    'Create an image at the pixel dimensions needed by a website, presentation or application. Choose how the source fits the new rectangle: preserve it with padding, crop to fill, stretch, or fit inside. Export a new JPG, PNG or WebP and inspect the resulting dimensions.',
    [
      'Prepare a 1200 by 800 product image',
      'Fit a logo into a square canvas',
      'Resize a photograph for a presentation',
    ],
    [
      [
        'Add a still image',
        'Choose one supported still image and check its orientation. Starting with a source larger than the requested result usually preserves more visible detail.',
      ],
      [
        'Enter dimensions and fit',
        'Set width and height in pixels, then choose the fit behaviour. Use padding to keep every edge or cropping to fill the canvas completely.',
      ],
      [
        'Choose output and background',
        'Select JPG, PNG or WebP and the available padding background. Remember that JPG turns transparent areas white when the new image is encoded.',
      ],
      [
        'Save and inspect',
        'Run the resize, download the new file and check its pixel dimensions. Inspect the crop or padding to confirm the subject is framed correctly.',
      ],
    ],
    [
      'A consistent product card',
      'A landscape product photo must occupy a 1200 by 800 card. Enter those dimensions and use fit with padding to retain the whole product. Choose a white background and JPG, then check the downloaded image for unexpected margins.',
    ],
    [
      [
        'Which fit keeps the whole image?',
        'Fit with padding preserves the complete image within the requested rectangle, adding background where the proportions differ. Fit inside also preserves proportions but can produce dimensions smaller than one of the requested sides.',
      ],
      [
        'What does fill and crop remove?',
        'The image is scaled until the requested rectangle is covered, then excess content at the edges is trimmed. Review the resulting framing carefully when a face, logo or caption lies near a border.',
      ],
      [
        'Will enlarging improve detail?',
        'Increasing dimensions creates additional pixels through resampling. It does not recover detail that the source never contained. For small photographs, choose a sensible display size and inspect the output rather than relying on pixel count alone.',
      ],
      [
        'How large can the output be?',
        'Width and height can each be up to 8192 pixels, but their product must stay within 40 million pixels. A very wide image may therefore need a smaller height than the individual field maximum.',
      ],
    ],
  ),
  'crop-image': guide(
    'Remove unwanted edges, isolate a subject or straighten the orientation of a still image. Select a rectangle using the preview or precise pixel coordinates, then apply rotation and flipping to that selection. Save the cropped result as JPG, PNG or WebP for your next task.',
    [
      'Remove a screenshot border',
      'Create a tighter portrait crop',
      'Rotate and mirror a scanned graphic',
    ],
    [
      [
        'Load the image',
        'Choose one supported still image and inspect the oriented preview. The coordinates refer to the displayed orientation rather than an unrotated camera sensor layout.',
      ],
      [
        'Select a rectangle',
        'Drag a crop on the preview or enter left, top, width and height in pixels. Keep the entire selected rectangle within the image boundaries.',
      ],
      [
        'Set orientation and format',
        'Choose any rotation or flip you need and select the output format. Cropping happens first, so rotation changes the orientation of the selected area.',
      ],
      [
        'Save the selected area',
        'Run Save cropped image, then inspect the downloaded result. Check that important edges remain visible and that any rotation or mirroring has the intended direction.',
      ],
    ],
    [
      'A clean screenshot excerpt',
      'A screenshot includes a useful chart surrounded by browser controls. Select the chart rectangle, leave rotation at zero and export PNG. The result contains only the selected area, ready to insert into a report without the surrounding interface.',
    ],
    [
      [
        'Are the crop coordinates before rotation?',
        'Yes. The tool selects the crop rectangle from the image in its display orientation, then rotates and flips that cropped region. Enter coordinates for the original preview, not the expected dimensions after rotation.',
      ],
      [
        'Can I crop outside the image?',
        'No. Left and top locate the rectangle inside the source, and its width and height must fit the remaining space. A selection extending beyond the image is rejected rather than padded automatically.',
      ],
      [
        'Does this crop every animation frame?',
        'This tool accepts still images only and rejects animated or multipage inputs. Use the animation editing tool for GIF, animated WebP or APNG when the crop needs to remain consistent through playback.',
      ],
      [
        'Which format suits a screenshot?',
        'PNG is useful for screenshots with text, sharp lines or transparent areas. JPG can reduce photographic file sizes but uses lossy encoding and replaces transparency with white. Inspect small labels after saving either format.',
      ],
    ],
  ),
  'merge-pdf': guide(
    'Combine several PDF documents into one file in a chosen reading order. Arrange the uploaded files before merging; pages inside each source keep their existing sequence. This is useful for assembling a cover letter, report and supporting pages into a single attachment of up to 100 pages.',
    [
      'Combine a cover letter and report',
      'Assemble monthly statements',
      'Bundle project handover documents',
    ],
    [
      [
        'Add the source PDFs',
        'Select at least two working, unprotected PDF documents. Check that the combined page count stays at or below the limit of 100 pages.',
      ],
      [
        'Arrange document order',
        'Move the uploaded documents into the intended sequence. Put a cover sheet first and supporting material last; pages within each source are kept together.',
      ],
      [
        'Create the combined document',
        'Run Merge PDFs after confirming the file order. The engine copies pages from each document into a new PDF without asking you to reprint them.',
      ],
      [
        'Review the finished PDF',
        'Download the merged document and inspect transitions between source files. Confirm that every expected page appears and that the first and last pages are correct.',
      ],
    ],
    [
      'One project delivery attachment',
      'A delivery package contains a two-page cover note, a twelve-page report and four supporting pages in separate PDFs. Add the files in that order and merge them. Review the resulting eighteen-page PDF before attaching it to the delivery message.',
    ],
    [
      [
        'Can I reorder pages within a source?',
        'The merge tool controls document order and keeps each source document internally unchanged. To move individual pages, first use Reorder PDF pages on the relevant source, or reorder the complete merged document afterward.',
      ],
      [
        'How many pages can I combine?',
        'The complete merged PDF can contain up to 100 pages. The tool checks the accumulated count while adding documents, so several individually valid files can still exceed the combined limit when merged together.',
      ],
      [
        'Do signatures and forms carry over?',
        'Page content is copied, but interactive forms, bookmarks and digital signatures may not carry over as expected. Inspect those features in the downloaded document and retain the source files when their interactive behaviour matters.',
      ],
      [
        'Can I merge password-protected PDFs?',
        'Use working, unprotected PDFs for this operation. If you know a document password, create an unlocked copy with the dedicated unlock tool first, then add that copy in the intended merge position.',
      ],
    ],
  ),
  'split-pdf': guide(
    'Extract useful pages from a PDF without manually recreating the document. Enter page numbers and ascending ranges, then choose a single PDF containing the selection or a ZIP with one PDF per page. Use it to separate sections, share a short excerpt or archive individual pages.',
    [
      'Share selected report pages',
      'Separate a packet into individual PDFs',
      'Keep only a document appendix',
    ],
    [
      [
        'Choose the source PDF',
        'Upload one working, unprotected PDF with no more than 100 pages. Check the document page numbers so your selection matches the actual file positions.',
      ],
      [
        'Describe the page selection',
        'Enter individual pages and ascending ranges, such as 1-3, 5. Leave the selection blank to include every page from the source document.',
      ],
      [
        'Choose the result structure',
        'Select one PDF to keep the selected pages together, or separate pages to receive a ZIP. The ZIP contains PDF documents rather than page images.',
      ],
      [
        'Download the selected pages',
        'Run Split PDF and save the output. Open the PDF or unpack the ZIP, then confirm the selection contains the intended pages and readable content.',
      ],
    ],
    [
      'An excerpt for a colleague',
      'A thirty-page report has a useful introduction on pages 1-3 and a summary on page 25. Enter 1-3, 25 and choose one PDF. The downloaded excerpt contains those four selected pages without the rest of the report.',
    ],
    [
      [
        'What does a blank selection do?',
        'A blank page selection includes all pages in the source. In separate-pages mode this creates one PDF per page inside a ZIP; in extract mode it keeps all pages together in a new PDF.',
      ],
      [
        'Are these printed page numbers?',
        'Selections use the physical page positions in the PDF, starting at one. A document with a cover or Roman-numeral introduction may display different labels, so check page positions in your PDF viewer before extracting.',
      ],
      [
        'Will separate pages become images?',
        'No. Separate-pages mode creates individual PDF files and packages them in a ZIP. If you need PNG or JPG page images, use a PDF rendering workflow rather than the PDF splitting operation.',
      ],
      [
        'Can a range run backward?',
        'Use ascending ranges such as 4-8, with every number inside the source document. Backward or out-of-bounds ranges are rejected. The separate Reorder PDF tool is more appropriate for explicitly rearranging a document sequence.',
      ],
    ],
  ),
  'images-to-pdf': guide(
    'Assemble photographs, receipts or screenshots into one PDF, with one image on each page. Arrange the images in reading order and choose A4, Letter or original-size pages with a margin. Each picture keeps its proportions so the finished document can be reviewed and shared easily.',
    [
      'Bundle receipt photographs',
      'Create a screenshot walkthrough',
      'Combine scanned image pages',
    ],
    [
      [
        'Add the page images',
        'Select up to twenty supported still images. Choose one image for each intended page and avoid animated or multipage files that need a separate export.',
      ],
      [
        'Arrange reading order',
        'Move the images into the sequence readers should follow. Put the opening page first and check any filename numbering against the visible upload order.',
      ],
      [
        'Choose paper and margins',
        'Select A4, Letter or original-size pages and set the margin. Images fit inside the available page area without stretching their original proportions.',
      ],
      [
        'Create and review the PDF',
        'Run Create PDF and download the document. Check the page sequence, image clarity and margins, especially when screenshots contain small text or receipt totals.',
      ],
    ],
    [
      'A receipt packet for expenses',
      'Six photographed receipts need to be submitted as one document. Add them in date order, choose A4 and a modest margin, then create the PDF. Review all six pages to ensure each total and receipt date remains legible.',
    ],
    [
      [
        'How many images can I add?',
        'You can combine up to twenty still images, with one image per PDF page. The selection also has a total decoded pixel limit, so very large photographs may need resizing before they fit together.',
      ],
      [
        'Will wide images be stretched?',
        'No. Each image is fitted proportionally inside its page margins. A4 and Letter pages switch to landscape for wide images, and any remaining space appears as page background rather than a distorted picture.',
      ],
      [
        'What happens to transparent areas?',
        'Transparent image areas appear against the white PDF page background. Review logos or diagrams that were designed for a dark background, since white text or pale details may become difficult to see.',
      ],
      [
        'Does this make scans searchable?',
        'This operation places image content on PDF pages; it does not recognize text. For a scanned document that needs selection or search, create the PDF and then use the English OCR tool afterward.',
      ],
    ],
  ),
  'heic-converter': guide(
    'Make a still HEIC or HEIF photo usable in an application that expects JPG, PNG or WebP. The converter decodes the photo and writes a new image file, making it useful for attachments, publishing and everyday editing. Choose the output according to compatibility, transparency and size needs.',
    [
      'Attach a phone photo to a form',
      'Open a HEIF photo in an older editor',
      'Prepare a WebP copy for a website',
    ],
    [
      [
        'Add the phone photo',
        'Choose one HEIC or HEIF still image. If the original contains several frames, export a single photograph first rather than expecting a sequence conversion.',
      ],
      [
        'Choose the image format',
        'Select JPG for broad compatibility, PNG for a lossless raster copy or WebP for a modern web image. The output choice changes the encoding.',
      ],
      [
        'Convert the photograph',
        'Run Create output and let the engine decode the HEIC or HEIF content. A renamed file with unrelated contents will not be accepted.',
      ],
      [
        'Check the new copy',
        'Download the converted image and open it in the application you intend to use. Check orientation, colour and any fine photographic detail before publishing.',
      ],
    ],
    [
      'A phone photo for a document',
      'A colleague receives a HEIC photograph that their document editor cannot insert. Select JPG and convert the still photo. The new JPG can be inserted as a normal image; review its orientation and crop in the document afterward.',
    ],
    [
      [
        'Does this convert Live Photo video?',
        'This converter processes a still HEIC or HEIF image. It does not export the moving portion of a Live Photo or combine paired photo and video files. Choose a still photo export when preparing the input.',
      ],
      [
        'Which output should I choose?',
        'JPG is widely usable for photographs, PNG avoids additional lossy image encoding, and WebP suits applications that support that format. The best choice depends on the destination application rather than the original filename alone.',
      ],
      [
        'Can I convert an image sequence?',
        'No. Animated and multipage inputs are rejected by these still-image tools. Export the specific frame you need from the source application, then convert that still image within the decoded pixel limit.',
      ],
      [
        'Will every camera variant work?',
        'The file must be decodable as HEIC or HEIF and remain within the still-image limits. A valid extension alone does not ensure support for every variant; an unsupported file produces an explicit conversion error.',
      ],
    ],
  ),
  'bmp-converter': guide(
    'Convert a BMP into a format that is easier to share, or create a genuine BMP for software that requires it. JPG, PNG, WebP and other supported raster sources can be decoded and re-encoded. This changes the image container and encoding rather than simply renaming a file.',
    [
      'Create a BMP for legacy software',
      'Turn a BMP screenshot into PNG',
      'Make a JPG copy of a large bitmap',
    ],
    [
      [
        'Choose a supported raster',
        'Add one supported still image, including BMP when you want another format. Check that the source is the image version you want to preserve.',
      ],
      [
        'Select the destination format',
        'Choose BMP, PNG, JPG or WebP from the output menu. Use BMP only when the receiving application specifically benefits from that image format.',
      ],
      [
        'Create the image copy',
        'Run Create output to decode and encode the pixels. The source is checked as an actual image, so changing its extension alone is insufficient.',
      ],
      [
        'Verify the destination application',
        'Download the result and open it where it will be used. Inspect transparency and colours, particularly when switching from a transparent PNG to BMP.',
      ],
    ],
    [
      'A bitmap for an older utility',
      'An older utility requires a BMP background but the supplied artwork is PNG. Add the PNG, choose BMP and create the output. Open the resulting BMP in the utility and check the white treatment of any transparent regions.',
    ],
    [
      [
        'Is the BMP output a renamed PNG?',
        'No. The tool decodes the source image and writes BMP image data. The result is checked as an image after encoding, so its contents correspond to the selected output format rather than merely its extension.',
      ],
      [
        'Will BMP make a smaller file?',
        'Not necessarily. BMP commonly needs more storage than formats designed for compressed photographic or web delivery. Choose PNG, JPG or WebP when compact sharing matters, and compare the actual output size for your image.',
      ],
      [
        'Does BMP preserve transparent pixels?',
        'This BMP export converts the image to RGB and places transparent content on white. If the receiving workflow needs transparency, choose PNG or WebP and check that the destination application supports the selected format.',
      ],
      [
        'Can I convert a multipage TIFF?',
        'These image conversions accept still, single-image inputs. A multipage TIFF must first be exported as the individual still image you need. That avoids silently losing pages when moving to a format with different capabilities.',
      ],
    ],
  ),
  'icon-favicon': guide(
    'Create an ICO containing several useful icon sizes, extract an icon to PNG, or assemble a favicon ZIP for a website. The source image is fitted into a square canvas with transparent padding. Choose a clean mark that remains recognisable when reduced to a small browser icon.',
    [
      'Create a website favicon package',
      'Export an ICO as a PNG image',
      'Make a multi-size icon for a desktop shortcut',
    ],
    [
      [
        'Choose a clear source mark',
        'Upload one supported raster image or ICO. Prefer a simple, well-framed mark because small favicon sizes cannot retain the detail of a full illustration.',
      ],
      [
        'Choose the export mode',
        'Select multi-size ICO, ICO to PNG or favicon ZIP. For PNG output, set the requested square size between sixteen and five hundred twelve pixels.',
      ],
      [
        'Build the icon files',
        'Run Create output. The artwork is proportionally padded to a square, and the chosen mode produces either one image file or a packaged set.',
      ],
      [
        'Inspect the smallest icon',
        'Download the result and check a small icon size as well as the large preview. For a ZIP, inspect the included files before adding them to a website.',
      ],
    ],
    [
      'A favicon set for a small site',
      'A square company mark needs browser and mobile icon files. Choose favicon ZIP and create the package. It includes favicon.ico, several PNG sizes and a site.webmanifest, which can be integrated into the website after reviewing the small-size appearance.',
    ],
    [
      [
        'Which sizes are inside the ICO?',
        'The ICO includes images at 16, 32, 48, 64 and 256 pixels. Keeping several sizes in one file allows compatible applications to choose an appropriate representation rather than scaling a single large bitmap.',
      ],
      [
        'What does the favicon ZIP contain?',
        'The ZIP contains the multi-size ICO, PNG icons including 180, 192 and 512 pixels, and a site.webmanifest. Downloading the package does not automatically configure a site; add the files and references in your website project.',
      ],
      [
        'Will a wide logo be cropped?',
        'The source is fitted into a square with transparent padding, retaining its proportions. A very wide wordmark can therefore become tiny at favicon scale; a separate simplified symbol usually remains easier to recognise.',
      ],
      [
        'Does PNG size change the ICO?',
        'The PNG size setting applies to the PNG export mode. Multi-size ICO uses its predefined size set, and the favicon pack generates its own collection of ICO and PNG files for common icon uses.',
      ],
    ],
  ),
  'jfif-converter': guide(
    'Turn JPEG image content saved with a JFIF extension into a new JPG or PNG that fits a stricter upload workflow. The converter reads the actual photograph and re-encodes it, so the result is an ordinary image file that can be opened, attached or inserted elsewhere.',
    [
      'Submit a JFIF photo as JPG',
      'Convert a downloaded image to PNG',
      'Prepare a JFIF image for a document editor',
    ],
    [
      [
        'Choose the JPEG image',
        'Add one JFIF, JPG or JPEG still image. Confirm the photograph is the intended source and is not an unrelated download with an image extension.',
      ],
      [
        'Select JPG or PNG',
        'Choose JPG for a familiar photographic file or PNG for a lossless raster encoding of the decoded pixels. Neither choice recovers previously discarded JPEG detail.',
      ],
      [
        'Create the converted file',
        'Run Create output to decode the JPEG content and write the selected format. The converter checks image contents rather than relying only on the filename.',
      ],
      [
        'Open the new image',
        'Download the output and try it in the upload form or editor that rejected the JFIF. Inspect orientation and fine details in the saved copy.',
      ],
    ],
    [
      'A downloaded picture for an upload form',
      'A downloaded photograph is saved as .jfif while a form accepts .jpg. Add the photograph, select JPG and create the output. Submit the resulting JPG after checking its dimensions and any separate size limit imposed by the form.',
    ],
    [
      [
        'What is the difference from renaming?',
        'Renaming changes only the filename extension. This converter decodes the JPEG image and writes a new JPG or PNG, which is useful when you need a verified output file rather than an extension change alone.',
      ],
      [
        'Does PNG restore lost JPEG quality?',
        'No. PNG preserves the decoded pixel image without another lossy JPEG encoding, but it cannot restore details already lost in the source JPEG. The resulting file may also be substantially larger than the original photograph.',
      ],
      [
        'Can I use a normal JPG here?',
        'Yes. JPG and JPEG are accepted alongside JFIF because they contain the same broad type of JPEG image data. Choose PNG when changing format or JPG when you need a newly encoded photographic copy.',
      ],
      [
        'Will the result fit every form?',
        'A JPG extension solves only one compatibility requirement. A destination may also enforce dimensions, aspect ratio or file size. Inspect its requirements and use the resize or compression tools if those additional changes are needed.',
      ],
    ],
  ),
  'jxl-converter': guide(
    'Decode a still JPEG XL image and save a JPG, PNG or WebP copy for applications that cannot open JXL. This is useful when receiving newer image formats or preparing artwork for familiar editing tools. The conversion keeps a still image workflow and rejects animated source files.',
    [
      'Open a received JXL in an older editor',
      'Create a JPG attachment from JPEG XL',
      'Prepare a PNG copy of JXL artwork',
    ],
    [
      [
        'Add the JXL image',
        'Select one still JPEG XL file and confirm it is the artwork you need. Animated JPEG XL inputs are outside this converter’s supported workflow.',
      ],
      [
        'Choose a usable output',
        'Select JPG, PNG or WebP according to the receiving application. Use PNG or WebP if preserving an existing transparent background is important to your design.',
      ],
      [
        'Decode and create output',
        'Run Create output and let the JPEG XL decoder read the file. The image must satisfy the still-image pixel bounds before it can be exported.',
      ],
      [
        'Review the converted image',
        'Download the new copy and inspect it in the target editor. Check colour, transparency and sharp edges because different encodings can change the visible result.',
      ],
    ],
    [
      'Artwork for a PNG-only workflow',
      'A supplied illustration arrives as JPEG XL, but a presentation workflow needs PNG. Add the still JXL, select PNG and create the output. Inspect the transparent edges in the downloaded PNG before placing it over a coloured slide background.',
    ],
    [
      [
        'Can this create JPEG XL files?',
        'This tool accepts JPEG XL as its input and exports JPG, PNG or WebP. It is intended to make an existing JXL usable elsewhere; the output menu does not offer a JPEG XL encoder.',
      ],
      [
        'Are animated JXL files supported?',
        'No. The converter explicitly supports still JPEG XL images and rejects animated inputs. Export the required frame from an application that understands the original animation before using this still-image conversion workflow.',
      ],
      [
        'Which output keeps transparency?',
        'PNG and WebP can represent transparent image areas, while JPG replaces them with white in this export. Select a format supported by your destination and inspect edge pixels against the background where the image will appear.',
      ],
      [
        'Does the copy preserve every JXL feature?',
        'The output is a newly encoded raster image in the selected format. It should be reviewed as that image, rather than assumed to retain every feature or metadata property of the original JPEG XL container.',
      ],
    ],
  ),
  'raw-converter': guide(
    'Develop a supported camera RAW photograph into a JPG or PNG using the camera white balance and an sRGB colour output. Use it to obtain an ordinary image for review, sharing or documents. This is a direct development workflow rather than a full editor with exposure and lens controls.',
    [
      'Preview a supported camera RAW photograph',
      'Make a JPG for sharing a shoot selection',
      'Create a PNG copy for further image editing',
    ],
    [
      [
        'Choose the camera original',
        'Add one supported CR2, CR3, NEF, ARW, DNG, RAF, ORF, RW2 or PEF file. Support depends on the actual camera variant and decoder compatibility.',
      ],
      [
        'Select JPG or PNG',
        'Choose JPG for a convenient viewing copy or PNG for a lossless encoding of the developed pixels. Development uses camera white balance and sRGB.',
      ],
      [
        'Develop the RAW photograph',
        'Run Create output to decode the sensor image and develop the preview copy. Unsupported camera variants fail explicitly instead of producing a falsely labelled image.',
      ],
      [
        'Compare the developed result',
        'Download the image and review colour and exposure. Keep the camera original available if you later need manual RAW adjustments or a different development interpretation.',
      ],
    ],
    [
      'A contact image from a camera file',
      'A photographer supplies a supported NEF and a colleague only needs a viewing copy for a draft layout. Choose JPG and develop it. Review the resulting sRGB photo before using it, and keep the NEF for later photographic adjustments.',
    ],
    [
      [
        'Can I adjust exposure or white balance?',
        'This workflow uses the camera white balance during development and outputs sRGB. It does not expose a manual exposure, white-balance or lens-correction panel. Use a dedicated RAW editor when those photographic decisions are part of the task.',
      ],
      [
        'Does a listed extension guarantee support?',
        'No. Camera formats can contain variants that differ by model and compression method. The local LibRaw decoder must support the actual file, and unsupported variants are reported explicitly even if their extension appears in the input list.',
      ],
      [
        'Is the result still a RAW file?',
        'No. JPG and PNG contain developed image pixels rather than the original sensor data. Retain the camera original for future development choices; changing the output image later cannot recreate the full RAW workflow.',
      ],
      [
        'What colour output is produced?',
        'Development uses camera white balance and sRGB with an eight-bit image output. This makes an ordinary viewing or editing copy, but it is not a substitute for a colour-managed RAW development workflow requiring different output characteristics.',
      ],
    ],
  ),
  'image-vectorize': guide(
    'Trace a raster illustration into SVG paths that can be selected and edited in a vector application. Choose colour tracing or a black-and-white silhouette, adjust colour precision and remove small speckles. Simple logos and high-contrast shapes generally produce more manageable results than detailed photographic textures.',
    [
      'Trace a simple raster logo',
      'Create a silhouette from a high-contrast graphic',
      'Convert flat artwork into editable paths',
    ],
    [
      [
        'Prepare a small clear image',
        'Upload one supported raster image of no more than four million pixels. Prefer clean edges and a simple background for a more useful trace.',
      ],
      [
        'Choose tracing behaviour',
        'Select colour or black and white, then set colour precision and speckle removal. More detail can create more shapes, while filtering removes tiny regions.',
      ],
      [
        'Generate the SVG paths',
        'Run Create output and wait for tracing to finish. The tool checks that the result contains vector paths rather than merely embedding the source bitmap.',
      ],
      [
        'Inspect and refine the trace',
        'Download the SVG and open it in a vector editor. Check small features, path complexity and colours, then refine shapes manually where the automatic trace needs help.',
      ],
    ],
    [
      'A silhouette for a small badge',
      'A high-contrast black mark is available only as PNG. Select black-and-white tracing and moderate speckle removal to avoid retaining isolated dots. Download the SVG, inspect the outer contour and adjust any small openings in a vector editor before producing the badge.',
    ],
    [
      [
        'Is the SVG an embedded photograph?',
        'No. The tracer creates SVG paths and verifies that the output contains paths rather than an embedded bitmap. The visual approximation still depends on the source and tracing settings, so detailed textures can become many small shapes.',
      ],
      [
        'How does colour precision affect output?',
        'Colour precision controls how finely colours are distinguished during a colour trace. Higher precision can retain more variation but may increase complexity. Try a lower setting for flat artwork when tiny colour differences are not useful.',
      ],
      [
        'What does speckle removal do?',
        'Speckle filtering removes small traced regions according to the chosen setting. It can clean dust and isolated pixels, but a high value can also remove intentional dots or fine features, which should be checked in the result.',
      ],
      [
        'Why is the input limited to four million pixels?',
        'Tracing creates geometry from pixel regions and is more demanding than a simple raster conversion. The four-million-pixel bound keeps the operation manageable; resize a large source while retaining clear edges before tracing it here.',
      ],
    ],
  ),
  'resize-print-image': guide(
    'Prepare an image for a measured print area by entering millimetres, centimetres or inches and a DPI value. The tool converts those physical measurements into whole-pixel dimensions, then crops, pads or stretches the source as selected. Save a JPG or PNG with the chosen print resolution metadata.',
    [
      'Prepare a 10 by 15 cm photograph',
      'Fit artwork to a measured label',
      'Create an image at a specified print DPI',
    ],
    [
      [
        'Choose the print image',
        'Add a supported still raster image. Check that its resolution is suitable for the intended physical size, since increasing pixels cannot restore missing source detail.',
      ],
      [
        'Enter measured dimensions',
        'Set width, height, units and print DPI. These values determine the output pixel dimensions, rounded to whole pixels within the forty-million-pixel output bound.',
      ],
      [
        'Choose the fitting method',
        'Select centre crop, pad to fit or stretch, and choose the padding colour when relevant. Export PNG or JPG according to your print workflow.',
      ],
      [
        'Create and check the file',
        'Run Create output and inspect the downloaded image. Check its framing and print-size settings in the application that will place it on paper.',
      ],
    ],
    [
      'A photograph for a measured frame',
      'A photo must fill a 10 by 15 cm frame at 300 DPI. Enter those measurements, choose centre crop and JPG, then create the output. Review the crop carefully so the frame does not cut off a face or an important edge.',
    ],
    [
      [
        'How are physical sizes converted to pixels?',
        'The tool converts the chosen unit to inches, multiplies by DPI and rounds each side to a whole pixel. Small rounding differences are expected because raster images cannot store fractional pixel widths or heights.',
      ],
      [
        'Does 300 DPI guarantee a sharp print?',
        'No. DPI describes the relationship between pixels and printed size. A source with too little detail can still look soft after resizing, so inspect the image and choose a physical size appropriate to the source quality.',
      ],
      [
        'Which fit avoids trimming artwork?',
        'Pad to fit keeps the whole image within the measured rectangle and fills remaining space with the selected padding colour. Centre crop fills the rectangle by trimming excess edges; stretch changes proportions to match both dimensions.',
      ],
      [
        'Can I request any physical dimensions?',
        'The controls permit a range of physical dimensions and DPI values, but the computed output must remain within forty million pixels. Very large measurements at high DPI may exceed that bound even when each field accepts its value.',
      ],
    ],
  ),
  'passport-signature': guide(
    'Create an exact-size image for a photo or signature upload using pixel dimensions, print DPI and an optional KB target. Choose a centre crop or padded fit, then export JPG or PNG. The controls help satisfy technical file requirements; you still need to check the receiving organisation’s specifications.',
    [
      'Resize a portrait to specified pixels',
      'Prepare a signature image for a form',
      'Create a photo copy with print DPI metadata',
    ],
    [
      [
        'Add a suitable source',
        'Choose one still image with the complete face or signature visible. Read the destination’s technical requirements before entering dimensions or choosing a crop.',
      ],
      [
        'Set pixels and fit',
        'Enter the required width, height and DPI, then select centre crop or padded fit. Check whether padding or trimmed edges are acceptable for your destination.',
      ],
      [
        'Choose format and target',
        'Select JPG or PNG and enter a target in KB if needed. Use zero for no target; JPG can vary quality while retaining the chosen dimensions.',
      ],
      [
        'Review technical suitability',
        'Run Create output and inspect the saved copy and target status. Check dimensions, framing, file size and the destination’s requirements before submitting the image.',
      ],
    ],
    [
      'A signature with fixed dimensions',
      'A form asks for a 600 by 200 pixel signature image. Enter those dimensions, choose padded fit and export PNG to keep the complete signature visible. If a size limit also applies, check the actual file size before uploading it.',
    ],
    [
      [
        'Does this guarantee passport-photo acceptance?',
        'No. Exact dimensions and a file-size target do not establish compliance with rules about expression, background, lighting or composition. Check the current requirements of the receiving organisation and inspect the final image against them.',
      ],
      [
        'Can the target KB change dimensions?',
        'This tool preserves the width and height you request. With JPG it tries lower encoding quality to reach the KB target; if that is insufficient, the result reports the target status rather than silently shrinking the dimensions.',
      ],
      [
        'Does PNG use the same target search?',
        'No. The bounded quality search is used for JPG. PNG is encoded and checked against the target, but the image is not automatically rescaled or repeatedly palette-reduced to force a particular size in this tool.',
      ],
      [
        'When should I use padded fit?',
        'Use padded fit when the full signature or portrait must remain visible and added border space is acceptable. Centre crop fills the exact rectangle by trimming edges, which can remove parts of a wide signature.',
      ],
    ],
  ),
  'image-watermark': guide(
    'Place a text label or uploaded logo over a photograph and save a flattened image copy. Control the position and opacity, with font size and colour for text or relative width for a logo. Use it for visible attribution, draft labels or consistent branding on image previews.',
    [
      'Add attribution to a photo preview',
      'Place a logo on a product image',
      'Mark a draft image with a text label',
    ],
    [
      [
        'Choose files in role order',
        'For text, add the photograph alone. For logo mode, add exactly two images with the photograph first and the logo second in the upload list.',
      ],
      [
        'Configure the visible mark',
        'Select text or logo mode and a position. Enter text and font settings or choose the logo width percentage, then adjust the watermark opacity.',
      ],
      [
        'Composite the new image',
        'Choose an output format and run Create output. The mark is composited into the image pixels, creating a new flattened copy of the photograph.',
      ],
      [
        'Check contrast and placement',
        'Download the result and inspect the mark at the intended display size. Check that it remains readable without covering a face, product detail or important caption.',
      ],
    ],
    [
      'A subtle logo on a product preview',
      'Add a product photograph followed by a transparent logo. Choose logo mode, bottom-right placement, twenty percent logo width and fifty percent opacity. Create the output and review the logo against the photo’s colours before sharing the preview.',
    ],
    [
      [
        'Which image is used as the logo?',
        'In logo mode, the first uploaded file is the photograph and the second is the logo. Exactly two images are required, so check their visible order before processing to avoid placing the photo over the logo.',
      ],
      [
        'Can I change the watermark later?',
        'The downloaded image contains a composited mark in its pixels rather than an editable watermark layer. Keep the original photograph and logo separately if you expect to change text, position or opacity for a later version.',
      ],
      [
        'What does logo width measure?',
        'The logo width setting is a percentage of the photograph’s width. The logo keeps its own proportions when resized, so a tall logo can occupy substantial height even at a modest percentage of the photo width.',
      ],
      [
        'Will the mark prevent copying?',
        'A visible watermark can communicate attribution or draft status, but it does not prevent someone from saving the image. Choose its placement for your intended presentation and retain original files for any later editing workflow.',
      ],
    ],
  ),
  'image-collage': guide(
    'Combine several photographs into one grid or row using consistent cells, spacing and background colour. Uploaded images fill their cells in order from left to right, with centre cropping where proportions differ. Adjust the grid dimensions to make a comparison sheet, contact image or compact visual summary.',
    [
      'Create a before-and-after image row',
      'Arrange product photos into a grid',
      'Make a simple contact sheet',
    ],
    [
      [
        'Add and order the pictures',
        'Select between two and twenty supported still images. Arrange them in reading order because cells are filled left to right and then down each row.',
      ],
      [
        'Set the collage geometry',
        'Choose the number of columns, cell width, cell height and spacing. Each image fills its cell, so choose cell proportions suited to the content.',
      ],
      [
        'Choose background and output',
        'Pick the background colour for gaps and select PNG, JPG or WebP. Keep the complete collage within the maximum of forty million output pixels.',
      ],
      [
        'Create and inspect every cell',
        'Run Create output and download the collage. Check image order, centre crops and empty space at the end of a partly filled final row.',
      ],
    ],
    [
      'A six-photo product overview',
      'Six product photos need one compact overview. Choose three columns, 600 by 600 pixel cells and a small white gap. Create the collage and inspect each centre crop, replacing or recropping source photos where an important product edge was lost.',
    ],
    [
      [
        'How is image order determined?',
        'Images are placed in their upload-list order, moving left to right across each row. When a row is full the next image starts the following row, so arrange the list before creating the final collage.',
      ],
      [
        'Are images stretched into cells?',
        'No. Each image is fitted to fill its cell with its proportions retained, which means edges can be cropped. For a subject near the edge, prepare a suitable source crop or choose a more accommodating cell shape.',
      ],
      [
        'Can I make a single row?',
        'Yes. Set the number of columns to the number of images, within the column control’s maximum. The cell dimensions and gap determine the resulting row width, which must still fit within the total output pixel bound.',
      ],
      [
        'Does spacing include an outer border?',
        'Yes. Spacing is added between cells and around the outer edge of the collage. The overall dimensions therefore include the cell areas plus these gaps, which matters when planning a precise width for a layout.',
      ],
    ],
  ),
  'image-dpi': guide(
    'Inspect an image’s print-resolution information or write a new DPI value to a JPG or PNG copy. You can change only the print metadata or resample pixels to preserve the interpreted printed size. This distinction helps when preparing images for layouts that use DPI to determine placement dimensions.',
    [
      'Check a photograph’s stored DPI',
      'Write 300 DPI metadata for a layout',
      'Resample while retaining an interpreted print size',
    ],
    [
      [
        'Choose the source image',
        'Add one supported still raster image. If the original has no stored DPI, remember that resampling uses a seventy-two-DPI assumption for its calculations.',
      ],
      [
        'Inspect or write DPI',
        'Select Inspect DPI for a JSON report, or Write DPI for an image output. Enter the requested DPI only when creating a new image copy.',
      ],
      [
        'Decide whether to resample',
        'Leave resampling off to retain the pixel dimensions, or enable it to scale pixels according to the old and new print-resolution values.',
      ],
      [
        'Check the resulting interpretation',
        'Run Create output and download the report or image. In a print-layout application, confirm both pixel dimensions and the physical size inferred from the stored DPI.',
      ],
    ],
    [
      'A layout-ready copy without extra pixels',
      'A designer needs an image tagged at 300 DPI while preserving its pixel dimensions. Choose Write DPI, enter 300 and leave resampling disabled. Export JPG or PNG, then check the size at which the layout application places the new copy.',
    ],
    [
      [
        'Does writing DPI improve image detail?',
        'No. Writing DPI without resampling changes print metadata, not pixel information. The same pixels may be interpreted as a smaller or larger physical print, but missing texture or detail is not recovered by the metadata value.',
      ],
      [
        'What does preserving printed size mean?',
        'With resampling enabled, the tool changes pixel dimensions in proportion to the new DPI relative to the original DPI. This aims to keep the interpreted physical size similar while changing how many pixels represent that area.',
      ],
      [
        'What if the source has no DPI?',
        'When resampling, missing input DPI is treated as 72. That assumption may differ from your intended print size, so inspect the source dimensions and consider the dedicated physical-size resizer when you know the exact measurements.',
      ],
      [
        'What does Inspect DPI download?',
        'Inspection creates a JSON report with image dimensions, stored DPI and related properties. It does not alter the image. A missing or unusual DPI value in that report should be interpreted separately from the photograph’s pixel dimensions.',
      ],
    ],
  ),
  'image-metadata': guide(
    'Inspect image properties and available EXIF values as JSON, or make a new image with metadata removed. The report can include dimensions, DPI, ICC profile presence and GPS information when stored in the source. Strip mode re-encodes the pixels, so review the resulting appearance as well as the metadata.',
    [
      'Inspect available camera EXIF fields',
      'Check whether an image contains GPS metadata',
      'Create a copy without source image metadata',
    ],
    [
      [
        'Choose an original image',
        'Add one supported still image. Use the original file when inspecting metadata, because an edited or messaging-app copy may already have removed many source fields.',
      ],
      [
        'Choose viewing or removal',
        'Select Metadata JSON to inspect the stored properties, or Strip metadata to create an image copy. Choose the output image format for strip mode.',
      ],
      [
        'Create the report or copy',
        'Run Create output. Inspection exports available values; stripping creates a fresh encoded image without carrying over source EXIF, comments, ICC profile or DPI metadata.',
      ],
      [
        'Review the relevant result',
        'Download the JSON report or new image. Inspect the report for the fields you need, or compare the stripped image’s colours and appearance before using it.',
      ],
    ],
    [
      'Checking a photo before sharing',
      'A photographer wants to see whether a source JPG includes location data. Select Metadata JSON and inspect the GPS fields if present. To create a version without the source metadata, run Strip metadata and review the newly encoded image before sharing.',
    ],
    [
      [
        'Does every image contain GPS information?',
        'No. GPS appears in the report only when it is present and readable in the source EXIF. A report without location fields does not establish the history of earlier files or information stored separately from the image.',
      ],
      [
        'Is stripping a lossless file edit?',
        'Strip mode re-encodes image pixels rather than simply deleting selected container fields. JPG or WebP can therefore introduce encoding differences, and dropping an ICC profile can affect colour interpretation. Compare the new image with the source.',
      ],
      [
        'Can I remove only one EXIF field?',
        'This tool offers a report or a fresh image without the source metadata. It does not provide field-by-field EXIF editing. Retain the original when you may later need camera details or a different metadata workflow.',
      ],
      [
        'What does ICC profile presence tell me?',
        'The report indicates the number of ICC profile bytes available in the image. That helps identify a stored colour profile, but it is not a full colour audit or a guarantee that different applications will display identical colours.',
      ],
    ],
  ),
};
