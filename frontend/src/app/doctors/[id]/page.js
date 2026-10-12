import { MemberGate } from '@/components/auth/Guards';
import DoctorPortfolio from '@/components/doctors/DoctorPortfolio';

// Portfolios are member-only. The profile is loaded in the browser with the
// member's session, so no profile data is ever part of the public HTML.
export const metadata = {
  title: 'Doctor profile',
  robots: { index: false, follow: false },
};

export default function DoctorProfilePage() {
  return (
    <MemberGate
      title="Doctor profiles are for members"
      description="Professional portfolios are shared only among signed-in members of MKCGSPANDAN."
    >
      <DoctorPortfolio />
    </MemberGate>
  );
}
