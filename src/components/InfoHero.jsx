import React from 'react';
import HeroArtwork from './HeroArtwork.jsx';

export default function InfoHero({ children, category = 'mixed' }) {
  return (
    <section className="info-hero info-hero-centered">
      <HeroArtwork category={category} />
      {children}
    </section>
  );
}
