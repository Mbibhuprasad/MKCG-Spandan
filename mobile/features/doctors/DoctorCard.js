import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Avatar, Card, Text } from "@/components/ui";
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
});
