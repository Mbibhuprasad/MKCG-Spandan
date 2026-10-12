'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogIn } from 'lucide-react';
import { api, formErrors } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import Button from '@/components/ui/Button';
import { FormMessage, TextField } from '@/components/ui/Form';
import { PageLoader } from '@/components/ui/Feedback';
import { safeNextPath } from './AuthShell';
import AdminAuthShell, { SecretField } from './AdminAuthShell';

const points = [
  'See everything members publish and delete what should not be there.',
  'Manage doctor accounts and what appears on the public homepage.',
  'Every admin action is recorded in the audit log.',
];

export default function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get('next'), '/admin');
  const { status, user, isAdmin, refreshUser } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Already an administrator (or just signed in as one): go to the admin panel.
  useEffect(() => {
    if (status === 'authenticated' && isAdmin) router.replace(next);
  }, [status, isAdmin, router, next]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    const fieldErrors = {};
    if (!identifier.trim()) fieldErrors.identifier = 'Enter your admin email or phone number.';
    if (!password) fieldErrors.password = 'Enter your password.';
    setErrors(fieldErrors);
    setMessage('');
    if (Object.keys(fieldErrors).length) return;

    setBusy(true);
    try {
      await api.post('/admin-login', { identifier: identifier.trim(), password }, { silentAuth: true });
      await refreshUser(); // loads the admin session; the effect above then redirects
    } catch (error) {
      const parsed = formErrors(error);
      setErrors(parsed.fieldErrors);
      setMessage(parsed.message);
      setBusy(false);
    }
  }

  if (status === 'loading' || (status === 'authenticated' && isAdmin)) return <PageLoader label="Opening the admin panel…" />;

  return (
    <AdminAuthShell
      eyebrow="MKCGSPANDAN Admin"
      headline="Administrator sign in"
      lead="This entrance is for community administrators only."
      points={points}
      title="Admin login"
      subtitle="Log in with your administrator email address or phone number."
      footer={
        <>
          <p>
            Need an admin account?{' '}
            <Link href="/admin-register" className="font-semibold text-brand-ink hover:underline">
              Register an administrator
            </Link>
          </p>
          <p>
            Are you a doctor?{' '}
            <Link href="/login" className="font-semibold text-leaf hover:underline">
              Member login
            </Link>
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {status === 'authenticated' && !message && (
          <FormMessage tone="info">
            You are signed in as {user.name}, a member account. Logging in here switches to the administrator account.
          </FormMessage>
        )}
        <FormMessage>{message}</FormMessage>

        <TextField
          label="Admin email or phone number"
          name="identifier"
          autoComplete="username"
          inputMode="email"
          placeholder="admin@example.com"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          error={errors.identifier}
          required
          autoFocus
        />

        <SecretField
          label="Password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
        />

        <Button type="submit" size="lg" className="w-full" loading={busy} icon={LogIn}>
          {busy ? 'Logging in…' : 'Log in as admin'}
        </Button>
      </form>
    </AdminAuthShell>
  );
}
