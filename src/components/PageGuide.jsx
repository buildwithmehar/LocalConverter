import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronDown, LockKeyhole } from 'lucide-react';
import { Link } from '../lib/navigation.jsx';

const guideLinks = [
  ['guide-how-to', 'How to use'],
  ['guide-settings', 'Settings'],
  ['guide-example', 'Example'],
  ['guide-limits', 'Limits'],
  ['guide-faq', 'FAQs'],
];

function GuideNavigation({ path }) {
  const navRef = useRef(null),
    [active, setActive] = useState('');
  useEffect(() => {
    const nav = navRef.current,
      guide = nav?.closest('.operation-guide');
    if (!guide) return;
    const sections = guideLinks.map(([id]) => guide.querySelector(`#${id}`));
    let frame = 0,
      previous = '';
    const update = () => {
      frame = 0;
      const stacked = window.matchMedia('(max-width:760px)').matches;
      const line = Math.max(220, nav.getBoundingClientRect().bottom + 26);
      let next = '';
      sections.forEach((section, index) => {
        if (section && (stacked || index !== 2) && section.getBoundingClientRect().top <= line)
          next = guideLinks[index][0];
      });
      // The example shares the settings row on desktop; honour its explicit anchor.
      if (!stacked && next === 'guide-settings' && window.location.hash === '#guide-example')
        next = 'guide-example';
      if (next !== previous) {
        previous = next;
        setActive(next);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    setActive('');
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('hashchange', schedule);
    };
  }, [path]);
  return (
    <nav ref={navRef} className="guide-contents" aria-label="On this page">
      <div className="guide-contents-panel">
        <div className="guide-contents-heading">
          <BookOpen size={18} />
          <div>
            <span>On this page</span>
            <small>Jump to a section</small>
          </div>
        </div>
        <div className="guide-contents-links">
          {guideLinks.map(([id, label]) => (
            <a key={id} href={`#${id}`} aria-current={active === id ? 'location' : undefined}>
              {label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default function PageGuide({ page }) {
  if (!page) return null;
  return (
    <article
      className="operation-guide"
      data-page-guide={page.path}
      aria-label={`${page.shortTitle} guide`}
    >
      <GuideNavigation path={page.path} />
      <section className="guide-overview">
        <div>
          <span className="home-eyebrow">Made for this task</span>
          <h2>{page.shortTitle}, step by step.</h2>
          <p>{page.lead}</p>
        </div>
        <aside>
          <h3>Useful when you need to…</h3>
          <ul>
            {page.useCases.map((text) => (
              <li key={text}>
                <Check size={15} />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </aside>
      </section>
      <section id="guide-how-to" className="guide-how-to">
        <div className="guide-section-title">
          <span className="home-eyebrow">From source to saved</span>
          <h2>How to use {page.shortTitle}</h2>
          <p>Follow the file order and settings for this specific operation.</p>
        </div>
        <ol className="guide-steps">
          {page.steps.map((step, index) => (
            <li key={step.title}>
              <span className="guide-step-number" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <div className="guide-detail-grid">
        <section id="guide-settings">
          <span className="home-eyebrow">Know your controls</span>
          <h2>Understand the settings</h2>
          {page.settings.length ? (
            <dl className="guide-settings">
              {page.settings.map((setting) => (
                <div key={setting.label}>
                  <dt>{setting.label}</dt>
                  <dd>{setting.text}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>
              This operation uses fixed output settings. Choose and order the supported files as
              described in the steps, then review the output notes before processing.
            </p>
          )}
        </section>
        <aside className="guide-example" id="guide-example">
          <span className="home-eyebrow">A practical example</span>
          <h2>{page.example.title}</h2>
          <p>{page.example.text}</p>
          <div className="guide-local-note">
            <LockKeyhole size={18} />
            <span>
              Keep your original. Save a new result. All processing stays on this computer.
            </span>
          </div>
        </aside>
      </div>
      <section className="guide-review" id="guide-check">
        <h2>Check your result</h2>
        <p>{page.review}</p>
      </section>
      <section className="guide-limits" id="guide-limits">
        <div>
          <span className="home-eyebrow">Before you start</span>
          <h2>What this tool supports</h2>
          <p>Choose a result that fits the file’s actual capabilities.</p>
        </div>
        <ul>
          {page.limitations.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </section>
      <section className="guide-faq" id="guide-faq">
        <span className="home-eyebrow">Answers for this operation</span>
        <h2>{page.shortTitle}: common questions</h2>
        {page.faqs.map((faq) => (
          <details key={faq.question}>
            <summary>
              {faq.question}
              <ChevronDown size={17} />
            </summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </section>
      <nav className="guide-related" aria-label="Related tools">
        <div>
          <span className="home-eyebrow">Keep working</span>
          <h2>Another way to finish the job</h2>
        </div>
        {page.related.map((item) => (
          <Link key={item.path} to={item.path}>
            <span>{item.title}</span>
            <ArrowRight size={16} />
          </Link>
        ))}
        <Link to="/tools">
          <span>Browse all tools and conversions</span>
          <ArrowRight size={16} />
        </Link>
      </nav>
    </article>
  );
}
