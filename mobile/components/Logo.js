import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

// The in-app logo: the header, the launch screen, Home and About all draw this
// one file. To use the final logo, replace mobile/assets/logo-mark.png (a square
// PNG, 512px or larger, transparent background) or point this line at another
// file in assets/. The file is bundled at build time, so it must exist.
const MARK = require('../assets/logo-mark.png');

// The only place the logo artwork is rendered. It is fitted inside a square
// with softly rounded corners and is never stretched.
export function LogoMark({ size = 36 }) {
  return <Image source={MARK} style={{ width: size, height: size, borderRadius: size * 0.25 }} contentFit="contain" accessibilityLabel="MKCGSPANDAN logo" />;
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
  name: { fontWeight: '800', letterSpacing: 0.6 },
  pulseWrap: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
});
