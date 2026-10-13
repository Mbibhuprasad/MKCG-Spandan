import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

// `media` items are the API's Media objects: { id, resourceType, url, thumbUrl, width, height }.
// Member-only media arrives as signed Cloudinary URLs, used exactly as given.

function ActiveVideo({ uri, style }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  return <VideoView player={player} style={style} nativeControls contentFit="contain" />;
}

// Poster with a play button; the player is created only when the doctor taps it.
function VideoItem({ item, style }) {
  const [playing, setPlaying] = useState(false);
  if (playing) return <ActiveVideo uri={item.url} style={style} />;
  return (
    <Pressable style={style} onPress={() => setPlaying(true)} accessibilityRole="button" accessibilityLabel="Play video">
      <Image source={{ uri: item.thumbUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      <View style={styles.playWrap}>
        <View style={styles.play}>
          <Ionicons name="play" size={26} color="#ffffff" />
        </View>
      </View>
    </Pressable>
  );
}

// Swipeable, full-width media (memory detail, viewer).
export function MediaCarousel({ media = [], height = 320, contain = false, initialIndex = 0, width: fixedWidth }) {
  const { colors } = useTheme();
  const window = useWindowDimensions();
  const width = fixedWidth || window.width;
  const [index, setIndex] = useState(initialIndex);
  if (!media.length) return null;
  return (
    <View style={{ height, backgroundColor: contain ? '#000000' : colors.surface2 }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: initialIndex * width, y: 0 }}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {media.map((item) =>
          item.resourceType === 'video' ? (
            <VideoItem key={item.id} item={item} style={{ width, height, backgroundColor: '#000000' }} />
          ) : (
            <Image
              key={item.id}
              source={{ uri: item.url }}
              placeholder={item.thumbUrl ? { uri: item.thumbUrl } : undefined}
              style={{ width, height }}
              contentFit={contain ? 'contain' : 'cover'}
              transition={200}
              accessibilityIgnoresInvertColors
            />
          )
        )}
      </ScrollView>
      {media.length > 1 ? (
        <View style={styles.counter}>
          <Text variant="caption" color="#ffffff">
            {index + 1} / {media.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// Full-screen viewer opened from a grid.
export function MediaViewer({ media, index, onClose }) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const open = index !== null && index !== undefined;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.viewer}>
        {open ? <MediaCarousel media={media} height={window.height} contain initialIndex={index} /> : null}
        <Pressable onPress={onClose} style={[styles.close, { top: insets.top + 10 }]} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={22} color="#ffffff" />
        </Pressable>
      </View>
    </Modal>
  );
}

// One to four attachments inside a card (community posts).
export function MediaGrid({ media = [], style }) {
  const { colors } = useTheme();
  const [viewing, setViewing] = useState(null);
  if (!media.length) return null;
  const single = media.length === 1;
  return (
    <>
      <View style={[styles.grid, style]}>
        {media.slice(0, 4).map((item, i) => (
          <Pressable
            key={item.id}
            onPress={() => setViewing(i)}
            style={[
              styles.cell,
              { backgroundColor: colors.surface2 },
              single ? styles.cellSingle : media.length === 3 && i === 0 ? styles.cellWide : styles.cellHalf,
            ]}
            accessibilityRole="imagebutton"
            accessibilityLabel={item.resourceType === 'video' ? 'Open video' : 'Open photo'}
          >
            <Image source={{ uri: single ? item.url : item.thumbUrl || item.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} />
            {item.resourceType === 'video' ? (
              <View style={styles.playWrap}>
                <View style={styles.play}>
                  <Ionicons name="play" size={22} color="#ffffff" />
                </View>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
      <MediaViewer media={media} index={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  playWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  play: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', paddingLeft: 3 },
  counter: { position: 'absolute', right: 12, bottom: 12, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  viewer: { flex: 1, backgroundColor: '#000000' },
  close: { position: 'absolute', right: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, borderRadius: radius.lg, overflow: 'hidden' },
  cell: { overflow: 'hidden' },
  cellSingle: { width: '100%', aspectRatio: 4 / 3 },
  cellWide: { width: '100%', aspectRatio: 2 },
  cellHalf: { width: '49.4%', aspectRatio: 1 },
});
