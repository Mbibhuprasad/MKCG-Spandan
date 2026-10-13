import { useLocalSearchParams } from "expo-router";
import { Screen, StackHeader } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { Portfolio } from "@/features/doctors/Portfolio";

export default function DoctorProfile() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  return (
    <Screen header={<StackHeader title="Doctor profile" />} padded={false}>
      <Portfolio doctorId={String(id)} own={String(id) === user.id} />
    </Screen>
  );
}
