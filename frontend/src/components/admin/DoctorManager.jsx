'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Ban, RotateCcw, Search, Trash2, UsersRound } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi, useDebounced } from '@/lib/hooks';
import { formatDate, plural } from '@/lib/format';
import { useToast } from '@/components/providers/ToastProvider';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Form';
import { Badge, EmptyState, ErrorState, PageLoader, Skeleton } from '@/components/ui/Feedback';
import DoctorDetail from './DoctorDetail';
import { AccountStatusBadge, AdminHeader, FilterPills, ReasonField } from './shared';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

const PAGE_SIZE = 12;

function CompletionMeter({ percent }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full rounded-full bg-leaf" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums text-fg-soft">{percent}%</span>
    </div>
  );
}

/**
 * Doctor management for administrators: search, filter, inspect, suspend /
 * reactivate, change visibility and delete. Every action here calls an /admin
 * API route that checks the ADMIN role again on the server.
 */
export default function DoctorManager() {
  const toast = useToast();
  const params = useSearchParams();
  const requested = params.get('status');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(requested === 'ACTIVE' || requested === 'SUSPENDED' ? requested : 'ALL');
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());

  const list = useApi('/admin/doctors', { q, status, page, limit: PAGE_SIZE });
  const doctors = list.data || [];

  const [selectedId, setSelectedId] = useState(null);
  const detail = useApi(selectedId ? `/admin/doctors/${selectedId}` : null, undefined, { enabled: Boolean(selectedId) });
  const selected = detail.data && detail.data.id === selectedId ? detail.data : null;

  const [dialog, setDialog] = useState(null); // { type: 'suspend' | 'delete', doctor }
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  function refresh() {
    list.reload();
    if (selectedId) detail.reload();
  }

  function openDialog(type, doctor) {
    setReason('');
    setDialog({ type, doctor });
  }

  async function setAccountStatus(doctor, nextStatus, reasonText = '') {
    if (busy) return;
    setBusy(true);
    try {
      await api.patch(`/admin/doctors/${doctor.id}/status`, { status: nextStatus, reason: reasonText });
      toast.success(
        nextStatus === 'SUSPENDED'
          ? `${doctor.name} has been suspended and signed out everywhere.`
          : `${doctor.name} has been reactivated.`
      );
      setDialog(null);
      refresh();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleVisibility(doctor, key) {
    if (busy) return;
    const current = key === 'featured' ? doctor.featured : doctor.visibility.directory;
    setBusy(true);
    try {
      await api.patch(`/admin/doctors/${doctor.id}/visibility`, { [key]: !current });
      toast.success('Visibility updated.');
      refresh();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteDoctor() {
    const doctor = dialog.doctor;
    try {
      await api.delete(`/admin/doctors/${doctor.id}`, { reason });
      toast.success(`${doctor.name}'s account and content were permanently deleted.`);
      setDialog(null);
      setSelectedId(null);
      if (doctors.length === 1 && page > 1) setPage((p) => p - 1);
      else list.reload();
    } catch (error) {
      toast.error(error.message);
    }
  }

  const total = list.meta ? list.meta.total : 0;

  return (
    <div>
      <AdminHeader
        title="Doctors"
        description="Search member accounts, review profiles and manage account status. Doctors join without approval; suspension and deletion are the available sanctions."
      />

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <label htmlFor="doctor-search" className="sr-only">
            Search doctors by name, email, phone, specialization or city
          </label>
          <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted" aria-hidden="true" />
          <Input
            id="doctor-search"
            type="search"
            placeholder="Search name, email, phone, specialization, city"
            value={search}
            maxLength={80}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>
        <FilterPills
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
      </div>

      {list.error ? (
        <ErrorState title="Doctors could not be loaded" message={list.error.message} onRetry={list.reload} />
      ) : list.loading && !list.data ? (
        <div className="space-y-3" role="status" aria-label="Loading doctors">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : doctors.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={q || status !== 'ALL' ? 'No doctors match these filters' : 'No doctors have registered yet'}
          description={
            q || status !== 'ALL'
              ? 'Try a different search term or status.'
              : 'Doctor accounts will appear here as soon as members join the community.'
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted" aria-live="polite">
            {plural(total, 'doctor')} found
          </p>

          {/* Table for medium screens and up */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <caption className="sr-only">Doctor accounts</caption>
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Doctor</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Contact</th>
                  <th scope="col" className="px-4 py-3 font-semibold">City</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Joined</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Profile</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {doctors.map((doctor) => (
                  <tr key={doctor.id} className="align-middle">
                    <th scope="row" className="px-4 py-3 font-normal">
                      <div className="flex items-center gap-3">
                        <Avatar name={doctor.name} src={doctor.profile.photoUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-fg">{doctor.name}</p>
                          <p className="truncate text-xs text-muted">{doctor.profile.specialization || 'No specialization added'}</p>
                        </div>
                        {doctor.featured && <Badge tone="brand">Featured</Badge>}
                      </div>
                    </th>
                    <td className="px-4 py-3 text-fg-soft">
                      <p className="max-w-[14rem] truncate">{doctor.email}</p>
                      <p className="text-xs text-muted">{doctor.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-fg-soft">{doctor.profile.city || '—'}</td>
                    <td className="px-4 py-3">
                      <AccountStatusBadge status={doctor.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-fg-soft">{formatDate(doctor.createdAt)}</td>
                    <td className="px-4 py-3">
                      <CompletionMeter percent={doctor.profileCompletion.percent} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="secondary" size="sm" onClick={() => setSelectedId(doctor.id)} aria-label={`Manage ${doctor.name}`}>
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards for small screens */}
          <ul className="space-y-3 md:hidden">
            {doctors.map((doctor) => (
              <li key={doctor.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={doctor.name} src={doctor.profile.photoUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-fg">{doctor.name}</p>
                    <p className="truncate text-xs text-muted">
                      {[doctor.profile.specialization, doctor.profile.city].filter(Boolean).join(' · ') || 'Profile not filled in'}
                    </p>
                  </div>
                  <AccountStatusBadge status={doctor.status} />
                </div>
                <dl className="mt-3 space-y-1 text-sm text-fg-soft">
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-xs font-semibold text-muted">Email</dt>
                    <dd className="min-w-0 break-all">{doctor.email}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-xs font-semibold text-muted">Phone</dt>
                    <dd>{doctor.phone}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-xs font-semibold text-muted">Joined</dt>
                    <dd>{formatDate(doctor.createdAt)}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="w-16 shrink-0 text-xs font-semibold text-muted">Profile</dt>
                    <dd>
                      <CompletionMeter percent={doctor.profileCompletion.percent} />
                    </dd>
                  </div>
                </dl>
                <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={() => setSelectedId(doctor.id)}>
                  Manage account
                </Button>
              </li>
            ))}
          </ul>

          <Pagination className="mt-8" page={page} totalPages={list.meta ? list.meta.totalPages : 1} onPageChange={setPage} />
        </>
      )}

      {/* Detail and account actions */}
      <Modal
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        title="Doctor account"
        description="Profile, visibility and account actions."
        size="lg"
        footer={
          selected && (
            <>
              <Button variant="danger-ghost" icon={Trash2} onClick={() => openDialog('delete', selected)} disabled={busy}>
                Delete account
              </Button>
              {selected.status === 'SUSPENDED' ? (
                <Button variant="leaf" icon={RotateCcw} loading={busy} onClick={() => setAccountStatus(selected, 'ACTIVE')}>
                  Reactivate
                </Button>
              ) : (
                <Button variant="secondary" icon={Ban} onClick={() => openDialog('suspend', selected)} disabled={busy}>
                  Suspend
                </Button>
              )}
            </>
          )
        }
      >
        {detail.error ? (
          <ErrorState title="This account could not be loaded" message={detail.error.message} onRetry={detail.reload} className="border-0 shadow-none" />
        ) : selected ? (
          <DoctorDetail doctor={selected} busy={busy} onToggleVisibility={(key) => toggleVisibility(selected, key)} />
        ) : (
          <PageLoader label="Loading account…" />
        )}
      </Modal>

      {/* Suspend */}
      <Modal
        open={Boolean(dialog && dialog.type === 'suspend')}
        onClose={() => !busy && setDialog(null)}
        title={dialog ? `Suspend ${dialog.doctor.name}?` : 'Suspend account'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={() => setAccountStatus(dialog.doctor, 'SUSPENDED', reason)}>
              Suspend account
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-fg-soft">
            The doctor is signed out immediately and cannot log in or use any protected feature until reactivated. Their
            published content stays visible unless you delete it separately.
          </p>
          <ReasonField
            value={reason}
            onChange={setReason}
            hint="Shown to the doctor in their notification and recorded in the audit log."
            placeholder="e.g. Repeated community guideline violations"
          />
        </div>
      </Modal>

      {/* Delete */}
      <ConfirmDialog
        open={Boolean(dialog && dialog.type === 'delete')}
        onClose={() => setDialog(null)}
        onConfirm={deleteDoctor}
        title={dialog ? `Permanently delete ${dialog.doctor.name}?` : 'Delete account'}
        confirmLabel="Delete account and content"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-fg-soft">
            This permanently deletes the doctor&apos;s <strong className="text-fg">account and profile</strong> and{' '}
            <strong className="text-fg">all content they own</strong> — posts, blogs, comments, memories (including
            uploaded photos and videos), events, visit plans and polls — together with their likes, votes and RSVPs.
          </p>
          <p className="text-sm font-semibold text-danger">This cannot be undone. Consider suspending the account instead.</p>
          <ReasonField value={reason} onChange={setReason} hint="Recorded in the audit log." />
        </div>
      </ConfirmDialog>
    </div>
  );
}
