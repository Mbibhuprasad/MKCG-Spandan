import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadow } from '@/theme/tokens';
import { Text } from './Text';

const PAD = 4;

// Two or three tabs at the top of a screen with a sliding highlight.
// tabs: [{ key, label, icon?, badge? }]
export function SegmentedTabs({ tabs, value, onChange, style }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, tabs.findIndex((t) => t.key === value));
  const tabWidth = width ? (width - PAD * 2) / tabs.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withSpring(index * tabWidth, { damping: 20, stiffness: 240, mass: 0.7 });
  }, [index, tabWidth, x]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: colors.surface2, borderColor: colors.line }, style]}
      accessibilityRole="tablist"
    >
      {tabWidth ? (
        <Animated.View style={[styles.indicator, { width: tabWidth, backgroundColor: colors.surface }, shadow(colors, 1), indicator]} />
      ) : null}
      {tabs.map((tab) => {
        const active = tab.key === value;
        const fg = active ? colors.brandInk : colors.muted;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
          >
            {tab.icon ? <Ionicons name={active ? tab.icon : `${tab.icon}-outline`} size={16} color={fg} /> : null}
            <Text variant="smallStrong" color={fg} numberOfLines={1}>
              {tab.label}
            </Text>
            {tab.badge ? (
              <View style={[styles.badge, { backgroundColor: colors.leaf }]}>
                <Text variant="caption" color="#ffffff" style={styles.badgeText}>
                  {tab.badge > 99 ? '99+' : String(tab.badge)}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: PAD, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, height: 46 },
  indicator: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: radius.md },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, lineHeight: 13, fontWeight: '800' },
});
