import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadow } from '@/theme/tokens';
import { formatDate } from '@/utils/format';

// Photo tile with the caption over a gradient. Used on Home (fixed width) and
// in the two-column Memories grid (flexible width).
export function MemoryTile({ memory, width, height = 190, style }) {
  const { colors } = useTheme();
  const router = useRouter();
  const first = memory.media[0];
  const when = memory.event ? memory.event.title : formatDate(memory.memoryDate || memory.publishedAt || memory.createdAt);
  return (
    <PressableScale
      onPress={() => router.push(`/memories/${memory.id}`)}
      style={[styles.tile, { width, height, backgroundColor: colors.surface2 }, shadow(colors, 1), style]}
      accessibilityRole="button"
      accessibilityLabel={`View memory: ${memory.title}`}
    >
      {first ? <Image source={{ uri: first.thumbUrl || first.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityIgnoresInvertColors /> : null}
      <LinearGradient colors={['transparent', 'rgba(4,10,26,0.86)']} style={styles.shade} />
      <View style={styles.badges}>
        {first && first.resourceType === 'video' ? (
          <View style={styles.badge}>
            <Ionicons name="videocam" size={12} color="#ffffff" />
          </View>
        ) : null}
        {memory.media.length > 1 ? (
          <View style={styles.badge}>
            <Ionicons name="copy-outline" size={11} color="#ffffff" />
            <Text variant="caption" color="#ffffff">
              {memory.media.length}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.caption}>
        <Text variant="smallStrong" color="#ffffff" numberOfLines={2}>
          {memory.title}
        </Text>
        <Text variant="caption" color="rgba(255,255,255,0.8)" numberOfLines={1}>
          {memory.owner.name}
          {when ? ` · ${when}` : ''}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.xl, overflow: 'hidden', justifyContent: 'flex-end' },
  shade: { ...StyleSheet.absoluteFillObject, top: '40%' },
  badges: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 5 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 7, height: 22, borderRadius: 11 },
  caption: { padding: 11, gap: 1 },
});
