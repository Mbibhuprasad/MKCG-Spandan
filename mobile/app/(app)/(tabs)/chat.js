import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppHeader } from '@/components/AppHeader';
import { Fab } from '@/components/Fab';
import { Banner, EmptyState, ErrorState, LoadingState, SegmentedTabs } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/features/chat/ChatContext';
import { ConnectionBanner, ConversationRow } from '@/features/chat/components';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

// The chat hub: Group Chat and One-to-One Chat. Both lists come from the
// server (GET /chat/conversations) and are kept current by the live connection.
export default function ChatHub() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { conversations, status, error, connection, unread, refreshConversations } = useChat();
  const [tab, setTab] = useState('group');
  const [refreshing, setRefreshing] = useState(false);

  // Coming back to the tab re-reads the list, so counts are right even if an
  // event was missed while the phone was asleep.
  useFocusEffect(
    useCallback(() => {
      refreshConversations({ silent: true });
    }, [refreshConversations])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshConversations({ silent: true });
    setRefreshing(false);
  };

  const type = tab === 'group' ? 'GROUP' : 'DIRECT';
  const items = conversations.filter((c) => c.type === type);
  // The API allows one-to-one chat only for doctors who have a WhatsApp number on their profile.
  const needsWhatsapp = tab === 'direct' && !isAdmin && !(user.whatsapp && user.whatsapp.number);

  const tabs = [
    { key: 'group', label: 'Group Chat', icon: 'people', badge: unread.GROUP },
    { key: 'direct', label: 'One-to-One Chat', icon: 'chatbubble', badge: unread.DIRECT },
  ];

  let empty = null;
  if (status === 'loading' || status === 'idle') empty = <LoadingState label="Loading conversations…" />;
  else if (status === 'error') empty = <ErrorState error={error} onRetry={() => refreshConversations()} />;
  else if (tab === 'group') empty = <EmptyState icon="people-outline" title="No group conversations" message="The community group appears here once it is available." />;
  else
    empty = (
      <EmptyState
        icon="chatbubbles-outline"
        title="No one-to-one chats yet"
        message="Search for a batchmate and start a private conversation. Only the two of you can read it."
        actionLabel={needsWhatsapp ? undefined : 'Find a friend'}
        onAction={() => router.push('/chat/new')}
      />
    );

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppHeader title="Chat">
        <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} style={styles.tabs} />
      </AppHeader>
      <ConnectionBanner connection={connection} />
      <FlatList
        data={status === 'ready' ? items : []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ConversationRow conversation={item} myId={user.id} />}
        ListHeaderComponent={
          needsWhatsapp ? (
            <Banner
              tone="warn"
              icon="logo-whatsapp"
              title="Add your WhatsApp number"
              message="One-to-one chat opens once your profile has a WhatsApp number. You decide whether other members can see it."
              actionLabel="Add it now"
              onAction={() => router.push('/profile/section/practice')}
              style={styles.notice}
            />
          ) : null
        }
        ListEmptyComponent={empty}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.surface} />}
      />
      {tab === 'direct' && !needsWhatsapp ? <Fab icon="create" label="New chat" onPress={() => router.push('/chat/new')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: { marginTop: 10 },
  list: { paddingBottom: 96, flexGrow: 1 },
  notice: { margin: space.lg, marginBottom: 4 },
});
