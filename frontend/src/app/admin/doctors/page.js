import { Suspense } from 'react';
import DoctorManager from '@/components/admin/DoctorManager';
import { PageLoader } from '@/components/ui/Feedback';

export const metadata = { title: 'Doctors' };

export default function AdminDoctorsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <DoctorManager />
    </Suspense>
  );
}
