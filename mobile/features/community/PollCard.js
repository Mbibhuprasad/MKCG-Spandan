import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, Text } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { messageOf } from '@/services/api';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';
import { formatDate, plural } from '@/utils/format';
import { pollsApi } from './api';
import { ContentMenu } from './Interactions';
import { AuthorLine } from './PostCard';

// A community poll. One ballot per member and votes are final — the API
// enforces both; results appear when the poll's own rules allow.
export function PollCard({ poll, onChange }) {
  const { colors } = useTheme();
  const toast = useToast();
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const voted = Boolean(poll.myVote);
  const canVote = poll.state === 'OPEN' && !voted;

  const pick = (id) => {
    if (!canVote) return;
    setPicked((current) => (poll.allowMultiple ? (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]) : [id]));
  };

  const vote = async () => {
    if (!picked.length || busy) return;
    setBusy(true);
    try {
      const { data } = await pollsApi.vote(poll.id, picked);
      onChange(data);
      setPicked([]);
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setBusy(false);
    }
  };

  const status = poll.state === 'OPEN' ? `Open until ${formatDate(poll.endsAt)}` : poll.state === 'UPCOMING' ? `Opens ${formatDate(poll.startsAt)}` : 'Closed';

  return (
    <Card style={styles.card}>
      <AuthorLine author={poll.creator} date={poll.publishedAt || poll.createdAt} right={<ContentMenu targetType="poll" targetId={poll.id} isMine={poll.isMine} label="poll" />} />
      <Text variant="h3">{poll.question}</Text>
      {poll.description ? (
        <Text variant="small" tone="muted">
          {poll.description}
        </Text>
      ) : null}
      <View style={styles.options}>
        {poll.options.map((option) => {
          const mine = voted && poll.myVote.includes(option.id);
          const selected = picked.includes(option.id);
          return (
            <Pressable
              key={option.id}
              onPress={() => pick(option.id)}
              disabled={!canVote}
              style={[styles.option, { borderColor: selected || mine ? colors.brand : colors.line, backgroundColor: colors.bgSoft }]}
              accessibilityRole={poll.allowMultiple ? 'checkbox' : 'radio'}
              accessibilityState={{ selected: selected || mine, disabled: !canVote }}
              accessibilityLabel={poll.resultsVisible ? `${option.text}, ${option.percent} percent` : option.text}
            >
              {poll.resultsVisible ? <View style={[styles.fill, { width: `${option.percent}%`, backgroundColor: mine ? colors.leafSoft : colors.brandSoft }]} /> : null}
              {canVote ? (
                <Ionicons
                  name={selected ? (poll.allowMultiple ? 'checkbox' : 'radio-button-on') : poll.allowMultiple ? 'square-outline' : 'radio-button-off'}
                  size={19}
                  color={selected ? colors.brand : colors.muted}
                />
              ) : mine ? (
                <Ionicons name="checkmark-circle" size={19} color={colors.leaf} />
              ) : null}
              <Text variant="smallStrong" style={styles.flex}>
                {option.text}
              </Text>
              {poll.resultsVisible ? (
                <Text variant="smallStrong" tone="muted">
                  {option.percent}%
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.footer}>
        <Text variant="caption" tone="muted" style={styles.flex}>
          {status}
          {poll.totalVoters !== null && poll.totalVoters !== undefined ? ` · ${plural(poll.totalVoters, 'voter')}` : ''}
          {poll.allowMultiple && canVote ? ' · choose any' : ''}
        </Text>
        {canVote ? <Button title="Vote" size="sm" onPress={vote} loading={busy} disabled={!picked.length} /> : null}
      </View>
      {!poll.resultsVisible && voted ? (
        <Text variant="caption" tone="muted">
          Your vote is in. Results appear when the poll closes.
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: 10 },
  options: { gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
