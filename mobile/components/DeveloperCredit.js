import { Linking, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PressableScale } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/contexts/ToastContext';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { site } from '@/utils/constants';

// Only a full https:// address becomes a link; anything else hides that link.
const httpsUrl = (value) => (/^https:\/\/[^\s]+$/i.test(String(value || '').trim()) ? String(value).trim() : '');

function CreditLink({ icon, label, hint, url }) {
  const { colors } = useTheme();
  const toast = useToast();
  const open = async () => {
    try {
      await Linking.openURL(url);
    } catch {
      toast.error(`${label} could not be opened on this phone.`);
    }
  };
  return (
    <PressableScale
      onPress={open}
      scaleTo={0.95}
      style={[styles.link, { backgroundColor: colors.surface, borderColor: colors.line }]}
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${hint}`}
      accessibilityHint="Opens in your browser"
    >
      <View style={[styles.linkIcon, { backgroundColor: colors.brandSoft }]}>
        <Ionicons name={icon} size={14} color={colors.brandInk} />
      </View>
      <View>
        <Text variant="smallStrong">{label}</Text>
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      </View>
    </PressableScale>
  );
}

// "Designed & Developed with ♥ by …" with the developer's portfolio and
// LinkedIn, for the end of a scrolling screen. Set in utils/constants.js.
export function DeveloperCredit({ style }) {
  const { colors } = useTheme();
  const { name } = site.developer;
  const portfolioUrl = httpsUrl(site.developer.portfolioUrl);
  const linkedinUrl = httpsUrl(site.developer.linkedinUrl);
  if (!name) return null;
  return (
    <Animated.View
      entering={FadeInUp.duration(320)}
      style={[styles.card, { backgroundColor: colors.surface2, borderColor: colors.line }, style]}
    >
      <Text variant="caption" tone="muted" center>
        Designed & Developed with{' '}
        <Text variant="caption" color={colors.danger} accessibilityLabel="love">
          ♥
        </Text>{' '}
        by{' '}
        <Text variant="caption" tone="brand" style={styles.name}>
          {name}
        </Text>
      </Text>
      {portfolioUrl || linkedinUrl ? (
        <View style={styles.links}>
          {portfolioUrl ? <CreditLink icon="globe-outline" label="Portfolio" hint="Visit website" url={portfolioUrl} /> : null}
          {linkedinUrl ? <CreditLink icon="logo-linkedin" label="LinkedIn" hint="Connect professionally" url={linkedinUrl} /> : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: space.xl,
    marginHorizontal: space.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    gap: 10,
    alignItems: 'center',
  },
  name: { fontWeight: '700' },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  linkIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
