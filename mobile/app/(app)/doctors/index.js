import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View, useWindowDimensions } from "react-native";
import {
  EmptyState,
  ErrorState,
  Input,
  ListFooter,
  LoadingState,
  Screen,
  SegmentedTabs,
  SelectField,
  StackHeader,
  Text,
} from "@/components/ui";
import { DoctorGridCard, DoctorListCard } from "@/features/doctors/DoctorCard";
import { doctorsApi } from "@/features/doctors/api";
import { useDebounced } from "@/hooks/useDebounced";
import { usePagedList } from "@/hooks/usePagedList";
import { useResource } from "@/hooks/useResource";
import { useTheme } from "@/theme/ThemeProvider";
import { space } from "@/theme/tokens";
import { plural } from "@/utils/format";

// List (the default on the phone) or a two-column grid of the directory tiles.
const VIEWS = [
  { key: "list", label: "List", icon: "list" },
  { key: "grid", label: "Grid", icon: "grid" },
];
const GRID_GAP = 10;

// Friends (member discovery): every active doctor who is listed, with the search and
// the two filters the API supports (GET /doctors?q=&specialization=&city=).
export default function DoctorsDirectory() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [view, setView] = useState("list");
  const tileWidth = Math.floor((width - space.lg * 2 - GRID_GAP) / 2);
  const [query, setQuery] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [city, setCity] = useState("");
  const q = useDebounced(query.trim(), 350);
  const filters = useResource(() => doctorsApi.filters(), []);
  const list = usePagedList(
    (page) => doctorsApi.list({ page, limit: 20, q, specialization, city }),
    [q, specialization, city],
  );
  const filtered = Boolean(q || specialization || city);
  const options = filters.data || { specializations: [], cities: [] };

  return (
    <Screen
      header={<StackHeader title="Friends" subtitle="Your Friends" />}
      padded={false}
      keyboard
    >
      <FlatList
        // A different column count needs a fresh list.
        key={view}
        numColumns={view === "grid" ? 2 : 1}
        columnWrapperStyle={view === "grid" ? styles.gridRow : undefined}
        data={list.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          view === "grid" ? (
            <DoctorGridCard doctor={item} width={tileWidth} />
          ) : (
            <View style={styles.row}>
              <DoctorListCard doctor={item} />
            </View>
          )
        }
        ListHeaderComponent={
          <View style={styles.filters}>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name"
              icon="search"
              autoCorrect={false}
              returnKeyType="search"
              maxLength={60}
              style={styles.noGap}
            />
            <View style={styles.selects}>
              <SelectField
                value={specialization}
                onChange={setSpecialization}
                options={options.specializations}
                placeholder="Specialization"
                searchable
                clearable
                icon="medkit-outline"
                style={styles.select}
              />
              <SelectField
                value={city}
                onChange={setCity}
                options={options.cities}
                placeholder="City"
                searchable
                clearable
                icon="location-outline"
                style={styles.select}
              />
            </View>
            <View style={styles.bar}>
              <Text variant="caption" tone="muted" style={styles.flex}>
                {list.status === "ready"
                  ? `${plural(list.total, "friend")} ${filtered ? "found" : "in the community"}`
                  : ""}
              </Text>
              <SegmentedTabs tabs={VIEWS} value={view} onChange={setView} style={styles.views} />
            </View>
          </View>
        }
        ListEmptyComponent={
          list.status === "loading" ? (
            <LoadingState label="Loading friends…" />
          ) : list.status === "error" ? (
            <ErrorState error={list.error} onRetry={list.reload} />
          ) : (
            <EmptyState
              icon="people-outline"
              title={filtered ? "No friends match" : "No friends here yet"}
              message={
                filtered
                  ? "Try a different name, specialization or city."
                  : "Friends appear here as they join the community."
              }
            />
          )
        }
        ListFooterComponent={
          <ListFooter
            loading={list.loadingMore}
            error={list.moreError}
            onRetry={list.loadMore}
          />
        }
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={list.refreshing}
            onRefresh={list.refresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
            progressBackgroundColor={colors.surface}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: space.lg, gap: 10, marginBottom: 12 },
  noGap: { marginBottom: 0 },
  selects: { flexDirection: "row", gap: 10 },
  select: { flex: 1, marginBottom: 0 },
  row: { paddingHorizontal: space.lg, marginBottom: 10 },
  gridRow: { paddingHorizontal: space.lg, gap: GRID_GAP, marginBottom: GRID_GAP },
  bar: { flexDirection: "row", alignItems: "center", gap: 10 },
  views: { width: 176 },
  flex: { flex: 1 },
  list: { paddingTop: space.lg, paddingBottom: 40, flexGrow: 1 },
});
