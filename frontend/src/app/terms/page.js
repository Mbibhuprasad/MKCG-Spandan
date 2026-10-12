import Link from 'next/link';
import { site } from '@/lib/site';
import LegalPage, { ContactLine, List, P, Term } from '@/components/legal/LegalPage';

export const metadata = {
  title: 'Terms & Conditions',
  description: `The terms that apply to every member account on ${site.name}: eligibility, accounts, content moderation, acceptable use and account suspension.`,
  alternates: { canonical: '/terms' },
};

const link = 'font-semibold text-brand-ink underline underline-offset-2';

const sections = [
  {
    id: 'about',
    title: 'About these terms',
    content: (
      <>
        <P>
          {site.name} is a private online community for doctors and medical batchmates. These terms apply to everyone
          who creates an account or uses the website. By registering you confirm that you have read and accept these
          Terms &amp; Conditions, the{' '}
          <Link href="/privacy" className={link}>
            Privacy Policy
          </Link>{' '}
          and the{' '}
          <Link href="/community-guidelines" className={link}>
            Community Guidelines
          </Link>
          .
        </P>
        <P>
          {site.name} is an independent, member-run community. It is not a medical service and is not operated or
          endorsed by any medical college, hospital, council or other institution.
        </P>
      </>
    ),
  },
  {
    id: 'eligibility',
    title: 'Who can join',
    content: (
      <>
        <P>
          Membership is intended for doctors and medical batchmates of the community. You must register as yourself,
          using your real name and contact details that belong to you.
        </P>
        <P>
          Registration does not require prior approval: once your details are accepted your account is active and you
          are signed in. Administrators may later suspend or delete an account that does not belong in the community
          or that breaks these terms.
        </P>
      </>
    ),
  },
  {
    id: 'account',
    title: 'Your account',
    content: (
      <List
        items={[
          <>
            <Term>One account per person.</Term> Each email address and phone number can be registered once.
          </>,
          <>
            <Term>Accurate information.</Term> Keep your name and profile truthful. Impersonating another person is
            prohibited.
          </>,
          <>
            <Term>Keep your password private.</Term> You are responsible for activity carried out through your
            account. Choose a strong password, do not share it, and log out on shared devices.
          </>,
          <>
            <Term>Sessions.</Term> Signing in creates a session that expires automatically. Changing your password
            signs out your other devices.
          </>,
          <>
            <Term>Roles.</Term> There are two kinds of account: doctors (members) and community administrators.
            Administrator accounts cannot be created through registration.
          </>,
        ]}
      />
    ),
  },
  {
    id: 'content',
    title: 'Content you submit',
    content: (
      <>
        <P>
          Members can submit posts, blogs, comments, memories (photos and videos), events, visit plans and polls. You
          remain responsible for what you submit and you confirm that you have the right to share it — including the
          consent of people who can be identified in photographs or videos where that is needed.
        </P>
        <P>
          By submitting content you allow {site.name} to store it and to display it to the audience described below
          for as long as it remains on the platform:
        </P>
        <List
          items={[
            <>
              <Term>Members only:</Term> posts, comments, memories, events, visit plans, polls and the doctor
              directory are shown to signed-in members.
            </>,
            <>
              <Term>Public:</Term> approved blogs can be read by anyone and may appear in search engines, together
              with the author&apos;s name, professional title, specialization and profile photo.
            </>,
            <>
              <Term>Public only if you opt in:</Term> a short card on the homepage (name, title, specialization, city
              and photo) if you enable public listing and an administrator features your profile; and a brief event
              mention (title, type, city and dates) if the organiser enables it.
            </>,
          ]}
        />
        <P>
          You can delete your own submissions at any time. Media you upload is stored with a third-party media
          service as described in the Privacy Policy.
        </P>
      </>
    ),
  },
  {
    id: 'moderation',
    title: 'Moderation',
    content: (
      <>
        <P>
          Everything a doctor submits starts as &ldquo;awaiting review&rdquo; and is visible only to its author and
          to administrators. An administrator approves or rejects each submission. Only approved content is shown to
          the community.
        </P>
        <List
          items={[
            'If you edit approved content, it returns to review before it is shown again.',
            'A poll can no longer be edited once it has been published or has received votes.',
            'Administrators may reject a submission, or remove content that was previously approved, and may record a reason.',
            'Members can report content they believe breaks the Community Guidelines. Reports are confidential.',
            'Sensitive administrative actions are recorded in an audit log.',
          ]}
        />
        <P>
          Review is carried out by people and is not instantaneous. Approval of a submission is not an endorsement of
          its accuracy.
        </P>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    content: (
      <>
        <P>
          You agree to follow the{' '}
          <Link href="/community-guidelines" className={link}>
            Community Guidelines
          </Link>
          . In particular you must not:
        </P>
        <List
          items={[
            'share identifiable patient records, prescriptions, reports or other confidential clinical information without proper legal authorisation;',
            'harass, threaten, discriminate against or abuse anyone;',
            'impersonate another person or misrepresent your qualifications;',
            'upload unlawful or explicit material, or private photos and information shared without permission;',
            'post spam, advertising or malicious links;',
            "collect, copy or misuse other members' information, or use it outside the community without their consent;",
            'attempt to bypass moderation, access controls, rate limits or other security measures, or interfere with the service.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'not-medical',
    title: 'Not a medical service',
    content: (
      <>
        <P>
          {site.name} is a social and professional community. It does not provide medical advice, diagnosis,
          treatment, consultation or referral services, and it must not be used to store or exchange patient data.
        </P>
        <P>
          Posts and blogs express the personal views of their authors. They are not clinical guidance and should not
          be relied on as such.
        </P>
      </>
    ),
  },
  {
    id: 'events',
    title: 'Events, visit plans and polls',
    content: (
      <>
        <P>
          Events, reunions and visit plans are proposed and organised by individual members. {site.name} only lists
          them: it does not organise gatherings, handle payments or bookings, or take responsibility for what happens
          at them. Any budget shown is an estimate provided by the organiser.
        </P>
        <P>
          An RSVP is an indication of interest, not a contract. Sharing your city or travel dates is voluntary; the
          platform does not track your location. Each member has one vote per poll and votes are final.
        </P>
      </>
    ),
  },
  {
    id: 'suspension',
    title: 'Suspension and deletion',
    content: (
      <>
        <P>
          Administrators may suspend an account that breaks these terms or the Community Guidelines. A suspended
          member is signed out of all sessions and cannot log in or use member features until the account is
          reactivated. Content published before a suspension is not removed automatically; administrators may review
          and remove it separately.
        </P>
        <P>
          Administrators may also delete an account. Deleting an account permanently removes the profile and the
          content the member created, as described in the Privacy Policy. To ask for your own account to be deleted,
          contact <ContactLine />.
        </P>
      </>
    ),
  },
  {
    id: 'availability',
    title: 'Availability and liability',
    content: (
      <>
        <P>
          The community is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. It may be
          changed, interrupted or withdrawn, and although care is taken to protect it, no online service can be
          guaranteed to be secure or free of errors. Keep your own copies of anything that matters to you.
        </P>
        <P>
          The extent to which responsibility for loss can be limited, and the law and courts that govern these terms,
          depend on where the community is operated. Those clauses are intentionally left to be completed by the
          community&apos;s legal adviser.
        </P>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes and contact',
    content: (
      <>
        <P>
          These terms may be updated. Each version carries a version identifier, shown at the top of this page, and
          the version you accepted is stored with your account. Continuing to use the community after a change means
          the updated terms apply to you.
        </P>
        <P>
          Questions about these terms can be sent to <ContactLine />.
        </P>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      description={`The rules that apply to every member account on ${site.name}.`}
      current="/terms"
      sections={sections}
    />
  );
}
