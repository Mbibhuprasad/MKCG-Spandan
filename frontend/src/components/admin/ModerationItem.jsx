'use client';

import Link from 'next/link';
import { ExternalLink, Trash2 } from 'lucide-react';
import { EVENT_TYPES, POLL_RESULTS_VISIBILITY, POST_TYPES, labelOf } from '@/lib/constants';
import { formatDate, formatDateRange, formatDateTime } from '@/lib/format';
import Button from '@/components/ui/Button';
import { Badge, ModerationBadge } from '@/components/ui/Feedback';
import AuthorLine from '@/components/content/AuthorLine';

// Content list (URL segment) → which field holds the author, and where the
// item lives for members.
const AUTHOR_FIELD = {
  posts: 'author',
  blogs: 'author',
  comments: 'author',
  memories: 'owner',
  events: 'organizer',
  'visit-plans': 'organizer',
  polls: 'creator',
};

function memberLink(queue, item) {
  switch (queue) {
    case 'posts':
      return `/community/posts/${item.id}`;
    case 'blogs':
      return `/blogs/${item.slug}`;
    case 'memories':
      return `/memories?memory=${item.id}`;
    case 'events':
    case 'visit-plans':
      return `/events/${item.id}`;
    case 'polls':
      return '/community?tab=polls';
    case 'comments':
      return item.target && item.target.link ? item.target.link : null;
    default:
      return null;
  }
}

function MediaGrid({ media }) {
  if (!media || media.length === 0) return null;
  return (
    <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {media.map((m, index) => (
        <li key={m.id} className="overflow-hidden rounded-xl border border-line bg-surface-2">
          {m.resourceType === 'video' ? (
            // Member-uploaded clips have no caption track available.
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video controls preload="metadata" poster={m.thumbUrl || undefined} src={m.url} className="aspect-square h-full w-full bg-black object-contain" />
          ) : (
            <a href={m.url} target="_blank" rel="noopener noreferrer" aria-label={`Open attachment ${index + 1} at full size`}>
              <img src={m.thumbUrl || m.url} alt={`Attachment ${index + 1}`} className="aspect-square h-full w-full object-cover" loading="lazy" decoding="async" />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function Detail({ label, children }) {
  if (children === null || children === undefined || children === '' || children === false) return null;
  return (
    <div>
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-fg">{children}</dd>
    </div>
  );
}

const Body = ({ children }) => (
  <p className="whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed text-fg-soft">{children}</p>
);

function PostContent({ item }) {
  return (
    <>
      <Badge tone="brand">{labelOf(POST_TYPES, item.type)}</Badge>
      <div className="mt-3">
        <Body>{item.body}</Body>
      </div>
      <MediaGrid media={item.media} />
    </>
  );
}

function BlogContent({ item }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="brand">{item.category}</Badge>
        <span className="text-xs text-muted">{item.readingMinutes} min read</span>
      </div>
      <h3 className="mt-3 font-display text-xl font-semibold text-fg">{item.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-fg-soft">{item.excerpt}</p>
      {item.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tags">
          {item.tags.map((tag) => (
            <li key={tag}>
              <Badge>#{tag}</Badge>
            </li>
          ))}
        </ul>
      )}
      {item.cover && (
        <img
          src={item.cover.url}
          alt="Blog cover"
          className="mt-4 max-h-72 w-full rounded-xl border border-line object-cover"
          loading="lazy"
          decoding="async"
        />
      )}
      <details className="mt-4 rounded-xl border border-line bg-surface-2/60">
        <summary className="px-4 py-3 text-sm font-semibold text-brand-ink">Read the full article</summary>
        {/* bodyHtml is rendered from Markdown and sanitised by the API (markdown.service.js). */}
        <div className="prose-blog border-t border-line px-4 py-4" dangerouslySetInnerHTML={{ __html: item.bodyHtml }} />
      </details>
    </>
  );
}

function CommentContent({ item }) {
  const target = item.target;
  return (
    <>
      <Body>{item.body}</Body>
      {target && (
        <p className="mt-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm text-fg-soft">
          <span className="font-semibold text-fg">Posted on {target.type}: </span>
          {target.link ? (
            <Link href={target.link} className="text-brand-ink hover:underline">
              {target.title || 'Untitled'}
            </Link>
          ) : (
            <span>{target.title}</span>
          )}
        </p>
      )}
    </>
  );
}

function MemoryContent({ item }) {
  return (
    <>
      <h3 className="font-display text-xl font-semibold text-fg">{item.title}</h3>
      {item.caption && (
        <div className="mt-2">
          <Body>{item.caption}</Body>
        </div>
      )}
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        <Detail label="Memory date">{item.memoryDate ? formatDate(item.memoryDate) : null}</Detail>
        <Detail label="Linked event">{item.event ? item.event.title : null}</Detail>
        <Detail label="Files">{item.media.length}</Detail>
      </dl>
      <MediaGrid media={item.media} />
    </>
  );
}

function EventContent({ item }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={item.eventType === 'VISIT_PLAN' ? 'leaf' : 'brand'}>{labelOf(EVENT_TYPES, item.eventType)}</Badge>
        {item.isPast && <Badge>Past</Badge>}
      </div>
      <h3 className="mt-3 font-display text-xl font-semibold text-fg">{item.title}</h3>
      <div className="mt-2">
        <Body>{item.description}</Body>
      </div>
      {item.cover && (
        <img
          src={item.cover.url}
          alt="Event cover"
          className="mt-4 max-h-72 w-full rounded-xl border border-line object-cover"
          loading="lazy"
          decoding="async"
        />
      )}
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Starts">{formatDateTime(item.startsAt)}</Detail>
        <Detail label="Ends">{formatDateTime(item.endsAt)}</Detail>
        <Detail label="Dates">{formatDateRange(item.startsAt, item.endsAt)}</Detail>
        <Detail label="Venue">{item.venue}</Detail>
        <Detail label="City">{item.city}</Detail>
        <Detail label="Proposed budget">{item.budgetNote}</Detail>
        <Detail label="RSVPs">{item.rsvpEnabled ? 'Enabled' : 'Disabled'}</Detail>
        <Detail label="RSVP deadline">{item.rsvpDeadline ? formatDateTime(item.rsvpDeadline) : null}</Detail>
        <Detail label="Capacity">{item.capacity}</Detail>
        <Detail label="Public homepage summary">
          {item.showOnPublicSite ? 'Requested — title, type, city and date would be public' : 'No — members only'}
        </Detail>
      </dl>
    </>
  );
}

function PollContent({ item }) {
  return (
    <>
      <h3 className="font-display text-xl font-semibold text-fg">{item.question}</h3>
      {item.description && (
        <div className="mt-2">
          <Body>{item.description}</Body>
        </div>
      )}
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-fg">
        {item.options.map((option) => (
          <li key={option.id}>{option.text}</li>
        ))}
      </ol>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="Choices per member">{item.allowMultiple ? 'Several options' : 'One option'}</Detail>
        <Detail label="Results visible">{labelOf(POLL_RESULTS_VISIBILITY, item.resultsVisibility)}</Detail>
        <Detail label="Opens">{formatDateTime(item.startsAt)}</Detail>
        <Detail label="Closes">{formatDateTime(item.endsAt)}</Detail>
      </dl>
    </>
  );
}

const CONTENT = {
  posts: PostContent,
  blogs: BlogContent,
  comments: CommentContent,
  memories: MemoryContent,
  events: EventContent,
  'visit-plans': EventContent,
  polls: PollContent,
};

/**
 * One item in an admin content list, shown in full so the admin can judge it.
 * The only action is deletion: content needs no approval.
 */
export default function ModerationItem({ queue, item, onDelete }) {
  const Content = CONTENT[queue];
  const moderation = item.moderation || {};
  const status = moderation.status;
  const link = memberLink(queue, item);

  return (
    <article className="card p-5 sm:p-6">
      <AuthorLine
        author={item[AUTHOR_FIELD[queue]]}
        date={item.createdAt}
        trailing={status && status !== 'APPROVED' ? <ModerationBadge status={status} className="shrink-0" /> : null}
      />

      <div className="mt-4">{Content ? <Content item={item} /> : null}</div>

      <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-4 text-xs text-muted">
        <div className="flex gap-1.5">
          <dt className="font-semibold">Shared:</dt>
          <dd>{item.createdAt ? formatDateTime(item.createdAt) : '—'}</dd>
        </div>
        {status && status !== 'APPROVED' && (
          <div className="flex gap-1.5 text-warn">
            <dt className="font-semibold">Hidden from members:</dt>
            <dd>
              left unpublished by the old approval system
              {moderation.rejectionReason ? ` (${moderation.rejectionReason})` : ''}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="danger-ghost" size="sm" icon={Trash2} onClick={() => onDelete(item)}>
          Delete
        </Button>
        {link && (
          <Link href={link} className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline">
            Open in community
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
    </article>
  );
}
