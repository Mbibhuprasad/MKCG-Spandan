import Link from 'next/link';
import { HeartPulse } from 'lucide-react';
import { site } from '@/lib/site';
import DeveloperCredit from './DeveloperCredit';
import Logo from './Logo';

const columns = [
  {
    title: 'Community',
    links: [
      { href: '/about', label: 'About' },
      { href: '/doctors', label: 'Friends' },
      { href: '/community', label: 'Community feed' },
      { href: '/events', label: 'Events & reunions' },
    ],
  },
  {
    title: 'Explore',
    links: [
      { href: '/blogs', label: 'Blogs' },
      { href: '/memories', label: 'Memories' },
      { href: '/register', label: 'Join the community' },
      { href: '/login', label: 'Member login' },
    ],
  },
  {
    title: 'Policies',
    links: [
      { href: '/terms', label: 'Terms & Conditions' },
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/community-guidelines', label: 'Community Guidelines' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-bg-soft">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-sm">
          <Logo logoSize={48} />
          <p className="mt-4 text-sm leading-relaxed text-fg-soft">
            A private community where doctors and medical Friends reconnect,
            celebrate one another&apos;s journeys and keep shared memories
            alive.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-muted">
            <HeartPulse className="h-4 w-4 text-leaf" aria-hidden="true" />
            Spandan — the heartbeat that keeps a batch together.
          </p>
        </div>

        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-sm font-bold text-fg">{column.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-fg-soft hover:text-brand-ink hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.name}. A members&apos; community
            — not a medical service.
          </p>
          <p>Please never share patient-identifiable information here.</p>
        </div>
        <DeveloperCredit />
      </div>
    </footer>
  );
}
