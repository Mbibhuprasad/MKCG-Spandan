"use client";

import { useMemo } from "react";
import { useApi } from "@/lib/hooks";

const keyOf = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Whether two typed values are the same apart from capitals and spacing. */
export const sameText = (a, b) => keyOf(a) === keyOf(b);

/**
 * The specialization and subspecialization options of the profile form.
 *
 * They are defined once, on the API (GET /doctors/specialties: the predefined
 * catalogue plus the values members typed themselves), so no component carries
 * its own list. The options are suggestions — any typed value is accepted.
 *
 *   names                       specialization options
 *   keywordsOf(name)            other names of an option, for searching
 *   find(value)                 the entry for a name or one of its aliases
 *   subspecializationsOf(value) options that belong to a specialization
 *   isListed(spec, sub)         whether `sub` is an option of `spec`
 */
export function useSpecialties() {
  const { data, loading, error } = useApi("/doctors/specialties");
  return useMemo(() => {
    const entries = (data && data.specializations) || [];
    const byKey = new Map();
    for (const entry of entries) {
      for (const label of [entry.name, ...entry.aliases])
        byKey.set(keyOf(label), entry);
    }
    const find = (value) => byKey.get(keyOf(value)) || null;
    return {
      loading,
      failed: Boolean(error),
      names: entries.map((entry) => entry.name),
      keywordsOf: (name) => {
        const entry = find(name);
        return entry ? entry.aliases.join(" ") : "";
      },
      find,
      subspecializationsOf: (value) => {
        const entry = find(value);
        return entry ? entry.subspecializations : [];
      },
      isListed: (specialization, subspecialty) => {
        const entry = find(specialization);
        const key = keyOf(subspecialty);
        return Boolean(
          entry &&
          key &&
          entry.subspecializations.some((sub) => keyOf(sub) === key),
        );
      },
    };
  }, [data, loading, error]);
}
