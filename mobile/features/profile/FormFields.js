import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Button,
  Card,
  FieldError,
  Input,
  SelectField,
  Sheet,
  SwitchRow,
  TagInput,
  Text,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { HIT_SLOP, space } from "@/theme/tokens";
import { emptyItem, validateItem } from "./model";

const KEYBOARD = {
  year: "number-pad",
  phone: "phone-pad",
  email: "email-address",
  url: "url",
};

// Renders one field from the section description. `catalogue` is the
// specialization list from GET /doctors/specialties.
export function ProfileField({
  field,
  value,
  onChange,
  error,
  catalogue = [],
  specialization = "",
}) {
  if (field.type === "bool")
    return (
      <SwitchRow label={field.label} value={value} onValueChange={onChange} />
    );

  if (field.type === "tags") {
    return (
      <TagInput
        label={field.label}
        value={value}
        onChange={onChange}
        max={field.maxItems}
        maxLength={field.max}
        placeholder={field.placeholder}
        error={error}
      />
    );
  }

  if (field.type === "select") {
    return (
      <SelectField
        label={field.label}
        required={field.required}
        value={value}
        onChange={onChange}
        options={field.options}
        searchable={field.searchable}
        allowCustom={field.allowCustom}
        clearable={!field.required}
        placeholder="Not stated"
        error={error}
      />
    );
  }

  // Listed options keep their listed spelling; anything else may be typed.
  if (field.type === "specialization") {
    const options = catalogue.map((s) => ({
      value: s.name,
      label: s.name,
      keywords: [...(s.aliases || []), ...(s.subspecializations || [])].join(
        " ",
      ),
    }));
    return (
      <SelectField
        label={field.label}
        required={field.required}
        value={value}
        onChange={onChange}
        options={options}
        searchable
        allowCustom
        clearable
        placeholder="Choose or type your own"
        error={error}
      />
    );
  }
  if (field.type === "subspecialty") {
    const entry = catalogue.find(
      (s) => s.name.toLowerCase() === String(specialization).toLowerCase(),
    );
    const options = entry ? entry.subspecializations || [] : [];
    return (
      <SelectField
        label={field.label}
        value={value}
        onChange={onChange}
        options={options}
        searchable
        allowCustom
        clearable
        placeholder={
          specialization
            ? "Choose or type your own"
            : "Choose a specialization first"
        }
        error={error}
      />
    );
  }

  const multiline = field.type === "multiline";
  return (
    <Input
      label={field.label}
      required={field.required}
      value={value}
      onChangeText={onChange}
      error={error}
      help={field.help}
      placeholder={field.placeholder}
      multiline={multiline}
      rows={field.rows || 3}
      maxLength={
        field.type === "year" ? 4 : field.type === "phone" ? 32 : field.max
      }
      counter={multiline}
      keyboardType={KEYBOARD[field.type]}
      autoCapitalize={
        field.type === "email" || field.type === "url" ? "none" : "sentences"
      }
      autoCorrect={!(field.type === "email" || field.type === "url")}
    />
  );
}

// A repeated profile section (education, experience, awards…): the saved
// entries as cards, and a sheet to add or edit one. `list` comes from LISTS.
export function ListEditor({ list, value, onChange, serverErrors = [] }) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState(null); // { item, index } — index -1 for a new entry
  const [errors, setErrors] = useState({});
  const full = value.length >= list.max;

  const open = (item, index) => {
    setErrors({});
    setEditing({ item: { ...item }, index });
  };

  const save = () => {
    const found = validateItem(list, editing.item);
    setErrors(found);
    if (Object.keys(found).length) return;
    onChange(
      editing.index === -1
        ? [...value, editing.item]
        : value.map((item, i) => (i === editing.index ? editing.item : item)),
    );
    setEditing(null);
  };

  const pairs = useMemo(() => {
    // Year fields sit two to a row.
    const rows = [];
    for (const field of list.fields) {
      const last = rows[rows.length - 1];
      if (
        field.type === "year" &&
        last &&
        last.length === 1 &&
        last[0].type === "year"
      )
        last.push(field);
      else rows.push([field]);
    }
    return rows;
  }, [list.fields]);

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Text variant="h3" style={styles.flex}>
          {list.label}
        </Text>
        <Text variant="caption" tone="muted">
          {value.length}/{list.max}
        </Text>
      </View>

      {value.map((item, index) => {
        const [title, subtitle] = list.summary(item);
        return (
          <Card
            key={item.key}
            soft
            style={styles.item}
            onPress={() => open(item, index)}
            accessibilityLabel={`Edit ${title}`}
          >
            <View style={styles.flex}>
              <Text variant="bodyStrong" numberOfLines={2}>
                {title || `Untitled ${list.itemLabel}`}
              </Text>
              {subtitle ? (
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => onChange(value.filter((_, i) => i !== index))}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${title}`}
            >
              <Ionicons name="trash-outline" size={19} color={colors.danger} />
            </Pressable>
          </Card>
        );
      })}

      {serverErrors.map((message) => (
        <FieldError key={message} message={message} />
      ))}

      <Button
        title={full ? `Limit of ${list.max} reached` : `Add ${list.itemLabel}`}
        icon="add"
        variant="secondary"
        size="sm"
        disabled={full}
        onPress={() => open(emptyItem(list), -1)}
      />

      <Sheet
        visible={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={
          editing && editing.index === -1
            ? `Add ${list.itemLabel}`
            : `Edit ${list.itemLabel}`
        }
        maxHeight="90%"
      >
        {editing ? (
          <ScrollView
            contentContainerStyle={styles.sheet}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {pairs.map((row) => (
              <View
                key={row[0].key}
                style={row.length > 1 ? styles.pair : null}
              >
                {row.map((field) => (
                  <View
                    key={field.key}
                    style={row.length > 1 ? styles.flex : null}
                  >
                    <ProfileField
                      field={field}
                      value={editing.item[field.key]}
                      error={errors[field.key]}
                      onChange={(next) => {
                        setEditing((e) => ({
                          ...e,
                          item: { ...e.item, [field.key]: next },
                        }));
                        if (errors[field.key])
                          setErrors((e) => ({ ...e, [field.key]: undefined }));
                      }}
                    />
                  </View>
                ))}
              </View>
            ))}
            <Button
              title={editing.index === -1 ? "Add to list" : "Update"}
              onPress={save}
              full
            />
            <Text variant="caption" tone="muted" center>
              Remember to save the section afterwards.
            </Text>
          </ScrollView>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { gap: 10, marginBottom: space.xl },
  head: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  sheet: { paddingHorizontal: space.xl, paddingBottom: 12, gap: 2 },
  pair: { flexDirection: "row", gap: 12 },
});
