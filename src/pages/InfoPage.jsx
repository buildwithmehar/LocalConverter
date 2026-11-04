import InfoHero from '../components/InfoHero.jsx';
import React from 'react';
import Catalog from '../components/Catalog.jsx';
import ToolsPage from './ToolsPage.jsx';
import HelpPage from './HelpPage.jsx';
import LearningPage from './LearningPage.jsx';
import FormatGuide from './FormatGuide.jsx';
import PolicyPage from './PolicyPage.jsx';
import RecoveryPage, { RecoveryDirectory } from './RecoveryPage.jsx';
import { recoveryRoutes } from '../lib/recovery-pages.js';
import FooterReading from './FooterReading.jsx';

export default function InfoPage({
  route,
  registry,
  Link,
  unavailable = false,
  loading = false,
  pendingCount = 0,
}) {
  if (route === '/errors') return <RecoveryDirectory />;
  if (recoveryRoutes[route])
    return (
      <RecoveryPage
        kind={recoveryRoutes[route].kind}
        registry={registry}
        pendingCount={pendingCount}
        preview
      />
    );
  if (route === '/tools') return <ToolsPage registry={registry} Link={Link} />;
  if (route === '/help') return <HelpPage registry={registry} Link={Link} />;
  if (route === '/about' || route === '/how-it-works')
    return <LearningPage kind={route === '/about' ? 'about' : 'how'} registry={registry} />;
  if (['/security', '/privacy', '/terms'].includes(route))
    return <PolicyPage route={route} registry={registry} />;
  if (loading)
    return (
      <InfoHero>
        <h1>Checking conversion support…</h1>
        <p>Connecting to the conversion tools on this computer.</p>
      </InfoHero>
    );
  if (unavailable)
    return <RecoveryPage kind="unsupported" registry={registry} pendingCount={pendingCount} />;
  if (route === '/formats')
    return (
      <>
        <InfoHero>
          <h1>Supported file formats</h1>
          <p>
            Browse image, document, audio, video, archive and data formats supported by your local
            tools. Choose a category below to see compatible conversions and open the converter you
            need. Your files are processed on this computer, without an account or a remote
            conversion service.
          </p>
        </InfoHero>
        <div className="info-content">
          <Catalog registry={registry} Link={Link} full />
          <FormatGuide registry={registry} />
          <FooterReading route={route} />
        </div>
      </>
    );
  return <RecoveryPage kind="404" route={route} registry={registry} pendingCount={pendingCount} />;
}
