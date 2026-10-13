import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { LogoMark } from '@/components/Logo';
import { IconButton, KeyboardView, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadow, space } from '@/theme/tokens';

// Shared frame for the sign-in and registration screens: brand gradient on
// top, the form on a raised sheet that overlaps it.
export function AuthShell({ title, subtitle, onBack, children, footer }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <StatusBar style="light" />
      <KeyboardView>
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <LinearGradient
            colors={colors.gradientHero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { paddingTop: insets.top + 14 }]}
          >
            <View style={styles.heroTop}>
              {onBack ? <IconButton name="chevron-back" onPress={onBack} tint="glass" color="#ffffff" accessibilityLabel="Go back" /> : <View />}
              <LogoMark size={40} />
            </View>
            <Text variant="display" color="#ffffff" style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? (
              <Text color="rgba(255,255,255,0.84)" style={styles.subtitle}>
                {subtitle}
              </Text>
            ) : null}
          </LinearGradient>

          <Animated.View
            entering={FadeInDown.duration(380)}
            style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.line }, shadow(colors, 2)]}
          >
            {children}
          </Animated.View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { paddingHorizontal: space.xl, paddingBottom: 64 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  title: { maxWidth: 320 },
  subtitle: { marginTop: 6, maxWidth: 330 },
  sheet: {
    marginTop: -40,
    marginHorizontal: space.lg,
    borderRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: space.xl,
  },
  footer: { alignItems: 'center', marginTop: space.xl, paddingHorizontal: space.xl },
});
