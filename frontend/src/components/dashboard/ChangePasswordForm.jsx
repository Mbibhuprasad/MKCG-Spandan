'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api, formErrors } from '@/lib/api';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import { FormMessage, TextField } from '@/components/ui/Form';

const empty = { currentPassword: '', newPassword: '', confirmPassword: '' };

/** Changes the signed-in user's password (PATCH /auth/password). */
export default function ChangePasswordForm() {
  const toast = useToast();
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (event) => {
    setValues((v) => ({ ...v, [key]: event.target.value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    const fieldErrors = {};
    if (!values.currentPassword) fieldErrors.currentPassword = 'Enter your current password.';
    if (values.newPassword.length < 8) fieldErrors.newPassword = 'Use at least 8 characters.';
    else if (!/[A-Za-z]/.test(values.newPassword) || !/\d/.test(values.newPassword)) {
      fieldErrors.newPassword = 'Include at least one letter and one number.';
    } else if (values.newPassword === values.currentPassword) {
      fieldErrors.newPassword = 'Choose a password you have not just used.';
    }
    if (values.confirmPassword !== values.newPassword) fieldErrors.confirmPassword = 'Passwords do not match.';
    setErrors(fieldErrors);
    setMessage('');
    if (Object.keys(fieldErrors).length) return;

    setBusy(true);
    try {
      await api.patch('/auth/password', { currentPassword: values.currentPassword, newPassword: values.newPassword });
      setValues(empty);
      toast.success('Password changed. Your other devices have been signed out.');
    } catch (error) {
      const parsed = formErrors(error);
      setErrors(parsed.fieldErrors);
      setMessage(parsed.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="password-heading">
      <h2 id="password-heading" className="text-lg font-bold text-fg">
        Change password
      </h2>
      <p className="mt-1 text-sm text-muted">Changing your password signs you out on every other device.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
        <FormMessage>{message}</FormMessage>
        <TextField
          label="Current password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          value={values.currentPassword}
          onChange={set('currentPassword')}
          error={errors.currentPassword}
          required
          className="max-w-md"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="New password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters with a letter and a number."
            value={values.newPassword}
            onChange={set('newPassword')}
            error={errors.newPassword}
            required
          />
          <TextField
            label="Confirm new password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={set('confirmPassword')}
            error={errors.confirmPassword}
            required
          />
        </div>
        <Button type="submit" variant="secondary" icon={KeyRound} loading={busy}>
          Update password
        </Button>
      </form>
    </section>
  );
}
