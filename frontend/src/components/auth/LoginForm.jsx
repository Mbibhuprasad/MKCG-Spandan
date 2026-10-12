'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { formErrors } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import Button from '@/components/ui/Button';
import { Field, FormMessage, Input, TextField } from '@/components/ui/Form';
import { PageLoader } from '@/components/ui/Feedback';
import AuthShell, { safeNextPath } from './AuthShell';

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const { status, login, sessionMessage } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Already signed in (or just signed in): leave the login page.
  useEffect(() => {
    if (status === 'authenticated') router.replace(next);
  }, [status, router, next]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    const fieldErrors = {};
    if (!identifier.trim()) fieldErrors.identifier = 'Enter your email or phone number.';
    if (!password) fieldErrors.password = 'Enter your password.';
    setErrors(fieldErrors);
    setMessage('');
    if (Object.keys(fieldErrors).length) return;

    setBusy(true);
    try {
      await login(identifier.trim(), password);
      // The effect above redirects once the session is in place.
    } catch (error) {
      const parsed = formErrors(error);
      setErrors(parsed.fieldErrors);
      setMessage(parsed.message);
      setBusy(false);
    }
  }

  if (status === 'loading' || status === 'authenticated') return <PageLoader label="Signing you in…" />;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in with the email address or phone number you registered with."
      footer={
        <>
          New to MKCGSPANDAN?{' '}
          <Link href="/register" className="font-semibold text-brand-ink hover:underline">
            Join the community
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {sessionMessage && !message && <FormMessage tone="warn">{sessionMessage}</FormMessage>}
        <FormMessage>{message}</FormMessage>

        <TextField
          label="Email or phone number"
          name="identifier"
          autoComplete="username"
          inputMode="email"
          placeholder="you@example.com or 98765 43210"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          error={errors.identifier}
          required
          autoFocus
        />

        <Field label="Password" error={errors.password} required>
          {(props) => (
            <div className="relative">
              <Input
                {...props}
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          )}
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={busy} icon={LogIn}>
          {busy ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </AuthShell>
  );
}
