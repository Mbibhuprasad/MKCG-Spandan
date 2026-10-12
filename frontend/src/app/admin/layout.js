import { RequireAdmin } from '@/components/auth/Guards';
import AdminNav from '@/components/admin/AdminNav';

// The admin panel is never indexed. RequireAdmin only decides what is shown in
// the browser — every /admin API route independently requires the ADMIN role,
// which is the single elevated role in this application.
export const metadata = {
  title: { default: 'Admin panel', template: '%s · Admin | MKCGSPANDAN' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return (
    <RequireAdmin>
      <AdminNav />
      <div className="container-page py-8 sm:py-10">{children}</div>
    </RequireAdmin>
  );
}
