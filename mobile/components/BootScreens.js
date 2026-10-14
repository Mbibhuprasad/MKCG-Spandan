import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LOGO } from '@/components/Logo';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Text } from '@/components/ui';
import { API_ORIGIN } from '@/services/config';
import { useTheme } from '@/theme/ThemeProvider';
import { site } from '@/utils/constants';

// The official logo (components/Logo.js). Its artwork sits on white, so it is
// shown on a white tile in both themes.
const LOGO_SIZE = 184; // the white tile
const INTRO_MS = 650; // the logo arriving
const PULSE_MS = 1400; // one soft breath while the session is checked
const OUTRO_MS = 320; // the screen leaving

// One of the three dots under the logo. They only say "working" — nothing here
// measures progress, so nothing pretends to.
function Dot({ index }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withDelay(
      index * 160,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) }),
          withDelay(300, withTiming(0, { duration: 1 }))
        ),
        -1,
        false
      )
    );
  }, [index, pulse]);
  const style = useAnimatedStyle(() => ({ opacity: 0.3 + 0.7 * pulse.value, transform: [{ scale: 0.8 + 0.2 * pulse.value }] }));
  return <Animated.View style={[styles.dot, style]} />;
}

// The animated launch screen. It takes over from the native splash and covers
// the app while the stored session is checked: the logo fades in and grows to
// its size in the centre of the screen, then breathes softly while a quiet
// loading indicator sits below it, and the whole screen fades away to reveal
// the app as soon as the check is over (it never waits on the animation for
// more than the short entrance).
//   done      the session check has finished (whatever its outcome)
//   onHidden  called after the fade-out so the parent can unmount the screen
export function LaunchScreen({ done = false, onHidden }) {
  const { colors } = useTheme();
  const intro = useSharedValue(0);
  const pulse = useSharedValue(0);
  const exit = useSharedValue(0);
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    intro.value = withTiming(1, { duration: INTRO_MS, easing: Easing.out(Easing.cubic) });
    const half = { duration: PULSE_MS / 2, easing: Easing.inOut(Easing.sin) };
    pulse.value = withDelay(INTRO_MS, withRepeat(withSequence(withTiming(1, half), withTiming(0, half)), -1, false));
    const timer = setTimeout(() => setArrived(true), INTRO_MS);
    return () => clearTimeout(timer);
  }, [intro, pulse]);

  // Leave once the app is ready and the logo has arrived: the zoom is never cut
  // short, and the screen is never held for longer than the check really takes.
  const leaving = done && arrived;
  useEffect(() => {
    if (!leaving) {
      // A new check began while the screen was fading: bring it back.
      exit.value = withTiming(0, { duration: 150 });
      return undefined;
    }
    exit.value = withTiming(1, { duration: OUTRO_MS, easing: Easing.in(Easing.quad) });
    const timer = setTimeout(() => onHidden && onHidden(), OUTRO_MS);
    return () => clearTimeout(timer);
  }, [leaving, exit, onHidden]);

  const screen = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  // The gradient fades in over the background colour the native splash used.
  const backdrop = useAnimatedStyle(() => ({ opacity: interpolate(intro.value, [0, 0.4], [0, 1], 'clamp') }));
  const logo = useAnimatedStyle(() => ({
    opacity: interpolate(intro.value, [0, 0.6], [0, 1], 'clamp'),
    transform: [{ scale: (0.86 + 0.14 * intro.value) * (1 + 0.025 * pulse.value) }],
  }));
  const caption = useAnimatedStyle(() => ({ opacity: interpolate(intro.value, [0.5, 1], [0, 1], 'clamp') }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }, screen]} pointerEvents={leaving ? 'none' : 'auto'}>
      <StatusBar style="light" />
      <Animated.View style={[StyleSheet.absoluteFill, backdrop]}>
        <LinearGradient colors={colors.gradientHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View style={styles.fill}>
        <Animated.View style={[styles.tile, logo]}>
          <Image source={LOGO} style={styles.logo} contentFit="contain" accessibilityLabel="MKCGSPANDAN logo" />
        </Animated.View>
        {/* Hung below the centred logo, so the logo itself stays in the middle of the screen. */}
        <Animated.View style={[styles.below, caption]}>
          <Text variant="small" color="rgba(255,255,255,0.86)" center style={styles.tagline}>
            {site.tagline}
          </Text>
          <View style={styles.dots} accessibilityRole="progressbar" accessibilityLabel="Loading">
            {[0, 1, 2].map((i) => (
              <Dot key={i} index={i} />
            ))}
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// A stored session exists but the API could not be reached to confirm it.
export function ServerUnreachable({ error, onRetry, onSignOut }) {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.fill, styles.pad, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.iconTile, { backgroundColor: colors.dangerSoft }]}>
        <Ionicons name="cloud-offline-outline" size={32} color={colors.danger} />
      </View>
      <Text variant="h1" center>
        Cannot reach MKCGSPANDAN
      </Text>
      <Text tone="muted" center style={styles.copy}>
        {(error && error.message) || 'The server could not be reached.'} You are still signed in on this phone — try again when you are back online.
      </Text>
      {__DEV__ ? (
        <Text variant="caption" tone="muted" center style={styles.copy}>
          Development build · API address: {API_ORIGIN || 'not set'}
        </Text>
      ) : null}
      <Button title="Try again" icon="refresh" onPress={onRetry} full style={styles.action} />
      <Button title="Sign out" variant="ghost" onPress={onSignOut} full />
    </View>
  );
}

// A build made without EXPO_PUBLIC_API_URL: say so instead of guessing an address.
export function NotConfigured() {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.fill, styles.pad, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.iconTile, { backgroundColor: colors.warnSoft }]}>
        <Ionicons name="construct-outline" size={32} color={colors.warn} />
      </View>
      <Text variant="h1" center>
        Server address not set
      </Text>
      <Text tone="muted" center style={styles.copy}>
        This build was made without the address of the MKCGSPANDAN server. Set EXPO_PUBLIC_API_URL (see mobile/.env.example) and build the app again.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { paddingHorizontal: 28, gap: 10 },
  below: { position: 'absolute', top: '50%', left: 0, right: 0, marginTop: LOGO_SIZE / 2 + 22, alignItems: 'center', paddingHorizontal: 28 },
  tile: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 36,
    padding: 10,
    backgroundColor: '#ffffff',
    elevation: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
  },
  logo: { width: '100%', height: '100%' },
  tagline: { maxWidth: 260 },
  dots: { flexDirection: 'row', gap: 8, marginTop: 26 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffffff' },
  iconTile: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  copy: { maxWidth: 320 },
  action: { marginTop: 18 },
});
