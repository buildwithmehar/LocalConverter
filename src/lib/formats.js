import {
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileSpreadsheet,
  Shapes,
  Code2,
} from 'lucide-react';

export const categoryNames = {
  document: 'Documents',
  image: 'Images',
  video: 'Video',
  audio: 'Audio',
  spreadsheet: 'Spreadsheets',
  archive: 'Archives',
  vector: 'Vector',
  subtitle: 'Subtitles',
  data: 'Data',
};
export const categoryIcons = {
  document: FileText,
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  spreadsheet: FileSpreadsheet,
  archive: FileArchive,
  vector: Shapes,
  subtitle: FileText,
  data: Code2,
};
export const bytes = (value) =>
  value >= 1048576
    ? `${Number((value / 1048576).toFixed(1))} MB`
    : `${Math.max(1, Math.round(value / 1024))} KB`;
export const upper = (value) => String(value || '').toUpperCase();
export const defaults = (pair) =>
  Object.fromEntries(
    (pair?.options || []).map((option) => [
      option.key,
      option.default ?? (option.type === 'checkbox' ? false : ''),
    ]),
  );
export const getPair = (registry, source, target) =>
  registry.pairs.find((pair) => pair.source === source && pair.target === target);
export const formatLabel = (format) => upper(format?.id);
