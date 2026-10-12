'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { Lock, Plus, Send, Trash2 } from 'lucide-react';
import { api, formErrors } from '@/lib/api';
import { POLL_RESULTS_VISIBILITY } from '@/lib/constants';
import { fromLocalInputValue, toLocalInputValue } from '@/lib/format';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { Checkbox, FormMessage, Input, SelectField, TextAreaField, TextField } from '@/components/ui/Form';
import EditorLoader from './EditorLoader';

const LIMITS = { questionMin: 8, questionMax: 240, optionMax: 140, optionsMin: 2, optionsMax: 10, descriptionMax: 1000 };
const YEAR_MS = 366 * 24 * 60 * 60 * 1000;

let optionKey = 0;
const newOption = (text = '') => ({ key: `option-${++optionKey}`, text });

// Mirrors the server rules for quick feedback; the API validates everything again.
function validate({ question, options, startsAt, endsAt }) {
  const errors = {};
  const q = question.trim().replace(/\s+/g, ' ');
  if (q.length < LIMITS.questionMin) errors.question = `Question must be at least ${LIMITS.questionMin} characters.`;

  const texts = options.map((o) => o.text.trim().replace(/\s+/g, ' '));
  if (texts.some((t) => !t)) errors.options = 'Fill in every option, or remove the empty ones.';
  else if (texts.length < LIMITS.optionsMin) errors.options = `Add at least ${LIMITS.optionsMin} options.`;
  else if (new Set(texts.map((t) => t.toLowerCase())).size !== texts.length) errors.options = 'Each option must be different.';

  const end = endsAt ? new Date(endsAt) : null;
  const start = startsAt ? new Date(startsAt) : null;
  const now = Date.now();
  if (start && Number.isNaN(start.getTime())) errors.startsAt = 'Enter a valid date and time.';
  if (!end || Number.isNaN(end.getTime())) errors.endsAt = 'Choose when the poll closes.';
  else if (end.getTime() <= now) errors.endsAt = 'Choose a closing time in the future.';
  else if (start && !errors.startsAt && end.getTime() <= start.getTime()) errors.endsAt = 'The poll must close after it opens.';
  else if (end.getTime() - now > YEAR_MS) errors.endsAt = 'A poll can stay open for at most one year.';
  return errors;
}

function PollFormFields({ initial }) {
  const router = useRouter();
  const toast = useToast();
  const optionsLegendId = useId();
  const editing = Boolean(initial);

  const [question, setQuestion] = useState(initial?.question || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [options, setOptions] = useState(() =>
    initial ? initial.options.map((o) => newOption(o.text)) : [newOption(), newOption()]
  );
  const [allowMultiple, setAllowMultiple] = useState(Boolean(initial?.allowMultiple));
  const [resultsVisibility, setResultsVisibility] = useState(initial?.resultsVisibility || 'AFTER_VOTE');
  const [startsAt, setStartsAt] = useState(() => (initial ? toLocalInputValue(initial.startsAt) : ''));
  const [endsAt, setEndsAt] = useState(() => (initial ? toLocalInputValue(initial.endsAt) : ''));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const clearError = (key) => errors[key] && setErrors((current) => ({ ...current, [key]: undefined }));

  function updateOption(key, text) {
    setOptions((list) => list.map((o) => (o.key === key ? { ...o, text } : o)));
    clearError('options');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    const fieldErrors = validate({ question, options, startsAt, endsAt });
    setErrors(fieldErrors);
    setMessage('');
    if (Object.keys(fieldErrors).length) {
      setMessage('Please check the highlighted fields.');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        question: question.trim(),
        description: description.trim(),
        options: options.map((o) => o.text.trim()),
        allowMultiple,
        resultsVisibility,
        startsAt: fromLocalInputValue(startsAt),
        endsAt: fromLocalInputValue(endsAt),
      };
      await (editing ? api.patch(`/polls/${initial.id}`, payload) : api.post('/polls', payload));
      toast.success(editing ? 'Poll updated.' : 'Poll published.');
      router.push('/community?tab=polls');
    } catch (error) {
      const parsed = formErrors(error);
      // The API reports option problems as "options" or "options.N".
      const optionError = Object.entries(parsed.fieldErrors).find(([key]) => key.startsWith('options'));
      setErrors(optionError ? { ...parsed.fieldErrors, options: optionError[1] } : parsed.fieldErrors);
      setMessage(parsed.message);
      setBusy(false);
    }
  }

  // Once someone has voted, the poll is locked so the options can never change underneath them.
  if (editing && initial.totalVoters > 0) {
    return (
      <EmptyState
        icon={Lock}
        title="This poll already has votes and can no longer be edited"
        description="This keeps the options members vote on from changing. You can delete the poll from My submissions and start a new one."
        action={
          <>
            <Button href="/dashboard/submissions">Back to my submissions</Button>
            <Button href="/community?tab=polls" variant="secondary">
              View polls
            </Button>
          </>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-semibold text-fg">{editing ? 'Edit your poll' : 'Start a poll'}</h1>
      <p className="mt-2 text-fg-soft">
        Let the batch decide together — reunion dates, restaurants, meeting places, activities or budgets.
      </p>

      <form onSubmit={handleSubmit} noValidate className="card mt-6 space-y-5 p-5 sm:p-6">
        <FormMessage tone="info">
          Your poll opens to the community as soon as you publish it. You can edit it until the first vote is cast; after
          that it is locked.
        </FormMessage>
        <FormMessage>{message}</FormMessage>

        <TextField
          label="Question"
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            clearError('question');
          }}
          error={errors.question}
          maxLength={LIMITS.questionMax}
          placeholder="e.g. Which weekend suits you for the reunion?"
          required
        />

        <TextAreaField
          label="Description"
          optional
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={errors.description}
          maxLength={LIMITS.descriptionMax}
          placeholder="Any context that helps members choose"
        />

        <fieldset className="space-y-2" aria-describedby={errors.options ? `${optionsLegendId}-error` : undefined}>
          <legend id={optionsLegendId} className="mb-1.5 text-sm font-semibold text-fg">
            Options{' '}
            <span className="text-danger" aria-hidden="true">
              *
            </span>
            <span className="ml-2 text-xs font-normal text-muted">
              {LIMITS.optionsMin}–{LIMITS.optionsMax} choices
            </span>
          </legend>
          <ul className="space-y-2">
            {options.map((option, index) => (
              <li key={option.key} className="flex items-center gap-2">
                <Input
                  value={option.text}
                  onChange={(e) => updateOption(option.key, e.target.value)}
                  maxLength={LIMITS.optionMax}
                  placeholder={`Option ${index + 1}`}
                  aria-label={`Option ${index + 1}`}
                  error={Boolean(errors.options) && !option.text.trim()}
                />
                <button
                  type="button"
                  onClick={() => {
                    setOptions((list) => list.filter((o) => o.key !== option.key));
                    clearError('options');
                  }}
                  disabled={options.length <= LIMITS.optionsMin}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line-strong text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-40"
                  aria-label={`Remove option ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {errors.options && (
            <p id={`${optionsLegendId}-error`} className="text-xs font-medium text-danger" role="alert">
              {errors.options}
            </p>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={Plus}
            onClick={() => setOptions((list) => [...list, newOption()])}
            disabled={options.length >= LIMITS.optionsMax}
          >
            Add option
          </Button>
        </fieldset>

        <Checkbox
          checked={allowMultiple}
          onChange={(e) => setAllowMultiple(e.target.checked)}
          label="Allow multiple choices"
          description="Members can select more than one option. Each member still votes only once."
        />

        <SelectField
          label="When can members see the results?"
          value={resultsVisibility}
          onChange={(e) => setResultsVisibility(e.target.value)}
          error={errors.resultsVisibility}
          required
        >
          {POLL_RESULTS_VISIBILITY.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Opens"
            type="datetime-local"
            optional
            value={startsAt}
            onChange={(e) => {
              setStartsAt(e.target.value);
              clearError('startsAt');
            }}
            error={errors.startsAt}
            hint="Leave empty to open straight away."
          />
          <TextField
            label="Closes"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => {
              setEndsAt(e.target.value);
              clearError('endsAt');
            }}
            error={errors.endsAt}
            hint="Voting stops automatically at this time."
            required
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
          <Button href={editing ? '/dashboard/submissions' : '/dashboard/create'} variant="secondary">
            Cancel
          </Button>
          <Button type="submit" loading={busy} icon={Send}>
            {editing ? 'Save changes' : 'Publish poll'}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Start a poll, or edit one of your own (until it has votes) with ?edit=ID. */
export default function PollForm() {
  return (
    <EditorLoader resource="/polls" label="poll">
      {(poll) => <PollFormFields key={poll ? poll.id : 'new'} initial={poll} />}
    </EditorLoader>
  );
}
