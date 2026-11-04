import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import ReferenceIcon from './ReferenceIcon.jsx';
import FormatFileIcon from './FormatFileIcon.jsx';
import './format-diagram.css';
import { AnimatedBeam } from './ui/animated-beam';

// Suggestions are filtered against the installed engines, never advertised as support.
const suggestions = [
  ['png', 'jpg'],
  ['webp', 'png'],
  ['mp4', 'mp3'],
  ['csv', 'json'],
  ['wav', 'mp3'],
  ['jpg', 'webp'],
  ['md', 'pdf'],
];
const cycleInterval = 5000;

function FormatFace({ format, moving }) {
  return (
    <span className="format-face-stack" aria-hidden="true">
      <AnimatePresence initial={false}>
        <motion.span
          key={format}
          className="format-face"
          initial={moving ? { opacity: 0, y: 6 } : false}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: moving ? -4 : 0 }}
          transition={{ duration: moving ? 0.32 : 0, ease: [0.22, 1, 0.36, 1] }}
        >
          <FormatFileIcon format={format} />
          <strong>{format.toUpperCase()}</strong>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export default function FormatDiagram({
  source,
  target,
  pairs,
  cycling,
  picker,
  onPicker,
  onCycle,
  onInteract,
}) {
  const root = useRef(null),
    inputRef = useRef(null),
    outputRef = useRef(null);
  const latest = useRef({ source, target, onCycle });
  latest.current = { source, target, onCycle };
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [foreground, setForeground] = useState(() => !document.hidden);
  const available = suggestions.filter(([from, to]) =>
    pairs.some((pair) => pair.source === from && pair.target === to),
  );
  const sequence = available.map((pair) => pair.join(':')).join(',');
  const moving = visible && foreground && !reduced;

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.1,
    });
    observer.observe(root.current);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const changeMotion = () => setReduced(media.matches);
    const changeVisibility = () => setForeground(!document.hidden);
    media.addEventListener('change', changeMotion);
    document.addEventListener('visibilitychange', changeVisibility);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', changeMotion);
      document.removeEventListener('visibilitychange', changeVisibility);
    };
  }, []);

  useEffect(() => {
    if (!cycling || !moving || available.length < 2) return;
    const timer = setInterval(() => {
      const { source: from, target: to, onCycle: change } = latest.current;
      const index = available.findIndex(([a, b]) => a === from && b === to);
      const next = available[(index + 1) % available.length];
      change(next[0], next[1]);
    }, cycleInterval);
    return () => clearInterval(timer);
  }, [cycling, moving, sequence]);

  return (
    <div
      ref={root}
      className="format-diagram"
      aria-label="Conversion formats"
      data-motion={moving ? 'running' : 'paused'}
      onPointerDownCapture={onInteract}
      onFocusCapture={onInteract}
    >
      <span className="ui-converter-beam" aria-hidden="true">
        {moving ? (
          <AnimatedBeam
            className="magic-format-beam"
            containerRef={root}
            fromRef={inputRef}
            toRef={outputRef}
            startXOffset={54}
            endXOffset={-54}
            pathWidth={1.4}
            pathColor="#ad7772"
            pathOpacity={0.35}
            gradientStartColor="#b93634"
            gradientStopColor="#f4c7b6"
            duration={3.2}
          />
        ) : (
          <i className="static-format-beam" />
        )}
      </span>
      <button
        ref={inputRef}
        className="format-tile"
        aria-label={`Input format: ${source.toUpperCase()}. Click to change.`}
        aria-expanded={(picker?.mode === 'source' && !picker.row) || false}
        onClick={(event) => onPicker(event, 'source')}
      >
        <FormatFace format={source} moving={moving} />
        <ReferenceIcon name="chevron-down" size={13} />
      </button>
      <span className="convert-symbol" aria-hidden="true">
        <span>
          <ReferenceIcon name="rotate" size={16} />
        </span>
        <small>TO</small>
      </span>
      <button
        ref={outputRef}
        className="format-tile output-tile"
        aria-label={`Output format: ${target.toUpperCase()}. Click to change.`}
        aria-expanded={(picker?.mode === 'target' && !picker.row) || false}
        onClick={(event) => onPicker(event, 'target')}
      >
        <FormatFace format={target} moving={moving} />
        <ReferenceIcon name="chevron-down" size={13} />
      </button>
    </div>
  );
}
