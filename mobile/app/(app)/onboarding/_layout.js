import { Stack } from 'expo-router/stack';
import { useTheme } from '@/theme/ThemeProvider';

// The optional steps a doctor is offered straight after registering.
export default function OnboardingLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right', gestureEnabled: false }} />;
}
