import React from 'react';
import { ShieldCheck, HardDrive, Trash2, LockKeyhole, ArrowRight } from 'lucide-react';

function Security({ Link, limits = {} }) {
  return (
    <section className="security">
      <h2>
        <ShieldCheck size={17} /> Data security
      </h2>
      <p>Files are processed by the local server on this computer.</p>
      <ul>
        <li>
          <span>
            <HardDrive size={17} />
          </span>
          <p>
            <strong>Local conversion.</strong> Files are not sent to an external conversion service.
          </p>
        </li>
        <li>
          <span>
            <Trash2 size={17} />
          </span>
          <p>
            <strong>Temporary storage.</strong> Copies expire after {limits.retentionMinutes || 30}{' '}
            minutes. Remove a file or use Clear all to delete them sooner.
          </p>
        </li>
        <li>
          <span>
            <LockKeyhole size={17} />
          </span>
          <p>
            <strong>No account required.</strong> The app has no sign-in, analytics or cloud storage
            imports.
          </p>
        </li>
      </ul>
      <Link to="/security" className="more-link">
        How files are handled <ArrowRight size={14} />
      </Link>
    </section>
  );
}

export default Security;
