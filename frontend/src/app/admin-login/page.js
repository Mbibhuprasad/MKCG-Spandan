import { Suspense } from 'react';
import AdminLoginForm from '@/components/auth/AdminLoginForm';
import { PageLoader } from '@/components/ui/Feedback';

export const metadata = {
  title: 'Admin login',
  description: 'Administrator sign in for MKCGSPANDAN.',
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminLoginForm />
    </Suspense>
  );
}
