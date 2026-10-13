import { Linking, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import { space } from '@/theme/tokens';
import { site } from '@/utils/constants';

// Only a full web address becomes a link; anything else is shown as plain text.
const url = /^https?:\/\//i.test(site.developer.url) ? site.developer.url : '';

// "Developed by …", for the end of a scrolling screen. The name and the
// optional link are set in utils/constants.js (site.developer).
export function DeveloperCredit({ style }) {
  if (!site.developer.name) return null;
  return (
    <Text variant="caption" tone="muted" center style={[styles.credit, style]}>
      Developed by{' '}
      <Text
        variant="caption"
        tone={url ? 'brand' : 'soft'}
        style={styles.name}
        onPress={url ? () => Linking.openURL(url).catch(() => {}) : undefined}
        accessibilityRole={url ? 'link' : undefined}
        suppressHighlighting
      >
        {site.developer.name}
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  credit: { marginTop: space.xl, paddingHorizontal: space.lg },
  name: { fontWeight: '700' },
});
