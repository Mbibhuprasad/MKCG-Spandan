'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { cn } from '@/lib/format';

export default function ThemeToggle({ className }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line text-fg-soft hover:bg-surface-2 hover:text-fg',
        className
      )}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {dark ? <Sun className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" /> : <Moon className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />}
    </button>
  );
}
