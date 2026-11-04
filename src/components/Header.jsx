import { ActionButton, useUiMotion } from './ui-kit.jsx';
import { motion } from 'motion/react';
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, X, Menu, ArrowRight, HardDrive, Moon, Sun } from 'lucide-react';
import BrandMark from './BrandMark.jsx';
import BrandWordmark from './BrandWordmark.jsx';
import { Link } from '../lib/navigation.jsx';
import SpringPanel from './SpringPanel.jsx';
import ToolsMenu from './ToolsMenu.jsx';

export default function Header({
  nav,
  setNav,
  ready,
  connectionFailed = false,
  registry,
  light,
  setLight,
  route,
  overHero,
  fileCount = 0,
}) {
  const { reduced, foreground, input } = useUiMotion();
  const toolsCloseTimer = useRef();
  const toolsButton = useRef(null);
  const toolsWrap = useRef(null);
  const toolsOpenedByHover = useRef(false);
  const cancelToolsClose = () => clearTimeout(toolsCloseTimer.current);
  useEffect(() => () => clearTimeout(toolsCloseTimer.current), []);
  useEffect(() => {
    if (nav !== 'tools') return;
    const dismiss = (event) => {
      if (toolsWrap.current?.contains(event.target)) return;
      clearTimeout(toolsCloseTimer.current);
      toolsOpenedByHover.current = false;
      setNav((current) => (current === 'tools' ? '' : current));
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [nav, setNav]);
  const openToolsOnHover = (event) => {
    if (event.pointerType !== 'mouse' || !window.matchMedia('(any-hover: hover)').matches) return;
    cancelToolsClose();
    if (nav !== 'tools') toolsOpenedByHover.current = true;
    setNav('tools');
  };
  const closeToolsOnLeave = (event) => {
    if (event.pointerType !== 'mouse') return;
    cancelToolsClose();
    const menu = event.currentTarget;
    toolsCloseTimer.current = setTimeout(() => {
      if (input.current === 'keyboard' && menu.contains(document.activeElement)) return;
      toolsOpenedByHover.current = false;
      setNav((current) => (current === 'tools' ? '' : current));
    }, 150);
  };
  const marker = (path) =>
    route === path && (
      <motion.span
        className="header-active-marker"
        layoutId="header-active-link"
        initial={false}
        transition={
          reduced || !foreground || input.current === 'keyboard'
            ? { duration: 0 }
            : { type: 'spring', stiffness: 560, damping: 40 }
        }
        aria-hidden="true"
      />
    );
  const [scrolled, setScrolled] = useState(() => window.scrollY > 48);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 48);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <>
      {!overHero && <div className="header-space" aria-hidden="true" />}
      <div className="header-shell" data-scrolled={scrolled}>
        <header className="header">
          <Link to="/" className="brand" aria-label="Local Converter home">
            <BrandMark />
            <BrandWordmark />
          </Link>
          <nav className="desktop-nav" aria-label="Main navigation">
            <div
              ref={toolsWrap}
              className="nav-wrap"
              onPointerEnter={openToolsOnHover}
              onPointerLeave={closeToolsOnLeave}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  cancelToolsClose();
                  toolsOpenedByHover.current = false;
                  setNav('');
                  toolsButton.current?.focus();
                }
              }}
              onBlur={(event) => {
                if (
                  !event.currentTarget.contains(event.relatedTarget) &&
                  (input.current === 'keyboard' || !event.currentTarget.matches(':hover'))
                ) {
                  cancelToolsClose();
                  setNav((current) => (current === 'tools' ? '' : current));
                }
              }}
            >
              <ActionButton
                ref={toolsButton}
                variant="ghost"
                className="nav-button"
                type="button"
                aria-expanded={nav === 'tools'}
                aria-controls="header-tools-menu"
                onClick={(event) => {
                  cancelToolsClose();
                  const keepOpen = event.detail > 0 && toolsOpenedByHover.current;
                  toolsOpenedByHover.current = false;
                  setNav(keepOpen ? 'tools' : nav === 'tools' ? '' : 'tools');
                }}
              >
                Tools <ChevronDown size={14} />
              </ActionButton>
              <SpringPanel
                open={nav === 'tools'}
                id="header-tools-menu"
                className="nav-dropdown tools-menu"
              >
                <ToolsMenu registry={registry} route={route} />
              </SpringPanel>
            </div>
            <Link to="/formats" aria-current={route === '/formats' ? 'page' : undefined}>
              Formats{marker('/formats')}
            </Link>
            <Link to="/how-it-works" aria-current={route === '/how-it-works' ? 'page' : undefined}>
              How it works{marker('/how-it-works')}
            </Link>
            <Link to="/about" aria-current={route === '/about' ? 'page' : undefined}>
              About{marker('/about')}
            </Link>
            <Link to="/help" aria-current={route === '/help' ? 'page' : undefined}>
              Help{marker('/help')}
            </Link>
            {fileCount > 0 && (
              <Link
                to="/activity"
                className="activity-nav-link"
                aria-current={route === '/activity' ? 'page' : undefined}
              >
                My files <span>{fileCount}</span>
                {marker('/activity')}
              </Link>
            )}
          </nav>
          <div className="header-right">
            <span
              className={`local-status ${ready ? 'online' : ''}`}
              title="Your files stay on this computer"
            >
              <i className="header-status-dot" />
              {ready
                ? 'Runs on your computer'
                : connectionFailed
                  ? 'Local server offline'
                  : 'Connecting locally'}
            </span>
            <ActionButton
              variant="icon"
              className="ui-theme-toggle icon-button theme-button"
              aria-label={`Switch to ${light ? 'dark' : 'light'} mode`}
              onClick={() => setLight(!light)}
            >
              {light ? <Moon size={20} /> : <Sun size={20} />}
            </ActionButton>
            <ActionButton
              variant="icon"
              className="icon-button mobile-menu-button"
              type="button"
              aria-label={nav === 'mobile' ? 'Close menu' : 'Open menu'}
              aria-controls="header-mobile-menu"
              aria-expanded={nav === 'mobile'}
              onClick={() => setNav(nav === 'mobile' ? '' : 'mobile')}
            >
              {nav === 'mobile' ? <X size={21} /> : <Menu size={21} />}
            </ActionButton>
          </div>
        </header>
      </div>
      <SpringPanel
        open={nav === 'mobile'}
        role="navigation"
        id="header-mobile-menu"
        className="mobile-nav"
        data-scrolled={scrolled}
        aria-label="Mobile navigation"
      >
        <Link to="/tools">
          Local tools <ArrowRight size={17} />
        </Link>
        <Link to="/activity">My files {fileCount > 0 && <span>{fileCount}</span>}</Link>
        <Link to="/formats" aria-current={route === '/formats' ? 'page' : undefined}>
          Supported formats
        </Link>
        <Link to="/how-it-works" aria-current={route === '/how-it-works' ? 'page' : undefined}>
          How it works
        </Link>
        <Link to="/about" aria-current={route === '/about' ? 'page' : undefined}>
          About
        </Link>
        <Link to="/security">Data security</Link>
        <Link to="/help" aria-current={route === '/help' ? 'page' : undefined}>
          Help
        </Link>
        <p>
          <HardDrive size={16} /> Files stay on this computer.
        </p>
      </SpringPanel>
    </>
  );
}
