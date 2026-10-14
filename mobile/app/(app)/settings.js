import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Banner,
  Button,
  Card,
  Divider,
  Input,
  Screen,
  SegmentedTabs,
  Sheet,
  StackHeader,
  SwitchRow,
  Text,
} from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { passwordIssue } from "@/features/auth/validation";
import {
  alertsEnabled,
  restoreAlertsPreference,
  setAlertsEnabled,
} from "@/features/notifications/localAlerts";
import { profileApi } from "@/features/profile/api";
import { fieldErrors, messageOf } from "@/services/api";
import { useTheme } from "@/theme/ThemeProvider";
import { space } from "@/theme/tokens";
import { PROFILE_SECTIONS } from "@/utils/constants";
import { invalidate } from "@/utils/events";
import { formatPhone } from "@/utils/phone";

const THEMES = [
  { key: "light", label: "Light", icon: "sunny" },
  { key: "dark", label: "Dark", icon: "moon" },
];

// What other members may see. Every switch is saved to the account
// (PATCH /doctors/me) and applied by the API, not by this app.
const CONTACT = [
  [
    "showWhatsapp",
    "WhatsApp number",
    "Members can open a WhatsApp chat with you.",
    "logo-whatsapp",
  ],
  [
    "showPhone",
    "Registered phone number",
    "Hidden unless you switch it on.",
    "call-outline",
  ],
  [
    "showEmail",
    "Email address",
    "Hidden unless you switch it on.",
    "mail-outline",
  ],
  [
    "showWorkContact",
    "Workplace contact",
    "Workplace phone and email.",
    "business-outline",
  ],
  [
    "showRegistration",
    "Registration details",
    "Registration and membership numbers.",
    "card-outline",
  ],
  [
    "showBloodGroup",
    "Blood group",
    "Private unless you choose to show it.",
    "water-outline",
  ],
];
const LISTING = [
  [
    "directory",
    "Listed in Friends",
    "Off: members see only a small name card.",
    "people-outline",
  ],
  [
    "portfolio",
    "Full portfolio open to members",
    "Off: your portfolio is visible to you only.",
    "id-card-outline",
  ],
  [
    "publicListing",
    "Allow a public homepage card",
    "Only if an administrator also features your profile.",
    "globe-outline",
  ],
  [
    "showBirthday",
    "Show me in Today's Birthdays",
    "On your birthday only. Your date of birth is never shown.",
    "gift-outline",
  ],
];

function Group({ title, children }) {
  return (
    <View style={styles.group}>
      <Text variant="eyebrow" tone="muted" style={styles.groupTitle}>
        {title}
      </Text>
      <Card style={styles.card}>{children}</Card>
    </View>
  );
}

function LinkRow({ icon, label, value, onPress, danger }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={styles.link}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={value ? `${label}: ${value}` : label}
    >
      <View
        style={[
          styles.linkIcon,
          { backgroundColor: danger ? colors.dangerSoft : colors.brandSoft },
        ]}
      >
        <Ionicons
          name={icon}
          size={17}
          color={danger ? colors.danger : colors.brandInk}
        />
      </View>
      <Text
        variant="bodyStrong"
        tone={danger ? "danger" : "default"}
        style={styles.flex}
        numberOfLines={1}
      >
        {label}
      </Text>
      {value ? (
        <Text
          variant="small"
          tone="muted"
          numberOfLines={1}
          style={styles.linkValue}
        >
          {value}
        </Text>
      ) : null}
      {onPress && !danger ? (
        <Ionicons name="chevron-forward" size={17} color={colors.muted} />
      ) : null}
    </Pressable>
  );
}

function PasswordSheet({ visible, onClose }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    const found = {};
    if (!current) found.currentPassword = "Enter your current password.";
    const issue = passwordIssue(next);
    if (issue) found.newPassword = issue;
    else if (next === current)
      found.newPassword = "Choose a password you have not just used.";
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await profileApi.changePassword(current, next);
      toast.success(
        "Password changed. Your other devices have been signed out.",
      );
      setCurrent("");
      setNext("");
      onClose();
    } catch (error) {
      setErrors({
        ...fieldErrors(error),
        form: Object.keys(fieldErrors(error)).length
          ? undefined
          : messageOf(error),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Change password">
      <View style={styles.sheet}>
        {errors.form ? (
          <Banner
            tone="danger"
            message={errors.form}
            style={styles.sheetBanner}
          />
        ) : null}
        <Input
          label="Current password"
          value={current}
          onChangeText={setCurrent}
          error={errors.currentPassword}
          secure
          autoCapitalize="none"
          maxLength={200}
        />
        <Input
          label="New password"
          value={next}
          onChangeText={setNext}
          error={errors.newPassword}
          help="At least 8 characters, with a letter and a number."
          secure
          autoCapitalize="none"
          maxLength={72}
        />
        <Button title="Change password" onPress={submit} loading={busy} full />
      </View>
    </Sheet>
  );
}

export default function Settings() {
  const router = useRouter();
  const toast = useToast();
  const { mode, setMode } = useTheme();
  const { user, setUser, signOut } = useAuth();
  const [alerts, setAlerts] = useState(alertsEnabled());
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const visibility = user.visibility;

  useEffect(() => {
    restoreAlertsPreference().then(setAlerts);
  }, []);

  // The switch moves at once; if the API refuses the change it moves back.
  const setVisibility = async (patch) => {
    const before = user;
    setUser({
      ...user,
      visibility: {
        ...visibility,
        ...patch,
        sections: { ...visibility.sections, ...(patch.sections || {}) },
      },
    });
    try {
      const { data } = await profileApi.update({ visibility: patch });
      setUser(data);
      invalidate("profile");
    } catch (error) {
      setUser(before);
      toast.error(messageOf(error));
    }
  };

  const toggleAlerts = async (next) => {
    const result = await setAlertsEnabled(next);
    setAlerts(result.enabled);
    if (next && !result.enabled)
      toast.error(result.reason || "Alerts could not be switched on.");
  };

  const confirmSignOut = () => {
    Alert.alert(
      "Sign out?",
      "You will need your email or phone number and password to sign in again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            setSigningOut(true);
            await signOut();
          },
        },
      ],
    );
  };

  return (
    <Screen header={<StackHeader title="Settings" />} scroll>
      <Group title="Appearance">
        <SegmentedTabs tabs={THEMES} value={mode} onChange={setMode} />
        <Text variant="caption" tone="muted">
          Your choice is remembered on this phone.
        </Text>
      </Group>

      <Group title="Account">
        <LinkRow icon="person-outline" label="Name" value={user.name} />
        <Divider />
        <LinkRow icon="mail-outline" label="Email" value={user.email} />
        <Divider />
        <LinkRow
          icon="call-outline"
          label="Phone"
          value={formatPhone(user.phone)}
        />
        <Divider />
        <LinkRow
          icon="create-outline"
          label="Edit profile"
          onPress={() => router.push("/profile/edit")}
        />
        <Divider />
        <LinkRow
          icon="key-outline"
          label="Change password"
          onPress={() => setPasswordOpen(true)}
        />
        <Text variant="caption" tone="muted">
          Email and phone number cannot be changed in the app.
        </Text>
      </Group>

      <Group title="Contact visibility">
        <Text variant="small" tone="muted">
          Choose which of your contact details other members can see.
          Administrators can always see account details.
        </Text>
        {CONTACT.map(([key, label, description, icon]) => (
          <SwitchRow
            key={key}
            label={label}
            description={description}
            icon={icon}
            value={visibility[key]}
            onValueChange={(value) => setVisibility({ [key]: value })}
          />
        ))}
        {!user.whatsapp.number ? (
          <Banner
            tone="info"
            icon="logo-whatsapp"
            message="You have not added a WhatsApp number yet."
            actionLabel="Add it"
            onAction={() => router.push("/profile/section/practice")}
          />
        ) : null}
      </Group>

      <Group title="Profile listing">
        {LISTING.map(([key, label, description, icon]) => (
          <SwitchRow
            key={key}
            label={label}
            description={description}
            icon={icon}
            value={visibility[key]}
            onValueChange={(value) => setVisibility({ [key]: value })}
          />
        ))}
      </Group>

      <Group title="Portfolio sections shown to members">
        {PROFILE_SECTIONS.map((section) => (
          <SwitchRow
            key={section.key}
            label={section.label}
            value={visibility.sections[section.key]}
            onValueChange={(value) =>
              setVisibility({ sections: { [section.key]: value } })
            }
          />
        ))}
      </Group>

      <Group title="Notifications">
        <SwitchRow
          label="Message alerts"
          description="Show an alert on this phone when a chat message arrives while the app is running."
          icon="notifications-outline"
          value={alerts}
          onValueChange={toggleAlerts}
        />
        <Text variant="caption" tone="muted">
          Alerts come from the app’s live chat connection. Nothing is delivered
          while the app is fully closed — open the app to see what you missed.
        </Text>
        <Divider />
        <LinkRow
          icon="list-outline"
          label="Notification history"
          onPress={() => router.push("/notifications")}
        />
      </Group>

      <Group title="About">
        <LinkRow
          icon="heart-outline"
          label="About MKCGSPANDAN"
          onPress={() => router.push("/about")}
        />
        <Divider />
        <LinkRow
          icon="shield-checkmark-outline"
          label="Privacy"
          onPress={() =>
            router.push({
              pathname: "/guidelines",
              params: { which: "privacy" },
            })
          }
        />
        <Divider />
        <LinkRow
          icon="document-text-outline"
          label="Community Guidelines"
          onPress={() =>
            router.push({
              pathname: "/guidelines",
              params: { which: "guidelines" },
            })
          }
        />
        <Divider />
        <LinkRow
          icon="information-circle-outline"
          label="App version"
          value={
            (Constants.expoConfig && Constants.expoConfig.version) || "1.0.0"
          }
        />
      </Group>

      <Button
        title="Sign out"
        icon="log-out-outline"
        variant="danger"
        onPress={confirmSignOut}
        loading={signingOut}
        full
        style={styles.signOut}
      />
      <PasswordSheet
        visible={passwordOpen}
        onClose={() => setPasswordOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { marginBottom: space.xl },
  groupTitle: { marginBottom: 8, marginLeft: 4 },
  card: { gap: 8 },
  link: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  linkIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  linkValue: { maxWidth: "52%" },
  sheet: { paddingHorizontal: space.xl },
  sheetBanner: { marginBottom: 14 },
  signOut: { marginTop: 4 },
});
