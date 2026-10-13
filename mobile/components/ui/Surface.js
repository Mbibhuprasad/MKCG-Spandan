import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadow, space } from '@/theme/tokens';
import { PressableScale } from './Button';

// The standard raised surface. Pass onPress to make the whole card tappable.
export function Card({ children, style, onPress, padded = true, level = 1, soft = false, accessibilityLabel }) {
  const { colors } = useTheme();
  const base = [
    styles.card,
    {
      backgroundColor: soft ? colors.surface2 : colors.surface,
      borderColor: colors.line,
    },
    shadow(colors, soft ? 0 : level),
    padded && styles.padded,
    style,
  ];
  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={base} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
        {children}
      </PressableScale>
    );
  }
  return <View style={base}>{children}</View>;
}

// Frosted panel for content that floats over a gradient or a photo. The blur is
// real where the platform supports it; the translucent tint keeps the text
// readable where it does not.
export function Glass({ children, style, intensity = 28, padded = true }) {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.glass, { borderColor: colors.glassLine }, style]}>
      <BlurView intensity={intensity} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glass }]} />
      <View style={padded && styles.padded}>{children}</View>
    </View>
  );
}

export function Divider({ style }) {
  const { colors } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.line }, style]} />;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2 },
  glass: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  padded: { padding: space.lg },
});
