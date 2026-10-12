'use client';

import { useId, useState } from 'react';
import { Check, Clock, Info, Pencil, Trash2, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDateTime, plural } from '@/lib/format';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import { Badge, ModerationBadge, ModerationNotice } from '@/components/ui/Feedback';
import { ConfirmDialog } from '@/components/ui/Modal';
import { FormMessage } from '@/components/ui/Form';
import AuthorLine from '@/components/content/AuthorLine';
import ReportButton from '@/components/content/ReportButton';

const STATE_BADGE = {
  OPEN: { tone: 'leaf', label: 'Open' },
  UPCOMING: { tone: 'brand', label: 'Opens soon' },
  CLOSED: { tone: 'neutral', label: 'Closed' },
};

function resultsRule(poll) {
  if (poll.resultsVisible) return '';
  if (poll.resultsVisibility === 'AFTER_CLOSE') return 'Results will be shown when the poll closes.';
  if (poll.resultsVisibility === 'AFTER_VOTE') return 'Results appear after you vote.';
  return '';
}

/**
 * A poll (API poll object) with voting and results.
 * The API enforces one ballot per member; this component only reflects it.
 * `onDeleted(id)` is called after the creator deletes the poll.
 */
export default function PollCard({ poll: initialPoll, onDeleted }) {
  const toast = useToast();
  const groupName = useId();
  const [poll, setPoll] = useState(initialPoll);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const approved = !poll.moderation || poll.moderation.status === 'APPROVED';
  const voted = Array.isArray(poll.myVote);
  const canVote = approved && poll.state === 'OPEN' && !voted;
  const stateBadge = STATE_BADGE[poll.state] || STATE_BADGE.CLOSED;
  const rule = resultsRule(poll);

  async function refresh() {
    try {
      const { data } = await api.get(`/polls/${poll.id}`);
      setPoll(data);
    } catch {
      // Keep what is on screen; the next page load will correct it.
    }
  }

  function toggle(optionId) {
    setError('');
    if (!poll.allowMultiple) {
      setSelected([optionId]);
      return;
    }
    setSelected((list) => (list.includes(optionId) ? list.filter((id) => id !== optionId) : [...list, optionId]));
  }

  async function submitVote(event) {
    event.preventDefault();
    if (busy) return;
    if (!selected.length) {
      setError(poll.allowMultiple ? 'Choose at least one option.' : 'Choose an option.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/polls/${poll.id}/vote`, { optionIds: selected });
      setPoll(data);
      setSelected([]);
      toast.success('Your vote has been recorded.');
    } catch (err) {
      if (err.status === 409) {
        // Already voted, closed or not open yet: show the reason and the real state.
        toast.info(err.message);
        setSelected([]);
        await refresh();
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/polls/${poll.id}`);
      toast.success('Poll deleted.');
      setConfirmDelete(false);
      if (onDeleted) onDeleted(poll.id);
    } catch (err) {
      toast.error(err.message);
      setConfirmDelete(false);
    }
  }

  const options = (
    <ul className="space-y-2">
      {poll.options.map((option) => {
        const mine = voted && poll.myVote.includes(option.id);
        const checked = selected.includes(option.id);
        const inner = (
          <>
            {canVote && (
              <input
                type={poll.allowMultiple ? 'checkbox' : 'radio'}
                name={groupName}
                value={option.id}
                checked={checked}
                onChange={() => toggle(option.id)}
                className="h-[1.1rem] w-[1.1rem] shrink-0 accent-[var(--brand)]"
              />
            )}
            <span className="min-w-0 flex-1 break-words text-sm font-medium text-fg">{option.text}</span>
            {mine && (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-leaf-strong">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Your vote
              </span>
            )}
            {poll.resultsVisible && (
              <span className="shrink-0 text-xs font-semibold tabular-nums text-fg-soft">
                {option.percent}% · {plural(option.votes, 'vote')}
              </span>
            )}
          </>
        );
        const rowClass = 'relative flex items-center gap-3 px-3.5 py-2.5';
        return (
          <li
            key={option.id}
            className={cn(
              'relative overflow-hidden rounded-xl border',
              checked || mine ? 'border-brand' : 'border-line-strong',
              canVote && 'hover:border-brand'
            )}
          >
            {poll.resultsVisible && (
              <span
                className={cn('absolute inset-y-0 left-0', mine ? 'bg-leaf-soft' : 'bg-brand-soft')}
                style={{ width: `${option.percent}%` }}
                aria-hidden="true"
              />
            )}
            {canVote ? <label className={cn(rowClass, 'cursor-pointer')}>{inner}</label> : <div className={rowClass}>{inner}</div>}
          </li>
        );
      })}
    </ul>
  );

  return (
    <article className="card p-5 sm:p-6">
      <AuthorLine
        author={poll.creator}
        date={poll.publishedAt || poll.createdAt}
        trailing={
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {approved ? <Badge tone={stateBadge.tone}>{stateBadge.label}</Badge> : <ModerationBadge status={poll.moderation.status} />}
          </div>
        }
      />

      {poll.isMine && <ModerationNotice moderation={poll.moderation} className="mt-4" />}

      <h3 className="mt-4 text-lg font-bold leading-snug text-fg">{poll.question}</h3>
      {poll.description && (
        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg-soft">{poll.description}</p>
      )}

      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {poll.state === 'UPCOMING'
            ? `Opens ${formatDateTime(poll.startsAt)}`
            : poll.state === 'CLOSED'
              ? `Closed ${formatDateTime(poll.endsAt)}`
              : `Closes ${formatDateTime(poll.endsAt)}`}
        </span>
        {poll.totalVoters !== null && poll.totalVoters !== undefined && (
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {plural(poll.totalVoters, 'member')} voted
          </span>
        )}
        <span>{poll.allowMultiple ? 'Multiple choices allowed' : 'One choice'}</span>
      </p>

      {canVote ? (
        <form onSubmit={submitVote} className="mt-4 space-y-3">
          <fieldset>
            <legend className="sr-only">
              {poll.allowMultiple ? 'Choose one or more options' : 'Choose one option'} for: {poll.question}
            </legend>
            {options}
          </fieldset>
          <FormMessage>{error}</FormMessage>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">Each member votes once. Votes cannot be changed.</p>
            <Button type="submit" size="sm" loading={busy} disabled={!selected.length}>
              Submit vote
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-4">{options}</div>
      )}

      {rule && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {rule}
        </p>
      )}
      {approved && voted && poll.state !== 'CLOSED' && (
        <p className="mt-3 text-xs font-medium text-leaf-strong">Thank you — your vote is in.</p>
      )}
      {approved && poll.state === 'UPCOMING' && <p className="mt-3 text-xs text-muted">Voting has not opened yet.</p>}

      {(poll.isMine || approved) && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-1 border-t border-line pt-3">
          {poll.isMine ? (
            <>
              {!approved && (
                <Button href={`/dashboard/create/poll?edit=${poll.id}`} variant="ghost" size="sm" icon={Pencil}>
                  Edit
                </Button>
              )}
              <Button variant="danger-ghost" size="sm" icon={Trash2} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            </>
          ) : (
            <ReportButton targetType="poll" targetId={poll.id} />
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete this poll?"
        message="The poll and every vote cast in it will be removed permanently."
        confirmLabel="Delete poll"
      />
    </article>
  );
}
