// Task-specific query families observed in the competitor review. Original copy.
export const toolSearchIntents = {
  'generate-id': {
    uses: [
      'Create UUID v4 identifiers for application records.',
      'Generate time-sortable ULIDs for logs and test data.',
      'Download one identifier per line for a data-import workflow.',
    ],
    related: ['generate-password', 'convert-timestamp', 'compare-text'],
  },
  'generate-password': {
    uses: [
      'Generate a password with the enabled character sets.',
      'Create a passphrase from independently selected random words.',
      'Generate a small set of credentials and store the download privately.',
    ],
    related: ['generate-id', 'hash-text', 'count-text'],
  },
  'decode-jwt': {
    uses: [
      'Read a JWT header and JSON payload during debugging.',
      'Compare expiry with the current computer clock.',
      'Inspect claims while keeping signature verification a separate step.',
    ],
    related: ['convert-timestamp', 'compare-json', 'query-json'],
  },
  'convert-timestamp': {
    uses: [
      'Translate Unix seconds or milliseconds into a readable date.',
      'Compare an event in UTC and an IANA timezone.',
      'Check whether a numeric timestamp uses seconds or milliseconds.',
    ],
    related: ['explain-cron', 'decode-jwt', 'number-base'],
  },
  'explain-cron': {
    uses: [
      'Explain a cron expression before scheduling a job.',
      'Inspect upcoming run times in a selected timezone.',
      'Check schedule boundaries against UTC timestamps.',
    ],
    related: ['convert-timestamp', 'count-text', 'test-regex'],
  },
  'test-regex': {
    uses: [
      'Inspect match indices and captured groups.',
      'Test a pattern against representative input text.',
      'Check zero-length matches without running unbounded code.',
    ],
    related: ['compare-text', 'clean-lines', 'format-code'],
  },
  'hash-text': {
    uses: [
      'Compute a SHA-based HMAC for a known message and secret.',
      'Compare a generated digest with an expected integration value.',
      'Inspect how the selected algorithm changes the digest.',
    ],
    related: ['decode-jwt', 'generate-password', 'compare-text'],
  },
  'inspect-url': {
    uses: [
      'Separate a URL into protocol, hostname, path and fragment.',
      'Inspect repeated query keys without losing their order.',
      'Debug an encoded link before sharing it.',
    ],
    related: ['query-string', 'change-case', 'test-regex'],
  },
  'query-string': {
    uses: [
      'Parse URL query parameters into structured data.',
      'Build a query string from JSON key/value pairs.',
      'Preserve repeated parameter names with an ordered pair list.',
    ],
    related: ['inspect-url', 'compare-json', 'query-json'],
  },
  'number-base': {
    uses: [
      'Convert an integer between binary, octal, decimal and hexadecimal.',
      'Handle large integer values without floating-point rounding.',
      'Check a negative integer in another base.',
    ],
    related: ['convert-units', 'convert-timestamp', 'compare-text'],
  },
  'compare-text': {
    uses: [
      'Compare an original and revised text file.',
      'Inspect added, removed and unchanged lines.',
      'Download a line-based change report for review.',
    ],
    related: ['clean-lines', 'count-text', 'compare-json'],
  },
  'count-text': {
    uses: [
      'Count words and Unicode characters in a draft.',
      'Inspect sentence, paragraph and line counts.',
      'Estimate reading time before publishing text.',
    ],
    related: ['clean-lines', 'change-case', 'document-stats'],
  },
  'change-case': {
    uses: [
      'Turn a heading into a URL slug.',
      'Convert identifiers to camel, Pascal, snake or kebab case.',
      'Prepare upper, lower or title case text.',
    ],
    related: ['clean-lines', 'count-text', 'inspect-url'],
  },
  'clean-lines': {
    uses: [
      'Remove duplicate lines from a pasted list.',
      'Trim spaces and control blank lines.',
      'Sort a cleaned list before comparing it with another version.',
    ],
    related: ['compare-text', 'count-text', 'change-case'],
  },
  'placeholder-text': {
    uses: [
      'Generate placeholder paragraphs for a page layout.',
      'Create a specific number of sample words.',
      'Check a design with replaceable copy before final content arrives.',
    ],
    related: ['count-text', 'markdown-editor', 'format-code'],
  },
  'convert-units': {
    uses: [
      'Convert a length, mass, temperature or area value.',
      'Compare decimal KB/MB with binary KiB/MiB data sizes.',
      'Translate a measurement between compatible units.',
    ],
    related: ['number-base', 'resize-print-image', 'image-dpi'],
  },
  'compare-json': {
    uses: [
      'Compare two JSON documents by value and path.',
      'Ignore object key order while inspecting data changes.',
      'See before/after values for array-position changes.',
    ],
    related: ['query-json', 'validate-json-schema', 'compare-text'],
  },
  'query-json': {
    uses: [
      'Extract nested values with a JSONPath expression.',
      'Select array items and wildcard properties.',
      'Explore JSON without executing scripts or filter expressions.',
    ],
    related: ['compare-json', 'validate-json-schema', 'query-string'],
  },
  'validate-json-schema': {
    uses: [
      'Validate a JSON value against a draft-07 schema.',
      'Inspect paths associated with validation failures.',
      'Test a local schema without fetching remote references.',
    ],
    related: ['query-json', 'compare-json', 'format-code'],
  },
  'format-sql': {
    uses: [
      'Indent a SQL query for review.',
      'Choose formatting rules for a supported SQL dialect.',
      'Make a query readable without executing it against a database.',
    ],
    related: ['format-code', 'compare-text', 'clean-lines'],
  },
  'format-code': {
    uses: [
      'Format HTML, CSS or JavaScript for review.',
      'Minify supported source text for a delivery copy.',
      'Compare readable and compact output without executing the source.',
    ],
    related: ['format-sql', 'compare-text', 'markdown-editor'],
  },
  'markdown-editor': {
    uses: [
      'Preview Markdown headings, lists and tables while editing.',
      'Export readable Markdown or sanitised HTML.',
      'Prepare document content before a semantic conversion.',
    ],
    related: ['docx-preview', 'count-text', 'diagram-studio'],
  },
  'diagram-studio': {
    uses: [
      'Render a Mermaid flowchart or sequence diagram.',
      'Export a supported diagram as SVG or PNG.',
      'Inspect a technical diagram defined in text before sharing it.',
    ],
    related: ['markdown-editor', 'format-code', 'docx-preview'],
  },
  'compare-metadata': {
    uses: [
      'Compare metadata in an original and edited photo.',
      'See which fields were added, removed or changed.',
      'Review metadata differences separately from pixel changes.',
    ],
    related: ['image-metadata', 'photo-privacy', 'inspect-file'],
  },
  'photo-privacy': {
    uses: [
      'Check a photo for location-related metadata.',
      'Identify camera, device, author and timestamp fields.',
      'Inspect remaining metadata before sharing an image.',
    ],
    related: ['image-metadata', 'compare-metadata', 'inspect-file'],
  },
  'pdf-metadata': {
    uses: [
      'Inspect supported PDF document information.',
      'Update editable metadata fields in a new PDF copy.',
      'Check PDF properties before delivering a document.',
    ],
    related: ['inspect-file', 'document-stats', 'docx-preview'],
  },
  'pdf-page-size': {
    uses: [
      'Fit PDF pages to A4 or US Letter.',
      'Choose custom page dimensions in PDF points.',
      'Prepare a new page size and review margins before printing.',
    ],
    related: ['merge-pdf', 'split-pdf', 'images-to-pdf'],
  },
  'pdf-contact-sheet': {
    uses: [
      'Arrange PDF page thumbnails into a contact sheet.',
      'Review the order of PDF pages in one visual overview.',
      'Save labelled page thumbnails as PNG or PDF.',
    ],
    related: ['images-to-pdf', 'image-collage', 'compare-metadata'],
  },
  'document-stats': {
    uses: [
      'Count readable text in PDF or DOCX documents.',
      'Inspect document text statistics before editing.',
      'Identify when scanned PDF pages need OCR first.',
    ],
    related: ['count-text', 'docx-preview', 'ocr-document'],
  },
  'inspect-file': {
    uses: [
      'Inspect a file report before choosing a conversion.',
      'Review available file properties and detected details.',
      'Check a source independently of its filename extension.',
    ],
    related: ['archive-browser', 'image-metadata', 'pdf-metadata'],
  },
  'docx-preview': {
    uses: [
      'Read extracted Word content without reproducing its page layout.',
      'Inspect DOCX extraction warnings.',
      'Save sanitised HTML for a content-editing workflow.',
    ],
    related: ['markdown-editor', 'document-stats', 'images-to-pdf'],
  },
};
