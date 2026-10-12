'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { MessageCircle, PenLine, Plus, Vote } from 'lucide-react';
import { POST_TYPES } from '@/lib/constants';
import { cn } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/components/providers/AuthProvider';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { Tabs } from '@/components/ui/Layout';
import { CardSkeletons, EmptyState, ErrorState } from '@/components/ui/Feedback';
import PostCard from './PostCard';
import PollCard from './PollCard';

const TABS = [
  { value: 'feed', label: 'Feed' },
  { value: 'polls', label: 'Polls' },
];

const POLL_FILTERS = [
  { value: 'open', label: 'Active' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
];

function FilterChips({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="flex gap-2 overflow-x-auto pb-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value || 'all'}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors',
              active
                ? 'border-brand bg-brand text-brand-fg'
                : 'border-line-strong bg-surface text-fg-soft hover:bg-surface-2 hover:text-fg'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function FeedTab() {
  const { user } = useAuth();
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useApi('/posts', { type, page, limit: 10 });
  const posts = data || [];

  function changeType(next) {
    setType(next);
    setPage(1);
  }

  function handleDeleted() {
    // Step back if the last post on a page was removed.
    if (posts.length === 1 && page > 1) setPage((p) => p - 1);
    else reload();
  }

  return (
    <div className="space-y-5">
      <div className="card flex items-center gap-3 p-4">
        <Avatar name={user?.name} src={user?.profile?.photoUrl} size="md" />
        <Link
          href="/dashboard/create/post"
          className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-line-strong bg-surface-2 px-4 text-sm text-muted hover:border-brand hover:text-fg"
        >
          <span className="truncate">Share an update with your batchmates…</span>
        </Link>
        <Button href="/dashboard/create/post" size="sm" icon={PenLine} className="hidden sm:inline-flex">
          New post
        </Button>
      </div>

      <FilterChips
        label="Filter posts by type"
        value={type}
        onChange={changeType}
        options={[{ value: '', label: 'All posts' }, ...POST_TYPES]}
      />

      {loading && !posts.length ? (
        <CardSkeletons count={3} className="space-y-5" height="h-44" />
      ) : error ? (
        <ErrorState title="The feed could not be loaded" message={error.message} onRetry={reload} />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title={type ? 'No posts of this type yet' : 'No posts yet'}
          description="Posts appear here once an administrator has approved them. Be the first to share something with the community."
          action={
            <Button href="/dashboard/create/post" icon={PenLine}>
              Create a post
            </Button>
          }
        />
      ) : (
        <ul className={cn('space-y-5', loading && 'opacity-60')} aria-busy={loading}>
          {posts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} onDeleted={handleDeleted} />
            </li>
          ))}
        </ul>
      )}

      {meta && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={(next) => {
            setPage(next);
            scrollToTop();
          }}
          className="pt-2"
        />
      )}
    </div>
  );
}

function PollsTab() {
  const [state, setState] = useState('open');
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useApi('/polls', { state, page, limit: 10 });
  const polls = data || [];

  function changeState(next) {
    setState(next);
    setPage(1);
  }

  function handleDeleted() {
    if (polls.length === 1 && page > 1) setPage((p) => p - 1);
    else reload();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips label="Filter polls" value={state} onChange={changeState} options={POLL_FILTERS} />
        <Button href="/dashboard/create/poll" size="sm" icon={Plus}>
          Start a poll
        </Button>
      </div>

      {loading && !polls.length ? (
        <CardSkeletons count={3} className="space-y-5" height="h-56" />
      ) : error ? (
        <ErrorState title="Polls could not be loaded" message={error.message} onRetry={reload} />
      ) : polls.length === 0 ? (
        <EmptyState
          icon={Vote}
          title={state === 'closed' ? 'No closed polls' : state === 'open' ? 'No active polls right now' : 'No polls yet'}
          description="Polls help the batch decide on reunion dates, venues, activities and budgets. Published polls appear here after admin approval."
          action={
            <Button href="/dashboard/create/poll" icon={Plus}>
              Start a poll
            </Button>
          }
        />
      ) : (
        <ul className={cn('space-y-5', loading && 'opacity-60')} aria-busy={loading}>
          {polls.map((poll) => (
            <li key={poll.id}>
              <PollCard poll={poll} onDeleted={handleDeleted} />
            </li>
          ))}
        </ul>
      )}

      {meta && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={(next) => {
            setPage(next);
            scrollToTop();
          }}
          className="pt-2"
        />
      )}
    </div>
  );
}

/** Members-only community area: the post feed and the polls, switched by ?tab=. */
export default function CommunityView() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get('tab') === 'polls' ? 'polls' : 'feed';

  function changeTab(next) {
    router.replace(next === 'polls' ? '/community?tab=polls' : '/community', { scroll: false });
  }

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Tabs tabs={TABS} value={tab} onChange={changeTab} label="Community sections" className="mb-6 w-fit" />
        <div role="tabpanel" aria-label={tab === 'polls' ? 'Polls' : 'Feed'}>
          {tab === 'polls' ? <PollsTab /> : <FeedTab />}
        </div>
      </div>
    </div>
  );
}
