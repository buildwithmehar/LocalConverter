import React from 'react';
import { Link } from '../lib/navigation.jsx';
import BrandMark from './BrandMark.jsx';
import BrandWordmark from './BrandWordmark.jsx';

export default function Footer() {
  return (
    <footer className="footer">
      <div>
        <Link to="/" className="footer-brand">
          <BrandMark />
          <BrandWordmark />
        </Link>
        <p>
          File conversion on your computer.
          <br />
          Your files. Your workspace.
        </p>
      </div>
      <div>
        <strong>Tools</strong>
        <Link to="/">File converter</Link>
        <Link to="/formats">Supported formats</Link>
        <Link to="/tools">Local tools</Link>
      </div>
      <div>
        <strong>Information</strong>
        <Link to="/about">About</Link>
        <Link to="/how-it-works">How it works</Link>
        <Link to="/help">Help center</Link>
        <Link to="/security">Data security</Link>
        <a href="https://github.com/buildwithmehar/LocalConverter">Source code</a>
      </div>
      <div>
        <strong>Legal</strong>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms of use</Link>
      </div>
    </footer>
  );
}
