'use client';

import { useSearchParams } from 'next/navigation';
import { useApi } from '@/lib/hooks';
import Button from '@/components/ui/Button';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/Feedback';

const ID_RE = /^[a-f\d]{24}$/i;

/**
 * Shared by the post, blog and poll editors.
 *
 *  - no ?edit= parameter → renders `children(null)` (create mode)
 *  - ?edit=ID            → loads `${resource}/ID`, checks it belongs to the
 *                          signed-in member, then renders `children(item)`
 *
 * The form itself is only mounted once the item is available, so it can seed
 * its state from props without any effect. The API re-checks ownership on save.
 */
export default function EditorLoader({ resource, label, children }) {
  const params = useSearchParams();
  const editId = params.get('edit');
  const valid = Boolean(editId) && ID_RE.test(editId);
  const { data, loading, error, reload } = useApi(valid ? `${resource}/${editId}` : null, undefined, { enabled: valid });

  if (!editId) return children(null);

  const back = (
    <Button href="/dashboard/submissions" variant="secondary">
      Back to my submissions
    </Button>
  );

  if (!valid || (error && (error.status === 404 || error.status === 400 || error.status === 403))) {
    return (
      <EmptyState
        title={`This ${label} cannot be edited`}
        description="It may have been removed, or it does not belong to your account."
        action={back}
      />
    );
  }
  if (loading && !data) return <PageLoader label={`Loading your ${label}…`} />;
  if (error) return <ErrorState title={`Your ${label} could not be loaded`} message={error.message} onRetry={reload} />;
  if (!data) return null;
  if (!data.isMine) {
    return (
      <EmptyState
        title={`You can only edit your own ${label}s`}
        description="Administrators can approve, reject or delete submissions from the admin panel."
        action={back}
      />
    );
  }
  return children(data);
}
