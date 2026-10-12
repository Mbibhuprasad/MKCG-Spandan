import Link from 'next/link';
import { site } from '@/lib/site';
import LegalPage, { ContactLine, List, P, Term } from '@/components/legal/LegalPage';

export const metadata = {
  title: 'Privacy Policy',
  description: `What information ${site.name} stores about its members, who can see it, where media is kept and how accounts and content are deleted.`,
  alternates: { canonical: '/privacy' },
};

const link = 'font-semibold text-brand-ink underline underline-offset-2';

const sections = [
  {
    id: 'summary',
    title: 'Summary',
    content: (
      <>
        <P>
          {site.name} is a private community. This policy explains, in plain language, what the platform stores, who
          can see it and how it is removed. It describes how the software behaves; it is not a statement that the
          platform satisfies any particular law.
        </P>
        <List
          items={[
            'Only the information needed to run a members’ community is collected.',
            'Member content is shown to signed-in members only. The exceptions — blogs and opt-in public listings — are listed below.',
            'Your email address and phone number are hidden from other members unless you switch them on.',
            'The platform contains no advertising and does not sell or rent member information.',
            'Patient information must never be uploaded.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'collected',
    title: 'Information we store',
    content: (
      <>
        <P>
          <Term>Account details.</Term> Your full name, email address, phone number and password. The password is
          stored only as a one-way cryptographic hash; nobody, including administrators, can read it. The version of
          the policies you accepted, and when, is also stored.
        </P>
        <P>
          <Term>Profile details you choose to add.</Term> Profile photo, professional title, specialization,
          subspecialty, designation, hospital or clinic, city and state, batch year, years of experience, biography,
          qualifications, interests, languages, education, professional experience, achievements, publications and
          professional links. You may also add your blood group; it stays private — visible only to you and the
          administrators — unless you choose to show it to members. All of these are optional.
        </P>
        <P>
          <Term>What you contribute.</Term> Posts, blogs, comments, memories (photos and videos with their titles and
          captions), events, visit plans, polls, and your likes, votes, RSVPs and reports.
        </P>
        <P>
          <Term>Technical records.</Term> A session record for each device you sign in on (its expiry time and a
          shortened description of the browser), in-app notifications, and — for administrators&apos; actions — an
          audit log. The server may also process your IP address to limit abusive traffic and may include it in
          routine technical request logs.
        </P>
        <P>
          The platform does not ask for, and members must not upload, patient records or other clinical information.
          It does not track your location: a city or travel date is only stored when you type it in yourself.
        </P>
      </>
    ),
  },
  {
    id: 'use',
    title: 'How the information is used',
    content: (
      <List
        items={[
          'to create your account, sign you in and keep your session secure;',
          'to show your profile and contributions to the audiences described in this policy;',
          'to let administrators handle reports, remove content that breaks the guidelines and manage accounts;',
          'to send in-app notifications — for example when someone comments on what you shared, an event is published or a gathering you RSVP’d to is approaching;',
          'to protect the community against abuse, such as repeated sign-in attempts.',
        ]}
      />
    ),
  },
  {
    id: 'visibility',
    title: 'Who can see what',
    content: (
      <>
        <P>
          <Term>Other members</Term> (signed-in doctors) can see your name, profile photo and professional profile,
          and your posts, comments, memories, events, visit plans and polls. They see your email address or
          phone number only if you enable &ldquo;show email&rdquo; or &ldquo;show phone&rdquo; in your profile
          settings.
        </P>
        <P>
          <Term>Directory listing.</Term> You can remove yourself from the doctor directory. Other members then see
          only a small name card (name, photo, title and specialization) where your name appears next to content you
          have shared.
        </P>
        <P>
          <Term>The public</Term> (anyone, including search engines) can see:
        </P>
        <List
          items={[
            'blogs, with the author’s name, professional title, specialization and profile photo;',
            'a short homepage card (name, title, specialization, city and photo) — only if you enable public listing and an administrator chooses to feature your profile;',
            'a brief mention of an upcoming event (title, type, city and dates) — only if its organiser enables it. Venues, descriptions and attendee lists are never public.',
          ]}
        />
        <P>
          <Term>Administrators</Term> can see all accounts, including email addresses and phone numbers, and all
          content.
        </P>
        <P>
          <Term>Portfolio-only gallery items</Term> — memories you chose not to show in the community Memories
          section — appear only in the gallery on your portfolio, and not at all to other members if you hide that
          gallery or your directory listing.
          Poll ballots are not shown to other members; only totals are displayed, according to each poll&apos;s
          result settings.
        </P>
      </>
    ),
  },
  {
    id: 'media',
    title: 'Photos and videos',
    content: (
      <>
        <P>
          Uploaded images and videos are not kept on the application server or in the database. They are stored with
          Cloudinary, a third-party media hosting service; the database keeps only a reference to each file and basic
          details such as its type and size. Files are stored under generated names — the original file name is not
          kept.
        </P>
        <List
          items={[
            <>
              <Term>Member-only media</Term> (memories, post images and event covers) is stored as access-controlled
              files. It can be opened only through signed links that the platform issues to signed-in members, and
              downloads of original files use links that expire after a few minutes.
            </>,
            <>
              <Term>Profile photos and blog cover images</Term> are stored as ordinary web images, because they can
              appear on public pages. Their addresses are not listed anywhere publicly unless you have opted in or
              published a blog, but anyone who has the address can open the image.
            </>,
          ]}
        />
        <P>
          Photographs may contain embedded details such as the date, device or location where they were taken.
          Consider removing such details before uploading, and make sure the people shown are comfortable with the
          photo being shared with the community.
        </P>
        <P>
          An upload that is never attached to a post, blog, memory, event or profile is deleted automatically after
          about a day.
        </P>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and browser storage',
    content: (
      <>
        <P>The website uses a single cookie, and it is essential:</P>
        <List
          items={[
            <>
              <Term>Session cookie.</Term> Set when you register or log in, so the site knows you are signed in. It
              cannot be read by scripts in the page, is sent only to this website, expires automatically (after seven
              days by default) and is removed when you log out.
            </>,
          ]}
        />
        <P>
          Your light or dark theme choice is saved in your browser&apos;s local storage and is never sent to the
          server. The platform includes no advertising or third-party analytics trackers.
        </P>
      </>
    ),
  },
  {
    id: 'sharing',
    title: 'Sharing with third parties',
    content: (
      <>
        <P>
          Member information is not sold, rented or used for advertising. It is processed by the service providers
          needed to run the platform: the hosting provider for the website and API, the MongoDB database service, and
          Cloudinary for media files. The specific providers and the regions in which they store data depend on how
          the community is deployed and should be listed here by its operators.
        </P>
        <P>Information may also be disclosed where the law requires it.</P>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'Retention and deletion',
    content: (
      <>
        <List
          items={[
            'You can edit your profile and delete your own posts, blogs, comments, memories, events and polls at any time. Deleting an item also removes its comments, likes and uploaded media.',
            'Notifications are removed automatically after about six months. Sessions are removed when they expire or when you log out.',
            'Suspending an account blocks access but does not delete its data.',
          ]}
        />
        <P>
          <Term>Account deletion.</Term> When an administrator deletes a doctor&apos;s account, the following are
          permanently removed: the account and profile, all sessions and notifications, every file the doctor
          uploaded, all content the doctor created (posts, blogs, memories, events, visit plans, polls and comments)
          together with the comments, likes, RSVPs and votes attached to that content, and the doctor&apos;s own
          likes, votes, RSVPs and reports elsewhere. The audit log keeps a minimal record that the deletion happened
          — the account identifier and name, the administrator and the time.
        </P>
        <P>
          There is currently no self-service button for deleting an account. To request deletion, contact{' '}
          <ContactLine />. Copies may persist for a limited time in routine backups made by the hosting providers.
        </P>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    content: (
      <>
        <P>
          Measures built into the platform include hashed passwords, sessions that can be revoked on the server,
          protection against cross-site request forgery, rate limits on sign-in and registration, checks on the real
          type and size of uploaded files, permission checks on every request, member reporting and administrator
          removal of content.
        </P>
        <P>
          No system is perfectly secure. Use a strong, unique password, and tell the administrators promptly if you
          believe your account has been accessed by someone else.
        </P>
      </>
    ),
  },
  {
    id: 'choices',
    title: 'Your choices',
    content: (
      <List
        items={[
          <>
            Review and correct your details at any time from{' '}
            <Link href="/dashboard/profile" className={link}>
              your profile
            </Link>
            .
          </>,
          'Decide whether you appear in the member directory, whether your profile may be featured publicly, and whether members can see your email address or phone number.',
          'Delete anything you have submitted.',
          <>
            Ask for a copy of your information, or for your account to be deleted, by contacting <ContactLine />.
          </>,
        ]}
      />
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    content: (
      <P>
        This policy may be updated as the community evolves. Each version carries the version identifier shown at the
        top of the page, and the version you accepted is stored with your account. Questions about privacy can be
        sent to <ContactLine />.
      </P>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description={`What ${site.name} stores about its members, who can see it and how it is deleted.`}
      current="/privacy"
      sections={sections}
    />
  );
}
