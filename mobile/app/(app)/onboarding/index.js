import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PulsingLogo } from '@/components/Logo';
import { Button, Card, Text } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const STEPS = [
  { icon: 'person', title: 'Complete your profile', text: 'Photo, specialization, city and your WhatsApp number.', href: '/onboarding/profile' },
  { icon: 'images', title: 'Share a memory', text: 'A photo or video the batch will recognise.', href: '/onboarding/memory' },
  { icon: 'create', title: 'Write a blog', text: 'An experience or idea worth sharing.', href: '/onboarding/blog' },
];

// Shown once, right after registration. Every step is optional: each can be
// tried now or skipped, and everything remains available from the app later.
export default function OnboardingWelcome() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, finishOnboarding } = useAuth();

  const skipAll = async () => {
    await finishOnboarding();
    router.replace('/');
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <StatusBar style="light" />
      <LinearGradient colors={colors.gradientHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 10 }]}>
        <PulsingLogo size={64} />
        <Text variant="display" color="#ffffff" center>
          Welcome, {user.name}
        </Text>
        <Text color="rgba(255,255,255,0.85)" center style={styles.heroText}>
          Your account is ready and you are signed in. Three quick, optional steps help  find you.
        </Text>
      </LinearGradient>

      <ScrollView style={styles.flex} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {STEPS.map((step, i) => (
          <Animated.View key={step.title} entering={FadeInDown.delay(100 + i * 80).duration(380)}>
            <Card onPress={() => router.push(step.href)} style={styles.step} accessibilityLabel={`Step ${i + 1}: ${step.title}. Try now`}>
              <View style={[styles.icon, { backgroundColor: colors.brandSoft }]}>
                <Ionicons name={step.icon} size={20} color={colors.brandInk} />
              </View>
              <View style={styles.flex}>
                <Text variant="eyebrow" tone="leaf">
                  Step {i + 1} · Optional
                </Text>
                <Text variant="bodyStrong">{step.title}</Text>
                <Text variant="caption" tone="muted">
                  {step.text}
                </Text>
              </View>
              <Text variant="smallStrong" tone="brand">
                Try now ›
              </Text>
            </Card>
          </Animated.View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <Button title="Continue" iconRight="arrow-forward" onPress={() => router.push('/onboarding/profile')} full size="lg" />
        <Button title="Skip for Now" variant="ghost" onPress={skipAll} full />
        <Text variant="caption" tone="muted" center>
          You can do all of this later from your Profile.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', paddingHorizontal: space.xl, paddingBottom: 28, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  heroText: { marginTop: 6, maxWidth: 330 },
  body: { flexGrow: 1, padding: space.lg, gap: 12, justifyContent: 'center' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: space.lg, paddingTop: 8, gap: 6 },
});
