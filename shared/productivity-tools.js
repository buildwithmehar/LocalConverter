export const select = (key, label, values, value = values[0]) => ({
  key,
  label,
  type: 'select',
  options: values.map((v) => (Array.isArray(v) ? v : [v, String(v)])),
  default: Array.isArray(value) ? value[0] : value,
});
export const number = (key, label, value, min, max, step) => ({
  key,
  label,
  type: 'number',
  default: value,
  min,
  max,
  ...(step ? { step } : {}),
});
export const text = (key, label, value = '', maxLength = 10000, type = 'text') => ({
  key,
  label,
  type,
  default: value,
  maxLength,
});
export const flag = (key, label, value = true) => ({
  key,
  label,
  type: 'checkbox',
  default: value,
});
const second = text('second', 'Second text', '', 200000, 'textarea');
const plain = [
  'txt',
  'md',
  'markdown',
  'json',
  'csv',
  'html',
  'htm',
  'css',
  'js',
  'sql',
  'xml',
  'yaml',
];
export const units = [
  'mm',
  'cm',
  'm',
  'km',
  'in',
  'ft',
  'yd',
  'mi',
  'mg',
  'g',
  'kg',
  'oz',
  'lb',
  'C',
  'F',
  'K',
  'm2',
  'km2',
  'ft2',
  'acre',
  'ha',
  'B',
  'KB',
  'MB',
  'GB',
  'KiB',
  'MiB',
  'GiB',
];
function make(id, title, summary, fields = [], extra = {}) {
  return {
    id,
    title,
    summary,
    intro: summary,
    category: 'data',
    icon: 'data',
    engine: 'productivity',
    accept: plain,
    multiple: false,
    minFiles: 1,
    textInput: true,
    action: 'Create result',
    fields,
    defaults: Object.fromEntries(fields.map((f) => [f.key, f.default])),
    guide: extra.generator
      ? 'Choose the generation mode and count, create the values and inspect the downloaded result. No source file is required.'
      : 'Enter or upload the source, choose settings, then create and review your result.',
    note: extra.generator
      ? 'Values are generated on this computer from the selected settings. Review and save the download before its temporary job expires.'
      : 'UTF-8 text up to 1 MB. Processing stays on this computer. Inputs are never executed.',
    ...extra,
  };
}
export const productivityTools = [
  make(
    'generate-id',
    'UUID / ULID generator',
    'Generate unique UUID v4 or time-sortable ULID identifiers.',
    [select('kind', 'ID type', ['uuid', 'ulid']), number('count', 'Number of IDs', 1, 1, 1000)],
    { generator: true },
  ),
  make(
    'generate-password',
    'Password / passphrase generator',
    'Generate passwords or random-word passphrases with secure randomness.',
    [
      select('kind', 'Credential type', ['password', 'passphrase']),
      number('length', 'Password length', 20, 8, 128),
      number('words', 'Words per passphrase', 6, 4, 12),
      number('count', 'Number to generate', 1, 1, 100),
      flag('uppercase', 'Include uppercase letters'),
      flag('digits', 'Include digits'),
      flag('symbols', 'Include symbols'),
    ],
    {
      generator: true,
      note: 'Generated credentials are included in the downloaded file. Keep that file private. Passphrases use independent random selections from 2,048 words.',
    },
  ),
  make(
    'decode-jwt',
    'JWT decoder',
    'Inspect a JWT header, payload and expiry without asserting authenticity.',
    [],
    {
      sample: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbGljZSIsImV4cCI6MX0.abc',
      note: 'Decoding does not verify a signature, issuer, audience or token authenticity. Do not treat decoded claims as trusted.',
    },
  ),
  make(
    'convert-timestamp',
    'Timestamp & timezone converter',
    'Convert Unix timestamps or ISO dates into UTC and a named timezone.',
    [
      select('unit', 'Numeric timestamp unit', ['seconds', 'milliseconds']),
      text('timezone', 'Timezone', 'Asia/Karachi', 100),
    ],
    {
      sample: '0',
      note: 'Numeric input uses the selected unit. Date/time strings require an explicit timezone (Z or offset); date-only input uses UTC. Output uses IANA timezone names.',
    },
  ),
  make(
    'explain-cron',
    'Cron expression explainer',
    'Explain a five-field cron expression and list its next run times.',
    [
      text('timezone', 'Timezone', 'Asia/Karachi', 100),
      text('start', 'Start ISO time (blank = now)', '', 100),
      number('count', 'Upcoming runs', 5, 1, 25),
    ],
    {
      sample: '0 9 * * *',
      note: 'Uses five-field Unix cron, including named months and weekdays. Results use the selected timezone and account for its daylight-saving rules.',
    },
  ),
  make(
    'test-regex',
    'Regex tester',
    'Find matches, character positions and capture groups in your text.',
    [text('pattern', 'Regular expression', '(\\d+)', 2000), text('flags', 'Flags', 'g', 8)],
    {
      sample: 'Order 123 and invoice 45',
      note: 'JavaScript regex syntax. Patterns run in a separate worker with a one-second execution deadline and at most 1,000 matches. Match positions count UTF-16 code units.',
    },
  ),
  make(
    'hash-text',
    'Text hash & HMAC',
    'Calculate SHA-256 or SHA-512 hashes and keyed HMAC digests.',
    [
      select('mode', 'Operation', ['hash', 'hmac']),
      select('algorithm', 'Algorithm', ['sha256', 'sha512']),
      text('secret', 'HMAC secret', '', 10000, 'password'),
    ],
    { sample: 'abc' },
  ),
  make(
    'inspect-url',
    'URL inspector',
    'Inspect a web URL and preserve repeated query parameters.',
    [],
    { sample: 'https://example.com/search?tag=one&tag=two#results' },
  ),
  make(
    'query-string',
    'Query string builder',
    'Parse query text or build it from JSON key/value pairs.',
    [select('mode', 'Direction', ['parse', 'build'])],
    {
      sample: 'tag=one&tag=two&q=caf%C3%A9',
      note: 'Build mode accepts a JSON array of [key,value] pairs or an object. Arrays of pairs preserve duplicate keys and their order.',
    },
  ),
  make(
    'number-base',
    'Number base converter',
    'Convert exact signed integers between binary, octal, decimal and hexadecimal.',
    [
      select('from', 'Input base', [2, 8, 10, 16], 10),
      select('to', 'Output base', [2, 8, 10, 16], 16),
    ],
    {
      sample: '9007199254740993',
      note: 'Uses exact integers rather than floating-point arithmetic. Fractions are unsupported; at most 4,096 input digits.',
    },
  ),
  make(
    'compare-text',
    'Text difference checker',
    'Compare two texts and inspect inserted, removed and unchanged lines.',
    [second],
    { comparison: true, sample: 'First line\nOriginal line' },
  ),
  make(
    'count-text',
    'Word & character counter',
    'Count words, Unicode characters, sentences, paragraphs and reading time.',
    [],
    { sample: 'Hello world.\n\nThis is a second paragraph.' },
  ),
  make(
    'change-case',
    'Text case & slug converter',
    'Convert text to letter cases, programming identifiers or a URL slug.',
    [
      select(
        'style',
        'Case style',
        ['lower', 'upper', 'title', 'camel', 'pascal', 'snake', 'kebab', 'slug'],
        'slug',
      ),
    ],
    { sample: 'Hello HTTP World' },
  ),
  make(
    'clean-lines',
    'Text & line cleaner',
    'Trim, sort and deduplicate text lines while controlling blank lines.',
    [
      flag('trim', 'Trim surrounding spaces'),
      flag('empty', 'Remove blank lines'),
      flag('deduplicate', 'Remove duplicate lines'),
      select('sort', 'Line sorting', ['none', 'ascending', 'descending']),
    ],
    { sample: '  banana\napple\nbanana\n\n' },
  ),
  make(
    'placeholder-text',
    'Placeholder text generator',
    'Generate a precise number of placeholder words or paragraphs.',
    [select('unit', 'Generate', ['paragraphs', 'words']), number('count', 'Count', 3, 1, 1000)],
    { generator: true },
  ),
  make(
    'convert-units',
    'Unit converter',
    'Convert length, mass, temperature, area and decimal or binary data sizes.',
    [select('from', 'From unit', units, 'm'), select('to', 'To unit', units, 'ft')],
    {
      sample: '1',
      note: 'Choose two units of the same dimension. C/F/K are temperatures, m2/ft2 are areas, and KB/MB are decimal while KiB/MiB are binary.',
    },
  ),
  make(
    'compare-json',
    'JSON difference checker',
    'Compare JSON objects and arrays using paths and before/after values.',
    [{ ...second, label: 'Second JSON', default: '{}' }],
    {
      comparison: true,
      sample: '{"name":"Local","version":1}',
      note: 'Object key order is ignored. Array order is significant. Reports use JSON Pointer paths with escaped property names.',
    },
  ),
  make(
    'query-json',
    'JSONPath explorer',
    'Extract values from nested JSON with a non-executable JSONPath query.',
    [text('query', 'JSONPath query', '$.items[*].name', 2000)],
    {
      sample: '{"items":[{"name":"Alice"},{"name":"Bob"}]}',
      note: 'Property, index, wildcard and recursive selection are supported. Script expressions, filters and prototype access are rejected.',
    },
  ),
  make(
    'validate-json-schema',
    'JSON Schema validator',
    'Validate a JSON value against a local draft-07 schema and inspect errors.',
    [text('schema', 'JSON Schema', '{"type":"object"}', 50000, 'textarea')],
    {
      sample: '{"name":"Local"}',
      note: 'Draft-07 schema validation runs in a time-limited worker. Remote references are not fetched. Formats such as email are annotations unless explicitly constrained with supported schema rules.',
    },
  ),
  make(
    'format-sql',
    'SQL formatter',
    'Format SQL queries with a selected dialect without executing them.',
    [select('dialect', 'SQL dialect', ['sql', 'postgresql', 'mysql', 'sqlite', 'bigquery'])],
    { sample: 'select id,name from users where active=true;' },
  ),
  make(
    'format-code',
    'HTML / CSS / JavaScript formatter',
    'Format or minify HTML, CSS and JavaScript without executing the source.',
    [
      select('language', 'Source language', ['html', 'css', 'javascript']),
      select('mode', 'Result', ['format', 'minify']),
    ],
    { sample: '<main><h1>Hello</h1><p>Local tools</p></main>' },
  ),
  make(
    'markdown-editor',
    'Markdown live editor',
    'Write Markdown with a live preview and export Markdown or clean HTML.',
    [select('format', 'Download format', ['html', 'md'])],
    {
      category: 'document',
      icon: 'files',
      livePreview: 'markdown',
      sample:
        '# Hello\n\n**Local Converter** keeps your work on this computer.\n\n| Tool | Result |\n| --- | --- |\n| Markdown | HTML |',
    },
  ),
];
for (const [i, t] of productivityTools.entries()) t.family = [71 + i];
