import { Suspense } from 'react';
import LoginForm from '@/components/auth/LoginForm';
import { PageLoader } from '@/components/ui/Feedback';

export const metadata = {
  title: 'Log in',
  description: 'Log in to MKCGSPANDAN with your registered email address or phone number.',
  alternates: { canonical: '/login' },
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <LoginForm />
    </Suspense>
  );
}
