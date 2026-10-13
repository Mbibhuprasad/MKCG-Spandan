import { useRouter } from "expo-router";
import { SectionEditor } from "@/features/profile/SectionEditor";
import { ESSENTIALS } from "@/features/profile/sections";

// Step A — complete profile (optional). Saved through the same PATCH /doctors/me
// as the full editor; skipping leaves everything to be filled in later.
export default function OnboardingProfile() {
  const router = useRouter();
  const next = () => router.push("/onboarding/memory");
  return (
    <SectionEditor
      section={ESSENTIALS}
      step={1}
      steps={3}
      submitLabel="Save and Continue"
      onSaved={next}
      onSkip={next}
    />
  );
}
