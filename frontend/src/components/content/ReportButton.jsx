'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { api, formErrors } from '@/lib/api';
import { REPORT_REASONS } from '@/lib/constants';
import { cn } from '@/lib/format';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormMessage, SelectField, TextAreaField } from '@/components/ui/Form';

/**
 * Lets a member report content to the administrators.
 * targetType: 'post' | 'blog' | 'comment' | 'memory' | 'event' | 'poll'
 */
export default function ReportButton({ targetType, targetId, compact = false, className }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0].value);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/reports', { targetType, targetId, reason, details });
      toast.success(data.alreadyReported ? 'You have already reported this. An admin will review it.' : 'Thank you. An admin will review this.');
      setOpen(false);
      setDetails('');
    } catch (err) {
      setError(formErrors(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg',
          className
        )}
        aria-label="Report this content"
      >
        <Flag className="h-4 w-4" aria-hidden="true" />
        {!compact && <span>Report</span>}
      </button>

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Report content"
        description="Reports are confidential and reviewed by the community administrators."
        size="sm"
      >
        <form onSubmit={submit} className="space-y-4">
          <FormMessage>{error}</FormMessage>
          <SelectField label="What is the problem?" value={reason} onChange={(e) => setReason(e.target.value)} required>
            {REPORT_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </SelectField>
          <TextAreaField
            label="Details"
            optional
            rows={3}
            maxLength={1000}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Anything that helps the admin understand the issue"
          />
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Send report
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
