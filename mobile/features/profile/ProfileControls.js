import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  Avatar,
  Button,
  Card,
  FieldError,
  Input,
  SwitchRow,
  Text,
} from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { messageOf, uploadMedia } from "@/services/api";
import { useTheme } from "@/theme/ThemeProvider";
import { invalidate } from "@/utils/events";
import { formatPhone } from "@/utils/phone";
import { profileApi } from "./api";

// Profile photo: chosen from the gallery, cropped square, uploaded through the
// API (purpose "profile") and attached with PUT /doctors/me/photo. Saved at
// once, independently of the rest of the form — exactly like the website.
export function PhotoEditor() {
  const { colors } = useTheme();
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const choose = async () => {
    if (busy) return;
    setError("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        exif: false,
      });
      if (result.canceled || !result.assets || !result.assets[0]) return;
      setBusy(true);
      const media = await uploadMedia(result.assets[0], "profile");
      const { data } = await profileApi.setPhoto(media.id);
      setUser(data);
      invalidate("profile");
      toast.success("Profile photo updated.");
    } catch (err) {
      setError(messageOf(err, "The photo could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await profileApi.removePhoto();
      setUser(data);
      invalidate("profile");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const has = Boolean(user.profile.photoUrl);
  return (
    <Card soft style={styles.photo}>
      <View>
        <Avatar uri={user.profile.photoUrl} name={user.name} size={84} square />
        {busy ? (
          <View style={[styles.photoBusy, { backgroundColor: colors.overlay }]}>
            <ActivityIndicator color="#ffffff" />
          </View>
        ) : null}
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong">Profile photo</Text>
        <Text variant="caption" tone="muted">
          A clear, recent photo helps batchmates recognise you. JPG, PNG or
          WebP, up to 8 MB.
        </Text>
        <View style={styles.photoActions}>
          <Button
            title={has ? "Change" : "Choose photo"}
            icon="image-outline"
            size="sm"
            variant="secondary"
            onPress={choose}
            disabled={busy}
          />
          {has ? (
            <Button
              title="Remove"
              size="sm"
              variant="ghost"
              onPress={remove}
              disabled={busy}
            />
          ) : null}
        </View>
        <FieldError message={error} />
      </View>
    </Card>
  );
}

// WhatsApp number for the member contact feature.
//   • "Same as my registered number" reuses the account's phone number, so it
//     is never stored twice.
//   • Otherwise a separate number is validated and normalised with its country code.
//   • "Show to members" is the doctor's own visibility switch; when it is off
//     the API does not send the number to anyone else.
// value: { sameAsPhone, number }, visible: boolean
export function WhatsappField({
  value,
  onChange,
  visible,
  onVisibleChange,
  error,
  phone,
}) {
  const { colors } = useTheme();
  return (
    <Card soft style={styles.whatsapp}>
      <Text variant="h3">WhatsApp number</Text>
      <Text variant="small" tone="muted">
        Used for the contact feature: members you allow can open a WhatsApp chat
        with you. It is also needed before you can start one-to-one chats in the
        app.
      </Text>
      <SwitchRow
        label="Same as my registered number"
        description={formatPhone(phone)}
        value={value.sameAsPhone}
        onValueChange={(sameAsPhone) => onChange({ ...value, sameAsPhone })}
        icon="call-outline"
      />
      {!value.sameAsPhone ? (
        <Input
          label="WhatsApp number"
          value={value.number}
          onChangeText={(number) => onChange({ ...value, number })}
          error={error}
          help="10-digit Indian numbers get +91 automatically. Outside India, start with + and the country code. Leave empty to remove it."
          placeholder="98765 43210"
          keyboardType="phone-pad"
          icon="logo-whatsapp"
          maxLength={32}
          style={styles.noGap}
        />
      ) : null}
      <View style={[styles.rule, { backgroundColor: colors.line }]} />
      <SwitchRow
        label="Show my WhatsApp number to members"
        description="Off keeps it private: nobody else receives it."
        value={visible}
        onValueChange={onVisibleChange}
        icon="eye-outline"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  photo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  photoBusy: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  photoActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  whatsapp: { gap: 6, marginBottom: 20 },
  noGap: { marginBottom: 0 },
  rule: { height: StyleSheet.hairlineWidth * 2, marginVertical: 4 },
});
