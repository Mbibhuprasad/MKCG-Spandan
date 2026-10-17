import { Suspense } from "react";
import { MemberGate } from "@/components/auth/Guards";
import { PageHeader } from "@/components/ui/Layout";
import { PageLoader } from "@/components/ui/Feedback";
import DoctorsDirectory from "@/components/doctors/DoctorsDirectory";

// The Friends list is member-only: nothing about members is rendered on the
// server, and search engines are asked not to index this URL.
export const metadata = {
  title: "Friends",
  description:
    "Friends on MKCGSPANDAN — find Friends by name, specialization and city.",
  alternates: { canonical: "/doctors" },
  robots: { index: false, follow: false },
};

export default function DoctorsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Your Friends"
        title="Friends"
        description="Find Friends by name, specialization or city, and see where their journeys in medicine have taken them."
      />
      <MemberGate
        title="Friends are visible to members"
        description="Profiles are shared only among signed-in members of MKCGSPANDAN. Join or log in to find your friends."
      >
        <Suspense fallback={<PageLoader />}>
          <DoctorsDirectory />
        </Suspense>
      </MemberGate>
    </>
  );
}
