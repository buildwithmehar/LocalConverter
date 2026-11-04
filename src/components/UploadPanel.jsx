import { ActionButton, Surface, EffectBeam } from './ui-kit.jsx';
import React from 'react';
import { UploadCloud, Plus, LockKeyhole } from 'lucide-react';
import { bytes } from '../lib/formats.js';

export default function UploadPanel({
  ready,
  dragging,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  onSelect,
  limits,
  dedicated,
}) {
  return (
    <div className={`upload-area ${dedicated ? 'dedicated-upload' : ''}`}>
      <Surface
        as="section"
        className={`upload-card ${dragging ? 'dragging' : ''}`}
        aria-label="File drop zone"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <span className="upload-emblem">
          <UploadCloud size={29} strokeWidth={1.7} />
        </span>
        <h2>{dragging ? 'Drop your files here' : 'Select your file to convert'}</h2>
        <p>Drop files here or select them from your computer.</p>
        <ActionButton
          variant="primary"
          className="select-file-button"
          disabled={!ready}
          onClick={onSelect}
        >
          <Plus size={19} /> Select File
        </ActionButton>
        <div className="upload-fineprint">
          <LockKeyhole size={13} />
          <span>
            Processed on this computer <i /> {bytes(limits.maxBytes || 104857600)} per file
          </span>
        </div>
        <EffectBeam active={dragging} />
      </Surface>
    </div>
  );
}
