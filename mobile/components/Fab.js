import { StyleSheet } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { shadow } from '@/theme/tokens';

// Floating "create" button for list screens. Sits above the tab bar.
export function Fab({ icon = 'add', label, onPress, bottom = 18 }) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={ZoomIn.duration(220)} style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <PressableScale onPress={onPress} scaleTo={0.94} style={[styles.button, shadow(colors, 3)]} accessibilityRole="button" accessibilityLabel={label}>
        <LinearGradient colors={colors.gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
          <Ionicons name={icon} size={20} color="#ffffff" />
          {label ? (
            <Text variant="smallStrong" color="#ffffff">
              {label}
            </Text>
          ) : null}
        </LinearGradient>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 16 },
  button: { borderRadius: 26 },
  fill: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 52, paddingHorizontal: 18, borderRadius: 26 },
});
