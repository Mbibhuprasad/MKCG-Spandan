import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Banner, Button, Card, ProgressBar, Screen, StackHeader, Text } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { profileApi } from '@/features/profile/api';
import { SECTIONS, sectionForStep, sectionProgress } from '@/features/profile/sections';
import { messageOf } from '@/services/api';
import { useTheme } from '@/theme/ThemeProvider';
import { invalidate } from '@/utils/events';

// Profile → Edit / Complete profile. The sections are the website wizard's
// steps; each saves on its own, so the profile can be finished in any order
// and at any pace. "Submit profile" is the wizard's final step (submit: true).
export default function EditProfile() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const completion = user.profileCompletion;
  const resume = sectionForStep(completion.resumeStep);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const { data } = await profileApi.update({ submit: true });
      setUser(data);
      invalidate('profile');
      toast.success('Your profile is complete.');
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<StackHeader title={completion.isComplete ? 'Edit profile' : 'Complete profile'} />} scroll>
      <Card style={styles.summary}>
        <View style={styles.summaryHead}>
          <Text variant="h3" style={styles.flex}>
            {completion.percent >= 100 ? 'Your profile is filled in' : 'Profile completion'}
          </Text>
          <Text variant="h2" tone="leaf">
            {completion.percent}%
          </Text>
        </View>
        <ProgressBar value={completion.percent / 100} />
        {completion.missing.length ? (
          <Text variant="small" tone="muted">
            Still to add: {completion.missing.join(', ')}
          </Text>
        ) : null}
        {!completion.isComplete ? (
          <>
            {completion.requiredMissing.length ? (
              <Banner tone="warn" message={`Needed before you can submit: ${completion.requiredMissing.join(', ')}.`} />
            ) : (
              <Button title="Submit profile" icon="checkmark-done" variant="leaf" onPress={submit} loading={busy} full />
            )}
            {resume && completion.resumeStep > 0 ? (
              <Button title={`Continue with ${resume.title}`} iconRight="arrow-forward" variant="secondary" size="sm" onPress={() => router.push(`/profile/section/${resume.key}`)} />
            ) : null}
          </>
        ) : (
          <View style={styles.done}>
            <Ionicons name="checkmark-circle" size={16} color={colors.leaf} />
            <Text variant="small" tone="leaf">
              Submitted — you can still change anything below.
            </Text>
          </View>
        )}
        {failure ? <Banner tone="danger" message={messageOf(failure)} /> : null}
      </Card>

      {SECTIONS.map((section) => {
        const { filled, total } = sectionProgress(section, user);
        const complete = total > 0 && filled === total;
        return (
          <Card key={section.key} onPress={() => router.push(`/profile/section/${section.key}`)} style={styles.row} accessibilityLabel={`${section.title}, ${filled} of ${total} filled in`}>
            <View style={[styles.icon, { backgroundColor: complete ? colors.leafSoft : colors.brandSoft }]}>
              <Ionicons name={complete ? 'checkmark' : section.icon} size={19} color={complete ? colors.leafStrong : colors.brandInk} />
            </View>
            <View style={styles.flex}>
              <Text variant="bodyStrong">{section.title}</Text>
              <Text variant="caption" tone="muted" numberOfLines={2}>
                {section.description}
              </Text>
            </View>
            <Text variant="caption" tone={complete ? 'leaf' : 'muted'}>
              {filled}/{total}
            </Text>
            <Ionicons name="chevron-forward" size={17} color={colors.muted} />
          </Card>
        );
      })}

      <Card onPress={() => router.push('/create/memory?gallery=1')} style={styles.row} accessibilityLabel="Add photos to your gallery">
        <View style={[styles.icon, { backgroundColor: colors.brandSoft }]}>
          <Ionicons name="images-outline" size={19} color={colors.brandInk} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">Gallery</Text>
          <Text variant="caption" tone="muted">
            Add photos to the Gallery on your profile. They are not added to community Memories.
          </Text>
        </View>
        <Ionicons name="add" size={19} color={colors.muted} />
      </Card>

      <Card onPress={() => router.push('/settings')} style={styles.row} accessibilityLabel="Contact visibility settings">
        <View style={[styles.icon, { backgroundColor: colors.brandSoft }]}>
          <Ionicons name="eye-outline" size={19} color={colors.brandInk} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">Visibility</Text>
          <Text variant="caption" tone="muted">
            Choose which contact details and sections other members can see.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.muted} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { gap: 10, marginBottom: 16 },
  summaryHead: { flexDirection: 'row', alignItems: 'center' },
  done: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 10 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
