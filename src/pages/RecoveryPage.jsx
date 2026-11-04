import InfoHero from '../components/InfoHero.jsx';
import React, { useEffect } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  RotateCw,
  FolderOpen,
  FileQuestion,
  CircleAlert,
  ShieldCheck,
} from 'lucide-react';
import { ActionButton } from '../components/ui-kit.jsx';
import { Link } from '../lib/navigation.jsx';
import { recoveryPages, recoveryRoutes, recoveryLinkNames } from '../lib/recovery-pages.js';
import { bytes } from '../lib/formats.js';

export default function RecoveryPage({
  kind = '404',
  route,
  registry = {},
  pendingCount = 0,
  onRetry,
  retrying = false,
  details,
  preview = false,
}) {
  const page = recoveryPages[kind] || recoveryPages['404'];
  useEffect(() => {
    document.title = `${page.title} — Local Converter`;
  }, [page.title]);
  const limit = bytes(registry.limits?.maxBytes || 104857600),
    minutes = registry.limits?.retentionMinutes || 30;
  return (
    <div className="recovery-page">
      <InfoHero category="security">
        <h1>{page.title}</h1>
        <p>{page.intro}</p>
      </InfoHero>
      <div className="recovery-content">
        <div className="recovery-toolbar">
          <div className="recovery-label">
            <div className="recovery-code" aria-hidden="true">
              <FileQuestion size={22} />
              <span>{page.code}</span>
            </div>
            {preview && <span className="recovery-preview-label">Error page preview</span>}
          </div>
          <div className="recovery-actions">
            {onRetry ? (
              <ActionButton onClick={onRetry} disabled={retrying} aria-busy={retrying}>
                <RotateCw size={16} />
                {retrying
                  ? 'Checking connection…'
                  : kind === '500'
                    ? 'Try this page again'
                    : 'Try connection again'}
              </ActionButton>
            ) : (
              <Link className="primary-button" to={page.primary[1]}>
                {page.primary[0]}
                <ArrowRight size={16} />
              </Link>
            )}
            <Link
              className="recovery-secondary"
              to={
                pendingCount ? '/activity' : !onRetry && page.primary[1] === '/help' ? '/' : '/help'
              }
            >
              {pendingCount ? <FolderOpen size={17} /> : <ArrowLeft size={16} />}{' '}
              {pendingCount
                ? 'Return to my files'
                : !onRetry && page.primary[1] === '/help'
                  ? 'Back to converter'
                  : 'Visit help center'}
            </Link>
          </div>
          {retrying && (
            <span className="recovery-retry-status" role="status">
              Checking the local service. Your tab stays open.
            </span>
          )}
        </div>
        <div className="recovery-explanation">
          <section>
            <span className="home-eyebrow">A way forward</span>
            <h2>What happened?</h2>
            <p>{page.reason}</p>
            {route && kind === '404' && (
              <div className="recovery-address">
                <span>Requested address</span>
                <code>{route}</code>
              </div>
            )}
            {details && (
              <details className="recovery-details">
                <summary>Connection details</summary>
                <p>{details}</p>
              </details>
            )}
            {pendingCount > 0 && (
              <div className="recovery-file-note">
                <FolderOpen size={20} />
                <p>
                  <strong>
                    {pendingCount} {pendingCount === 1 ? 'file is' : 'files are'} still in this
                    tab’s workspace.
                  </strong>{' '}
                  Use My files to continue. A full reload or closing the tab can remove pending
                  browser selections.
                </p>
              </div>
            )}
          </section>
          <aside className="recovery-facts">
            <ShieldCheck size={22} />
            <h2>Keep your next step simple.</h2>
            <p>
              Keep the original file. Read the message before changing settings or trying another
              output.
            </p>
            <dl>
              <div>
                <dt>Per-file input limit</dt>
                <dd>{limit}</dd>
              </div>
              <div>
                <dt>Temporary result retention</dt>
                <dd>{minutes} minutes</dd>
              </div>
              <div>
                <dt>Processing location</dt>
                <dd>This computer</dd>
              </div>
            </dl>
          </aside>
        </div>
        <section className="recovery-next" aria-labelledby="recovery-next-heading">
          <h2 id="recovery-next-heading">Try this next</h2>
          <ol>
            {page.steps.map(([heading, text], index) => (
              <li key={heading}>
                <span className="recovery-step">{index + 1}</span>
                <div>
                  <h3>{heading}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <nav className="recovery-links" aria-label="Helpful destinations">
          {page.related.map((path) => (
            <Link key={path} to={path}>
              {recoveryLinkNames[path]}
              <ArrowRight size={17} />
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function RecoveryDirectory() {
  return (
    <>
      <InfoHero category="security">
        <h1>Find your way forward</h1>
        <p>
          A reference to the app’s recovery pages. These previews explain common problems and show
          the next useful action; opening one does not simulate a failed conversion or change your
          files.
        </p>
      </InfoHero>
      <div className="recovery-content">
        <section className="recovery-directory-intro">
          <h2>When a file or a page needs attention.</h2>
          <p>
            A broken address, a rejected file and an unavailable local server need different
            responses. Start with the message beside your file. These guides explain the difference
            and help you return to the converter without repeatedly submitting the same request.
          </p>
          <Link className="learning-text-link" to="/help">
            Read the troubleshooting guide <ArrowRight size={16} />
          </Link>
        </section>
        <div className="recovery-directory">
          {Object.entries(recoveryRoutes).map(([path, page]) => (
            <Link key={path} to={path}>
              <span>{page.code}</span>
              <div>
                <h2>{page.title}</h2>
                <p>{page.intro}</p>
              </div>
              <ArrowRight size={18} />
            </Link>
          ))}
        </div>
        <p className="recovery-directory-note">
          <CircleAlert size={17} /> These are interface previews. The local app also shows
          file-specific failures beside the affected job, so other files in the workspace remain
          available.
        </p>
      </div>
    </>
  );
}
