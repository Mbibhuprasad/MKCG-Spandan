import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { site } from '@/lib/site';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/Layout';

const POLICIES = [
  { href: '/terms', label: 'Terms & Conditions' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/community-guidelines', label: 'Community Guidelines' },
];

/* Small building blocks so the three policy pages read and look the same. */

export function P({ children }) {
  return <p className="text-[0.975rem] leading-relaxed text-fg-soft">{children}</p>;
}

export function List({ items, ordered = false }) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className={`${ordered ? 'list-decimal' : 'list-disc'} space-y-2 pl-5 text-[0.975rem] leading-relaxed text-fg-soft marker:text-leaf`}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </Tag>
  );
}

export function Term({ children }) {
  return <strong className="font-semibold text-fg">{children}</strong>;
}

/** How to reach the administrators — never an invented address. */
export function ContactLine() {
  if (site.contactEmail) {
    return (
      <>
        the community administrators at{' '}
        <a href={`mailto:${site.contactEmail}`} className="font-semibold text-brand-ink underline underline-offset-2">
          {site.contactEmail}
        </a>
      </>
    );
  }
  return <>the community administrators</>;
}

/**
 * Shared layout for Terms, Privacy Policy and Community Guidelines.
 *   sections: [{ id, title, content }]  — `content` is JSX
 *   `current` is the page's own path, used to highlight it among the policies.
 */
export default function LegalPage({ title, description, current, sections }) {
  return (
    <>
      <PageHeader eyebrow="Policies" title={title} description={description} />

      <div className="container-page py-10 sm:py-12">
        {/* The wording is a starting point, not legal advice or a compliance claim. */}
        <div
          role="note"
          className="flex items-start gap-3 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-4 text-warn sm:px-5"
        >
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="text-sm leading-relaxed">
            <p className="font-bold">Template text — legal review required</p>
            <p className="mt-1">
              This document describes how {site.name} is designed to work. It has not been reviewed by a lawyer and is
              not a statement of legal compliance. It must be reviewed and adapted by a qualified legal professional
              before the community is used in production.
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm text-muted">
          Policy version <strong className="font-semibold text-fg">{site.policyVersion}</strong> · effective{' '}
          <time dateTime={site.policyVersion}>{formatDate(`${site.policyVersion}T00:00:00+05:30`)}</time>. The version
          each member accepted, and when, is recorded with their account at registration.
        </p>

        <div className="mt-8 grid gap-10 lg:grid-cols-[16rem_1fr] lg:gap-14">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav aria-label="On this page" className="card p-4">
              <h2 className="px-2 text-xs font-bold uppercase tracking-wider text-muted">On this page</h2>
              <ol className="mt-2 space-y-0.5">
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="flex gap-2 rounded-lg px-2 py-1.5 text-sm text-fg-soft hover:bg-surface-2 hover:text-fg"
                    >
                      <span className="w-5 shrink-0 text-muted" aria-hidden="true">
                        {index + 1}.
                      </span>
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <nav aria-label="All policies" className="mt-4 hidden px-2 lg:block">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">All policies</h2>
              <ul className="mt-2 space-y-1.5">
                {POLICIES.map((policy) => (
                  <li key={policy.href}>
                    <Link
                      href={policy.href}
                      aria-current={policy.href === current ? 'page' : undefined}
                      className={
                        policy.href === current
                          ? 'text-sm font-semibold text-brand-ink'
                          : 'text-sm text-fg-soft hover:text-brand-ink hover:underline'
                      }
                    >
                      {policy.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <article className="min-w-0 max-w-3xl space-y-10">
            {sections.map((section, index) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="scroll-mt-24">
                <h2 id={`${section.id}-heading`} className="font-display text-xl font-semibold text-fg sm:text-2xl">
                  <span className="mr-2 text-leaf" aria-hidden="true">
                    {index + 1}.
                  </span>
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4">{section.content}</div>
              </section>
            ))}

            <footer className="border-t border-line pt-6 text-sm text-fg-soft">
              <p>Read together with:</p>
              <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
                {POLICIES.filter((policy) => policy.href !== current).map((policy) => (
                  <li key={policy.href}>
                    <Link href={policy.href} className="font-semibold text-brand-ink hover:underline">
                      {policy.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </footer>
          </article>
        </div>
      </div>
    </>
  );
}
