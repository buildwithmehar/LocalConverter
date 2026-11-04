import PDFDocument from 'pdfkit';
import mammoth from 'mammoth';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { textInput, fail } from './common.js';
import { inspectZip } from './packaging.js';

const plain = (html) =>
  sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
    nonTextTags: ['script', 'style', 'textarea', 'option'],
  })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
export async function convertDocument(buffer, source, target) {
  if (source === 'docx') {
    const entries = inspectZip(buffer);
    if (!entries['word/document.xml']) fail('Not a Word DOCX document.');
    const result =
      target === 'txt'
        ? await mammoth.extractRawText({ buffer })
        : await mammoth.convertToHtml(
            { buffer },
            { convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: '' })) },
          );
    return Buffer.from(
      target === 'txt'
        ? result.value
        : sanitizeHtml(result.value, {
            allowedTags: [
              'h1',
              'h2',
              'h3',
              'p',
              'ul',
              'ol',
              'li',
              'strong',
              'em',
              'table',
              'thead',
              'tbody',
              'tr',
              'th',
              'td',
              'br',
              'blockquote',
            ],
            allowedAttributes: {},
          }),
    );
  }
  let text = textInput(buffer);
  if (source === 'html') text = plain(text.replace(/<\/(?:p|div|h[1-6]|li|tr)>/gi, '\n'));
  if (source === 'md') text = plain(marked.parse(text).replace(/<\/(?:p|h[1-6]|li)>/gi, '\n'));
  if (target === 'txt') return Buffer.from(text);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: 'Converted document' } });
    const chunks = [];
    doc.on('data', (d) => chunks.push(d));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font('Helvetica').fontSize(11).text(text, { lineGap: 4 });
    doc.end();
  });
}
function timestamp(value) {
  const match = value.match(/^(?:(\d{2,}):)?(\d{2}):(\d{2})[,.](\d{3})$/);
  if (!match || +match[2] > 59 || +match[3] > 59) fail('Invalid subtitle timestamp.');
  return `${(match[1] ?? '00').padStart(2, '0')}:${match[2]}:${match[3]}.${match[4]}`;
}
export function convertSubtitle(buffer, source, target) {
  let txt = textInput(buffer).replace(/\r/g, '').trim();
  if (source === 'vtt') {
    if (!txt.startsWith('WEBVTT')) fail('Invalid WebVTT signature.');
    txt = txt.replace(/^WEBVTT[^\n]*\n+/, '');
  }
  const cues = txt
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((block) => {
      let lines = block.split('\n');
      if (!lines[0].includes('-->')) lines.shift();
      const parts = (lines.shift() ?? '').split(/\s+-->\s+/);
      if (parts.length !== 2 || !lines.length) fail('Malformed subtitle cue.');
      return {
        start: timestamp(parts[0]),
        end: timestamp(parts[1].split(/\s/)[0]),
        body: lines.join('\n'),
      };
    });
  if (!cues.length) fail('No subtitle cues found.');
  return Buffer.from(
    (target === 'vtt' ? 'WEBVTT\n\n' : '') +
      cues
        .map(
          (c, i) =>
            `${target === 'srt' ? `${i + 1}\n` : ''}${target === 'srt' ? c.start.replace('.', ',') : c.start} --> ${target === 'srt' ? c.end.replace('.', ',') : c.end}\n${c.body}`,
        )
        .join('\n\n') +
      '\n',
  );
}
