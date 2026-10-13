import { LegalContent } from '@/components/LegalContent';
import { Screen, StackHeader } from '@/components/ui';

// Readable before an account exists, from the registration form.
export default function Policies() {
  return (
    <Screen header={<StackHeader title="Guidelines & privacy" />} scroll>
      <LegalContent which="both" />
    </Screen>
  );
}
