import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Banner, Button, Checkbox, Input, Text } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { AuthShell } from '@/features/auth/AuthShell';
import { validateRegistration } from '@/features/auth/validation';
import { fieldErrors, messageOf } from '@/services/api';

const EMPTY = { name: '', email: '', phone: '', password: '', confirmPassword: '', acceptPolicies: false };

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async () => {
    if (busy) return;
    const found = validateRegistration(form);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      // Only these fields are sent. The role is assigned by the server (always
      // DOCTOR) and the account is active at once — there is no approval step.
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        acceptPolicies: true,
      });
      // Signed in: the root layout opens the app, which starts the onboarding.
    } catch (error) {
      setErrors(fieldErrors(error));
      setFailure(error);
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Join the community"
      subtitle="Create your doctor account. You are signed in straight away."
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
      footer={
        <Text tone="muted">
          Already a member?{' '}
          <Text variant="bodyStrong" tone="brand" onPress={() => router.replace('/login')} accessibilityRole="link">
            Sign in
          </Text>
        </Text>
      }
    >
      {failure ? (
        <Banner tone="danger" title={failure.isNetwork ? 'Cannot reach the server' : undefined} message={messageOf(failure)} style={styles.banner} />
      ) : null}

      <Input
        label="Full name"
        required
        icon="person-outline"
        value={form.name}
        onChangeText={set('name')}
        error={errors.name}
        placeholder="Dr. Ananya Mishra"
        autoCapitalize="words"
        autoComplete="name"
        maxLength={80}
      />
      <Input
        label="Email"
        required
        icon="mail-outline"
        value={form.email}
        onChangeText={set('email')}
        error={errors.email}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        maxLength={254}
      />
      <Input
        label="Phone number"
        required
        icon="call-outline"
        value={form.phone}
        onChangeText={set('phone')}
        error={errors.phone}
        help="10-digit Indian numbers get +91 automatically. Outside India, start with + and the country code."
        placeholder="98765 43210"
        keyboardType="phone-pad"
        autoComplete="tel"
        maxLength={32}
      />
      <Input
        label="Password"
        required
        icon="lock-closed-outline"
        value={form.password}
        onChangeText={set('password')}
        error={errors.password}
        help="At least 8 characters, with a letter and a number."
        placeholder="Create a password"
        secure
        autoCapitalize="none"
        autoComplete="new-password"
        maxLength={72}
      />
      <Input
        label="Confirm password"
        required
        icon="lock-closed-outline"
        value={form.confirmPassword}
        onChangeText={set('confirmPassword')}
        error={errors.confirmPassword}
        placeholder="Type it again"
        secure
        autoCapitalize="none"
        autoComplete="new-password"
        maxLength={72}
      />

      <Checkbox checked={form.acceptPolicies} onChange={set('acceptPolicies')} error={errors.acceptPolicies}>
        <Text variant="small" tone="soft">
          I accept the Terms, the Privacy Policy and the{' '}
          <Text variant="smallStrong" tone="brand" onPress={() => router.push('/policies')} accessibilityRole="link">
            Community Guidelines
          </Text>
          , and I will never share identifiable patient information.
        </Text>
      </Checkbox>

      <Button title="Create account" icon="person-add-outline" onPress={submit} loading={busy} full size="lg" style={styles.submit} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  banner: { marginBottom: 16 },
  submit: { marginTop: 18 },
});
