import { useMemo, useState } from "react";
import { View } from "react-native";
import { FormScreen } from "@/components/FormScreen";
import { Banner, SwitchRow } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { doctorsApi } from "@/features/doctors/api";
import { useResource } from "@/hooks/useResource";
import { fieldErrors } from "@/services/api";
import { invalidate } from "@/utils/events";
import { profileApi } from "./api";
import { ListEditor, ProfileField } from "./FormFields";
import {
  placeServerErrors,
  sectionToForm,
  sectionToPayload,
  validateSection,
} from "./model";
import { PhotoEditor, WhatsappField } from "./ProfileControls";
import { LISTS } from "./sections";

const VISIBILITY_LABELS = {
  showWorkContact: [
    "Show workplace contact to members",
    "Workplace phone and email on your profile.",
  ],
};

// Edits one section of the profile and saves it with PATCH /doctors/me.
// Used from Profile → Edit profile and, with `onSkip`, as onboarding step A.
export function SectionEditor({
  section,
  onSaved,
  onSkip,
  step,
  steps,
  submitLabel = "Save",
  only,
}) {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(() => sectionToForm(section, user));
  const [errors, setErrors] = useState({ fields: {}, lists: {}, other: [] });
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);

  const needsCatalogue = section.fields.some(
    (f) => f.type === "specialization",
  );
  const catalogue = useResource(() => doctorsApi.specialties(), [], {
    enabled: needsCatalogue,
  });
  const specializations =
    (catalogue.data && catalogue.data.specializations) || [];

  // `only` narrows the section to a few fields (the short onboarding form).
  const fields = useMemo(
    () =>
      only
        ? section.fields.filter((f) => only.includes(f.key))
        : section.fields,
    [section, only],
  );
  const lists = only ? [] : section.lists;

  const setField = (key) => (value) => {
    setForm((f) => {
      const next = { ...f, fields: { ...f.fields, [key]: value } };
      // A subspecialization belongs to its specialization: changing one clears the other.
      if (
        key === "specialization" &&
        "subspecialty" in f.fields &&
        value !== f.fields.specialization
      )
        next.fields.subspecialty = "";
      return next;
    });
    if (errors.fields[key])
      setErrors((e) => ({ ...e, fields: { ...e.fields, [key]: undefined } }));
  };

  const save = async () => {
    if (busy) return;
    const found = validateSection({ ...section, fields }, form);
    setErrors({ fields: found, lists: {}, other: [] });
    setFailure(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const { data } = await profileApi.update(
        sectionToPayload({ ...section, fields, lists }, form),
      );
      setUser(data);
      invalidate("profile");
      toast.success("Saved.");
      onSaved(data);
    } catch (error) {
      setErrors(placeServerErrors(section, fieldErrors(error)));
      setFailure(error);
      setBusy(false);
    }
  };

  return (
    <FormScreen
      title={section.title}
      subtitle={section.description}
      step={step}
      steps={steps}
      submitLabel={submitLabel}
      submitIcon="checkmark"
      onSubmit={save}
      busy={busy}
      onSkip={onSkip}
      failure={failure}
    >
      {errors.other.length ? (
        <Banner
          tone="danger"
          message={errors.other.join(" ")}
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {section.photo ? <PhotoEditor /> : null}

      {fields.map((field) => (
        <ProfileField
          key={field.key}
          field={field}
          value={form.fields[field.key]}
          onChange={setField(field.key)}
          error={errors.fields[field.key]}
          catalogue={specializations}
          specialization={form.fields.specialization}
        />
      ))}

      {section.whatsapp ? (
        <WhatsappField
          phone={user.phone}
          value={form.whatsapp}
          onChange={(whatsapp) => {
            setForm((f) => ({ ...f, whatsapp }));
            if (errors.fields.whatsapp)
              setErrors((e) => ({
                ...e,
                fields: { ...e.fields, whatsapp: undefined },
              }));
          }}
          visible={form.visibility.showWhatsapp}
          onVisibleChange={(showWhatsapp) =>
            setForm((f) => ({
              ...f,
              visibility: { ...f.visibility, showWhatsapp },
            }))
          }
          error={errors.fields.whatsapp}
        />
      ) : null}

      {!only && section.visibility ? (
        <View style={{ marginBottom: 16 }}>
          {section.visibility.map((key) => (
            <SwitchRow
              key={key}
              label={VISIBILITY_LABELS[key][0]}
              description={VISIBILITY_LABELS[key][1]}
              value={form.visibility[key]}
              onValueChange={(value) =>
                setForm((f) => ({
                  ...f,
                  visibility: { ...f.visibility, [key]: value },
                }))
              }
              icon="eye-outline"
            />
          ))}
        </View>
      ) : null}

      {lists.map((key) => (
        <ListEditor
          key={key}
          list={LISTS[key]}
          value={form.lists[key]}
          onChange={(next) =>
            setForm((f) => ({ ...f, lists: { ...f.lists, [key]: next } }))
          }
          serverErrors={errors.lists[key]}
        />
      ))}
    </FormScreen>
  );
}
