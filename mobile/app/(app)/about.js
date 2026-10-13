import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DeveloperCredit } from '@/components/DeveloperCredit';
import { PulsingLogo } from '@/components/Logo';
import { Button, Card, Screen, StackHeader, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { site } from '@/utils/constants';

// The same account of the community as the website's About page.
const FEATURES = [
  ['people', 'Find your friends', 'Find batchmates by name, specialization or city, and read their professional journeys.'],
  ['chatbubbles', 'Group and one-to-one chat', 'Talk with the whole community, or privately with one colleague.'],
  ['newspaper', 'A community feed', 'Updates, achievements, reunion news and announcements from members.'],
  ['book', 'Blogs by members', 'Experiences and ideas written by the people you trained with.'],
  ['images', 'Shared memories', 'Photos and videos from college years and reunions, kept in one place.'],
  ['calendar', 'Events and visit plans', 'Plan reunions, dinners and visits, with RSVPs.'],
];

const VALUES = [
  ['lock-closed', 'Privacy', 'Member content is shown to signed-in members. Your contact details stay hidden unless you switch them on.'],
  ['hand-left', 'Respect', 'This is a community of colleagues and friends. Harassment, discrimination, impersonation and abusive behaviour have no place here.'],
  ['medkit', 'Professional conduct', 'Patient confidentiality comes first. Identifiable patient records, prescriptions, reports and clinical details must never be shared.'],
  ['shield-checkmark', 'Moderation', 'Members can report anything that concerns them, and administrators can remove content or suspend accounts.'],
];

function Item({ icon, title, text, tone = 'brand' }) {
  const { colors } = useTheme();
  return (
    <View style={styles.item}>
      <View style={[styles.icon, { backgroundColor: tone === 'leaf' ? colors.leafSoft : colors.brandSoft }]}>
        <Ionicons name={icon} size={18} color={tone === 'leaf' ? colors.leafStrong : colors.brandInk} />
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="small" tone="muted">
          {text}
        </Text>
      </View>
    </View>
  );
}

export default function About() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Screen header={<StackHeader title="About" />} scroll padded={false}>
      <LinearGradient colors={colors.gradientHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <PulsingLogo size={70} />
        <Text variant="eyebrow" color="#6fe3ad">
          About {site.name}
        </Text>
        <Text variant="display" color="#ffffff" center>
          {site.tagline}
        </Text>
        <Text color="rgba(255,255,255,0.86)" center>
          A private home for a medical batch, long after graduation.
        </Text>
      </LinearGradient>

      <View style={styles.body}>
        <Card style={styles.card}>
          <Text variant="h2">A community of doctors who trained together</Text>
          <Text tone="soft">
            MKCGSPANDAN brings doctors and medical batchmates together in one place — to reconnect, to celebrate each other’s work, to keep shared memories safe and to make the next reunion easier to plan.
          </Text>
          <Text tone="soft">
            It is not a hospital system, a patient service or a general social network. There are no patient records here, no advertisements and no public timeline. It exists to keep people who shared the years of medical training connected throughout their careers.
          </Text>
          <Text variant="small" tone="muted">
            MKCGSPANDAN is an independent, member-run community. It does not represent, and is not presented as being endorsed by, any medical college, hospital, council or other institution.
          </Text>
        </Card>

        <Card style={styles.card}>
          <View style={styles.spandan}>
            <Ionicons name="pulse" size={22} color={colors.leaf} />
            <Text variant="h3">Why “Spandan”?</Text>
          </View>
          <Text tone="soft">
            Spandan means a heartbeat — a pulse. It is the first sign every doctor learns to look for, and a fitting name for what keeps a batch alive: the regular, quiet rhythm of people checking in on one another.
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text variant="h3">What you can do here</Text>
          {FEATURES.map(([icon, title, text]) => (
            <Item key={title} icon={icon} title={title} text={text} />
          ))}
        </Card>

        <Card style={styles.card}>
          <Text variant="h3">What the community stands for</Text>
          {VALUES.map(([icon, title, text]) => (
            <Item key={title} icon={icon} title={title} text={text} tone="leaf" />
          ))}
        </Card>

        <Button title="Privacy and Community Guidelines" icon="document-text-outline" variant="secondary" onPress={() => router.push('/guidelines')} full />
        <DeveloperCredit style={styles.credit} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', paddingHorizontal: space.xl, paddingTop: 8, paddingBottom: 30, gap: 6 },
  body: { padding: space.lg, gap: 14 },
  card: { gap: 12 },
  credit: { marginTop: 6 },
  spandan: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  item: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
