import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Avatar, Button, Card, Text } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { joinParts } from "@/utils/format";

// The platform does not verify members, so cards carry a neutral directory
// label and never a "verified" badge.
export function DoctorTile({ doctor, width = 168 }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Card
      onPress={() => router.push(`/doctors/${doctor.id}`)}
      style={[styles.tile, { width }]}
      accessibilityLabel={`View the profile of ${doctor.name}`}
    >
      <Avatar uri={doctor.photoUrl} name={doctor.name} size={68} square />
      <Text variant="bodyStrong" numberOfLines={1} center style={styles.name}>
        {doctor.name}
      </Text>
      <Text variant="caption" tone="muted" numberOfLines={1} center>
        {doctor.professionalTitle || doctor.designation || "Community member"}
      </Text>
      {doctor.specialization ? (
        <View style={[styles.pill, { backgroundColor: colors.leafSoft }]}>
          <Text variant="caption" color={colors.leafStrong} numberOfLines={1}>
            {doctor.specialization}
          </Text>
        </View>
      ) : null}
      {doctor.city ? (
        <View style={styles.meta}>
          <Ionicons name="location-outline" size={12} color={colors.muted} />
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {doctor.city}
          </Text>
        </View>
      ) : null}
      <Text variant="smallStrong" tone="brand" style={styles.cta}>
        View profile
      </Text>
    </Card>
  );
}

// Compact row for the directory and the "new chat" search. Pass `onPress` to
// override the default (opening the profile) and `right` for an action.
export function DoctorRow({ doctor, onPress, right }) {
  const { colors } = useTheme();
  const router = useRouter();
  const place = joinParts([doctor.hospital, doctor.city], ", ");
  return (
    <Card
      onPress={onPress || (() => router.push(`/doctors/${doctor.id}`))}
      style={styles.row}
      accessibilityLabel={`${doctor.name}, ${doctor.specialization || "doctor"}`}
    >
      <Avatar uri={doctor.photoUrl} name={doctor.name} size={52} square />
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {doctor.name}
        </Text>
        <Text variant="small" tone="soft" numberOfLines={1}>
          {joinParts([
            doctor.professionalTitle || doctor.designation,
            doctor.specialization,
          ]) || "Community member"}
        </Text>
        {place ? (
          <View style={styles.meta}>
            <Ionicons name="location-outline" size={12} color={colors.muted} />
            <Text
              variant="caption"
              tone="muted"
              numberOfLines={1}
              style={styles.flex}
            >
              {place}
            </Text>
          </View>
        ) : null}
      </View>
      {right || (
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      )}
    </Card>
  );
}

// One friend in the Friends list view: the row above with the location, the
// contact number (only present when the doctor's privacy settings allow it —
// the API leaves it out otherwise), the specialization and a View More button.
export function DoctorListCard({ doctor }) {
  const { colors } = useTheme();
  const router = useRouter();
  const open = () => router.push(`/doctors/${doctor.id}`);
  const location = joinParts([doctor.city, doctor.state], ", ");
  const contact = doctor.contact || {};
  const phone = contact.phone || contact.workPhone || "";
  return (
    <Card style={styles.listCard} accessibilityLabel={`${doctor.name}, ${doctor.specialization || "doctor"}`}>
      <View style={styles.listTop}>
        <Avatar uri={doctor.photoUrl} name={doctor.name} size={52} square />
        <View style={styles.flex}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {doctor.name}
          </Text>
          {doctor.specialization ? (
            <View style={[styles.pill, styles.pillLeft, { backgroundColor: colors.leafSoft }]}>
              <Text variant="caption" color={colors.leafStrong} numberOfLines={1}>
                {doctor.specialization}
              </Text>
            </View>
          ) : (
            <Text variant="small" tone="soft" numberOfLines={1}>
              {doctor.professionalTitle || doctor.designation || "Community member"}
            </Text>
          )}
        </View>
      </View>
      {location || phone ? (
        <View style={styles.listFacts}>
          {location ? (
            <View style={styles.meta}>
              <Ionicons name="location-outline" size={13} color={colors.muted} />
              <Text variant="caption" tone="muted" numberOfLines={1} style={styles.flex}>
                {location}
              </Text>
            </View>
          ) : null}
          {phone ? (
            <View style={styles.meta}>
              <Ionicons name="call-outline" size={13} color={colors.brandInk} />
              <Text variant="caption" tone="soft" numberOfLines={1} style={styles.flex} selectable>
                {phone}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <Button title="View More" size="sm" variant="secondary" iconRight="chevron-forward" onPress={open} full accessibilityLabel={`View More: ${doctor.name}`} />
    </Card>
  );
}

// One friend in the Friends grid view: the same facts as the list card, as a
// narrow card for two columns. The contact number is only present when the
// doctor's privacy settings allow it.
export function DoctorGridCard({ doctor, width }) {
  const { colors } = useTheme();
  const router = useRouter();
  const contact = doctor.contact || {};
  const phone = contact.phone || contact.workPhone || "";
  return (
    <Card style={[styles.gridCard, { width }]} accessibilityLabel={`${doctor.name}, ${doctor.specialization || "doctor"}`}>
      <Avatar uri={doctor.photoUrl} name={doctor.name} size={60} square />
      <Text variant="bodyStrong" numberOfLines={2} center style={styles.name}>
        {doctor.name}
      </Text>
      {doctor.specialization ? (
        <View style={[styles.pill, { backgroundColor: colors.leafSoft }]}>
          <Text variant="caption" color={colors.leafStrong} numberOfLines={1}>
            {doctor.specialization}
          </Text>
        </View>
      ) : null}
      {doctor.city ? (
        <View style={styles.meta}>
          <Ionicons name="location-outline" size={12} color={colors.muted} />
          <Text variant="caption" tone="muted" numberOfLines={1} style={styles.shrink}>
            {doctor.city}
          </Text>
        </View>
      ) : null}
      {phone ? (
        <View style={styles.meta}>
          <Ionicons name="call-outline" size={12} color={colors.brandInk} />
          <Text variant="caption" tone="soft" numberOfLines={1} style={styles.shrink}>
            {phone}
          </Text>
        </View>
      ) : null}
      <Button title="View More" size="sm" variant="secondary" onPress={() => router.push(`/doctors/${doctor.id}`)} full style={styles.gridMore} accessibilityLabel={`View More: ${doctor.name}`} />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  gridCard: { alignItems: "center", gap: 3, paddingVertical: 14, paddingHorizontal: 10 },
  gridMore: { marginTop: 10 },
  tile: {
    alignItems: "center",
    gap: 3,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  name: { marginTop: 8, alignSelf: "stretch" },
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 5,
    maxWidth: "100%",
  },
  meta: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  cta: { marginTop: 9 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  listCard: { gap: 10, padding: 12 },
  listTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  listFacts: { gap: 2 },
  pillLeft: { alignSelf: "flex-start", marginTop: 4 },
});
