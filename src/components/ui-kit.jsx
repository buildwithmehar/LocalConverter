import React, { createContext, forwardRef, useContext, useEffect, useRef, useState } from 'react';
import { MotionConfig, useInView } from 'motion/react';
import { usePageReveals } from '../motion/use-page-reveals.js';
import { BorderBeam } from './ui/border-beam';
import { cn } from '../lib/utils';

const EffectsContext = createContext({
  foreground: true,
  reduced: false,
  input: { current: 'pointer' },
});
export const useUiMotion = () => useContext(EffectsContext);

export function UiProvider({ children }) {
  const [foreground, setForeground] = useState(!document.hidden);
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const input = useRef('pointer');
  useEffect(() => {
    const update = () => setForeground(!document.hidden);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReduced(media.matches);
    const pointer = () => {
      input.current = 'pointer';
    };
    const keyboard = (event) => {
      if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) input.current = 'keyboard';
    };
    document.addEventListener('visibilitychange', update);
    media.addEventListener('change', updateMotion);
    document.addEventListener('pointerdown', pointer, true);
    document.addEventListener('keydown', keyboard, true);
    return () => {
      document.removeEventListener('visibilitychange', update);
      media.removeEventListener('change', updateMotion);
      document.removeEventListener('pointerdown', pointer, true);
      document.removeEventListener('keydown', keyboard, true);
    };
  }, []);
  return (
    <EffectsContext.Provider value={{ foreground, reduced, input }}>
      <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>{children}</MotionConfig>
    </EffectsContext.Provider>
  );
}

export const ActionButton = forwardRef(function ActionButton(
  { variant = 'primary', className, children, ...props },
  ref,
) {
  return (
    <button
      type="button"
      ref={ref}
      data-feedback="subtle"
      className={cn('ui-action', `ui-action-${variant}`, className)}
      {...props}
    >
      <span className={variant === 'primary' ? 'ui-action-label' : 'relative z-10'}>
        {children}
      </span>
    </button>
  );
});

export function EffectBeam({ active = true, className }) {
  const root = useRef(null);
  const visible = useInView(root);
  const { foreground, reduced } = useContext(EffectsContext);
  return (
    <span className={cn('ui-effect-beam', className)} ref={root} aria-hidden="true">
      {active && visible && foreground && !reduced && (
        <BorderBeam
          colorFrom="#b93634"
          colorTo="#edb3a1"
          duration={8}
          size={100}
          borderWidth={1.3}
        />
      )}
    </span>
  );
}

export function Surface({
  as: Element = 'div',
  className,
  contentClassName,
  children,
  appear = true,
  ...props
}) {
  return (
    <div
      className={cn('ui-surface', className)}
      data-effects="static"
      data-appear={appear ? 'card' : undefined}
    >
      <div className="relative z-40">
        <Element className={cn('ui-card-body', contentClassName)} {...props}>
          {children}
        </Element>
      </div>
    </div>
  );
}

export function PageView({ children, className, revision }) {
  const effects = useUiMotion();
  const scope = usePageReveals({ ...effects, revision });
  return (
    <div ref={scope} className={className} data-motion-engine="motion">
      {children}
    </div>
  );
}
