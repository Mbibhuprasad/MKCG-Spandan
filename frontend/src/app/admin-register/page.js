import AdminRegisterForm from '@/components/auth/AdminRegisterForm';

export const metadata = {
  title: 'Admin registration',
  description: 'Create an administrator account for MKCGSPANDAN.',
  robots: { index: false, follow: false },
};

export default function AdminRegisterPage() {
  return <AdminRegisterForm />;
}
