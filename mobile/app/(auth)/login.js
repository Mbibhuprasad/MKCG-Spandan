import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Banner, Button, Input, Text } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { AuthShell } from '@/features/auth/AuthShell';
import { validateLogin } from '@/features/auth/validation';
import { fieldErrors, messageOf } from '@/services/api';

export default function Login() {
  const router = useRouter();
  const { signIn, notice, clearNotice } = useAuth();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef(null);

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async () => {
    if (busy) return; // one request at a time, however often the button is tapped
    const found = validateLogin(form);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    clearNotice();
    try {
      await signIn({ identifier: form.identifier.trim(), password: form.password });
      // Nothing to navigate: the root layout moves signed-in doctors into the app.
    } catch (error) {
      setErrors(fieldErrors(error));
      setFailure(error);
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to reconnect with your Friends."
      footer={
        <Text tone="muted">
          New to MKCGSPANDAN?{" "}
          <Text
            variant="bodyStrong"
            tone="brand"
            onPress={() => router.push("/register")}
            accessibilityRole="link"
          >
            Create an account
          </Text>
        </Text>
      }
    >
      {notice ? (
        <Banner tone="warn" message={notice} style={styles.banner} />
      ) : null}
      {failure ? (
        <Banner
          tone="danger"
          title={failure.isNetwork ? "Cannot reach the server" : undefined}
          message={messageOf(failure)}
          style={styles.banner}
        />
      ) : null}

      <Input
        label="Email or phone number"
        icon="person-outline"
        value={form.identifier}
        onChangeText={set("identifier")}
        error={errors.identifier}
        placeholder="you@example.com or 98765 43210"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        keyboardType="email-address"
        returnKeyType="next"
        onSubmitEditing={() =>
          passwordRef.current && passwordRef.current.focus()
        }
        blurOnSubmit={false}
        maxLength={254}
      />
      <Input
        ref={passwordRef}
        label="Password"
        icon="lock-closed-outline"
        value={form.password}
        onChangeText={set("password")}
        error={errors.password}
        placeholder="Your password"
        secure
        autoCapitalize="none"
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={submit}
        maxLength={200}
      />
      <Button
        title="Sign in"
        icon="log-in-outline"
        onPress={submit}
        loading={busy}
        full
        size="lg"
      />
      <View style={styles.note}>
        <Text variant="caption" tone="muted" center>
          Forgotten your password? Ask a community administrator to help you
          reset it.
        </Text>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  banner: { marginBottom: 16 },
  note: { marginTop: 14 },
});
