import React from 'react';
import { animated, to, useTransition } from '@react-spring/web';
import { useUiMotion } from './ui-kit.jsx';

// One spring per open menu; no spring controllers on individual links/buttons.
export default function SpringPanel({ open, children, style, ...props }) {
  const { reduced, foreground, input } = useUiMotion();
  const instant = reduced || !foreground || input.current === 'keyboard';
  const transitions = useTransition(open, {
    from: instant ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -6, scale: 0.985 },
    enter: { opacity: 1, y: 0, scale: 1 },
    leave: { opacity: 0, y: -3, scale: 0.99 },
    immediate: instant,
    config: { tension: 480, friction: 36, clamp: true, precision: 0.01 },
  });
  return transitions(
    (values, visible) =>
      visible && (
        <animated.div
          {...props}
          data-motion-engine="react-spring"
          aria-hidden={!open || undefined}
          inert={!open || undefined}
          style={{
            ...style,
            opacity: instant ? 1 : values.opacity,
            transform: instant
              ? 'none'
              : to([values.y, values.scale], (y, scale) => `translateY(${y}px) scale(${scale})`),
            transformOrigin: 'top center',
            pointerEvents: open ? undefined : 'none',
          }}
        >
          {children}
        </animated.div>
      ),
  );
}
