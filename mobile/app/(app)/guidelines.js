import { useLocalSearchParams } from 'expo-router';
import { LegalContent } from '@/components/LegalContent';
import { Screen, StackHeader } from '@/components/ui';

const TITLES = { privacy: 'Privacy', guidelines: 'Community Guidelines', both: 'Privacy & Guidelines' };

export default function Guidelines() {
  const params = useLocalSearchParams();
  const which = params.which === 'privacy' || params.which === 'guidelines' ? params.which : 'both';
  return (
    <Screen header={<StackHeader title={TITLES[which]} />} scroll>
      <LegalContent which={which} />
    </Screen>
  );
}
