"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Users, X } from "lucide-react";
import { useApi, useDebounced } from "@/lib/hooks";
import { plural } from "@/lib/format";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import { Field, Input, SelectField } from "@/components/ui/Form";
import {
  CardSkeletons,
  EmptyState,
  ErrorState,
} from "@/components/ui/Feedback";
import DoctorCard from "@/components/cards/DoctorCard";

const PAGE_SIZE = 12;

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
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `/doctors?${qs}` : "/doctors");
  }, [debouncedQ, specialization, city, page]);

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
    <div className="container-page py-8 sm:py-10">
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

      <p className="mt-5 text-sm text-muted" aria-live="polite">
        {loading && !data
          ? "Loading friends…"
          : meta && !error
            ? `${plural(meta.total, "friend")}${hasFilters ? " found" : " in the community"}`
            : ""}
      </p>

      <div className="mt-4">
        {loading && !data ? (
          <CardSkeletons count={6} height="h-60" />
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
        ) : (
          <ul
            className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${loading ? "opacity-60" : ""}`}
            aria-busy={loading}
          >
            {doctors.map((doctor) => (
              <li key={doctor.id}>
                <DoctorCard doctor={doctor} />
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
