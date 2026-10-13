import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppHeader } from "@/components/AppHeader";
import { Button, ProgressBar, Text } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { Portfolio } from "@/features/doctors/Portfolio";
import { useTheme } from "@/theme/ThemeProvider";

// The signed-in doctor's own portfolio — the same component other members see
// at /doctors/[id], with the owner's actions added. No second profile screen.
export default function Profile() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const completion = user.profileCompletion;

  const actions = (
    <View style={styles.actions}>
      {completion.percent < 100 ? (
        <View style={styles.progress}>
          <View style={styles.progressHead}>
            <Text variant="caption" tone="muted" style={styles.flex}>
              Profile completion
            </Text>
            <Text variant="smallStrong" tone="leaf">
              {completion.percent}%
            </Text>
          </View>
          <ProgressBar value={completion.percent / 100} height={6} />
        </View>
      ) : null}
      <View style={styles.row}>
        <Button
          title={completion.percent < 100 ? "Complete profile" : "Edit profile"}
          icon="create-outline"
          onPress={() => router.push("/profile/edit")}
          style={styles.flex}
          full
        />
        <Button
          title="Settings"
          icon="settings-outline"
          variant="secondary"
          onPress={() => router.push("/settings")}
          style={styles.flex}
          full
        />
      </View>
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <AppHeader title="Profile" />
      <Portfolio doctorId={user.id} own ownActions={actions} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: { gap: 12, marginTop: 6 },
  progress: { gap: 6 },
  progressHead: { flexDirection: "row", alignItems: "center" },
  row: { flexDirection: "row", gap: 10 },
});
