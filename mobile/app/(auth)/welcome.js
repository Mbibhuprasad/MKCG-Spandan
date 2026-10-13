import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PulsingLogo } from '@/components/Logo';
import { Button, Text } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { site } from '@/utils/constants';

const SLIDES = [
  {
    icon: 'people',
    title: 'Your batch, in one private place',
    text: 'MKCGSPANDAN is a members-only community for doctors and medical batchmates — the friends you trained with, wherever their careers took them.',
  },
  {
    icon: 'images',
    title: 'Journeys, blogs and shared memories',
    text: 'Build your professional profile, write about your work, and keep the photos and videos of your college years and reunions together.',
  },
  {
    icon: 'chatbubbles',
    title: 'Talk, plan and meet again',
    text: 'Chat with the whole community or one-to-one, follow community updates, and organise reunions and visits with RSVPs.',
  },
];

// The short introduction shown once, the first time the app is opened.
export default function Welcome() {
  const { colors } = useTheme();
  const { introSeen, markIntroSeen } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const pager = useRef(null);

  if (introSeen) return <Redirect href="/login" />;

  const leave = async (to) => {
    await markIntroSeen();
    router.replace(to);
  };
  const next = () => {
    if (index < SLIDES.length - 1) pager.current.scrollTo({ x: width * (index + 1), animated: true });
    else leave('/register');
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <StatusBar style="light" />
      <LinearGradient colors={colors.gradientHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 18 }]}>
        <Animated.View entering={FadeIn.duration(500)} style={styles.center}>
          <PulsingLogo size={78} />
          <Text style={styles.wordmark} color="#ffffff">
            MKCG<Text style={styles.wordmark} color="#6fe3ad">SPANDAN</Text>
          </Text>
          <Text variant="small" color="rgba(255,255,255,0.85)" center>
            {site.tagline}
          </Text>
        </Animated.View>
      </LinearGradient>

      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={styles.flex}
      >
        {SLIDES.map((slide, i) => (
          <Animated.View key={slide.title} entering={FadeInDown.delay(120 + i * 60).duration(420)} style={[styles.slide, { width }]}>
            <View style={[styles.iconTile, { backgroundColor: colors.leafSoft }]}>
              <Ionicons name={slide.icon} size={28} color={colors.leafStrong} />
            </View>
            <Text variant="h1" center>
              {slide.title}
            </Text>
            <Text tone="soft" center style={styles.slideText}>
              {slide.text}
            </Text>
          </Animated.View>
        ))}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.dots} accessibilityLabel={`Step ${index + 1} of ${SLIDES.length}`}>
          {SLIDES.map((slide, i) => (
            <View key={slide.title} style={[styles.dot, { backgroundColor: i === index ? colors.brand : colors.lineStrong, width: i === index ? 22 : 7 }]} />
          ))}
        </View>
        <Button title={index < SLIDES.length - 1 ? 'Next' : 'Create your account'} iconRight="arrow-forward" onPress={next} full size="lg" />
        <Button title="I already have an account" variant="ghost" onPress={() => leave('/login')} full />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { paddingBottom: 26, paddingHorizontal: space.xl, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  center: { alignItems: 'center' },
  wordmark: { fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: 1.1, marginBottom: 4 },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xxl, gap: 12 },
  iconTile: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  slideText: { maxWidth: 340 },
  bottom: { paddingHorizontal: space.xl, gap: 6 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 14 },
  dot: { height: 7, borderRadius: 4 },
});
