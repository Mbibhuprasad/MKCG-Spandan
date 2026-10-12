'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { api, formErrors } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import Button from '@/components/ui/Button';
import { FormMessage, TextField } from '@/components/ui/Form';
import { PageLoader } from '@/components/ui/Feedback';
import AdminAuthShell, { SecretField } from './AdminAuthShell';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const points = [
  'Only someone who holds the admin registration key can create an administrator.',
  'Use a strong password — this account can moderate all content and accounts.',
  'You are signed in straight away and taken to the admin panel.',
];

const initial = { name: '', email: '', phone: '', password: '', confirmPassword: '', registrationKey: '' };

// Mirrors the server rules for quick feedback. The API validates everything again.
function validate(values) {
  const errors = {};
  if (values.name.trim().length < 2) errors.name = 'Enter your full name.';
  if (!EMAIL_RE.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  const digits = values.phone.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) errors.phone = 'Enter a valid phone number.';
  if (values.password.length < 12) errors.password = 'Use at least 12 characters.';
  else if (!/[A-Za-z]/.test(values.password) || !/\d/.test(values.password)) {
    errors.password = 'Include at least one letter and one number.';
  }
  if (values.confirmPassword !== values.password) errors.confirmPassword = 'Passwords do not match.';
  if (!values.registrationKey) errors.registrationKey = 'Enter the admin registration key.';
  return errors;
}

export default function AdminRegisterForm() {
  const router = useRouter();
  const { status, user, isAdmin, refreshUser } = useAuth();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Registration signs the administrator in, so this also handles the redirect afterwards.
  useEffect(() => {
    if (status === 'authenticated' && isAdmin) router.replace('/admin');
  }, [status, isAdmin, router]);

  const set = (key) => (event) => {
    const { value } = event.target;
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    const fieldErrors = validate(values);
    setErrors(fieldErrors);
    setMessage('');
    if (Object.keys(fieldErrors).length) return;

    setBusy(true);
    try {
      await api.post('/admin-register', values, { silentAuth: true });
      await refreshUser(); // loads the new admin session; the effect above then redirects
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
      headline="Create an administrator"
      lead="Set up an administrator account for the community."
      points={points}
      title="Admin registration"
      subtitle="Fill in your details and the admin registration key you were given."
      footer={
        <>
          <p>
            Already an administrator?{' '}
            <Link href="/admin-login" className="font-semibold text-brand-ink hover:underline">
              Admin login
            </Link>
          </p>
          <p>
            Are you a doctor?{' '}
            <Link href="/register" className="font-semibold text-leaf hover:underline">
              Join as a member
            </Link>
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {status === 'authenticated' && !message && (
          <FormMessage tone="info">
            You are signed in as {user.name}, a member account. Registering here creates a separate administrator account and
            switches to it.
          </FormMessage>
        )}
        <FormMessage>{message}</FormMessage>

        <TextField
          label="Full name"
          name="name"
          autoComplete="name"
          placeholder="Community Admin"
          value={values.name}
          onChange={set('name')}
          error={errors.name}
          required
          maxLength={80}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="admin@example.com"
            value={values.email}
            onChange={set('email')}
            error={errors.email}
            required
          />
          <TextField
            label="Phone number"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="98765 43210"
            hint="Add the country code if outside India."
            value={values.phone}
            onChange={set('phone')}
            error={errors.phone}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SecretField
            label="Password"
            name="password"
            autoComplete="new-password"
            hint="At least 12 characters with a letter and a number."
            value={values.password}
            onChange={set('password')}
            error={errors.password}
            required
          />
          <SecretField
            label="Confirm password"
            name="confirmPassword"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={set('confirmPassword')}
            error={errors.confirmPassword}
            required
          />
        </div>

        <div className="rounded-xl border border-leaf/30 bg-leaf-soft p-4">
          <SecretField
            label="Admin registration key"
            name="registrationKey"
            autoComplete="off"
            hint="The secret key set on the server (ADMIN_REGISTER_KEY)."
            value={values.registrationKey}
            onChange={set('registrationKey')}
            error={errors.registrationKey}
            required
          />
        </div>

        <Button type="submit" size="lg" className="w-full" loading={busy} icon={UserPlus}>
          {busy ? 'Creating the admin account…' : 'Create admin account'}
        </Button>
      </form>
    </AdminAuthShell>
  );
}
