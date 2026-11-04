import React from 'react';
import ReferenceIcon from './ReferenceIcon.jsx';

export default function FormatFileIcon({ format }) {
  const name = ['png', 'jpg', 'webp', 'avif', 'gif', 'tiff', 'bmp', 'svg'].includes(format)
    ? 'file-image'
    : ['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(format)
      ? 'file-video'
      : ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'aiff'].includes(format)
        ? 'file-audio'
        : ['csv', 'tsv', 'xlsx', 'ods'].includes(format)
          ? 'file-excel'
          : ['zip', 'gz', '7z', 'tar'].includes(format)
            ? 'file-zipper'
            : format === 'pdf'
              ? 'file-lines'
              : format === 'docx'
                ? 'file-word'
                : ['html', 'json', 'yaml'].includes(format)
                  ? 'file-code'
                  : 'file-lines';
  // Use the same portrait silhouette; the adjacent format label identifies the type.
  return <ReferenceIcon name={name} className="format-file-icon" width={24} height={32} />;
}
