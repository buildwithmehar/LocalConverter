import HeroArtwork from './components/HeroArtwork.jsx';
import SearchGuide from './components/SearchGuide.jsx';
import { metadataFor } from '../shared/seo-metadata.js';
import { pageBootstrap, usePageGuide, applyPageMetadata } from './lib/use-page-guide.js';
import { AnimatePresence } from 'motion/react';

import { ActionButton, PageView } from './components/ui-kit.jsx';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { AlertCircle, X, ChevronRight, ArrowRight } from 'lucide-react';

import { categoryNames, defaults, getPair, upper, bytes } from './lib/formats.js';

import { NavigationContext, Link } from './lib/navigation.jsx';

import Footer from './components/Footer.jsx';

import { pageMetadata } from './lib/page-metadata.js';

import Header from './components/Header.jsx';

import ConversionWorkspace from './components/ConversionWorkspace.jsx';

import UploadPanel from './components/UploadPanel.jsx';

import ConverterDetails from './components/ConverterDetails.jsx';

import PopularConverters from './components/PopularConverters.jsx';

import { converterIntro } from './lib/converter-content.js';

import FormatPicker from './components/FormatPicker.jsx';

import OptionsDialog from './components/OptionsDialog.jsx';

import Catalog from './components/Catalog.jsx';

import Security from './components/Security.jsx';

import InfoPage from './pages/InfoPage.jsx';

import HomepageDetails from './components/HomepageDetails.jsx';

import HomeDiscovery from './components/HomeDiscovery.jsx';

import FormatDiagram from './components/FormatDiagram.jsx';

import RecoveryPage from './pages/RecoveryPage.jsx';

import PageErrorBoundary from './components/PageErrorBoundary.jsx';

import { recoveryPages, recoveryRoutes } from './lib/recovery-pages.js';

import FooterReading from './pages/FooterReading.jsx';

import EverydayTools from './components/EverydayTools.jsx';

import EverydayToolPage from './pages/EverydayToolPage.jsx';

import { toolById, toolDefaults } from '../shared/everyday-tools.js';
import { isBrowserSite } from './browser/site-mode.js';
import { browserRequest } from './browser/client.js';
import { browserDefaults } from './browser/registry.js';

function App() {
  const [registry, setRegistry] = useState(
    () => pageBootstrap()?.registry || { formats: [], pairs: [], dependencies: [], limits: {} },
  );

  const [token, setToken] = useState('');

  const [ready, setReady] = useState(false);

  const [error, setError] = useState('');

  const [connectionError, setConnectionError] = useState(null);

  const [connectionAttempt, setConnectionAttempt] = useState(0);

  const [connecting, setConnecting] = useState(true);

  const [pending, setPending] = useState([]);

  const [toolDrafts, setToolDrafts] = useState({});

  const [jobs, setJobs] = useState([]);

  const [sending, setSending] = useState(false);

  const [route, setRoute] = useState(window.location.pathname);

  const [source, setSource] = useState('png');

  const [target, setTarget] = useState('jpg');

  const [picker, setPicker] = useState(null);

  const [optionsRow, setOptionsRow] = useState(null);

  const [nav, setNav] = useState('');

  const [dragging, setDragging] = useState(false);

  const [heroInteracted, setHeroInteracted] = useState(false);

  const [light, setLight] = useState(
    () => localStorage.getItem('local-converter-theme') === 'light',
  );

  const fileInput = useRef(null);

  const dropCounter = useRef(0);

  const routePair = registry.pairs.find((pair) => route === `/${pair.source}-to-${pair.target}`);

  const utilityTool =
    registry.tools?.find((tool) => tool.id === route.slice(1)) || toolById(route.slice(1));
  const pageGuide = usePageGuide(route, Boolean(utilityTool || routePair));

  const utilityDrafts = Object.entries(toolDrafts).filter(
    ([, draft]) => draft.files?.length || draft.text?.trim(),
  );

  const utilityFileCount = utilityDrafts.reduce(
    (count, [, draft]) => count + (draft.files?.length || 1),
    0,
  );

  const isHome = route === '/',
    isActivity = route === '/activity';

  const pagePending = routePair
    ? pending.filter((row) => row.source === routePair.source && row.target === routePair.target)
    : pending;

  const pageJobs = routePair
    ? jobs.filter(
        (row) =>
          !row.operation && row.source === routePair.source && row.target === routePair.target,
      )
    : jobs;

  const hasRows = Boolean((routePair || isActivity) && pagePending.length + pageJobs.length > 0);

  const active = jobs.some((job) => ['queued', 'processing'].includes(job.status));

  const completed = pageJobs.filter((job) => job.status === 'completed');

  const categories = [...new Set(registry.formats.map((format) => format.category))];

  const requestedConverter =
    route.startsWith('/to-') ||
    route.endsWith('-converter') ||
    /\/[a-z0-9]+-to-[a-z0-9]+$/.test(route);

  const registeredConverter =
    registry.pairs.some((pair) => route === `/${pair.source}-to-${pair.target}`) ||
    registry.formats.some(
      (format) => route === `/${format.id}-converter` || route === `/to-${format.id}`,
    ) ||
    categories.some((category) => route === `/${category}-converter`);

  const converterRoute = route === '/' || registeredConverter;

  async function request(path, init = {}) {
    if (isBrowserSite()) return browserRequest(path, init);

    const response = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      headers: {
        ...(init.method && init.method !== 'GET' ? { 'X-Local-Token': token } : {}),
        ...init.headers,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));

      throw Object.assign(
        new Error(
          typeof data.error === 'string'
            ? data.error
            : data.error?.message || data.message || `Request failed (${response.status}).`,
        ),
        { status: response.status },
      );
    }

    return response.status === 204 ? null : response.json();
  }

  useEffect(() => {
    let alive = true;

    const controller = new AbortController();

    const connectionTimeout = setTimeout(() => controller.abort(), 12000);

    async function initialize() {
      setConnecting(true);

      try {
        const session = await request('/api/session', { signal: controller.signal });

        const [data, saved] = await Promise.all([
          request('/api/registry', { signal: controller.signal }),
          request('/api/jobs', { signal: controller.signal }),
        ]);

        if (!alive) return;

        setToken(session.token);
        setRegistry(data);
        setJobs(saved.jobs);
        setReady(true);
        setConnectionError(null);

        const first =
          data.pairs.find((pair) => pair.source === 'png' && pair.target === 'jpg') ||
          data.pairs[0];

        if (first) {
          setSource(first.source);
          setTarget(first.target);
        }
      } catch (exception) {
        if (alive)
          setConnectionError({
            message:
              exception.name === 'AbortError'
                ? 'The local service did not respond within 12 seconds.'
                : exception.message,
            kind:
              exception.name === 'AbortError'
                ? '408'
                : recoveryPages[String(exception.status)]
                  ? String(exception.status)
                  : exception.status >= 500
                    ? '500'
                    : 'offline',
          });
      } finally {
        clearTimeout(connectionTimeout);
        if (alive) setConnecting(false);
      }
    }

    initialize();

    return () => {
      alive = false;
      clearTimeout(connectionTimeout);
      controller.abort();
    };
  }, [connectionAttempt]);

  useEffect(() => {
    if (!active) return;

    let alive = true;

    const timer = setInterval(async () => {
      try {
        const data = await request('/api/jobs');
        if (alive) setJobs(data.jobs);
      } catch (exception) {
        if (alive) setError(exception.message);
      }
    }, 900);

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [active, token]);

  useEffect(() => {
    const pop = () => {
      setRoute(window.location.pathname);
      setNav('');
      setPicker(null);
    };

    window.addEventListener('popstate', pop);

    return () => window.removeEventListener('popstate', pop);
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;

    root.dataset.themeSwitching = 'true';

    root.dataset.theme = light ? 'light' : 'dark';

    root.classList.toggle('dark', !light);

    localStorage.setItem('local-converter-theme', light ? 'light' : 'dark');

    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        delete root.dataset.themeSwitching;
      });
    });

    return () => {
      cancelAnimationFrame(frame);
      delete root.dataset.themeSwitching;
    };
  }, [light]);

  useEffect(() => {
    if (!ready) return;

    const slug = route.slice(1);

    const pair = registry.pairs.find((pair) => slug === `${pair.source}-to-${pair.target}`);

    if (pair) {
      setSource(pair.source);
      setTarget(pair.target);
    } else {
      const format = registry.formats.find(
        (format) => slug === `${format.id}-converter` || slug === `to-${format.id}`,
      );

      if (format) {
        const available =
          registry.pairs.find((pair) => pair.target === format.id) ||
          registry.pairs.find((pair) => pair.source === format.id);

        if (available) {
          setSource(available.source);
          setTarget(available.target);
        }
      } else {
        const category = slug.replace('-converter', '');

        const available = registry.pairs.find((pair) =>
          registry.formats.some(
            (format) => format.id === pair.source && format.category === category,
          ),
        );

        if (available) {
          setSource(available.source);
          setTarget(available.target);
        }
      }
    }
  }, [route, ready]);

  useEffect(() => {
    const escape = (event) => {
      if (event.key === 'Escape') {
        setNav('');
        setPicker(null);
        setOptionsRow(null);
      }
    };

    window.addEventListener('keydown', escape);

    return () => window.removeEventListener('keydown', escape);
  }, []);

  useEffect(() => {
    const unload = (event) => {
      if (pending.length || utilityFileCount || active || sending) {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', unload);

    return () => window.removeEventListener('beforeunload', unload);
  }, [pending.length, utilityFileCount, active, sending]);

  function navigate(path) {
    if (path !== route) {
      history.pushState({}, '', path);
      setRoute(path);
      window.scrollTo({ top: 0 });
    }

    setNav('');
    setPicker(null);
    setError('');
  }

  function chooseSource(value) {
    setSource(value);

    const preferredTarget = routePair?.target || target;

    setTarget(
      getPair(registry, value, preferredTarget)
        ? preferredTarget
        : registry.pairs.find((pair) => pair.source === value)?.target || '',
    );
  }

  function openPicker(event, mode, row = null) {
    setHeroInteracted(true);

    setPicker({ anchor: event.currentTarget, mode, row });
  }

  function selectFormat(format) {
    if (picker.row) {
      setPending((rows) =>
        rows.map((row) => {
          if (row.id !== picker.row.id) return row;

          const nextSource = picker.mode === 'source' ? format.id : row.source;

          const nextTarget =
            picker.mode === 'target'
              ? format.id
              : getPair(registry, nextSource, row.target)
                ? row.target
                : registry.pairs.find((pair) => pair.source === nextSource)?.target;

          return {
            ...row,
            source: nextSource,
            target: nextTarget,
            options: defaults(getPair(registry, nextSource, nextTarget)),
          };
        }),
      );
    } else if (picker.mode === 'source') chooseSource(format.id);
    else setTarget(format.id);

    if (picker.row) {
      const from = picker.mode === 'source' ? format.id : picker.row.source;

      const to =
        picker.mode === 'target'
          ? format.id
          : getPair(registry, from, picker.row.target)
            ? picker.row.target
            : registry.pairs.find((pair) => pair.source === from)?.target;

      if (!isActivity && to) navigate(`/${from}-to-${to}`);
    } else {
      const from = picker.mode === 'source' ? format.id : routePair?.source || source;

      const currentTarget = routePair?.target || target;

      const to =
        picker.mode === 'target'
          ? format.id
          : getPair(registry, from, currentTarget)
            ? currentTarget
            : registry.pairs.find((pair) => pair.source === from)?.target;

      if (to) navigate(`/${from}-to-${to}`);
    }

    const anchor = picker.anchor;
    setPicker(null);
    if (anchor.isConnected) anchor.focus();
  }

  function addFiles(files) {
    setHeroInteracted(true);

    if (!ready) return;

    const maxFiles = registry.limits.maxFiles || registry.limits.maxJobs || 20;

    const maxBytes =
      registry.limits.maxBytes ||
      registry.limits.maxFileSize ||
      registry.limits.maxFileBytes ||
      registry.limits.uploadBytes ||
      100 * 1024 * 1024;

    const errors = [];

    const added = [];

    for (const file of Array.from(files)) {
      if (pending.length + jobs.length + added.length >= maxFiles) {
        errors.push(`You can add up to ${maxFiles} files. Remove files before adding more.`);
        break;
      }

      if (file.size > maxBytes) {
        errors.push(`${file.name} exceeds the ${bytes(maxBytes)} file limit.`);
        continue;
      }

      const ext = file.name.toLowerCase().split('.').pop();

      const aliases = { jpeg: 'jpg', tif: 'tiff', yml: 'yaml', htm: 'html', md: 'md', m4v: 'mp4' };

      const detected = registry.formats.find((format) => format.id === (aliases[ext] || ext))?.id;

      const pairs = registry.pairs.filter((pair) => pair.source === detected);

      if (!detected || !pairs.length) {
        errors.push(
          `${file.name}: this file format is not supported by the installed converters. See Supported formats.`,
        );
        continue;
      }

      const preferredTarget = routePair?.target || target;

      const nextTarget = pairs.some((pair) => pair.target === preferredTarget)
        ? preferredTarget
        : pairs[0].target;

      added.push({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        source: detected,
        target: nextTarget,
        options: defaults(getPair(registry, detected, nextTarget)),
        status: 'pending',
      });
    }

    setPending((rows) => [...rows, ...added]);
    setError(errors.join(' '));

    if (added.length) {
      const pairs = new Set(added.map((row) => `${row.source}-to-${row.target}`));

      navigate(pairs.size === 1 && !isActivity ? `/${[...pairs][0]}` : '/activity');
    }

    if (fileInput.current) fileInput.current.value = '';
  }

  async function convert() {
    if (sending || !pagePending.length) return;

    setSending(true);
    setError('');

    const batch = [...pagePending];

    for (const row of batch) {
      try {
        const form = new FormData();
        form.append('file', row.file);
        form.append('source', row.source);
        form.append('target', row.target);
        form.append('options', JSON.stringify(row.options));

        const data = await request('/api/jobs', { method: 'POST', body: form });

        setJobs((current) => [...current.filter((job) => job.id !== data.job.id), data.job]);

        setPending((current) => current.filter((item) => item.id !== row.id));
      } catch (exception) {
        setError(exception.message);
      }
    }

    setSending(false);
  }

  async function jobAction(job, action) {
    try {
      setError('');

      if (action === 'remove') {
        await request(`/api/jobs/${job.id}`, { method: 'DELETE' });
        setJobs((current) => current.filter((row) => row.id !== job.id));
      } else {
        const data = await request(`/api/jobs/${job.id}/${action}`, { method: 'POST' });
        setJobs((current) => current.map((row) => (row.id === job.id ? data.job : row)));
      }
    } catch (exception) {
      setError(exception.message);
    }
  }

  function updateToolDraft(id, change) {
    setToolDrafts((current) => ({
      ...current,
      [id]: change(
        current[id] || {
          files: [],
          options: { ...toolDefaults(id), ...(isBrowserSite() ? browserDefaults[id] : {}) },
        },
      ),
    }));
  }

  async function runUtility() {
    if (sending || !utilityTool) return;

    const draft = toolDrafts[utilityTool.id] || {
      files: [],
      options: {
        ...toolDefaults(utilityTool.id),
        ...(isBrowserSite() ? browserDefaults[utilityTool.id] : {}),
      },
    };

    const inline = (value) => ({
      id: 'inline-text',
      file: new File([value], utilityTool.id === 'semantic-document' ? 'input.md' : 'input.txt', {
        type: 'text/plain',
      }),
    });
    const uploads = utilityTool.generator
      ? [inline('Generate')]
      : utilityTool.id === 'create-code' &&
          draft.text?.trim() &&
          !(draft.files || []).some((f) => f.source === 'txt')
        ? [inline(draft.text), ...(draft.files || [])]
        : draft.files?.length
          ? draft.files
          : utilityTool.textInput && draft.text?.trim()
            ? [inline(draft.text)]
            : [];
    if (!uploads.length) return;

    setSending(true);
    setError('');

    try {
      const form = new FormData();
      for (const row of uploads) form.append('files', row.file);

      form.append(
        'options',
        JSON.stringify({
          ...toolDefaults(utilityTool.id),
          ...(isBrowserSite() ? browserDefaults[utilityTool.id] : {}),
          ...draft.options,
        }),
      );

      const data = await request(`/api/tools/${utilityTool.id}/jobs`, {
        method: 'POST',
        body: form,
      });

      setJobs((current) => [...current.filter((job) => job.id !== data.job.id), data.job]);

      const sent = new Set((draft.files || []).map((file) => file.id));
      updateToolDraft(utilityTool.id, (current) => ({
        ...current,
        ...(utilityTool.id === 'compress-image' && draft.files?.length === 1
          ? { previewFile: draft.files[0].file }
          : {}),
        files: (current.files || []).filter((file) => !sent.has(file.id)),
        ...(uploads[0]?.id === 'inline-text' &&
        current.text === draft.text &&
        !utilityTool.livePreview &&
        !['productivity', 'reports'].includes(utilityTool.engine)
          ? { text: '' }
          : {}),
      }));
    } catch (exception) {
      setError(exception.message);
    } finally {
      setSending(false);
    }
  }

  async function clear() {
    try {
      if (routePair) {
        const jobIds = new Set(pageJobs.map((row) => row.id)),
          pendingIds = new Set(pagePending.map((row) => row.id));

        for (const id of jobIds) await request(`/api/jobs/${id}`, { method: 'DELETE' });

        setJobs((rows) => rows.filter((row) => !jobIds.has(row.id)));

        setPending((rows) => rows.filter((row) => !pendingIds.has(row.id)));
      } else {
        await request('/api/clear', { method: 'POST' });
        setJobs([]);
        setPending([]);
      }

      setError('');
    } catch (exception) {
      setError(exception.message);
    }
  }

  const pickerFormats = picker
    ? registry.formats.filter((format) =>
        picker.mode === 'source'
          ? registry.pairs.some((pair) => pair.source === format.id)
          : registry.pairs.some(
              (pair) =>
                pair.source === (picker.row?.source || routePair?.source || source) &&
                pair.target === format.id,
            ),
      )
    : [];

  const categoryRoute = route.slice(1).replace('-converter', '');

  const heading = isActivity
    ? 'Your conversions'
    : route === '/'
      ? 'Local File Converter'
      : routePair
        ? `${upper(routePair.source)} to ${upper(routePair.target)} Converter`
        : categoryNames[categoryRoute]
          ? `${categoryNames[categoryRoute]} Converter`
          : `${upper(route.replace(/^\/(to-)?/, '').replace('-converter', ''))} Converter`;

  useEffect(() => {
    const info = pageMetadata[route];

    const connectionBlocked =
      connectionError &&
      !ready &&
      (converterRoute || isActivity || requestedConverter || utilityTool || route === '/tools');

    const title = connectionBlocked
      ? recoveryPages[connectionError.kind].title
      : utilityTool?.title ||
        (converterRoute || isActivity
          ? heading
          : info?.tabTitle ||
            info?.title ||
            recoveryRoutes[route]?.title ||
            (requestedConverter
              ? ready
                ? 'Conversion unavailable'
                : 'Checking conversion support…'
              : 'Page not found'));

    document.title = `${title} — Local Converter`;

    const description = document.querySelector('meta[name="description"]');

    if (description)
      description.content =
        utilityTool?.intro ||
        (routePair ? converterIntro(routePair, registry) : null) ||
        info?.description ||
        'Convert files on your own computer. Local image, document, audio, video and data conversion.';

    if (pageGuide?.seo && !connectionBlocked) applyPageMetadata(pageGuide.seo);
    else {
      const site = pageBootstrap()?.site || { origin: window.location.origin, indexable: false };
      const meta = metadataFor(route, null, site, registry);
      applyPageMetadata(
        connectionBlocked
          ? { ...meta, title: document.title, robots: 'noindex, follow', schema: null }
          : meta,
      );
    }
  }, [
    heading,
    route,
    converterRoute,
    isActivity,
    requestedConverter,
    ready,
    connectionError,
    utilityTool,
    pageGuide,
    registry,
  ]);

  const selectFiles = () => {
    setHeroInteracted(true);
    fileInput.current.click();
  };

  const uploadEvents = {
    onDragEnter: (event) => {
      event.preventDefault();
      dropCounter.current++;
      setDragging(true);
    },

    onDragOver: (event) => event.preventDefault(),

    onDragLeave: (event) => {
      event.preventDefault();
      dropCounter.current--;
      if (!dropCounter.current) setDragging(false);
    },

    onDrop: (event) => {
      event.preventDefault();
      dropCounter.current = 0;
      setDragging(false);
      addFiles(event.dataTransfer.files);
    },
  };

  return (
    <NavigationContext.Provider value={navigate}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <Header
        nav={nav}
        setNav={setNav}
        ready={ready}
        connectionFailed={Boolean(connectionError)}
        registry={registry}
        light={light}
        setLight={setLight}
        route={route}
        overHero
        fileCount={pending.length + jobs.length + utilityFileCount}
      />

      <input
        ref={fileInput}
        type="file"
        id="file-input"
        data-testid="file-input"
        aria-label="Select files to convert"
        multiple
        className="file-input"
        onClick={() => setHeroInteracted(true)}
        onChange={(event) => addFiles(event.target.files)}
      />

      <main id="main">
        <PageErrorBoundary
          resetKey={route}
          registry={registry}
          pendingCount={pending.length + jobs.length + utilityFileCount}
        >
          <PageView key={route} revision={`${ready}-${hasRows}`} className="ui-page-view">
            {connectionError &&
            !ready &&
            (converterRoute ||
              isActivity ||
              requestedConverter ||
              utilityTool ||
              route === '/tools') ? (
              <RecoveryPage
                kind={connectionError.kind}
                registry={registry}
                pendingCount={pending.length + jobs.length + utilityFileCount}
                onRetry={() => setConnectionAttempt((value) => value + 1)}
                retrying={connecting}
                details={connectionError.message}
              />
            ) : utilityTool ? (
              <EverydayToolPage
                key={utilityTool.id}
                tool={utilityTool}
                registry={registry}
                ready={ready}
                draft={
                  toolDrafts[utilityTool.id] || {
                    files: [],
                    options: {
                      ...toolDefaults(utilityTool.id),
                      ...(isBrowserSite() ? browserDefaults[utilityTool.id] : {}),
                    },
                  }
                }
                onDraft={(change) => updateToolDraft(utilityTool.id, change)}
                onRun={runUtility}
                jobs={jobs.filter((job) => job.operation === utilityTool.id)}
                onJobAction={jobAction}
                sending={sending}
                error={error}
                onError={setError}
                pageGuide={pageGuide}
              />
            ) : converterRoute || isActivity ? (
              <>
                <section
                  className={`hero ${!isHome ? 'converter-hero' : ''} ${hasRows ? 'hero-compact' : ''} ${isActivity ? 'activity-hero' : ''}`}
                >
                  <div className="hero-clouds" aria-hidden="true" />
                  <HeroArtwork
                    quiet
                    category={
                      registry.formats.find((format) => format.id === (routePair?.source || source))
                        ?.category || 'mixed'
                    }
                  />

                  <div className="hero-inner">
                    <div className="hero-copy">
                      {!isHome && (
                        <nav className="converter-breadcrumb" aria-label="Breadcrumb">
                          <Link to="/">Home</Link>
                          <ChevronRight size={13} />
                          <Link to="/tools">Converters</Link>
                          <ChevronRight size={13} />
                          <span>
                            {isActivity
                              ? 'Your conversions'
                              : routePair
                                ? `${upper(routePair.source)} to ${upper(routePair.target)}`
                                : heading.replace(' Converter', '')}
                          </span>
                        </nav>
                      )}

                      <h1>{heading}</h1>
                      <p>
                        {isHome
                          ? 'Convert images, documents, audio, video and more on your computer. Choose a file and an output format to get started.'
                          : isActivity
                            ? 'View your selected files, conversion status and downloads.'
                            : routePair
                              ? converterIntro(routePair, registry)
                              : `Convert ${categoryNames[categoryRoute]?.toLowerCase() || upper(source)} files with the tools on this computer. Choose your files to get started.`}
                      </p>
                    </div>

                    {!isActivity && (
                      <FormatDiagram
                        source={routePair?.source || source}
                        target={routePair?.target || target}
                        pairs={registry.pairs}
                        cycling={
                          isHome &&
                          ready &&
                          !hasRows &&
                          !heroInteracted &&
                          !picker &&
                          !nav &&
                          !dragging
                        }
                        picker={picker}
                        onPicker={openPicker}
                        onInteract={() => setHeroInteracted(true)}
                        onCycle={(from, to) => {
                          setSource(from);
                          setTarget(to);
                        }}
                      />
                    )}
                  </div>
                </section>

                {error && (
                  <div className="error-banner" role="alert">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                    <ActionButton
                      variant="icon"
                      className="icon-button"
                      aria-label="Dismiss error"
                      onClick={() => setError('')}
                    >
                      <X size={18} />
                    </ActionButton>
                  </div>
                )}

                {hasRows ? (
                  <ConversionWorkspace
                    pending={pagePending}
                    jobs={pageJobs}
                    registry={registry}
                    sending={sending}
                    pair={routePair}
                    activity={isActivity}
                    onSelect={selectFiles}
                    onClear={clear}
                    onConvert={convert}
                    onPicker={openPicker}
                    onOptions={setOptionsRow}
                    onRemove={(row) =>
                      row.status === 'pending'
                        ? setPending((rows) => rows.filter((item) => item.id !== row.id))
                        : jobAction(row, 'remove')
                    }
                    onCancel={(row) => jobAction(row, 'cancel')}
                    onRetry={(row) => jobAction(row, 'retry')}
                    onDragOver={uploadEvents.onDragOver}
                    onDrop={uploadEvents.onDrop}
                  />
                ) : (
                  <UploadPanel
                    ready={ready}
                    dragging={dragging}
                    onSelect={selectFiles}
                    limits={registry.limits}
                    dedicated={!isHome}
                    {...uploadEvents}
                  />
                )}

                {isActivity && utilityDrafts.length > 0 && (
                  <section className="utility-draft-notice">
                    <h2>Continue your tools</h2>
                    {utilityDrafts.map(([id, draft]) => (
                      <Link key={id} to={`/${id}`}>
                        <span>
                          {toolById(id)?.title} · {draft.files?.length || 'Text'}{' '}
                          {draft.files?.length === 1
                            ? 'file selected'
                            : draft.files?.length
                              ? 'files selected'
                              : 'draft'}
                        </span>
                        <ArrowRight size={16} />
                      </Link>
                    ))}
                  </section>
                )}

                {isHome && (
                  <>
                    {pending.length + jobs.length > 0 && (
                      <div className="recent-conversions">
                        <div>
                          <span className="recent-status-dot" />
                          <p>
                            You have <strong>{pending.length + jobs.length} files</strong> in your
                            workspace.
                          </p>
                        </div>
                        <Link to="/activity">
                          Continue your conversions <ArrowRight size={16} />
                        </Link>
                      </div>
                    )}

                    <PopularConverters registry={registry} />

                    <EverydayTools registry={registry} compact />

                    <HomeDiscovery registry={registry} />

                    <HomepageDetails />

                    <div className="home-footer-reading">
                      <FooterReading route="/" />
                    </div>
                  </>
                )}

                {routePair && (
                  <ConverterDetails pair={routePair} registry={registry} pageGuide={pageGuide} />
                )}

                {!isHome && !isActivity && !routePair && !hasRows && (
                  <div className="home-sections">
                    <Catalog registry={registry} Link={Link} />
                    <Security Link={Link} limits={registry.limits} />
                  </div>
                )}
              </>
            ) : (
              <InfoPage
                route={route}
                registry={registry}
                Link={Link}
                unavailable={ready && requestedConverter && !registeredConverter}
                loading={!ready && requestedConverter}
                pendingCount={pending.length + jobs.length}
              />
            )}

            {!isActivity && !utilityTool && !routePair && !connectionError && (
              <SearchGuide route={route} registry={registry} />
            )}
            {!converterRoute && !isActivity && !utilityTool && error && (
              <div className="error-banner" role="alert">
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}
          </PageView>
        </PageErrorBoundary>
      </main>

      {!hasRows && <Footer />}

      <AnimatePresence initial={false}>
        {picker && (
          <FormatPicker
            key={`${picker.mode}-${picker.row?.id || 'hero'}`}
            formats={pickerFormats}
            picker={picker}
            currentFormat={
              picker.mode === 'source'
                ? picker.row?.source || routePair?.source || source
                : picker.row?.target || routePair?.target || target
            }
            onSelect={selectFormat}
            onClose={() => {
              const anchor = picker.anchor;
              setPicker(null);
              anchor.focus();
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {optionsRow && (
          <OptionsDialog
            key={optionsRow.id}
            row={optionsRow}
            pair={getPair(registry, optionsRow.source, optionsRow.target)}
            onClose={() => setOptionsRow(null)}
            onSave={(options) => {
              setPending((rows) =>
                rows.map((row) => (row.id === optionsRow.id ? { ...row, options } : row)),
              );
              setOptionsRow(null);
            }}
          />
        )}
      </AnimatePresence>

      <div className="sr-only" aria-live="polite">
        {active
          ? 'Conversion in progress.'
          : completed.length
            ? `${completed.length} conversions completed. Downloads are ready.`
            : ''}
      </div>
    </NavigationContext.Provider>
  );
}

export default App;
