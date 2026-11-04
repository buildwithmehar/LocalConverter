import React from 'react';
import { Link } from '../lib/navigation.jsx';
import { discoveryPage } from '../../shared/search-content.js';
import './search-guide.css';

export default function SearchGuide({ route, registry }) {
  const page = discoveryPage(route, registry);
  if (!page) return null;
  // Tools/formats already display their full directory above this shared guide.
  const groups = ['/tools', '/formats'].includes(route) ? [] : page.groups;
  return (
    <article
      className="search-guide info-content"
      data-search-guide={route}
      aria-label="Conversion guide"
    >
      <p>{page.lead}</p>
      {page.sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          <p>{section.text}</p>
        </section>
      ))}
      {groups.map((group) => (
        <section key={group.title}>
          <h2>{group.title}</h2>
          <ul className="search-guide-links">
            {group.items.map((item) => (
              <li key={item.path}>
                <Link to={item.path}>{item.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {page.faqs.length > 0 && (
        <section>
          <h2>Common questions</h2>
          {page.faqs.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </section>
      )}
      <nav aria-label="Keep reading">
        {page.links.map((item) => (
          <Link key={item.path} to={item.path}>
            {item.title}
          </Link>
        ))}
      </nav>
    </article>
  );
}
