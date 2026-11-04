import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ theme: 'dark', systemTheme: 'dark' });

// Adapter for Magic Card: the converter owns its existing theme and persistence.
export function ConverterThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');
  useEffect(() => {
    const update = () => setTheme(document.documentElement.dataset.theme || 'dark');
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);
  return (
    <ThemeContext.Provider value={{ theme, systemTheme: theme }}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
