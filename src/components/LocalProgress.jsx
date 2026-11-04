import React, { useEffect, useState } from 'react';

let definition;
export default function LocalProgress({ value, label }) {
  const [upgraded, setUpgraded] = useState(() =>
    Boolean(customElements.get('local-conversion-progress')),
  );
  const progress = Math.max(0, Math.min(100, Number(value) || 0));
  useEffect(() => {
    let mounted = true;
    definition ||= import('../motion/local-progress.js').catch(() => {
      definition = undefined;
    });
    definition.then(() => {
      if (mounted) setUpgraded(Boolean(customElements.get('local-conversion-progress')));
    });
    return () => {
      mounted = false;
    };
  }, []);
  return (
    <div className="local-progress-track">
      <progress
        className={upgraded ? 'sr-only' : undefined}
        max="100"
        value={progress}
        aria-label={label}
      />
      <local-conversion-progress hidden={!upgraded} aria-hidden="true" value={String(progress)} />
    </div>
  );
}
