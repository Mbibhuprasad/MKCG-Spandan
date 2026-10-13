import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeProvider';

// Animated horizontal bar. `value` is 0–1.
export function ProgressBar({ value = 0, height = 8, tone = 'leaf', trackColor, style }) {
  const { colors } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const clamped = Math.max(0, Math.min(1, Number(value) || 0));
  const width = useSharedValue(0);

  // The fill is animated in pixels (measured from the track), which every
  // Android version draws reliably.
  useEffect(() => {
    width.value = withTiming(trackWidth * clamped, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [clamped, trackWidth, width]);

  const fill = useAnimatedStyle(() => ({ width: width.value }));

  return (
    <View
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor || colors.surface2 }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Animated.View style={[{ height, borderRadius: height / 2, overflow: 'hidden' }, fill]}>
        <LinearGradient
          colors={tone === 'brand' ? colors.gradientBrand : colors.gradientLeaf}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden', alignSelf: 'stretch' },
});
