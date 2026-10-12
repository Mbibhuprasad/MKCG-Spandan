'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'mkcg-theme';
const ThemeContext = createContext({ theme: 'light', toggleTheme: () => {}, setTheme: () => {} });

// Runs before first paint (inlined in <head>) so a returning visitor who chose
// dark mode never sees a flash of the light theme. First-time visitors always
// get light mode, whatever their system setting.
export const themeInitScript = `(function(){try{if(localStorage.getItem('${STORAGE_KEY}')==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light');

  useEffect(() => {
    // Sync React state with what the inline script already applied.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  const setTheme = useCallback((next) => {
    const value = next === 'dark' ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', value === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Storage unavailable (private mode): the choice lasts for this visit only.
    }
    setThemeState(value);
  }, []);

  const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
