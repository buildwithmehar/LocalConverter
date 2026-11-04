import InfoHero from '../components/InfoHero.jsx';
import React from 'react';
import { ArrowRight, ShieldCheck, LockKeyhole, FileText, Check } from 'lucide-react';
import { Link } from '../lib/navigation.jsx';
import { policyContent } from '../lib/policy-content.js';

export default function PolicyPage({ route, registry }) {
  const page = policyContent(route, registry);
  const Icon =
    page.icon === 'security' ? ShieldCheck : page.icon === 'privacy' ? LockKeyhole : FileText;
  const contents = () => (
    <nav aria-label="On this page">
      <strong>On this page</strong>
      {page.data && <a href="#data-overview">Data at a glance</a>}
      {page.sections.map((section) => (
        <a href={`#${section.id}`} key={section.id}>
          {section.title}
        </a>
      ))}
    </nav>
  );
  return (
    <>
      <InfoHero category="security">
        <h1>{page.title}</h1>
        <p>{page.intro}</p>
      </InfoHero>
      <div className="policy-content">
        <section className="policy-overview" aria-labelledby="policy-summary-heading">
          <div>
            <Icon size={26} />
            <h2 id="policy-summary-heading">{page.summary}</h2>
            <p>
              {registry.mode === 'browser'
                ? 'Applies to this browser workspace.'
                : 'Applies to the local app running on this computer.'}
            </p>
          </div>
          <dl>
            {page.facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <div className="policy-layout">
          <aside className="policy-contents">
            <div className="policy-desktop-contents">{contents()}</div>
            <details className="policy-mobile-contents">
              <summary>On this page</summary>
              {contents()}
            </details>
            <p>
              <Check size={15} /> Read the sections that matter to your file and your workflow.
            </p>
          </aside>
          <article className="policy-article">
            {page.data && (
              <section id="data-overview">
                <h2>Data at a glance</h2>
                <p>
                  The browser and the local server hold different copies. This overview helps
                  distinguish a pending selection, a temporary working file and a download you have
                  already saved.
                </p>
                <dl className="policy-data-list">
                  {page.data.map(([label, text]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{text}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
            {page.sections.map((section) => (
              <section key={section.id} id={section.id}>
                <h2>{section.title}</h2>
                {section.paragraphs.map((text) => (
                  <p key={text}>{text}</p>
                ))}
              </section>
            ))}
            <section className="policy-related" aria-label="Related information">
              <h2>Keep reading</h2>
              {page.related.map(([path, label]) => (
                <Link key={path} to={path}>
                  {label}
                  <ArrowRight size={17} />
                </Link>
              ))}
            </section>
          </article>
        </div>
      </div>
    </>
  );
}
