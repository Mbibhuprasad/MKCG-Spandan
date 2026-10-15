'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronsUpDown, CircleAlert, ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api, uploadMedia } from '@/lib/api';
import { UPLOAD_LIMITS } from '@/lib/constants';
import { cn } from '@/lib/format';
import Button from '@/components/ui/Button';
import { Field, Input, TextField } from '@/components/ui/Form';
import { YEAR_MAX, YEAR_MIN } from './model';

const EASE = [0.22, 1, 0.36, 1];

/** Year input used throughout the wizard. */
export function YearField(props) {
  return <TextField type="number" inputMode="numeric" min={YEAR_MIN} max={YEAR_MAX} placeholder="YYYY" {...props} />;
}

/**
 * Searchable text input with suggestions (ARIA combobox). The doctor may pick
 * a suggestion or keep whatever they typed, so no specialty or city is ever
 * excluded by the list.
 *   keywords(option) → other names the option is also found by (optional)
 * On leaving the field, a typed value that matches an option apart from
 * capitals takes the option's spelling.
 */
export function ComboField({ label, value, onChange, options = [], keywords, error, hint, required, optional, className, ...inputProps }) {
  const listId = useId();
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const [active, setActive] = useState(-1);

  const query = value.trim().toLowerCase();
  const searchText = (option) => (keywords ? `${option} ${keywords(option)}` : option).toLowerCase();
  // Until the doctor types, the whole list is offered so they can browse it.
  const matches =
    !typed || !query
      ? options
      : [
          ...options.filter((o) => o.toLowerCase().startsWith(query)),
          ...options.filter((o) => !o.toLowerCase().startsWith(query) && searchText(o).includes(query)),
        ];
  const showList = open && options.length > 0;
  const listed = options.find((o) => o.toLowerCase() === query);

  useEffect(() => {
    if (!showList || active < 0 || !listRef.current) return;
    const option = listRef.current.children[active];
    if (option) option.scrollIntoView({ block: 'nearest' });
  }, [active, showList]);

  const close = () => {
    setOpen(false);
    setTyped(false);
    setActive(-1);
  };
  const choose = (option) => {
    onChange(option);
    close();
  };

  function onKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(event.key === 'ArrowDown' ? 0 : matches.length - 1);
        return;
      }
      if (!matches.length) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + matches.length) % matches.length);
    } else if (event.key === 'Enter' && showList && active >= 0 && matches[active]) {
      event.preventDefault(); // choose the suggestion instead of moving to the next step
      choose(matches[active]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
    }
  }

  return (
    <Field label={label} error={error} hint={hint} required={required} optional={optional} className={className}>
      {(props) => (
        <div className="relative">
          <Input
            {...props}
            {...inputProps}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
            autoComplete="off"
            error={error}
            value={value}
            className="pr-10"
            onChange={(event) => {
              onChange(event.target.value);
              setTyped(true);
              setOpen(true);
              setActive(-1);
            }}
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              if (listed && listed !== value) onChange(listed);
              close();
            }}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Show suggestions for ${label}`}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl text-muted hover:text-fg"
            onMouseDown={(event) => event.preventDefault()} // keep focus in the input
            onClick={() => (open ? close() : setOpen(true))}
          >
            <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />
          </button>
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={`${label} suggestions`}
            hidden={!showList}
            onMouseDown={(event) => event.preventDefault()} // scrolling the list must not blur the input
            className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-line-strong bg-surface p-1 shadow-lift"
          >
            {showList && matches.length === 0 && (
              <li role="presentation" className="px-3 py-2 text-sm text-muted">
                Nothing in the list matches — your own wording will be saved.
              </li>
            )}
            {showList &&
              matches.map((option, index) => {
                const selected = option.toLowerCase() === query;
                return (
                  // Keyboard users choose with the arrow keys and Enter on the input (combobox pattern).
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                  <li
                    key={option}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm',
                      index === active ? 'bg-brand-soft text-brand-ink' : 'text-fg hover:bg-surface-2'
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(option)}
                  >
                    <span className="truncate">{option}</span>
                    {selected && <Check className="h-4 w-4 shrink-0 text-leaf" aria-hidden="true" />}
                  </li>
                );
              })}
            {showList && typed && query && !listed && matches.length > 0 && (
              <li role="presentation" className="mt-1 border-t border-line px-3 pb-1 pt-2 text-xs text-muted">
                Not in the list? Keep typing — “{value.trim()}” will be saved as your own entry.
              </li>
            )}
          </ul>
        </div>
      )}
    </Field>
  );
}

/**
 * Like ComboField, but several values can be chosen: each choice is shown as a
 * chip, and the list stays open so more can be ticked. Clicking a ticked option
 * removes it. A typed value is added with Enter, a comma or the Add button; one
 * that matches an option apart from capitals takes the option's spelling.
 *   values   the chosen values (array)
 *   onChange(next values)
 */
export function MultiComboField({
  label,
  values,
  onChange,
  options = [],
  keywords,
  error,
  hint,
  required,
  optional,
  className,
  placeholder,
  max = 8,
  maxLength = 80,
}) {
  const listId = useId();
  const listRef = useRef(null);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const keyOf = (text) => String(text).replace(/\s+/g, ' ').trim().toLowerCase();
  const chosen = new Set(values.map(keyOf));
  const full = values.length >= max;
  const query = keyOf(draft);
  const searchText = (option) => (keywords ? `${option} ${keywords(option)}` : option).toLowerCase();
  const matches = !query
    ? options
    : [
        ...options.filter((o) => o.toLowerCase().startsWith(query)),
        ...options.filter((o) => !o.toLowerCase().startsWith(query) && searchText(o).includes(query)),
      ];
  const showList = open && options.length > 0;

  useEffect(() => {
    if (!showList || active < 0 || !listRef.current) return;
    const option = listRef.current.children[active];
    if (option) option.scrollIntoView({ block: 'nearest' });
  }, [active, showList]);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const remove = (value) => onChange(values.filter((v) => keyOf(v) !== keyOf(value)));
  const toggle = (option) => {
    if (chosen.has(keyOf(option))) remove(option);
    else if (!full) onChange([...values, option]);
    setDraft('');
  };
  // Adds what was typed (a comma separates several), using an option's spelling where one matches.
  const commit = (raw) => {
    setDraft('');
    const next = [...values];
    const keys = new Set(chosen);
    for (const part of String(raw).split(',')) {
      const text = part.replace(/\s+/g, ' ').trim().slice(0, maxLength);
      const key = keyOf(text);
      if (!key || keys.has(key) || next.length >= max) continue;
      next.push(options.find((o) => o.toLowerCase() === key) || text);
      keys.add(key);
    }
    if (next.length !== values.length) onChange(next);
  };

  function onKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(event.key === 'ArrowDown' ? 0 : matches.length - 1);
        return;
      }
      if (!matches.length) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + matches.length) % matches.length);
    } else if (event.key === 'Enter') {
      event.preventDefault(); // never move to the next step from here
      if (showList && active >= 0 && matches[active]) toggle(matches[active]);
      else commit(draft);
    } else if (event.key === ',') {
      event.preventDefault();
      commit(draft);
    } else if (event.key === 'Backspace' && !draft && values.length) {
      onChange(values.slice(0, -1));
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
    }
  }

  return (
    <Field label={label} error={error} hint={hint} required={required} optional={optional} className={className}>
      {(props) => (
        <div>
          {values.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2" aria-label={`${label}: chosen`}>
              {values.map((value) => (
                <li
                  key={keyOf(value)}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-brand/15 bg-brand-soft py-1 pl-3 pr-1 text-sm font-medium text-brand-ink"
                >
                  <span className="truncate">{value}</span>
                  <button
                    type="button"
                    onClick={() => remove(value)}
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
            <div className="relative min-w-0 flex-1">
              <Input
                {...props}
                required={undefined}
                role="combobox"
                aria-expanded={showList}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
                autoComplete="off"
                error={error}
                value={draft}
                maxLength={maxLength}
                placeholder={full ? `Limit reached (${max})` : placeholder}
                className="pr-10"
                onChange={(event) => {
                  setDraft(event.target.value);
                  setOpen(true);
                  setActive(-1);
                }}
                onClick={() => setOpen(true)}
                onKeyDown={onKeyDown}
                onBlur={() => {
                  commit(draft);
                  close();
                }}
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label={`Show suggestions for ${label}`}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl text-muted hover:text-fg"
                onMouseDown={(event) => event.preventDefault()} // keep focus in the input
                onClick={() => (open ? close() : setOpen(true))}
              >
                <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />
              </button>
              <ul
                ref={listRef}
                id={listId}
                role="listbox"
                aria-label={`${label} suggestions`}
                aria-multiselectable="true"
                hidden={!showList}
                onMouseDown={(event) => event.preventDefault()} // scrolling the list must not blur the input
                className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-line-strong bg-surface p-1 shadow-lift"
              >
                {showList && matches.length === 0 && (
                  <li role="presentation" className="px-3 py-2 text-sm text-muted">
                    Nothing in the list matches — press Enter to add “{draft.trim()}” as your own.
                  </li>
                )}
                {showList &&
                  matches.map((option, index) => {
                    const selected = chosen.has(keyOf(option));
                    return (
                      // Keyboard users choose with the arrow keys and Enter on the input (combobox pattern).
                      // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                      <li
                        key={option}
                        id={`${listId}-${index}`}
                        role="option"
                        aria-selected={selected}
                        aria-disabled={!selected && full}
                        className={cn(
                          'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm',
                          index === active ? 'bg-brand-soft text-brand-ink' : 'text-fg hover:bg-surface-2',
                          !selected && full && 'cursor-not-allowed opacity-50'
                        )}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => toggle(option)}
                      >
                        <span className="truncate">{option}</span>
                        {selected && <Check className="h-4 w-4 shrink-0 text-leaf" aria-hidden="true" />}
                      </li>
                    );
                  })}
              </ul>
            </div>
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

/**
 * A repeatable group of entries (education, experience …). Each saved entry is
 * shown as a compact card with Edit and Remove; one entry is edited at a time.
 * An entry with a validation error is always open so its message can be seen.
 *
 *   summarize(item) → { title, subtitle?, meta? }
 *   children(item, index) → the entry's fields
 */
export function EntryList({
  title,
  description,
  items,
  max,
  addLabel,
  emptyText,
  itemLabel,
  summarize,
  onAdd,
  onRemove,
  openKey,
  onOpenChange,
  hasError,
  error,
  children,
}) {
  const headingId = useId();
  const listRef = useRef(null);
  const focusNew = useRef(false);

  // After "Add …" the first field of the new entry takes focus.
  useEffect(() => {
    if (!focusNew.current) return;
    focusNew.current = false;
    const first = listRef.current && listRef.current.querySelector('li:last-child :is(input, select, textarea)');
    if (first) first.focus({ preventScroll: true });
  }, [items.length]);

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div>
        <h3 id={headingId} className="text-base font-bold text-fg">
          {title}
        </h3>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>

      {error && (
        <p className="flex items-start gap-1.5 text-xs font-medium text-danger" role="alert">
          <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {items.length === 0 && <p className="rounded-xl bg-surface-2/70 px-4 py-3 text-sm text-muted">{emptyText}</p>}

      <ol ref={listRef} className="space-y-3">
        <AnimatePresence initial={false}>
          {items.map((item, index) => {
            const invalid = hasError(index);
            const editing = invalid || openKey === item.key;
            const summary = summarize(item);
            const name = summary.title || `${itemLabel} ${index + 1}`;
            return (
              <motion.li
                key={item.key}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                // overflow-clip, not -hidden: a clipped box cannot be scrolled, so moving focus into an
                // entry while it is still expanding never shifts its content out of place.
                className="overflow-clip"
              >
                <div className={cn('rounded-xl border bg-surface', invalid ? 'border-danger/60' : editing ? 'border-brand/40' : 'border-line')}>
                  <div className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[0.7rem] font-bold uppercase tracking-wider text-muted">
                        {itemLabel} {index + 1}
                      </p>
                      <p className={cn('truncate text-sm font-semibold', summary.title ? 'text-fg' : 'text-muted')}>
                        {summary.title || 'Not filled in yet'}
                      </p>
                      {!editing && summary.subtitle && <p className="truncate text-sm text-fg-soft">{summary.subtitle}</p>}
                      {!editing && summary.meta && <p className="mt-0.5 text-xs font-medium text-muted">{summary.meta}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!editing && (
                        <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onOpenChange(item.key)} aria-label={`Edit ${name}`}>
                          Edit
                        </Button>
                      )}
                      <Button variant="danger-ghost" size="sm" icon={Trash2} onClick={() => onRemove(index)} aria-label={`Remove ${name}`}>
                        Remove
                      </Button>
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {editing && (
                      <motion.div
                        key="editor"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: EASE }}
                        className="overflow-clip"
                      >
                        <div className="space-y-4 border-t border-line px-4 pb-4 pt-4">
                          {children(item, index)}
                          <div className="flex justify-end">
                            <Button variant="secondary" size="sm" icon={Check} onClick={() => onOpenChange(null)} disabled={invalid}>
                              Done
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>

      {items.length < max ? (
        <Button
          variant="outline"
          size="sm"
          icon={Plus}
          onClick={() => {
            focusNew.current = true;
            onAdd();
          }}
        >
          {addLabel}
        </Button>
      ) : (
        <p className="text-xs text-muted">You have reached the limit of {max} entries.</p>
      )}
    </section>
  );
}

const IMAGE_TYPES = UPLOAD_LIMITS.imageAccept.split(',');

/**
 * Optional image for an entry (an award photo or certificate).
 *
 * The file is uploaded through the API to Cloudinary straight away; the entry
 * only remembers the upload's id, and the API attaches it to the profile when
 * the step is saved. `imageUrl` is just the preview.
 *   onChange({ imageId, imageUrl })
 */
export function ImageAttachment({ label, hint, purpose, imageId, imageUrl, onChange }) {
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(null); // null = idle, 0–100 = uploading
  const [error, setError] = useState('');
  const busy = progress !== null;

  // Best effort: an upload that was never saved with the profile is discarded.
  // (The API refuses to delete one that is in use — that one is removed when the step is saved.)
  const discard = (id) => {
    if (id) api.delete(`/media/${id}`, undefined, { silentAuth: true }).catch(() => {});
  };

  async function handleFile(file) {
    if (!file || busy) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      setError('Please choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > UPLOAD_LIMITS.imageMb * 1024 * 1024) {
      setError(`That image is larger than ${UPLOAD_LIMITS.imageMb} MB.`);
      return;
    }
    setError('');
    setProgress(0);
    try {
      const media = await uploadMedia(purpose, file, { onProgress: setProgress });
      discard(imageId);
      onChange({ imageId: media.id, imageUrl: media.thumbUrl || media.url });
    } catch (err) {
      setError(err.message || 'The image could not be uploaded. Please try again.');
    } finally {
      setProgress(null);
    }
  }

  return (
    <div>
      <p className="flex items-baseline justify-between text-sm font-semibold text-fg">
        <span>{label}</span>
        <span className="text-xs font-normal text-muted">Optional</span>
      </p>
      <div className="mt-1.5 flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-2 text-muted">
          {busy ? (
            <span className="text-xs font-bold text-fg" role="status">
              {progress}%
            </span>
          ) : imageUrl ? (
            <img src={imageUrl} alt={`${label} preview`} className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={ImagePlus} onClick={() => inputRef.current && inputRef.current.click()} disabled={busy}>
              {imageId ? 'Change image' : 'Add image'}
            </Button>
            {imageId && (
              <Button
                variant="danger-ghost"
                size="sm"
                icon={Trash2}
                disabled={busy}
                onClick={() => {
                  discard(imageId);
                  onChange({ imageId: null, imageUrl: '' });
                }}
              >
                Remove image
              </Button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted">{hint || `JPG, PNG or WebP up to ${UPLOAD_LIMITS.imageMb} MB.`}</p>
          {error && (
            <p className="mt-1 flex items-start gap-1.5 text-xs font-medium text-danger" role="alert">
              <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_LIMITS.imageAccept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          handleFile(event.target.files && event.target.files[0]);
          event.target.value = '';
        }}
      />
    </div>
  );
}
