import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { TABS, TabBar } from '@/components/TabBar';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';

// Exactly five primary destinations: Home, Chat, Blogs & Memories, Community, Profile.
export default function TabsLayout() {
  const { colors } = useTheme();
  const { onboardingPending } = useAuth();

  // A doctor who has just registered goes through the optional onboarding first.
  if (onboardingPending) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg }, animation: 'fade' }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
      ))}
    </Tabs>
  );
}
