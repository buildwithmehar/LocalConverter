export function browserText(text) {
  return String(text)
    .replace(
      /the installed local app|the installed app|the local application|the local app/gi,
      'this browser workspace',
    )
    .replace(
      /installed local conversion engines|installed conversion engines|installed local encoder|installed encoder/gi,
      'browser conversion engines',
    )
    .replace(
      /local server processing|local backend processing|local server/gi,
      'browser processing',
    )
    .replace(/127\.0\.0\.1(?::\d+)?/g, 'this device')
    .replace(/temporary (?:local )?job copies/gi, 'temporary browser results')
    .replace(/This installation provides/gi, 'This website includes')
    .replace(/available in the installed local app/gi, 'available in this browser workspace');
}
export function browserCopy(value) {
  if (typeof value === 'string') return browserText(value);
  if (Array.isArray(value)) return value.map(browserCopy);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, browserCopy(item)]));
  return value;
}
export function browserDiscovery(page) {
  if (!page) return null;
  const result = browserCopy(page);
  const privacy =
    'Files, pasted text and generated results are processed in this browser. They are not uploaded to a conversion server. Engine downloads can require internet access; large operations depend on the memory and CPU available on this device.';
  const retention =
    'Results stay in this browser tab until you remove them or reload/close the page. Download anything you want to keep. Saved downloads are independent of the browser workspace.';
  result.faqs = result.faqs.map((faq) =>
    /leave my computer|remote upload/i.test(faq.question)
      ? { ...faq, answer: privacy }
      : /long.*download|completed results/i.test(faq.question)
        ? { ...faq, answer: retention }
        : /without internet/i.test(faq.question)
          ? {
              ...faq,
              answer:
                'The website and required engine assets must load first. Processing runs on this device; a fresh visit or an uncached engine still requires internet access.',
            }
          : faq,
  );
  if (result.path === '/') {
    result.lead =
      'Local Converter processes supported files directly in your browser. Choose a source, select an output, adjust the settings and download a separate result. Your selected files are not uploaded to a conversion server.';
    result.sections[1] = {
      title: 'How do I convert a file?',
      text: 'Open a converter, choose your original file, review the settings and select Convert. Processing runs in your browser. Download your result before reloading or closing the tab.',
    };
  }
  if (result.path === '/tools')
    result.lead =
      'Browse all tool workspaces and supported format conversions. Processing runs in this browser. Individual tools show their supported formats and any browser-specific limitations.';
  if (result.path === '/about')
    result.sections = [
      { title: 'A browser workspace for local files', text: privacy },
      {
        title: 'Real conversions and clear limitations',
        text: 'The site uses browser libraries and WebAssembly engines. Each operation must produce a real output; unavailable native-only features are disclosed in the workspace.',
      },
    ];
  if (result.path === '/how-it-works')
    result.sections = [
      {
        title: 'Choose, convert and download',
        text: 'Choose a supported file or paste text, adjust the settings and select Convert. Browser libraries and WebAssembly engines create the output on your device. No Node.js installation or local server is required.',
      },
      { title: 'Save before leaving', text: retention },
    ];
  if (result.path === '/privacy' || result.path === '/security') {
    result.lead = privacy;
    result.sections = [
      { title: 'Processing and temporary results', text: privacy + ' ' + retention },
      {
        title: 'Google Analytics on the public website',
        text: 'The canonical public website uses Google Analytics 4 (G-PNZFZ75FT9) for page visits and technical browser information. Analytics can use cookies. File contents, filenames, pasted tool input, generated passwords and private result identifiers are not sent as Analytics events. Preview origins do not initialize collection.',
      },
    ];
  }
  return result;
}
export function browserOperation(original, registry) {
  let page = browserCopy(original);
  const tool = registry.tools?.find((tool) => page.path === '/' + tool.id);
  const processing =
    'Processing runs in this browser, on your device. Files and pasted input are not uploaded to a conversion server. The website and required engine assets must load first; large operations depend on available device memory.';
  const retention =
    'Selections and completed jobs stay available while you navigate inside this tab. Use My files to revisit results. Reloading or closing the tab clears the workspace; download results you want to keep first.';
  const repair = (value) => {
    if (typeof value === 'string') {
      if (
        /\b(?:FSRCNN|CLAHE|LibreOffice|Calibre)\b|non.local.means|installed server|local.server mode|browser.to.localhost/i.test(
          value,
        )
      )
        return tool?.browserNote || processing;
      if (
        /\b\d+.minute (?:temporary )?retention|expire.*(?:minutes|restart)|server results/i.test(
          value,
        )
      )
        return retention;
      return value;
    }
    if (Array.isArray(value)) return value.map(repair);
    if (value && typeof value === 'object')
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, repair(item)]));
    return value;
  };
  page = repair(page);
  page.steps = page.steps.map((step) => ({
    ...step,
    text: step.text.replace(
      /Save downloads before the \d+-minute temporary retention ends\./i,
      'Save downloads before reloading or closing this tab.',
    ),
  }));
  page.faqs = page.faqs.map((faq) =>
    /upload files to another service|where are files processed/i.test(faq.question)
      ? { ...faq, answer: processing }
      : /continue after changing pages/i.test(faq.question)
        ? { ...faq, answer: retention }
        : faq,
  );
  page.limitations = [
    ...(tool?.browserUnavailable ? [tool.browserUnavailable] : []),
    ...(tool?.browserNote ? [tool.browserNote] : []),
    'Files are processed on this device. Browser memory and engine-specific limits apply. Save results before reloading.',
    ...page.limitations.filter((text) => !/(?:server|installed|30 minutes|retention)/i.test(text)),
  ];
  return page;
}
