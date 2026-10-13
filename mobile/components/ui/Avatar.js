import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/theme/ThemeProvider';
import { initials } from '@/utils/format';
import { Text } from './Text';

// A member's photo, or their initials on the brand gradient when they have not
// added one. `icon` shows a symbol instead (used for group conversations).
export function Avatar({ uri, name = '', size = 44, icon, ring = false, square = false, style }) {
  const { colors } = useTheme();
  const borderRadius = square ? Math.round(size * 0.26) : size / 2;
  const frame = [
    { width: size, height: size, borderRadius },
    ring && { borderWidth: 2, borderColor: colors.surface },
    style,
  ];

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[frame, { backgroundColor: colors.surface2 }]}
        contentFit="cover"
        transition={180}
        accessibilityIgnoresInvertColors
        accessibilityLabel={name ? `${name}'s photo` : undefined}
      />
    );
  }
  return (
    <LinearGradient colors={colors.gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[frame, styles.center]}>
      {icon ? (
        <Ionicons name={icon} size={Math.round(size * 0.48)} color="#ffffff" />
      ) : (
        <Text color="#ffffff" style={{ fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.46), fontWeight: '800' }}>
          {initials(name)}
        </Text>
      )}
    </LinearGradient>
  );
}

// A few overlapping avatars (attendees, group members).
export function AvatarStack({ people = [], size = 28, max = 4 }) {
  return (
    <View style={styles.stack}>
      {people.slice(0, max).map((p, i) => (
        <Avatar key={p.id || i} uri={p.photoUrl} name={p.name} size={size} ring style={{ marginLeft: i ? -size * 0.3 : 0 }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  stack: { flexDirection: 'row', alignItems: 'center' },
});
