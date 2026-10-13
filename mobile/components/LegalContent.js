import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Banner, Card, Text } from '@/components/ui';
import { WEB_URL } from '@/services/config';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { openLink } from '@/utils/phone';

// A mobile summary of the Community Guidelines and Privacy Policy published on
// the MKCGSPANDAN website (frontend/src/app/community-guidelines and /privacy).
// The website holds the complete, authoritative texts.
const GUIDELINES = [
  {
    icon: 'heart',
    title: 'The spirit of the community',
    points: [
      'Treat this like a reunion: with warmth, good humour and the courtesy you would show a colleague.',
      'Celebrate one another’s achievements; disagree without making it personal.',
      'Share what you would be comfortable having every batchmate read. Blogs are public — write them accordingly.',
    ],
  },
  {
    icon: 'shield-checkmark',
    title: 'Patient confidentiality comes first',
    points: [
      'Never post identifiable patient records, prescriptions, reports, images or case details without proper legal authorisation.',
      'This includes anything visible in the background of a photo — a monitor, a case sheet, a name board, a patient in a ward.',
      'This is a place to stay in touch, not for clinical consultations, referrals or patient data.',
    ],
  },
  {
    icon: 'ban',
    title: 'What is not allowed',
    points: [
      'Harassment, bullying, threats and abusive or demeaning content.',
      'Discrimination on grounds such as gender, religion, caste, ethnicity, region, language, disability, age or sexual orientation.',
      'Impersonation, or misrepresenting your qualifications or position.',
      'Sexually explicit, obscene, violent or otherwise unlawful images and videos.',
      'Photos, contact details, messages or personal information about someone else shared without their consent.',
      'Spam, advertising, scams and malicious links.',
      'Collecting or exporting members’ details, or using them outside the community without consent.',
    ],
  },
  {
    icon: 'images',
    title: 'Sharing memories responsibly',
    points: [
      'Share photos and videos you took yourself or have permission to share.',
      'If a batchmate asks for a memory showing them to be removed, remove it — or ask an administrator to.',
      'Do not redistribute other members’ photos outside the community without their agreement.',
    ],
  },
  {
    icon: 'flag',
    title: 'Publishing and moderation',
    points: [
      'What you post is published immediately — there is no approval step.',
      'Any member can report content that concerns them from the menu on a post, blog, memory, event or comment.',
      'Administrators can remove content and suspend or delete accounts that break these guidelines.',
    ],
  },
];

const PRIVACY = [
  {
    icon: 'lock-closed',
    title: 'What is stored',
    points: [
      'Your name, email address, phone number and a one-way hash of your password — nobody, including administrators, can read the password.',
      'The profile details you choose to add, and what you contribute: posts, blogs, comments, memories, events, polls, chat messages, likes, votes and RSVPs.',
      'A session record for each device you sign in on.',
    ],
  },
  {
    icon: 'eye',
    title: 'Who can see what',
    points: [
      'Signed-in members see your name, photo and professional profile, and what you share.',
      'Your email address and phone number are hidden from other members unless you switch them on. Your WhatsApp number is shown to members only while “Show WhatsApp” is on.',
      'Blogs are public, with the author’s name, title, specialization and photo.',
      'One-to-one chat messages can be read only by the two people in the conversation.',
      'Administrators can see all accounts and community content.',
    ],
  },
  {
    icon: 'cloud-upload',
    title: 'Photos and videos',
    points: [
      'Media is stored with Cloudinary under generated names; the original file name is not kept.',
      'Memories, post images and event covers are access-controlled and opened through signed links issued to signed-in members.',
      'Profile photos and blog covers are ordinary web images because they can appear on public pages.',
    ],
  },
  {
    icon: 'phone-portrait',
    title: 'On this phone',
    points: [
      'The app keeps your session token and your theme and alert preferences in Android’s encrypted storage. Your password is never stored.',
      'The app asks for access to your photos only when you choose a photo or video to upload. It does not use the camera, microphone, contacts or location.',
      'Signing out ends the session on the server and removes the token from the phone.',
    ],
  },
];

function Section({ icon, title, points }) {
  const { colors } = useTheme();
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.iconTile, { backgroundColor: colors.brandSoft }]}>
          <Ionicons name={icon} size={18} color={colors.brandInk} />
        </View>
        <Text variant="h3" style={styles.flex}>
          {title}
        </Text>
      </View>
      {points.map((point) => (
        <View key={point} style={styles.point}>
          <View style={[styles.dot, { backgroundColor: colors.leaf }]} />
          <Text variant="small" tone="soft" style={styles.flex}>
            {point}
          </Text>
        </View>
      ))}
    </Card>
  );
}

// which: 'guidelines' | 'privacy' | 'both'
export function LegalContent({ which = 'both' }) {
  return (
    <View style={styles.wrap}>
      {which !== 'privacy' ? (
        <>
          <Text variant="eyebrow" tone="leaf">
            Community Guidelines
          </Text>
          {GUIDELINES.map((s) => (
            <Section key={s.title} {...s} />
          ))}
        </>
      ) : null}
      {which !== 'guidelines' ? (
        <>
          <Text variant="eyebrow" tone="leaf" style={which === 'both' && styles.gap}>
            Privacy
          </Text>
          {PRIVACY.map((s) => (
            <Section key={s.title} {...s} />
          ))}
        </>
      ) : null}
      <Banner
        tone="info"
        message="This is a summary. The complete Terms, Privacy Policy and Community Guidelines are published on the MKCGSPANDAN website."
        actionLabel={WEB_URL ? 'Open the website' : undefined}
        onAction={WEB_URL ? () => openLink(`${WEB_URL}/community-guidelines`) : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: space.md },
  gap: { marginTop: space.lg },
  card: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconTile: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
});
