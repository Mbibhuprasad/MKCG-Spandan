import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { restoreAlertsPreference, setOpenHandler } from '@/features/notifications/localAlerts';
import { useTheme } from '@/theme/ThemeProvider';

// Everything a signed-in doctor can open. The five tabs are the home of this
// stack; every other screen is pushed on top of them.
export default function AppLayout() {
  const { colors } = useTheme();
  const router = useRouter();

  // Message alerts (if the doctor switched them on): tapping one opens its conversation.
  useEffect(() => {
    restoreAlertsPreference();
    setOpenHandler((conversationId) => router.push(`/chat/${conversationId}`));
    return () => setOpenHandler(null);
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="menu" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
      <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
    </Stack>
  );
}
