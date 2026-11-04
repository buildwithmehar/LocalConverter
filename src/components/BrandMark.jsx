import React from 'react';
import symbol from '../assets/brand/lc-monogram.json';

export default function BrandMark() {
  return (
    <svg viewBox={symbol.viewBox} aria-hidden="true" focusable="false" data-brand="local-converter">
      {symbol.paths.map(({ fill, d }, index) => (
        <path key={index} fill={fill === '#211F20' ? 'currentColor' : fill} d={d} />
      ))}
    </svg>
  );
}
