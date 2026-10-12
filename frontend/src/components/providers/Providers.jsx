'use client';

import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from './ThemeProvider';
import { AuthProvider } from './AuthProvider';
import { ToastProvider } from './ToastProvider';

export default function Providers({ children }) {
  return (
    // reducedMotion="user": Framer Motion honours the visitor's OS setting everywhere.
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
