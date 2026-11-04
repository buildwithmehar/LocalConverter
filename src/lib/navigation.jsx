import React, { createContext, useContext } from 'react';

export const NavigationContext = createContext(null);

export function Link({ to, children, onClick, ...props }) {
  const navigate = useContext(NavigationContext);
  return (
    <a
      href={to}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (
          !event.defaultPrevented &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          event.button === 0
        ) {
          event.preventDefault();
          navigate(to);
        }
      }}
    >
      {children}
    </a>
  );
}
