import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/theme/ThemeProvider';
import { HIT_SLOP, radius, shadow } from '@/theme/tokens';
import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { damping: 18, stiffness: 320, mass: 0.6 };

// A pressable that gives a little under the finger. Used by cards and buttons.
export function PressableScale({ children, style, scaleTo = 0.97, disabled, onPressIn, onPressOut, ...rest }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        scale.set(withSpring(scaleTo, SPRING));
        if (onPressIn) onPressIn(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, SPRING));
        if (onPressOut) onPressOut(e);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}

const SIZES = {
  sm: { height: 36, paddingHorizontal: 14, text: 'smallStrong', icon: 16 },
  md: { height: 46, paddingHorizontal: 18, text: 'bodyStrong', icon: 18 },
  lg: { height: 52, paddingHorizontal: 22, text: 'bodyStrong', icon: 20 },
};

// variant: primary (gradient) | leaf | secondary | ghost | danger
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  full = false,
  style,
  accessibilityLabel,
}) {
  const { colors } = useTheme();
  const s = SIZES[size] || SIZES.md;
  const inactive = disabled || loading;

  const look = {
    primary: { fg: '#ffffff', gradient: colors.gradientBrand },
    leaf: { fg: '#ffffff', gradient: colors.gradientLeaf },
    secondary: { fg: colors.brandInk, bg: colors.brandSoft, border: colors.glassLine },
    ghost: { fg: colors.brandInk, bg: 'transparent' },
    outline: { fg: colors.fg, bg: 'transparent', border: colors.lineStrong },
    danger: { fg: colors.danger, bg: colors.dangerSoft },
  }[variant];

  const content = (
    <View style={[styles.row, { height: s.height, paddingHorizontal: s.paddingHorizontal }]}>
      {loading ? (
        <ActivityIndicator size="small" color={look.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={s.icon} color={look.fg} /> : null}
          <Text variant={s.text} color={look.fg} numberOfLines={1}>
            {title}
          </Text>
          {iconRight ? <Ionicons name={iconRight} size={s.icon} color={look.fg} /> : null}
        </>
      )}
    </View>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[
        styles.base,
        full && styles.full,
        look.gradient ? shadow(colors, 1) : null,
        look.bg ? { backgroundColor: look.bg } : null,
        look.border ? { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: look.border } : null,
        inactive && styles.inactive,
        style,
      ]}
    >
      {look.gradient ? (
        <LinearGradient colors={look.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </PressableScale>
  );
}

// Round icon-only button with an optional count badge (header actions).
export function IconButton({ name, onPress, size = 22, color, tint = 'surface', badge, accessibilityLabel, style, disabled }) {
  const { colors } = useTheme();
  const bg = tint === 'none' ? 'transparent' : tint === 'brand' ? colors.brandSoft : tint === 'glass' ? 'rgba(255,255,255,0.16)' : colors.surface2;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      hitSlop={HIT_SLOP}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.iconButton, { backgroundColor: bg }, disabled && styles.inactive, style]}
    >
      <Ionicons name={name} size={size} color={color || colors.fg} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.bg }]}>
          <Text variant="caption" color="#ffffff" style={styles.badgeText}>
            {badge > 99 ? '99+' : String(badge)}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg, overflow: 'hidden', alignSelf: 'flex-start' },
  full: { alignSelf: 'stretch' },
  gradient: { borderRadius: radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  inactive: { opacity: 0.55 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 9.5, lineHeight: 12, fontWeight: '800' },
});
