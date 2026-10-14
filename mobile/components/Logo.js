import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

// The official MKCGSPANDAN logo (the same artwork as the website's), drawn by
// the header, Home, About, sign-in and onboarding; the launch screen and the
// native splash use the same file (components/BootScreens.js, app.config.js).
// The file is bundled at build time, so it must exist.
export const LOGO = require('../assets/MKCGSPANDAN LOGO.png');

// The only place the in-app logo is rendered. The artwork sits on white, so it
// is shown on a white tile with softly rounded corners — legible in both
// themes — and fitted inside it, never stretched or cropped.
export function LogoMark({ size = 36 }) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.25, padding: Math.max(1, size * 0.04) }]}>
      <Image source={LOGO} style={styles.fill} contentFit="contain" accessibilityLabel="MKCGSPANDAN logo" />
    </View>
  );
}

export function Logo({ size = 34, showName = true, color }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="MKCGSPANDAN">
      <LogoMark size={size} />
      {showName ? (
        <Text style={[styles.name, { fontSize: size * 0.5, lineHeight: size * 0.68 }]} color={color || colors.fg}>
          MKCG<Text style={[styles.name, { fontSize: size * 0.5, lineHeight: size * 0.68 }]} color={color || colors.leaf}>SPANDAN</Text>
        </Text>
      ) : null}
    </View>
  );
}

// "Spandan" means a heartbeat: the mark beats twice, rests, and repeats.
export function PulsingLogo({ size = 96 }) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const halo = useSharedValue(0);

  useEffect(() => {
    const beat = (to) => withTiming(to, { duration: 150, easing: Easing.out(Easing.quad) });
    scale.value = withRepeat(withSequence(beat(1.08), beat(1), beat(1.05), beat(1), withDelay(700, withTiming(1, { duration: 1 }))), -1, false);
    halo.value = withRepeat(withSequence(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 1 }), withDelay(200, withTiming(0, { duration: 1 }))), -1, false);
  }, [scale, halo]);

  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.35 * (1 - halo.value), transform: [{ scale: 1 + halo.value * 0.7 }] }));

  return (
    <View style={[styles.pulseWrap, { width: size * 1.9, height: size * 1.9 }]}>
      <Animated.View style={[styles.halo, { width: size, height: size, borderRadius: size * 0.25, backgroundColor: colors.leaf }, haloStyle]} />
      <Animated.View style={markStyle}>
        <LogoMark size={size} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  tile: { backgroundColor: '#ffffff', overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  name: { fontWeight: '800', letterSpacing: 0.6 },
  pulseWrap: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
});
