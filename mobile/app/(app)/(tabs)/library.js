import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppHeader } from '@/components/AppHeader';
import { Fab } from '@/components/Fab';
import { ChipRow, EmptyState, ErrorState, Input, ListFooter, LoadingState, SegmentedTabs } from '@/components/ui';
import { BlogRow } from '@/features/blogs/BlogCard';
import { blogsApi } from '@/features/blogs/api';
import { MemoryTile } from '@/features/memories/MemoryCard';
import { memoriesApi } from '@/features/memories/api';
import { useDebounced } from '@/hooks/useDebounced';
import { usePagedList } from '@/hooks/usePagedList';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { BLOG_CATEGORIES } from '@/utils/constants';

const TABS = [
  { key: 'blogs', label: 'Blogs', icon: 'book' },
  { key: 'memories', label: 'Memories', icon: 'images' },
];

function BlogsList() {
  const { colors } = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const q = useDebounced(query.trim(), 350);
  const list = usePagedList((page) => blogsApi.list({ page, limit: 10, q, category }), [q, category], { topics: ['blogs'] });
  const filtered = Boolean(q || category);

  return (
    <FlatList
      data={list.items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <BlogRow blog={item} />
        </View>
      )}
      ListHeaderComponent={
        <View style={styles.filters}>
          <Input value={query} onChangeText={setQuery} placeholder="Search blogs by title" icon="search" returnKeyType="search" autoCorrect={false} maxLength={80} style={styles.search} />
          <ChipRow options={BLOG_CATEGORIES} value={category} onChange={setCategory} allLabel="All" />
        </View>
      }
      ListEmptyComponent={
        list.status === 'loading' ? (
          <LoadingState label="Loading blogs…" />
        ) : list.status === 'error' ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : (
          <EmptyState
            icon="book-outline"
            title={filtered ? 'No blogs match' : 'No blogs yet'}
            message={filtered ? 'Try a different search or category.' : 'Write the first one — it is published as soon as you save it.'}
            actionLabel={filtered ? undefined : 'Write a blog'}
            onAction={() => router.push('/create/blog')}
          />
        )
      }
      ListFooterComponent={<ListFooter loading={list.loadingMore} error={list.moreError} onRetry={list.loadMore} />}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.4}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.surface} />}
    />
  );
}

function MemoriesGrid() {
  const { colors } = useTheme();
  const router = useRouter();
  const list = usePagedList((page) => memoriesApi.list({ page, limit: 12 }), [], { topics: ['memories'] });

  return (
    <FlatList
      data={list.items}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.columns}
      renderItem={({ item }) => <MemoryTile memory={item} height={210} style={styles.cell} />}
      ListEmptyComponent={
        list.status === 'loading' ? (
          <LoadingState label="Loading memories…" />
        ) : list.status === 'error' ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : (
          <EmptyState
            icon="images-outline"
            title="No memories yet"
            message="Share a photo or video — it appears here as soon as it is saved."
            actionLabel="Share a memory"
            onAction={() => router.push('/create/memory')}
          />
        )
      }
      ListFooterComponent={<ListFooter loading={list.loadingMore} error={list.moreError} onRetry={list.loadMore} />}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.4}
      contentContainerStyle={[styles.listContent, styles.gridContent]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.surface} />}
    />
  );
}

// Blogs and Memories side by side under one tab, switched without leaving the screen.
export default function Library() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [tab, setTab] = useState(params.tab === 'memories' ? 'memories' : 'blogs');
  const [seenParam, setSeenParam] = useState(params.tab);

  // "View all blogs" / "View all memories" on Home arrive with ?tab=… while
  // this tab may already be open: follow the parameter when it changes.
  if (params.tab !== seenParam) {
    setSeenParam(params.tab);
    if (params.tab === 'blogs' || params.tab === 'memories') setTab(params.tab);
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppHeader title="Blogs & Memories">
        <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} style={styles.tabs} />
      </AppHeader>
      {tab === 'blogs' ? <BlogsList /> : <MemoriesGrid />}
      <Fab
        icon={tab === 'blogs' ? 'create' : 'camera'}
        label={tab === 'blogs' ? 'Write blog' : 'Add memory'}
        onPress={() => router.push(tab === 'blogs' ? '/create/blog' : '/create/memory')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: { marginTop: 10 },
  filters: { gap: 10, marginBottom: 14 },
  search: { marginHorizontal: space.lg, marginBottom: 0 },
  row: { paddingHorizontal: space.lg, marginBottom: 14 },
  listContent: { paddingTop: space.lg, paddingBottom: 96, flexGrow: 1 },
  gridContent: { paddingHorizontal: space.lg },
  columns: { gap: 12, marginBottom: 12 },
  cell: { flex: 1 },
});
