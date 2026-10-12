import Link from 'next/link';
import { site } from '@/lib/site';
import LegalPage, { ContactLine, List, P, Term } from '@/components/legal/LegalPage';

export const metadata = {
  title: 'Community Guidelines',
  description: `How members of ${site.name} are expected to behave: patient confidentiality, respect, privacy, what must never be posted, and how moderation works.`,
  alternates: { canonical: '/community-guidelines' },
};

const link = 'font-semibold text-brand-ink underline underline-offset-2';

const sections = [
  {
    id: 'spirit',
    title: 'The spirit of the community',
    content: (
      <>
        <P>
          {site.name} exists so that doctors who trained together can stay connected. Treat it the way you would
          treat a reunion: with warmth, good humour and the professional courtesy you would show a colleague.
        </P>
        <List
          items={[
            'Be kind and assume good intentions.',
            'Celebrate one another’s achievements; disagree without making it personal.',
            'Share what you would be comfortable having every batchmate read.',
            'Remember that approved blogs are public — write them accordingly.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'patients',
    title: 'Patient confidentiality comes first',
    content: (
      <>
        <P>
          <Term>
            Do not upload or post identifiable patient records, prescriptions, investigation reports, images, case
            details or any other confidential clinical information without proper legal authorisation.
          </Term>
        </P>
        <P>
          This applies to text, photographs, videos, screenshots and documents, and to anything visible in the
          background of a photo — a monitor, a case sheet, a name board, a patient in a ward. Removing a name is
          often not enough to make a patient unidentifiable. If you are unsure, do not post it.
        </P>
        <P>
          This community is for staying in touch. It is not a place for clinical consultations, referrals or sharing
          patient data.
        </P>
      </>
    ),
  },
  {
    id: 'prohibited',
    title: 'What is not allowed',
    content: (
      <>
        <P>The following are prohibited everywhere on the platform, including comments, captions and profile fields:</P>
        <List
          items={[
            <>
              <Term>Patient and clinical information</Term> — identifiable patient records, prescriptions, reports or
              confidential clinical information shared without proper legal authorisation.
            </>,
            <>
              <Term>Harassment and abuse</Term> — harassment, bullying, threats, intimidation, and abusive or
              demeaning content.
            </>,
            <>
              <Term>Discrimination</Term> — content that attacks or demeans people on grounds such as gender,
              religion, caste, ethnicity, region, language, disability, age or sexual orientation.
            </>,
            <>
              <Term>Impersonation</Term> — pretending to be another person, creating an account in someone
              else&apos;s name, or misrepresenting your qualifications or position.
            </>,
            <>
              <Term>Unlawful or explicit images</Term> — sexually explicit, obscene, violent or otherwise unlawful
              images and videos.
            </>,
            <>
              <Term>Private photos and information shared without permission</Term> — photographs, videos, contact
              details, messages or personal information about someone else posted without their consent.
            </>,
            <>
              <Term>Spam and malicious links</Term> — repetitive or promotional posting, advertising, scams, and
              links to malware, phishing or deceptive sites.
            </>,
            <>
              <Term>Misuse of members&apos; information</Term> — collecting, copying, scraping or exporting
              members&apos; details, or using them outside the community (for example for marketing or mailing lists)
              without consent.
            </>,
            <>
              <Term>Other unlawful content</Term> — anything that breaks the law, infringes someone else&apos;s
              rights, or encourages others to do so.
            </>,
          ]}
        />
        <P>
          Attempts to get around moderation or security — such as re-posting rejected content unchanged, or
          interfering with other members&apos; accounts — are treated as breaches of these guidelines.
        </P>
      </>
    ),
  },
  {
    id: 'photos',
    title: 'Sharing memories responsibly',
    content: (
      <List
        items={[
          'Share photographs and videos you took yourself or have permission to share.',
          'Think about the people in the picture. If a batchmate asks for a memory showing them to be removed, remove it — or ask an administrator to.',
          'Do not share photographs of children, family members or third parties who would not expect to appear here.',
          'Memories can be viewed and downloaded by signed-in members. Do not redistribute other members’ photos outside the community without their agreement.',
        ]}
      />
    ),
  },
  {
    id: 'events',
    title: 'Events, visit plans and polls',
    content: (
      <List
        items={[
          'Propose real gatherings with accurate dates, places and expected costs.',
          'RSVP honestly and update your response if your plans change, so organisers can plan.',
          'Sharing your city or travel dates is entirely voluntary. Never pressure anyone to share theirs.',
          'Use polls for planning community activities, not for campaigning or for singling people out.',
        ]}
      />
    ),
  },
  {
    id: 'moderation',
    title: 'How moderation works',
    content: (
      <>
        <List
          ordered
          items={[
            <>
              <Term>You submit.</Term> A post, blog, comment, memory, event, visit plan or poll is saved as
              &ldquo;awaiting review&rdquo;. Only you and the administrators can see it.
            </>,
            <>
              <Term>An administrator reviews.</Term> The submission is approved or rejected. If it is rejected, a
              reason may be given.
            </>,
            <>
              <Term>You are notified.</Term> You receive an in-app notification either way, and can follow every
              submission under{' '}
              <Link href="/dashboard/submissions" className={link}>
                My submissions
              </Link>
              .
            </>,
            <>
              <Term>Approved content is published</Term> to the community. If you later edit it, it returns to
              review before it is shown again.
            </>,
          ]}
        />
        <P>
          Review is carried out by people, so it can take time. Administrators can also remove content that was
          previously approved, and their approvals, rejections, removals and account actions are recorded in an audit
          log.
        </P>
      </>
    ),
  },
  {
    id: 'reporting',
    title: 'Reporting a problem',
    content: (
      <>
        <P>
          If you see something that breaks these guidelines, use the <Term>Report</Term> button on the post, blog,
          comment, memory, event or poll. Choose a reason and add any detail that will help. Reports go to the
          administrators only — the member you report is not told who reported them.
        </P>
        <P>
          For urgent concerns, or a concern about an account rather than a piece of content, contact <ContactLine />.
        </P>
      </>
    ),
  },
  {
    id: 'sanctions',
    title: 'What happens when guidelines are broken',
    content: (
      <>
        <P>Depending on how serious the breach is, and whether it is repeated, administrators may:</P>
        <List
          items={[
            <>
              <Term>Reject a submission</Term> so that it is never published.
            </>,
            <>
              <Term>Remove published content</Term>, together with its comments and likes. The author is notified.
            </>,
            <>
              <Term>Suspend the account.</Term> A suspended member is signed out everywhere and cannot log in or use
              member features until an administrator reactivates the account.
            </>,
            <>
              <Term>Delete the account</Term> permanently, along with the content it created, as described in the{' '}
              <Link href="/privacy" className={link}>
                Privacy Policy
              </Link>
              .
            </>,
          ]}
        />
        <P>
          Content that appears to be unlawful — and in particular any disclosure of patient information — may be
          removed immediately and may be reported to the appropriate authorities where the law requires it.
        </P>
        <P>
          If you believe a decision was a mistake, you can raise it with <ContactLine />.
        </P>
      </>
    ),
  },
];

export default function CommunityGuidelinesPage() {
  return (
    <LegalPage
      title="Community Guidelines"
      description="A private community works only if its members can trust one another. These are the standards every member agrees to."
      current="/community-guidelines"
      sections={sections}
    />
  );
}
