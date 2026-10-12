import { RequireAuth } from '@/components/auth/Guards';
import DashboardNav from '@/components/dashboard/DashboardNav';

// Everything under /dashboard is private: signed-out visitors are redirected to
// the login page and search engines are told not to index these URLs.
export const metadata = {
  title: { default: 'Dashboard', template: '%s | MKCGSPANDAN' },
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }) {
  return (
    <RequireAuth>
      <DashboardNav />
      <div className="container-page py-8 sm:py-10">{children}</div>
    </RequireAuth>
  );
}
