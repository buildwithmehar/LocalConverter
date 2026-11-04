import React from 'react';
import icons from '../assets/icons/fontawesome/icons.json';

// Font Awesome Free 7.3.1 by Fonticons, Inc. — CC BY 4.0.
// Original SVG paths; attribution/license: assets/icons/fontawesome and /about.
export default function ReferenceIcon({ name, size, width, height, className = '' }) {
  const icon = icons[name];
  if (!icon) return null;
  return (
    <svg
      className={className}
      width={width ?? size}
      height={height ?? size}
      viewBox={icon.viewBox}
      aria-hidden="true"
      focusable="false"
      data-icon={name}
    >
      {icon.paths.map((d, index) => (
        <path key={index} fill="currentColor" d={d} />
      ))}
    </svg>
  );
}
