import { useLayoutEffect, useRef } from 'react';
import { useAnimate } from 'motion/react-mini';

const textTargets = [
  '.hero-copy>h1',
  '.hero-copy>p',
  '.info-hero>h1',
  '.info-hero>p',
  '.workspace-heading',
  '.format-library-toolbar',
  '.help-sidebar',
  '.help-section-heading',
  '.prose>section',
  '.popular-heading',
  '.section-heading',
  '.tools-filters',
  '.local-engine-list>h2',
  '.catalog>h2',
  '.catalog>p',
  '.security>h2',
  '.security>p',
  '.homepage-details section>h2',
  '.homepage-details section>p',
  '[data-page-enter]',
].join(',');
const selector = `${textTargets},[data-appear="card"]`;

export function usePageReveals({ reduced, foreground, input, revision }) {
  const [scope, animate] = useAnimate();
  const seen = useRef(new WeakSet());
  useLayoutEffect(() => {
    const root = scope.current;
    const registered = new Set();
    const controls = new Map();
    const instant = reduced || !foreground || input.current === 'keyboard';
    const finish = (element, saved) => {
      element.style.translate = saved.translate;
      if (saved.opacity !== undefined) element.style.opacity = saved.opacity;
      element.dataset.motionEnter = reduced ? 'reduced' : 'settled';
    };
    const enter = (element, index = 0) => {
      if (seen.current.has(element)) return;
      seen.current.add(element);
      // Keep compositor work bounded even on the directory's 161-card grid.
      if (instant || input.current === 'keyboard' || controls.size >= 8) {
        element.dataset.motionEnter = reduced ? 'reduced' : 'settled';
        return;
      }
      const card = element.dataset.motionKind === 'card';
      const saved = {
        translate: element.style.translate,
        ...(card ? {} : { opacity: element.style.opacity }),
      };
      element.dataset.motionEnter = 'running';
      const animation = animate(
        element,
        {
          // A separate property keeps CSS hover and the upload card's -50% anchor intact.
          translate: [`0px ${card ? 10 : 8}px`, '0px 0px'],
          ...(card ? {} : { opacity: [0.86, 1] }),
        },
        {
          duration: card ? 0.26 : 0.24,
          delay: Math.min(index, 3) * 0.025,
          ease: [0.22, 1, 0.36, 1],
        },
      );
      controls.set(element, { animation, saved });
      animation.then(() => {
        if (element.isConnected && controls.has(element)) {
          finish(element, saved);
          controls.delete(element);
        }
      });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        let index = 0;
        for (const entry of entries)
          if (entry.isIntersecting) {
            enter(entry.target, index++);
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.12 },
    );

    const register = (nodes) => {
      const candidates = new Set();
      for (const node of nodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches(selector)) candidates.add(node);
        node.querySelectorAll(selector).forEach((element) => candidates.add(element));
      }
      // A card enters once as a unit; don't animate the text inside it a second time.
      const batch = [...candidates]
        .filter((element) => {
          if (!root.contains(element) || registered.has(element) || seen.current.has(element))
            return false;
          let parent = element.parentElement;
          while (parent && parent !== root) {
            if (parent.matches(selector)) return false;
            parent = parent.parentElement;
          }
          return true;
        })
        .slice(0, Math.max(0, 240 - registered.size));
      // Read all geometry before starting any animation writes.
      const measured = batch.map((element) => ({ element, rect: element.getBoundingClientRect() }));
      let index = 0;
      for (const { element, rect } of measured) {
        registered.add(element);
        element.dataset.motionKind = element.matches('[data-appear="card"]') ? 'card' : 'text';
        element.dataset.motionEnter = 'pending';
        if (instant || (rect.top < innerHeight && rect.bottom > 0)) enter(element, index++);
        else observer.observe(element);
      }
    };
    register([root]);
    // Only element insertion is observed: hover/style/progress text updates don't trigger scans.
    const additions = new MutationObserver((records) => {
      if (records.some((record) => [...record.removedNodes].some((node) => node.nodeType === 1))) {
        for (const element of registered)
          if (!root.contains(element)) {
            observer.unobserve(element);
            registered.delete(element);
            const running = controls.get(element);
            if (running) {
              running.animation.stop();
              finish(element, running.saved);
              controls.delete(element);
            }
          }
      }
      const nodes = records
        .flatMap((record) => [...record.addedNodes])
        .filter((node) => node.nodeType === 1);
      if (nodes.length) register(nodes);
    });
    additions.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      additions.disconnect();
      for (const [element, { animation, saved }] of controls) {
        animation.stop();
        finish(element, saved);
        seen.current.delete(element);
      }
      controls.clear();
      registered.clear();
    };
  }, [animate, foreground, reduced, input, revision, scope]);
  return scope;
}
