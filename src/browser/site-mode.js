// Published builds use browser processing; the installed local app remains usable.
export function isBrowserSite() {
  if (import.meta.env?.VITE_BROWSER_ONLY === 'true') return true;
  if (typeof location === 'undefined') return false;
  try {
    const site = JSON.parse(
      document.getElementById('local-bootstrap')?.textContent || 'null',
    )?.site;
    if (site?.mode === 'browser') return true;
  } catch {}
  return !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
}
