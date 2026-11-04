import React from 'react';
import { isBrowserSite } from '../browser/site-mode.js';
import { ArrowRight } from 'lucide-react';
import { Link } from '../lib/navigation.jsx';

const notes = {
  '/': {
    title: 'Choose the file you need at the end.',
    paragraphs: [
      'A useful conversion starts with its destination. An upload form might ask for JPEG, an editing app might need a PNG with transparency, and a spreadsheet workflow might need plain rows rather than a formatted document. Pick the output that meets that need instead of choosing an extension only because it looks familiar.',
      'Try one representative file before preparing a large batch. Keep default settings first, check the saved result in the app where you intend to use it, and then adjust quality, dimensions or other available options with a specific goal. A smaller file is not always a better copy, and a successful conversion does not mean every advanced feature was preserved.',
      'If a file needs attention, read its message before submitting it again. The help center explains output choices, downloads and recovery. You can move between these pages inside the app and use My files to return to pending selections; a full tab reload or browser close is a different action.',
    ],
    links: [
      ['/how-it-works', 'Follow the conversion steps'],
      ['/help', 'Find an answer'],
      ['/security', 'Understand local processing'],
    ],
  },
  '/formats': {
    title: 'An extension is a starting point, not the whole file.',
    paragraphs: [
      'Two files with the same extension can contain different features. A PDF might be searchable text, scanned page images or a mixture of both. A spreadsheet might contain plain values, formulas or embedded objects. The format directory shows supported routes, while the converter page explains the limits of that particular route.',
      'For a repeatable workflow, keep a representative source and compare the output after changing one setting at a time. Inspect transparent edges in an image, identifiers and empty cells in a table, or a few sections of a media file. Choose a different output when the feature you need is not preserved by the current route.',
      'When no route is offered, use the application that created the original to export a supported copy. Renaming the extension alone does not convert the content. The help center explains how to distinguish an unsupported format from a damaged input or an expired download.',
    ],
    links: [
      ['/tools', 'Search all local tools'],
      ['/help', 'Troubleshoot a file'],
    ],
  },
  '/about': {
    title: 'Designed around a task you can finish.',
    paragraphs: [
      'The app keeps its working choices close to the file: a compatible output picker, options for the selected conversion and a status for each submitted job. The surrounding pages explain how those controls behave so you can make a decision before pressing Convert. The same registry powers the directory and the converter pages.',
      'Local processing is useful when you want a browser workspace backed by tools on this computer. It still has practical responsibilities: keep the local service running, use trusted inputs, save completed downloads and understand the limits of the target format. The app does not replace the source application when you need exact editing or preservation of its advanced features.',
      'The privacy, security and terms pages describe this installation in more detail. They separate a browser selection from a temporary server copy and a file you have already downloaded. Those distinctions make recovery easier when a tab is closed, a session ends or a result expires.',
    ],
    links: [
      ['/privacy', 'Read the privacy details'],
      ['/terms', 'Understand use and limitations'],
    ],
  },
  '/how-it-works': {
    title: 'Pause between changing a format and trusting a result.',
    paragraphs: [
      'After downloading, open the new copy in its destination application. A file can be valid and still be unsuitable for your purpose: a flattened image may lose transparency, extracted text may lose layout, and a table export may keep values without the formulas or workbook formatting that created them.',
      'Use a small review routine for repeated work. Compare filenames and dimensions, scan a few representative pages or rows, and check the feature that motivated the conversion. When you need a different result, return to the original and change one supported setting or output. Repeatedly converting an already converted copy can compound losses.',
      'If a message interrupts the process, recover from the affected job instead of starting the whole batch again. Save other completed results, read the failure details and use Retry only when you have addressed the likely cause. Visit Help for the difference between file problems, session access and the local server being unavailable.',
    ],
    links: [
      ['/help', 'Get recovery guidance'],
      ['/formats', 'Compare supported outputs'],
    ],
  },
  '/help': {
    title: 'Match the message to the next action.',
    paragraphs: [
      'A missing page is a navigation problem. An unsupported type is a format problem. An expired download is a temporary-storage problem. These situations can look similar when all you see is an unavailable result, but selecting the same file again is not the right first step for every one of them.',
      'Start with the explanation beside the affected file. Check whether the original opens, whether the selected route is supported and whether the current browser session still owns the job. Save any other completed results before clearing the workspace or restarting the local service.',
      'The recovery guide brings together the app’s error-page explanations. It includes practical steps for access restrictions, large inputs, timeouts and local connection issues. The guide is a reference: visiting a preview does not create a failed job, remove a file or change your workspace.',
    ],
    links: [
      ['/errors', 'Browse recovery guides'],
      ['/security', 'Read about local access'],
      ['/privacy', 'Understand temporary copies'],
    ],
  },
};

const browserParagraphs = {
  '/formats': {
    2: 'When no route is offered, use the application that created the original to export a supported copy. Renaming the extension alone does not convert its contents. The help center explains unsupported formats, damaged inputs and results cleared from tab memory.',
  },
  '/about': {
    1: 'Conversion engines work with the files you select inside this browser. Keep the tab open, use trusted inputs and save finished results before reloading. Tool-specific limits describe which parts of a format are supported; complex editing and exact source layout may still need the original application.',
    2: 'The privacy, security and terms pages explain browser processing, downloads and the website’s analytics. File contents, filenames and text you enter are excluded from analytics. Selections and results stay in tab memory until removed, cleared or the tab is reloaded or closed.',
  },
  '/how-it-works': {
    2: 'If a message interrupts the process, recover from the affected job instead of starting the whole batch again. Save other completed results, read the failure details and use Retry after addressing the cause. Help covers input limits, engine loading and results lost when a tab is reloaded.',
  },
  '/help': {
    0: 'A missing page is a navigation problem. An unsupported type needs a compatible export. A result lost after reloading must be converted again. Read the message beside the affected file to choose the next step.',
    1: 'Check whether the original opens and whether the selected route supports its contents. Save other finished results before clearing the workspace or reloading. Jobs and downloads exist only in this tab’s memory until you save them.',
    2: 'The recovery guide explains large inputs, timeouts, browser engine loading and unsupported features. Reading a guide does not change a job or remove a file from your workspace.',
  },
};
export default function FooterReading({ route, browser = isBrowserSite() }) {
  const original = notes[route];
  if (!original) return null;
  const note = browser
    ? {
        ...original,
        paragraphs: original.paragraphs.map((text, i) => browserParagraphs[route]?.[i] || text),
        links: original.links.map(([path, label]) => [
          path,
          path === '/security' ? 'Understand browser processing' : label,
        ]),
      }
    : original;
  return (
    <section className="footer-route-note">
      <h2>{note.title}</h2>
      {note.paragraphs.map((text) => (
        <p key={text}>{text}</p>
      ))}
      <div className="reading-links">
        {note.links.map(([path, label]) => (
          <Link key={path} to={path}>
            {label}
            <ArrowRight size={15} />
          </Link>
        ))}
      </div>
    </section>
  );
}
