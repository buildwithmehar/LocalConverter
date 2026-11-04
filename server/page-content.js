import { everydayTools, toolDefaults } from '../shared/everyday-tools.js';
import { toolGuides } from '../shared/tool-guides.js';
import { buildPairGuide } from '../shared/pair-guides.js';
import { toolSearchIntents } from '../shared/search-intents.js';

const display = (value) =>
  typeof value === 'boolean' ? (value ? 'On' : 'Off') : value === '' ? 'blank' : String(value);
const description = (text) =>
  text.length <= 175
    ? text
    : text
        .slice(0, 174)
        .replace(/\s+\S*$/, '')
        .replace(/[.,;:]$/, '') + '.';
const num = (key, label, min, max) => ({ key, label, type: 'number', min, max });
const select = (key, label, options) => ({ key, label, type: 'select', options });
const output = select('output', 'Output format', [
  ['jpg', 'JPG'],
  ['png', 'PNG'],
  ['webp', 'WebP'],
]);
const basicFields = {
  'compress-image': [
    num('targetKB', 'Target size (KB)', 1, 102400),
    output,
    { key: 'allowResize', label: 'Allow smaller dimensions if needed', type: 'checkbox' },
  ],
  'resize-image': [
    num('width', 'Width (px)', 1, 8192),
    num('height', 'Height (px)', 1, 8192),
    select('fit', 'How the image fits', [
      ['contain', 'Fit and pad'],
      ['cover', 'Fill and crop'],
      ['fill', 'Stretch'],
      ['inside', 'Fit inside'],
    ]),
    select('background', 'Padding background', [
      ['white', 'White'],
      ['transparent', 'Transparent'],
    ]),
    output,
  ],
  'crop-image': [
    num('left', 'Crop left (px)', 0, 65535),
    num('top', 'Crop top (px)', 0, 65535),
    num('width', 'Crop width (px)', 1, 65535),
    num('height', 'Crop height (px)', 1, 65535),
    select('rotate', 'Rotate after cropping', [
      [0, 'No rotation'],
      [90, '90°'],
      [180, '180°'],
      [270, '270°'],
    ]),
    { key: 'flop', label: 'Flip horizontally', type: 'checkbox' },
    { key: 'flip', label: 'Flip vertically', type: 'checkbox' },
    output,
  ],
  'split-pdf': [
    { key: 'pages', label: 'Pages to keep', type: 'text' },
    select('mode', 'Download as', [
      ['extract', 'One PDF with selected pages'],
      ['separate', 'ZIP of separate PDF pages'],
    ]),
  ],
  'images-to-pdf': [
    select('paper', 'Page size', [
      ['a4', 'A4'],
      ['letter', 'US Letter'],
      ['original', 'Match each image'],
    ]),
    num('margin', 'Page margin (points)', 0, 72),
  ],
};
function fieldHelp(field, defaults, tool) {
  const defaultValue = defaults[field.key];
  if (tool.id === 'hash-text' && field.key === 'secret')
    return 'HMAC uses this secret as the key for the selected digest algorithm. Enter a nonempty secret in HMAC mode; ordinary hash mode does not use it. The result is a digest, not the original key. The local job omits this option from public job details. Keep the key private.';
  if (tool.id === 'create-code' && field.key === 'password')
    return 'For the Wi-Fi QR preset, enter the network password. This credential is encoded in the generated QR content: someone who scans the code can read or use it. The option is omitted from public job details, but it remains in the QR output. Share the code only with intended recipients.';
  if (field.type === 'password')
    return 'Enter the document password only for this operation. It is sent to the local worker, omitted from public job details and never included in a download filename. Keep a separate safe copy if you are setting a new password.';
  if (field.type === 'select')
    return `Choose ${field.label.toLowerCase()} according to the result you need. Available choices: ${field.options.map(([, label]) => label).join('; ')}. The initial selection is ${field.options.find(([value]) => value === defaultValue)?.[1] || display(defaultValue)}.`;
  if (field.type === 'number')
    return `${field.label} accepts values from ${field.min} to ${field.max}${field.step && field.step !== 1 ? `, in increments of ${field.step}` : `, using whole numbers`}. The initial value is ${display(defaultValue)}. Change it for a specific output requirement, then check the result before processing more files.`;
  if (field.type === 'checkbox')
    return `Turn “${field.label}” on only when it matches your intended result. The initial state is ${display(defaultValue).toLowerCase()}. Read the workflow and output limitations below when this changes how the original content is processed.`;
  if (field.type === 'color')
    return `Choose the ${field.label.toLowerCase()} used by the operation. The initial colour is ${defaultValue}. Check the output against its intended background, particularly when transparent areas, fine edges or text contrast matter.`;
  return `${field.label} is applied to this tool job. ${field.type === 'textarea' ? 'Use the syntax shown in the workflow, especially for JSON field mappings.' : 'Use the value or syntax described in the example below.'} ${defaultValue !== '' ? `The initial value is “${display(defaultValue)}”.` : 'Leave it blank only when the field is described as optional.'}`;
}
function buildToolGuide(tool, registry) {
  const guide = toolGuides[tool.id];
  if (!guide) throw new Error(`Missing page guide: ${tool.id}`);
  const limits = registry.limits || {},
    minutes = limits.retentionMinutes || 30,
    maxMB = Math.round((limits.maxBytes || 104857600) / 1048576);
  const settings = (tool.fields || basicFields[tool.id] || []).map((field) => ({
    label: field.label,
    text: fieldHelp(field, toolDefaults(tool.id), tool),
  }));
  return {
    kind: 'tool',
    path: `/${tool.id}`,
    title: tool.title,
    shortTitle: tool.title,
    description: description(
      `${tool.summary} Use ${tool.title} locally with practical instructions, output settings and format limits.`,
    ),
    lead: guide.lead,
    useCases: guide.useCases,
    steps: guide.steps,
    example: guide.example,
    settings,
    review: `${tool.guide} ${tool.note} Open the saved output in the app or workflow where you plan to use it. Check one representative result before repeating the same settings with more files. The original files stay unchanged.`,
    limitations: [
      tool.note,
      tool.generator
        ? 'No source file is required. Choose the settings to generate a new result.'
        : `Upload ${tool.multiple ? `up to ${limits.maxFiles || 20} files, at least ${tool.minFiles || 1}` : 'one file'} with a combined size of at most ${maxMB} MB. The completed output must fit within 200 MB.`,
      tool.textInput && !tool.generator
        ? 'Pasted text and uploaded text have operation-specific UTF-8 byte limits. Productivity tools accept up to 1 MiB (1,048,576 bytes); non-ASCII characters can use several bytes each. If a file is selected, it takes priority over pasted text.'
        : 'Files are checked by the local engine; a matching filename alone is not proof of valid contents.',
      `Jobs run one at a time with a ${limits.timeoutSeconds || 180}-second deadline. Temporary files expire after approximately ${minutes} minutes; download them before clearing or restarting the app.`,
    ],
    faqs: [
      ...guide.faqs.map(([question, answer]) => ({ question, answer })),
      {
        question: `Does ${tool.title} upload files to another service?`,
        answer: tool.browserMode
          ? 'Local-server mode sends the selected files to the installed server on this computer. Optional browser mode processes its supported inputs inside the browser without creating a server job. Neither mode uses an external conversion provider. Initial setup and installation of local assets can require internet access.'
          : 'Processing happens on the local server on this computer, using installed libraries, models and native tools. The browser-to-localhost connection is required, but no third-party conversion service is used. Initial dependency setup can require internet access; conversions use the installed local assets.',
      },
      {
        question: 'Can I continue after changing pages?',
        answer: tool.browserMode
          ? `Local-server jobs and pending selections can be revisited through My files inside the app; server results expire after approximately ${minutes} minutes. Optional browser results are not stored in My files. Download browser results before leaving, navigating away from or reloading this page. Closing or reloading the tab also discards pending browser selections.`
          : `Pending selections stay available while navigating inside the app. Use My files to return to a tool draft or its results. Reloading or closing the tab discards pending browser selections; temporary job results expire after approximately ${minutes} minutes. Download finished files before restarting the local app.`,
      },
    ],
    facts: [
      {
        label: 'Input',
        value: tool.generator
          ? 'No source file required'
          : tool.textInput
            ? 'Upload or paste text'
            : tool.multiple
              ? 'Ordered file selection'
              : 'One source file',
      },
      {
        label: tool.generator ? 'Output' : 'Upload budget',
        value: tool.generator ? 'Generated locally' : `${maxMB} MB combined`,
      },
      { label: 'Processing', value: 'On this computer' },
      { label: 'Results', value: `Save within ${minutes} min` },
    ],
    related: [
      ...(toolSearchIntents[tool.id]?.related
        ? toolSearchIntents[tool.id].related
            .map((id) => everydayTools.find((other) => other.id === id))
            .filter(Boolean)
        : everydayTools
            .filter((other) => other.id !== tool.id && other.category === tool.category)
            .slice(0, 4)
      ).map((other) => ({ title: other.title, path: `/${other.id}` })),
      ...registry.pairs
        .filter(
          (pair) => registry.formats.find((f) => f.id === pair.source)?.category === tool.category,
        )
        .slice(0, 2)
        .map((pair) => ({
          title: `${pair.source.toUpperCase()} to ${pair.target.toUpperCase()}`,
          path: `/${pair.source}-to-${pair.target}`,
        })),
    ],
  };
}
export function operationPages(registry) {
  const pages = [
    ...everydayTools.map((tool) => buildToolGuide(tool, registry)),
    ...registry.pairs.map((pair) => buildPairGuide(pair, registry)),
  ];
  return new Map(pages.map((page) => [page.path, page]));
}
