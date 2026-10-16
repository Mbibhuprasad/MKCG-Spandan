"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  CircleCheck,
  Clock,
  Images,
  Inbox,
  MessageSquareText,
  Pencil,
  UserRound,
  Users,
  Vote,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAction, useApi } from "@/lib/hooks";
import { cn, formatDate, timeAgo } from "@/lib/format";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { ModerationBadge, Skeleton } from "@/components/ui/Feedback";
import AuthorLine from "@/components/content/AuthorLine";
import EventCard from "@/components/cards/EventCard";
import CompletionBar from "./CompletionBar";
import { STEPS as PROFILE_STEPS } from "./profile-wizard/model";
import {
  SUBMISSION_TYPES,
  snippet,
  submissionTypeByKey,
} from "./submissionTypes";

const quickActions = [
  {
    href: "/dashboard/create/post",
    label: "Create a Post",
    icon: MessageSquareText,
  },
  { href: "/dashboard/create/blog", label: "Write a Blog", icon: BookOpen },
  { href: "/dashboard/create/memory", label: "Share a Memory", icon: Images },
  {
    href: "/dashboard/create/event",
    label: "Create an Event or Visit Plan",
    icon: CalendarPlus,
  },
  { href: "/dashboard/create/poll", label: "Start a Poll", icon: Vote },
  { href: "/doctors", label: "Explore Friends", icon: Users },
];

function Panel({ title, action, children, className }) {
  return (
    <section className={cn("card p-5 sm:p-6", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-fg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function PanelLink({ href, children }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-ink hover:underline"
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}

function Rows({ count = 3, height = "h-14" }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn("w-full rounded-xl", height)} />
      ))}
    </div>
  );
}

function PanelError({ onRetry }) {
  return (
    <p className="text-sm text-danger" role="alert">
      This could not be loaded.{" "}
      <button
        type="button"
        className="font-semibold underline"
        onClick={onRetry}
      >
        Try again
      </button>
    </p>
  );
}

function PanelEmpty({ icon: Icon = Inbox, children }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-surface-2/70 px-4 py-4 text-sm text-muted">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, tone = "brand", href }) {
  const tones = {
    brand: "bg-brand-soft text-brand-ink",
    leaf: "bg-leaf-soft text-leaf-strong",
    warn: "bg-warn-soft text-warn",
  };
  return (
    <Link
      href={href}
      className="card flex items-center gap-4 p-4 transition-shadow hover:shadow-lift"
    >
      <span
        className={cn(
          "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          tones[tone],
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-extrabold leading-none text-fg">
          {value}
        </span>
        <span className="mt-1 block truncate text-xs font-semibold text-muted">
          {label}
        </span>
      </span>
    </Link>
  );
}

// The doctor's most recent submissions across every content type. Only the
// types they have actually used are requested (known from the summary counts).
function useRecentActivity(submissions) {
  const [state, setState] = useState({ key: null, items: [], failed: false });
  const key = submissions
    ? SUBMISSION_TYPES.filter(
        (t) => submissions[t.key] && submissions[t.key].total > 0,
      )
        .map((t) => t.key)
        .join(",")
    : null;

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    const types = key.split(",").map(submissionTypeByKey);
    Promise.allSettled(
      types.map((type) =>
        api.get(type.minePath, { limit: 3 }).then(({ data }) =>
          data.map((item) => ({
            id: `${type.key}-${item.id}`,
            type,
            title: type.title(item),
            status: item.moderation ? item.moderation.status : "APPROVED",
            createdAt: item.createdAt,
          })),
        ),
      ),
    ).then((results) => {
      if (cancelled) return;
      const items = results
        .filter((r) => r.status === "fulfilled")
        .flatMap((r) => r.value)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 6);
      setState({
        key,
        items,
        failed: results.every((r) => r.status === "rejected"),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (key === null) return { loading: true, items: [], failed: false };
  if (key === "") return { loading: false, items: [], failed: false };
  if (state.key !== key) return { loading: true, items: [], failed: false };
  return { loading: false, items: state.items, failed: state.failed };
}

export default function DashboardOverview() {
  const { user, setUser, isAdmin } = useAuth();
  const toast = useToast();

  const summary = useApi("/dashboard/summary");
  const posts = useApi("/posts", { limit: 3 });
  const events = useApi("/events", { scope: "upcoming", limit: 3 });
  const notifications = useApi("/notifications", { limit: 5 });
  const activity = useRecentActivity(
    summary.data ? summary.data.submissions : null,
  );

  const [dismissPrompt, dismissing] = useAction(async () => {
    try {
      const { data } = await api.patch("/doctors/me", {
        dismissProfilePrompt: true,
      });
      setUser(data);
    } catch (error) {
      toast.error(error.message);
    }
  });

  if (!user) return null;
  const completion = user.profileCompletion || {
    percent: 0,
    isComplete: false,
    missing: [],
  };
  const showPrompt = !completion.isComplete && !user.profilePromptDismissed;
  // The wizard remembers the step the doctor reached (0-based) so they can pick up where they left off.
  const resumeStep = completion.resumeStep || 0;
  const requiredMissing = completion.requiredMissing || [];
  const profile = user.profile || {};
  const location = [profile.city, profile.state].filter(Boolean).join(", ");
  const totals = summary.data ? summary.data.totals : null;
  // Only non-zero for items the former approval workflow left unpublished.
  const hiddenTotal = totals ? totals.PENDING + totals.REJECTED : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">
            {isAdmin ? "Administrator" : "Your dashboard"}
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            Welcome, {user.name}
          </h1>
          <p className="mt-2 max-w-2xl text-fg-soft">
            Here is what is happening in the community and where your own
            submissions stand.
          </p>
        </div>
        <Button href="/dashboard/create" icon={Pencil}>
          Share something
        </Button>
      </header>

      {showPrompt && (
        <section
          aria-labelledby="complete-profile-heading"
          className="rounded-[1.125rem] border border-brand/25 bg-brand-soft p-5 sm:p-6"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h2
                id="complete-profile-heading"
                className="font-display text-xl font-semibold text-fg sm:text-2xl"
              >
                Complete Your Professional Profile
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-soft">
                A short step-by-step form builds your portfolio and helps
                Friends find and recognise you. You can do this now or later
                — the community is already open to you, and your progress is
                saved along the way.
              </p>
              <p className="mt-2 text-xs text-muted">
                {resumeStep > 0
                  ? `You have reached step ${resumeStep + 1} of ${PROFILE_STEPS.length}.`
                  : `${PROFILE_STEPS.length} short steps — most of them optional.`}
                {requiredMissing.length > 0
                  ? ` Required: ${requiredMissing.join(", ")}.`
                  : " Review and submit to finish."}
              </p>
              <CompletionBar
                percent={completion.percent}
                className="mt-4 max-w-md"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button href="/dashboard/profile" icon={UserRound}>
                {resumeStep > 0 ? "Continue profile" : "Complete profile"}
              </Button>
              <Button
                variant="secondary"
                onClick={dismissPrompt}
                loading={dismissing}
              >
                Skip for now
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Key figures — all counted by the API */}
      <section
        aria-label="Your figures"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {summary.loading && !summary.data ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-[4.75rem] w-full rounded-[1.125rem]"
            />
          ))
        ) : summary.error ? (
          <div className="card p-4 sm:col-span-2 lg:col-span-4">
            <PanelError onRetry={summary.reload} />
          </div>
        ) : (
          <>
            <StatTile
              icon={CircleCheck}
              tone="leaf"
              label="Published by you"
              value={totals.APPROVED}
              href="/dashboard/submissions"
            />
            <StatTile
              icon={Clock}
              tone="warn"
              label="Events you are going to"
              value={summary.data.myUpcomingRsvps}
              href="/events"
            />
            <StatTile
              icon={CalendarDays}
              label="Upcoming events"
              value={summary.data.upcomingEvents}
              href="/events"
            />
            <StatTile
              icon={Bell}
              label="Unread notifications"
              value={summary.data.unreadNotifications}
              href="/dashboard/notifications"
            />
          </>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Panel title="Quick actions">
            <ul className="grid gap-3 sm:grid-cols-2">
              {quickActions.map((action) => (
                <li key={action.href}>
                  <Link
                    href={action.href}
                    className="flex h-full items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm font-semibold text-fg hover:border-brand hover:bg-brand-soft/60 hover:text-brand-ink"
                  >
                    <action.icon
                      className="h-4 w-4 shrink-0 text-brand-ink"
                      aria-hidden="true"
                    />
                    {action.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Your submissions"
            action={<PanelLink href="/dashboard/submissions">Manage</PanelLink>}
          >
            {summary.loading && !summary.data ? (
              <Rows count={3} height="h-10" />
            ) : summary.error ? (
              <PanelError onRetry={summary.reload} />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[22rem] text-sm">
                    <caption className="sr-only">
                      What you have published, by type
                    </caption>
                    <thead>
                      <tr className="text-left text-xs font-semibold text-muted">
                        <th scope="col" className="pb-2 font-semibold">
                          Type
                        </th>
                        <th
                          scope="col"
                          className="pb-2 text-center font-semibold"
                        >
                          Published
                        </th>
                        {hiddenTotal > 0 && (
                          <th
                            scope="col"
                            className="pb-2 text-center font-semibold"
                          >
                            Not published
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {SUBMISSION_TYPES.map((type) => {
                        const counts = summary.data.submissions[type.key] || {
                          PENDING: 0,
                          APPROVED: 0,
                          REJECTED: 0,
                        };
                        return (
                          <tr key={type.key}>
                            <th
                              scope="row"
                              className="py-2.5 text-left font-semibold text-fg"
                            >
                              <Link
                                href={`/dashboard/submissions?tab=${type.tab}`}
                                className="inline-flex items-center gap-2 hover:text-brand-ink"
                              >
                                <type.icon
                                  className="h-4 w-4 text-muted"
                                  aria-hidden="true"
                                />
                                {type.plural}
                              </Link>
                            </th>
                            <td
                              className={cn(
                                "py-2.5 text-center font-semibold",
                                counts.APPROVED
                                  ? "text-leaf-strong"
                                  : "text-muted",
                              )}
                            >
                              {counts.APPROVED}
                            </td>
                            {hiddenTotal > 0 && (
                              <td
                                className={cn(
                                  "py-2.5 text-center font-semibold",
                                  counts.PENDING + counts.REJECTED
                                    ? "text-warn"
                                    : "text-muted",
                                )}
                              >
                                {counts.PENDING + counts.REJECTED}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-muted">
                  {hiddenTotal > 0
                    ? "Items marked “not published” were left hidden by the old review process. Edit and save one to publish it."
                    : "Everything you share is published to the community straight away."}
                </p>
              </>
            )}
          </Panel>

          <Panel
            title="Recent activity"
            action={
              <PanelLink href="/dashboard/submissions">
                All submissions
              </PanelLink>
            }
          >
            {summary.error ? (
              <PanelError onRetry={summary.reload} />
            ) : activity.loading ? (
              <Rows count={3} height="h-12" />
            ) : activity.failed ? (
              <PanelError onRetry={summary.reload} />
            ) : activity.items.length === 0 ? (
              <PanelEmpty>
                You have not shared anything yet. Your posts, blogs, memories,
                events and polls will appear here.
              </PanelEmpty>
            ) : (
              <ul className="divide-y divide-line">
                {activity.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-soft">
                      <item.type.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-fg">
                        {item.title || item.type.label}
                      </p>
                      <p className="text-xs text-muted">
                        {item.type.label} · {formatDate(item.createdAt)}
                      </p>
                    </div>
                    <ModerationBadge
                      status={item.status}
                      className="shrink-0"
                    />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Community updates"
            action={<PanelLink href="/community">Open the feed</PanelLink>}
          >
            {posts.loading && !posts.data ? (
              <Rows count={3} height="h-20" />
            ) : posts.error ? (
              <PanelError onRetry={posts.reload} />
            ) : (posts.data || []).length === 0 ? (
              <PanelEmpty icon={MessageSquareText}>
                No posts have been published yet. Be the first to share an
                update.
              </PanelEmpty>
            ) : (
              <ul className="space-y-3">
                {posts.data.map((post) => (
                  <li
                    key={post.id}
                    className="rounded-xl border border-line p-4"
                  >
                    <AuthorLine
                      author={post.author}
                      date={post.publishedAt || post.createdAt}
                      size="sm"
                    />
                    <p className="mt-2.5 whitespace-pre-line break-words text-sm leading-relaxed text-fg-soft line-clamp-3">
                      {snippet(post.body, 260)}
                    </p>
                    <Link
                      href={`/community/posts/${post.id}`}
                      className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-ink hover:underline"
                      aria-label={`Read the post by ${post.author ? post.author.name : "a member"}`}
                    >
                      Read post
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <Panel
            title="Your profile"
            action={<PanelLink href="/dashboard/profile">Edit</PanelLink>}
          >
            <div className="flex items-start gap-4">
              <Avatar name={user.name} src={profile.photoUrl} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-fg">
                  {user.name}
                </p>
                {(profile.professionalTitle || profile.designation) && (
                  <p className="mt-0.5 line-clamp-2 text-sm text-fg-soft">
                    {profile.professionalTitle || profile.designation}
                  </p>
                )}
                {(profile.specialization || location) && (
                  <p className="mt-1 text-xs text-muted">
                    {[profile.specialization, location]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
            </div>
            <CompletionBar percent={completion.percent} className="mt-5" />
            <p className="mt-2 text-xs text-muted">
              {completion.isComplete
                ? completion.missing.length
                  ? `Complete. You could still add: ${completion.missing.slice(0, 3).join(", ")}${completion.missing.length > 3 ? "…" : ""}`
                  : "Your profile is complete."
                : completion.missing.length
                  ? `To add: ${completion.missing.slice(0, 3).join(", ")}${completion.missing.length > 3 ? "…" : ""}`
                  : "Review and submit your profile to finish."}
            </p>
            <Button
              href={`/doctors/${user.id}`}
              variant="secondary"
              size="sm"
              className="mt-4 w-full"
            >
              Preview my profile
            </Button>
          </Panel>

          <Panel
            title="Upcoming events"
            action={<PanelLink href="/events">All events</PanelLink>}
          >
            {events.loading && !events.data ? (
              <Rows count={2} height="h-28" />
            ) : events.error ? (
              <PanelError onRetry={events.reload} />
            ) : (events.data || []).length === 0 ? (
              <PanelEmpty icon={CalendarDays}>
                No upcoming events yet.{" "}
                <Link
                  href="/dashboard/create/event"
                  className="font-semibold text-brand-ink hover:underline"
                >
                  Propose one
                </Link>
                .
              </PanelEmpty>
            ) : (
              <>
                <ul className="space-y-3">
                  {events.data.map((event) => (
                    <li key={event.id}>
                      <EventCard event={event} className="shadow-none" />
                    </li>
                  ))}
                </ul>
                {summary.data && summary.data.myUpcomingRsvps > 0 && (
                  <p className="mt-3 text-xs text-muted">
                    You are going to {summary.data.myUpcomingRsvps} upcoming{" "}
                    {summary.data.myUpcomingRsvps === 1 ? "event" : "events"}.
                  </p>
                )}
              </>
            )}
          </Panel>

          <Panel
            title="Notifications"
            action={
              <PanelLink href="/dashboard/notifications">View all</PanelLink>
            }
          >
            {notifications.loading && !notifications.data ? (
              <Rows count={3} height="h-12" />
            ) : notifications.error ? (
              <PanelError onRetry={notifications.reload} />
            ) : (notifications.data || []).length === 0 ? (
              <PanelEmpty icon={Bell}>
                Nothing yet. Comments, new events and polls will show up here.
              </PanelEmpty>
            ) : (
              <ul className="divide-y divide-line">
                {notifications.data.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        n.read ? "bg-line-strong" : "bg-leaf",
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm text-fg",
                          !n.read && "font-semibold",
                        )}
                      >
                        {!n.read && <span className="sr-only">Unread: </span>}
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                          {n.message}
                        </p>
                      )}
                      <p
                        className="mt-0.5 text-[0.7rem] text-muted"
                        suppressHydrationWarning
                      >
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
