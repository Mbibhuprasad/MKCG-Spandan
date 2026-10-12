'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Field, Input } from '@/components/ui/Form';
import Button from '@/components/ui/Button';

/**
 * Edits a short list of text values (qualifications, interests, languages).
 * Press Enter or a comma to add; duplicates are ignored.
 */
export default function TagInput({ label, hint, values, onChange, placeholder, max = 12, maxLength = 60, error }) {
  const [draft, setDraft] = useState('');
  const full = values.length >= max;

  function commit(raw) {
    const parts = String(raw)
      .split(',')
      .map((part) => part.replace(/\s+/g, ' ').trim().slice(0, maxLength))
      .filter(Boolean);
    setDraft('');
    if (!parts.length) return;
    const next = [...values];
    for (const part of parts) {
      if (next.length >= max) break;
      if (!next.some((v) => v.toLowerCase() === part.toLowerCase())) next.push(part);
    }
    if (next.length !== values.length) onChange(next);
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault(); // never submit the surrounding form from here
      commit(draft);
    } else if (event.key === 'Backspace' && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <Field label={label} hint={hint || `Press Enter to add. Up to ${max}.`} error={error} optional>
      {(props) => (
        <div>
          {values.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2" aria-label={`${label}: current entries`}>
              {values.map((value) => (
                <li
                  key={value}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-brand/15 bg-brand-soft py-1 pl-3 pr-1 text-sm font-medium text-brand-ink"
                >
                  <span className="truncate">{value}</span>
                  <button
                    type="button"
                    onClick={() => onChange(values.filter((v) => v !== value))}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full hover:bg-brand/15"
                    aria-label={`Remove ${value}`}
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input
              {...props}
              required={undefined}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={() => commit(draft)}
              placeholder={full ? 'Limit reached' : placeholder}
              maxLength={maxLength}
              disabled={full}
              error={error}
              enterKeyHint="done"
            />
            <Button
              variant="secondary"
              icon={Plus}
              onClick={() => commit(draft)}
              disabled={full || !draft.trim()}
              aria-label={`Add to ${label}`}
              className="shrink-0"
            >
              Add
            </Button>
          </div>
        </div>
      )}
    </Field>
  );
}
