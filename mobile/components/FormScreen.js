import { StyleSheet, View } from 'react-native';
import { Banner, Button, Screen, StackHeader, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { messageOf } from '@/services/api';

// Frame shared by every create/edit form: header, scrolling fields, and a
// fixed footer with the main action. During onboarding the same forms are
// shown with a step indicator and a "Skip for Now" button.
export function FormScreen({ title, subtitle, step, steps, children, submitLabel, submitIcon, onSubmit, busy, disabled, onSkip, skipLabel = 'Skip for Now', failure, note, back = true }) {
  const { colors } = useTheme();
  const header = (
    <StackHeader title={title} subtitle={subtitle} back={back}>
      {step ? (
        <View>
          <Text variant="eyebrow" tone="leaf">
            Step {step} of {steps}
          </Text>
          <Text variant="h2" numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          <View style={styles.steps}>
            {Array.from({ length: steps }).map((_, i) => (
              <View key={i} style={[styles.step, { backgroundColor: i < step ? colors.leaf : colors.surface2 }]} />
            ))}
          </View>
        </View>
      ) : null}
    </StackHeader>
  );

  return (
    <Screen
      header={header}
      scroll
      keyboard
      footer={
        <>
          <Button title={submitLabel} icon={submitIcon} onPress={onSubmit} loading={busy} disabled={disabled} full size="lg" />
          {onSkip ? <Button title={skipLabel} variant="ghost" onPress={onSkip} disabled={busy} full /> : null}
        </>
      }
    >
      {step && subtitle ? (
        <Text tone="muted" style={styles.intro}>
          {subtitle}
        </Text>
      ) : null}
      {failure ? (
        <Banner tone="danger" title={failure.isNetwork ? 'Cannot reach the server' : undefined} message={messageOf(failure)} style={styles.banner} />
      ) : null}
      {children}
      {note ? (
        <Text variant="caption" tone="muted" center style={styles.note}>
          {note}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', gap: 5, marginTop: 6 },
  step: { flex: 1, height: 4, borderRadius: 2 },
  intro: { marginBottom: 16 },
  banner: { marginBottom: 16 },
  note: { marginTop: 4 },
});
