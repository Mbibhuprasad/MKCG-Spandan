import Link from 'next/link';
import { ArrowRight, BookOpen, CalendarPlus, Images, MessageSquareText, Plane, Vote } from 'lucide-react';

export const metadata = { title: 'Create' };

const options = [
  {
    href: '/dashboard/create/post',
    icon: MessageSquareText,
    title: 'Create a post',
    text: 'Share an update, an achievement or a thought with the community feed.',
  },
  {
    href: '/dashboard/create/blog',
    icon: BookOpen,
    title: 'Write a blog',
    text: 'Publish a longer article. Blogs are visible to the public and appear on your portfolio.',
  },
  {
    href: '/dashboard/create/memory',
    icon: Images,
    title: 'Share a memory',
    text: 'Upload photos or videos from college days, reunions and celebrations.',
  },
  {
    href: '/dashboard/create/event',
    icon: CalendarPlus,
    title: 'Propose an event',
    text: 'Plan a reunion, get-together, dinner or professional meetup.',
  },
  {
    href: '/dashboard/create/event?type=VISIT_PLAN',
    icon: Plane,
    title: 'Share a visit plan',
    text: 'Travelling to another city? Let batchmates there know your dates.',
  },
  {
    href: '/dashboard/create/poll',
    icon: Vote,
    title: 'Start a poll',
    text: 'Let the batch vote on dates, venues, activities or budgets.',
  },
];

export default function CreateIndexPage() {
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-fg">What would you like to share?</h1>
      <p className="mt-2 max-w-2xl text-fg-soft">
        Whatever you share is published to the community straight away. You can edit or delete it later under{' '}
        <Link href="/dashboard/submissions" className="font-semibold text-brand-ink hover:underline">
          My submissions
        </Link>
        .
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <li key={option.href}>
            <Link href={option.href} className="card group flex h-full flex-col p-5 transition-shadow hover:shadow-lift">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                <option.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-base font-bold text-fg">{option.title}</h2>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-fg-soft">{option.text}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink">
                Start
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
