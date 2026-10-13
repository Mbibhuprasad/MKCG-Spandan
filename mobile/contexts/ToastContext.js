import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadow } from '@/theme/tokens';

const ToastContext = createContext(null);

const ICONS = { success: 'checkmark-circle', error: 'alert-circle', info: 'information-circle' };

// Short confirmations and failures that slide in under the status bar.
export function ToastProvider({ children }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((message, tone = 'info') => {
    if (!message) return;
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message: String(message), tone });
    timer.current = setTimeout(() => setToast(null), tone === 'error' ? 4500 : 2800);
  }, []);

  const api = useMemo(
    () => ({
      show,
      hide,
      success: (message) => show(message, 'success'),
      error: (message) => show(message, 'error'),
      info: (message) => show(message, 'info'),
    }),
    [show, hide]
  );

  const tint = toast ? { success: colors.leaf, error: colors.danger, info: colors.brand }[toast.tone] : colors.brand;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={FadeInUp.duration(220)}
          exiting={FadeOutUp.duration(180)}
          style={[styles.wrap, { top: insets.top + 8 }]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={hide}
            style={[styles.toast, { backgroundColor: colors.surface, borderColor: colors.line }, shadow(colors, 3)]}
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
          >
            <Ionicons name={ICONS[toast.tone]} size={20} color={tint} />
            <Text variant="smallStrong" style={styles.text}>
              {toast.message}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 1000, elevation: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    maxWidth: 480,
  },
  text: { flexShrink: 1 },
});
