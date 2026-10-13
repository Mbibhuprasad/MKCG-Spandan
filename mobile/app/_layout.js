import { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { LaunchScreen, NotConfigured, ServerUnreachable } from '@/components/BootScreens';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ChatProvider } from '@/features/chat/ChatContext';
import { NotificationsProvider } from '@/features/notifications/NotificationsContext';
import { isApiConfigured } from '@/services/config';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

// The native splash stays up until the theme is known, so the first frame is
// already in the right colours; the animated launch screen takes over from there.
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { status, bootError, restore, signOut } = useAuth();
  const { colors, ready } = useTheme();
  const loading = status === 'loading';

  // The launch screen is up from the first frame and comes back only when the
  // session is checked again ("Try again" after the server could not be
  // reached). It sits above the navigator, so moving between tabs or screens
  // never shows it, and it stays mounted a moment after loading ends to fade out.
  const [launching, setLaunching] = useState(true);
  if (loading && !launching) setLaunching(true);
  const hideLaunch = useCallback(() => setLaunching(false), []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  if (!isApiConfigured) return <NotConfigured />;

  // Signed-out visitors can only reach the (auth) screens and signed-in
  // doctors only the (app) screens; a change of status moves them across.
  // This is navigation, not security — every request is authorised by the API.
  return (
    <>
      {loading ? null : status === 'offline' ? (
        <ServerUnreachable error={bootError} onRetry={restore} onSignOut={signOut} />
      ) : (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }}>
          <Stack.Protected guard={status === 'signedOut'}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Protected guard={status === 'signedIn'}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
        </Stack>
      )}
      {launching ? <LaunchScreen done={!loading} onHidden={hideLaunch} /> : null}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <NotificationsProvider>
                <ChatProvider>
                  <RootNavigator />
                </ChatProvider>
              </NotificationsProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
