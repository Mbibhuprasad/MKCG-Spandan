import { BookOpen, CalendarDays, Images, MessageCircle, MessageSquareText, Vote } from 'lucide-react';
import { CONTENT_LABELS, EVENT_TYPES, POST_TYPES, labelOf } from '@/lib/constants';
import { formatDateRange } from '@/lib/format';

export function snippet(text, max = 120) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

const commentTargetHref = (comment) => {
  switch (comment.targetType) {
    case 'post':
      return `/community/posts/${comment.targetId}`;
    case 'event':
      return `/events/${comment.targetId}`;
    case 'memory':
      return `/memories?memory=${comment.targetId}`;
    default:
      return null; // blog comments: the API does not return the blog slug here
  }
};

/**
 * Everything the dashboard needs to list a doctor's own submissions:
 * which "mine" endpoint to read, how to title an item and where its
 * view / edit / delete actions point. `key` matches the API content type
 * (and the keys of `summary.submissions`); `tab` is the URL value.
 */
export const SUBMISSION_TYPES = [
  {
    key: 'post',
    tab: 'posts',
    label: 'Post',
    plural: 'Posts',
    icon: MessageSquareText,
    minePath: '/posts/mine',
    itemPath: (id) => `/posts/${id}`,
    title: (item) => snippet(item.body),
    meta: (item) => labelOf(POST_TYPES, item.type),
    viewHref: (item) => `/community/posts/${item.id}`,
    editHref: (item) => `/dashboard/create/post?edit=${item.id}`,
    createHref: '/dashboard/create/post',
    createLabel: 'Create a post',
    emptyText: 'Share an update, an achievement or a thought with your batchmates.',
  },
  {
    key: 'blog',
    tab: 'blogs',
    label: 'Blog',
    plural: 'Blogs',
    icon: BookOpen,
    minePath: '/blogs/mine',
    itemPath: (id) => `/blogs/${id}`,
    title: (item) => item.title,
    meta: (item) => item.category,
    viewHref: (item) => `/blogs/${item.slug}`,
    editHref: (item) => `/dashboard/create/blog?edit=${item.id}`,
    createHref: '/dashboard/create/blog',
    createLabel: 'Write a blog',
    emptyText: 'Write a longer article about your practice, your career or your batch.',
  },
  {
    key: 'comment',
    tab: 'comments',
    label: 'Comment',
    plural: 'Comments',
    icon: MessageCircle,
    minePath: '/comments/mine',
    itemPath: (id) => `/comments/${id}`,
    title: (item) => snippet(item.body),
    meta: (item) => `On a ${(CONTENT_LABELS[item.targetType] || 'post').toLowerCase()}`,
    viewHref: commentTargetHref,
    editHref: () => null, // comments are edited in place (see Submissions.jsx)
    createHref: '/community',
    createLabel: 'Go to the community',
    emptyText: 'Join a conversation in the community feed.',
  },
  {
    key: 'memory',
    tab: 'memories',
    label: 'Memory',
    plural: 'Memories',
    icon: Images,
    minePath: '/memories/mine',
    itemPath: (id) => `/memories/${id}`,
    title: (item) => item.title,
    meta: (item) => {
      const count = (item.media || []).length;
      return `${count} ${count === 1 ? 'file' : 'files'}${item.event ? ` · ${item.event.title}` : ''}`;
    },
    viewHref: (item) => `/memories?memory=${item.id}`,
    editHref: (item) => `/dashboard/create/memory?edit=${item.id}`,
    createHref: '/dashboard/create/memory',
    createLabel: 'Share a memory',
    emptyText: 'Upload photos or videos from college days, reunions and celebrations.',
  },
  {
    key: 'event',
    tab: 'events',
    label: 'Event',
    plural: 'Events & visit plans',
    icon: CalendarDays,
    minePath: '/events/mine',
    itemPath: (id) => `/events/${id}`,
    title: (item) => item.title,
    meta: (item) =>
      [labelOf(EVENT_TYPES, item.eventType), item.city, formatDateRange(item.startsAt, item.endsAt)].filter(Boolean).join(' · '),
    viewHref: (item) => `/events/${item.id}`,
    editHref: (item) => `/dashboard/create/event?edit=${item.id}`,
    createHref: '/dashboard/create/event',
    createLabel: 'Propose an event',
    emptyText: 'Plan a reunion or get-together, or let batchmates know about a visit.',
  },
  {
    key: 'poll',
    tab: 'polls',
    label: 'Poll',
    plural: 'Polls',
    icon: Vote,
    minePath: '/polls/mine',
    itemPath: (id) => `/polls/${id}`,
    title: (item) => item.question,
    meta: (item) => `${(item.options || []).length} options`,
    viewHref: () => '/community?tab=polls',
    // A published poll can no longer be edited (the API refuses it too).
    editHref: (item) =>
      item.moderation && item.moderation.status !== 'APPROVED' ? `/dashboard/create/poll?edit=${item.id}` : null,
    createHref: '/dashboard/create/poll',
    createLabel: 'Start a poll',
    emptyText: 'Let the batch vote on dates, venues, activities or budgets.',
  },
];

export const submissionTypeByKey = (key) => SUBMISSION_TYPES.find((t) => t.key === key);
export const submissionTypeByTab = (tab) => SUBMISSION_TYPES.find((t) => t.tab === tab);
