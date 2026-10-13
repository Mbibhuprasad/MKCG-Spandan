import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/components/ui/Text';
import { useChat } from '@/features/chat/ChatContext';
import { useTheme } from '@/theme/ThemeProvider';
import { TAB_BAR_HEIGHT, shadow } from '@/theme/tokens';

// The five primary destinations, in order. Nothing else is ever added here.
export const TABS = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'chat', label: 'Chat', icon: 'chatbubbles' },
  { name: 'library', label: 'Blogs & Memories', icon: 'book' },
  { name: 'community', label: 'Community', icon: 'people' },
  { name: 'profile', label: 'Profile', icon: 'person-circle' },
];

function TabItem({ tab, focused, onPress, onLongPress, badge }) {
  const { colors } = useTheme();
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, { damping: 16, stiffness: 220, mass: 0.6 });
  }, [focused, progress]);

  const pill = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ scaleX: 0.6 + progress.value * 0.4 }] }));
  const icon = useAnimatedStyle(() => ({ transform: [{ translateY: -2 * progress.value }, { scale: 1 + progress.value * 0.08 }] }));

  const tint = focused ? colors.brandInk : colors.muted;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={badge ? `${tab.label}, ${badge} unread` : tab.label}
    >
      <View style={styles.iconWrap}>
        <Animated.View style={[styles.pill, { backgroundColor: colors.brandSoft }, pill]} />
        <Animated.View style={icon}>
          <Ionicons name={focused ? tab.icon : `${tab.icon}-outline`} size={22} color={tint} />
        </Animated.View>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: colors.leaf, borderColor: colors.surface }]}>
            <Text color="#ffffff" style={styles.badgeText}>
              {badge > 99 ? '99+' : String(badge)}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="caption" color={tint} numberOfLines={2} center style={[styles.label, focused && styles.labelOn]}>
        {tab.label}
      </Text>
    </Pressable>
  );
}

export function TabBar({ state, navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { unread } = useChat();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const offset = useSharedValue(0);

  // The bar steps aside while the keyboard is up so it never sits on top of an input.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    offset.value = withTiming(keyboardOpen ? 1 : 0, { duration: 160 });
  }, [keyboardOpen, offset]);

  const height = TAB_BAR_HEIGHT + insets.bottom;
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value * height }], opacity: 1 - offset.value }));

  if (keyboardOpen) return null;

  return (
    <Animated.View style={[styles.bar, { height, paddingBottom: insets.bottom, borderTopColor: colors.line, backgroundColor: colors.surface }, shadow(colors, 3), slide]} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const index = state.routes.findIndex((r) => r.name === tab.name);
        if (index === -1) return null;
        const route = state.routes[index];
        const focused = state.index === index;
        return (
          <TabItem
            key={tab.name}
            tab={tab}
            focused={focused}
            badge={tab.name === 'chat' ? unread.total : 0}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
          />
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth * 2 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 7, gap: 1 },
  iconWrap: { width: 52, height: 30, alignItems: 'center', justifyContent: 'center' },
  pill: { position: 'absolute', width: 52, height: 30, borderRadius: 15 },
  label: { fontSize: 10, lineHeight: 12, paddingHorizontal: 2 },
  labelOn: { fontWeight: '800' },
  badge: {
    position: 'absolute',
    top: -3,
    right: 4,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 9, lineHeight: 11, fontWeight: '800' },
});
