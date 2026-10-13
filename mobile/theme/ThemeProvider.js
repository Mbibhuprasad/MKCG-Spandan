import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { KEYS, getItem, setItem } from '@/services/storage';
import { palettes } from './tokens';

const ThemeContext = createContext(null);

// Light is the default for a new installation; the choice made with the toggle
// is remembered on the device.
export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    getItem(KEYS.theme).then((stored) => {
      if (!active) return;
      if (stored === 'dark' || stored === 'light') setModeState(stored);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const colors = palettes[mode];

  // The native window behind the React tree (seen during transitions and
  // behind the keyboard) follows the theme too.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);

  const setMode = useCallback((next) => {
    if (next !== 'dark' && next !== 'light') return;
    setModeState(next);
    setItem(KEYS.theme, next);
  }, []);

  const toggle = useCallback(() => {
    setModeState((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      setItem(KEYS.theme, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ mode, isDark: mode === 'dark', colors, setMode, toggle, ready }),
    [mode, colors, setMode, toggle, ready]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

// Builds a StyleSheet from the active palette and rebuilds it only when the
// theme changes:  const styles = useStyles(makeStyles)
export function useStyles(factory) {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create(factory(colors)), [factory, colors]);
}
