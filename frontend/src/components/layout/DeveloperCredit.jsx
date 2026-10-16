import { ArrowUpRight, Globe, Heart } from 'lucide-react';
import { site } from '@/lib/site';

// LinkedIn's "in" mark (lucide-react no longer ships brand icons).
function LinkedInIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" focusable="false">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

function CreditLink({ href, icon: Icon, label, hint }) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-soft text-brand-ink transition-colors duration-200 group-hover:bg-brand group-hover:text-brand-fg">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="font-bold text-fg">{label}</span>
        <span className="hidden text-muted sm:inline">{hint}</span>
        <span className="sr-only"> (opens in a new tab)</span>
        <ArrowUpRight
          className="h-3.5 w-3.5 text-muted transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-ink motion-reduce:transition-none"
          aria-hidden="true"
        />
      </a>
    </li>
  );
}

/** "Designed & Developed with ♥ by …" with the developer's portfolio and LinkedIn. */
export default function DeveloperCredit() {
  const { name, portfolioUrl, linkedinUrl } = site.developer;
  if (!name) return null;
  return (
    <div className="container-page pb-6">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-gradient-to-r from-brand-soft/50 via-surface/60 to-leaf-soft/50 px-4 py-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-[0.85rem] text-fg-soft">
          Designed &amp; Developed with{' '}
          <Heart className="inline h-3.5 w-3.5 -translate-y-px fill-current text-danger" aria-hidden="true" />
          <span className="sr-only">love</span> by{' '}
          <span className="bg-gradient-to-r from-brand-ink to-leaf-strong bg-clip-text font-bold text-transparent">{name}</span>
        </p>
        {(portfolioUrl || linkedinUrl) && (
          <ul className="flex flex-wrap justify-center gap-2" aria-label={`${name} online`}>
            {portfolioUrl && (
              <CreditLink
                href={portfolioUrl}
                icon={Globe}
                label="Portfolio"
                hint="Visit website"
              />
            )}
            {linkedinUrl && (
              <CreditLink
                href={linkedinUrl}
                icon={LinkedInIcon}
                label="LinkedIn"
                hint="Connect professionally"
              />
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
