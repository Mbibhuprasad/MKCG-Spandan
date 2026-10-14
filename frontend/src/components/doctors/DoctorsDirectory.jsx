"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutGrid, List, Search, Users, X } from "lucide-react";
import { useApi, useDebounced } from "@/lib/hooks";
import { cn, plural } from "@/lib/format";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import { Field, Input, SelectField } from "@/components/ui/Form";
import {
  CardSkeletons,
  EmptyState,
  ErrorState,
} from "@/components/ui/Feedback";
import DoctorGridCard from "@/components/cards/DoctorGridCard";
import DoctorListItem from "@/components/cards/DoctorListItem";

const PAGE_SIZE = 12;

// Grid (the cards) is the default on the website; List shows one row per friend.
const VIEWS = [
  { value: "grid", label: "Grid", icon: LayoutGrid },
  { value: "list", label: "List", icon: List },
];

function ViewSwitch({ value, onChange }) {
  return (
    <div
      role="group"
      aria-label="Show friends as"
      className="inline-flex shrink-0 rounded-xl border border-line bg-surface-2 p-1"
    >
      {VIEWS.map((view) => {
        const active = view.value === value;
        return (
          <button
            key={view.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(view.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors",
              active
                ? "bg-surface text-brand-ink shadow-soft"
                : "text-muted hover:text-fg",
            )}
          >
            <view.icon className="h-4 w-4" aria-hidden="true" />
            {view.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The Friends list (member discovery). Rendered inside <MemberGate>, so it only mounts — and only
 * calls the API — for signed-in members. Filters are mirrored into the URL so
 * coming back from a profile restores the same results.
 */
export default function DoctorsDirectory() {
  const params = useSearchParams();
  const [q, setQ] = useState(() => params.get("q") || "");
  const [specialization, setSpecialization] = useState(
    () => params.get("specialization") || "",
  );
  const [city, setCity] = useState(() => params.get("city") || "");
  const [view, setView] = useState(() =>
    params.get("view") === "list" ? "list" : "grid",
  );
  const [page, setPage] = useState(() => {
    const n = Number(params.get("page"));
    return Number.isInteger(n) && n > 0 ? n : 1;
  });
  const debouncedQ = useDebounced(q.trim(), 350);

  const filters = useApi("/doctors/filters");
  const { data, meta, loading, error, reload } = useApi("/doctors", {
    q: debouncedQ || undefined,
    specialization: specialization || undefined,
    city: city || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const doctors = data || [];
  const hasFilters = Boolean(debouncedQ || specialization || city);

  // Keep the address bar in step with the current filters (no navigation).
  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedQ) next.set("q", debouncedQ);
    if (specialization) next.set("specialization", specialization);
    if (city) next.set("city", city);
    if (page > 1) next.set("page", String(page));
    if (view === "list") next.set("view", "list");
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `/doctors?${qs}` : "/doctors");
  }, [debouncedQ, specialization, city, page, view]);

  const change = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  function clearFilters() {
    setQ("");
    setSpecialization("");
    setCity("");
    setPage(1);
  }

  function goToPage(next) {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const specializations = filters.data ? filters.data.specializations : [];
  const cities = filters.data ? filters.data.cities : [];

  return (
    <div className="container-page py-6 sm:py-6">
      <p className="mb-5 max-w-2xl text-base leading-relaxed text-fg-soft">
        Find batchmates by name, specialization or city, and see where their
        journeys in medicine have taken them.
      </p>
      <form
        role="search"
        aria-label="Find friends"
        onSubmit={(event) => event.preventDefault()}
        className="card grid gap-4 p-4 sm:p-5 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end"
      >
        <Field label="Search by name">
          {(props) => (
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted"
                aria-hidden="true"
              />
              <Input
                {...props}
                type="search"
                value={q}
                onChange={change(setQ)}
                placeholder="Friend's name"
                maxLength={60}
                className="pl-10"
                autoComplete="off"
              />
            </div>
          )}
        </Field>
        <SelectField
          label="Specialization"
          value={specialization}
          onChange={change(setSpecialization)}
          disabled={filters.loading}
        >
          <option value="">All specializations</option>
          {/* Keep a value restored from the URL selectable while the list loads. */}
          {specialization && !specializations.includes(specialization) && (
            <option value={specialization}>{specialization}</option>
          )}
          {specializations.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="City"
          value={city}
          onChange={change(setCity)}
          disabled={filters.loading}
        >
          <option value="">All cities</option>
          {city && !cities.includes(city) && (
            <option value={city}>{city}</option>
          )}
          {cities.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </SelectField>
        <Button
          variant="ghost"
          icon={X}
          onClick={clearFilters}
          disabled={!q && !specialization && !city}
        >
          Clear
        </Button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          {loading && !data
            ? "Loading friends…"
            : meta && !error
              ? `${plural(meta.total, "friend")}${hasFilters ? " found" : " in the community"}`
              : ""}
        </p>
        <ViewSwitch value={view} onChange={setView} />
      </div>

      <div className="mt-4">
        {loading && !data ? (
          view === "list" ? (
            <CardSkeletons count={4} className="space-y-4" height="h-24" />
          ) : (
            <CardSkeletons count={6} height="h-60" />
          )
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : doctors.length === 0 ? (
          meta && meta.total > 0 && page > 1 ? (
            <EmptyState
              icon={Users}
              title="No more friends on this page"
              description="There are fewer results than this page number."
              action={
                <Button variant="secondary" onClick={() => goToPage(1)}>
                  Go to the first page
                </Button>
              }
            />
          ) : hasFilters ? (
            <EmptyState
              icon={Search}
              title="No friends match your search"
              description="Try a different name, or clear the specialization and city filters."
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title="Friends will appear here"
              description="Friends appear here as they join and complete their profiles. Make sure yours is ready for batchmates to find."
              action={
                <Button href="/dashboard/profile">Complete my profile</Button>
              }
            />
          )
        ) : view === "list" ? (
          <ul
            className={`space-y-4 ${loading ? "opacity-60" : ""}`}
            aria-busy={loading}
          >
            {doctors.map((doctor) => (
              <li key={doctor.id}>
                <DoctorListItem doctor={doctor} />
              </li>
            ))}
          </ul>
        ) : (
          <ul
            className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${loading ? "opacity-60" : ""}`}
            aria-busy={loading}
          >
            {doctors.map((doctor) => (
              <li key={doctor.id}>
                <DoctorGridCard doctor={doctor} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {meta && !error && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={goToPage}
          className="mt-8"
        />
      )}
    </div>
  );
}
