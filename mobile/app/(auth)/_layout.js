import { Stack } from 'expo-router/stack';
import { useTheme } from '@/theme/ThemeProvider';

export const unstable_settings = { initialRouteName: 'welcome' };

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="policies" />
    </Stack>
  );
}
