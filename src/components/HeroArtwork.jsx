import React from 'react';
import './hero-artwork.css';

export default function HeroArtwork({ quiet = false }) {
  // Converter heroes retain their original cloud artwork and format controls.
  if (quiet) return null;
  return <div className="hero-artwork hero-artwork-image" aria-hidden="true" />;
}
