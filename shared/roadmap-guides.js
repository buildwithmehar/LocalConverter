import { productivityTools } from './productivity-tools.js';
import { reportTools } from './report-tools.js';
import { toolSearchIntents } from './search-intents.js';
const outputNotes = {
  'generate-id':
    'UUID output uses version 4 randomness; ULIDs include a timestamp and random component. Each identifier appears on its own line.',
  'generate-password':
    'Password generation guarantees a character from each enabled set and shuffles securely. Passphrases independently select words from a 2,048-word list. Keep generated downloads private.',
  'decode-jwt':
    'A readable payload does not establish authenticity. The report explicitly says signatureVerified is false, and expiry is compared with the current computer clock.',
  'explain-cron':
    'The report contains both a human-readable description and actual upcoming UTC timestamps. The selected IANA timezone determines the schedule.',
  'test-regex':
    'Each match includes its value, start and end indices, capture groups and named groups. Zero-length matches advance safely; long-running patterns are terminated.',
  'query-json':
    'Use queries such as $.items[*].name, $..name or $.items[0]. Script expressions and filter predicates are deliberately unsupported.',
  'compare-text':
    'Unchanged lines, additions and removals are represented separately. Paste the comparison into Second text or upload exactly two files in original/revised order.',
  'compare-json':
    'The output contains JSON Pointer paths and before/after values. Object key ordering is ignored; array positions are significant.',
  'query-string':
    'Parse mode accepts an optional leading question mark. Build mode accepts an object or an ordered array such as [["tag","one"],["tag","two"]].',
  'diagram-studio':
    'Choose Mermaid flowchart, sequenceDiagram, erDiagram, classDiagram, mindmap or gantt syntax. These are text descriptions, not natural-language prompts.',
  'pdf-page-size':
    'A4 and Letter presets set actual page dimensions. Custom dimensions and margins are measured in PDF points, with 72 points per inch.',
  'compare-metadata':
    'Upload exactly two images, original first. Added, removed and changed metadata fields are reported independently of any pixel differences.',
  'document-stats':
    'DOCX extraction includes warnings; PDF needs selectable text. Run the existing OCR tool before analyzing scanned pages.',
};
const extra = {
  id: 'docx-preview',
  title: 'DOCX preview & extraction',
  summary: 'Extract clean HTML and inspect warnings from a Word document.',
  note: 'Layout and images may differ from Word. Active resources are omitted.',
  guide: 'Upload a DOCX and review its readable content and extraction warnings.',
  accept: ['docx'],
  fields: [],
};
export const roadmapGuides = Object.fromEntries(
  [...productivityTools, ...reportTools, extra].map((tool) => {
    const input = tool.generator
      ? 'No source file is required. Choose the generation settings and use the main action button.'
      : tool.textInput
        ? 'Paste UTF-8 text into the main input or upload a matching file. A selected file takes priority over the pasted text.'
        : 'Choose the supported original file using the file picker or drop zone. Check the accepted input types listed above the workspace.';
    const specifics = outputNotes[tool.id] || tool.note;
    return [
      tool.id,
      {
        lead: `${tool.summary} ${specifics} ${input}`,
        useCases: toolSearchIntents[tool.id]?.uses || [tool.summary, tool.guide, tool.note],
        steps: [
          {
            title: tool.generator ? 'Choose generation settings' : 'Provide the source',
            text: `${input} ${tool.comparison ? 'For comparison, enter the revised value in the second input or select two source files in the intended order.' : ''} Read the operation note before starting, because supported syntax and file limits are part of the result contract. The original file is not overwritten or renamed by this workflow.`,
          },
          {
            title: 'Choose the intended result',
            text: `${tool.fields?.length ? `Review the controls for ${tool.fields.map((f) => f.label).join(', ')}.` : 'This operation uses a fixed report format, so no extra output configuration is required.'} Change settings according to the file or text you actually supplied. Defaults are a starting point rather than a promise that every source uses the same conventions. ${specifics}`,
          },
          {
            title: 'Create and inspect the output',
            text: `Use the main action button to run ${tool.title.toLowerCase()}. Local processing checks the source and reports malformed or unsupported inputs. A completed job appears in Your results, with a download action and a preview when the output supports it. If the operation fails, read its message and correct the source or settings before retrying; changing only a filename does not change file contents.`,
          },
          {
            title: 'Save and verify the result',
            text: `Download the finished output and open it in the application or workflow that will consume it. ${tool.guide} Check the values, layout, encoding or parsed structure relevant to your task. Keep the source when you may need another set of settings later. Temporary job downloads are session-owned and expire; saving your own copy is the way to retain a result.`,
          },
        ],
        example: {
          title: `Try ${tool.title.toLowerCase()} with a small source`,
          text: tool.generator
            ? `Choose a small count first, create the output and inspect each generated item. Increase the count only after confirming the selected mode and settings suit your intended workflow. ${specifics}`
            : `${tool.sample ? `Try this source: ${tool.sample}.` : `Choose one small supported ${tool.accept?.[0]?.toUpperCase() || 'source'} file${tool.multiple ? ' and the required comparison file' : ''}.`} Use the initial settings, inspect the result and then change one setting to understand its effect. ${specifics}`,
        },
        faqs: [
          [`What does ${tool.title} produce?`, `${tool.summary} ${specifics}`],
          [
            'Which source should I use?',
            tool.generator
              ? `${input} Use the count and mode controls shown above; the generator creates new values from those settings. No source file is uploaded or parsed.`
              : `${input} ${tool.accept ? `Supported file extensions are ${tool.accept.join(', ')}.` : ''} The processing engine checks actual contents; a matching extension alone does not make malformed content valid.`,
          ],
          [
            tool.generator
              ? 'Why were my generation settings rejected?'
              : 'Why did this input fail?',
            tool.generator
              ? `${tool.note} Check the mode, count and value ranges shown beside the generation controls, then retry with valid settings. A generation error does not require selecting an input file.`
              : `${tool.note} Check syntax, required inputs and the ranges shown next to settings. An error keeps unsupported data from being presented as a successful conversion. Correct the source and retry rather than repeatedly resubmitting an unchanged invalid input.`,
          ],
          [
            'How should I check the download?',
            `${tool.guide} Review the saved content in its destination application, including a typical case and any boundary values important to your use. A completed operation confirms processing finished; it cannot determine whether the supplied settings match your wider business requirements.`,
          ],
        ],
      },
    ];
  }),
);
