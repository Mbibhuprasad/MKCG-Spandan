import RegisterForm from '@/components/auth/RegisterForm';

export const metadata = {
  title: 'Join the community',
  description:
    'Create your doctor account on MKCGSPANDAN and start reconnecting with your medical batchmates right away.',
  alternates: { canonical: '/register' },
};

export default function RegisterPage() {
  return <RegisterForm />;
}
