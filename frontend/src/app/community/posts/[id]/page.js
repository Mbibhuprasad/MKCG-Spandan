import { MemberGate } from '@/components/auth/Guards';
import PostDetail from '@/components/community/PostDetail';

// The post itself is fetched in the browser with the member's session, so no
// member content is ever part of the server-rendered HTML.
export const metadata = {
  title: 'Community post',
  robots: { index: false, follow: false },
};

export default async function PostPage({ params }) {
  const { id } = await params;
  return (
    <MemberGate
      title="This post is for members"
      description="Community posts are shared privately between doctors. Sign in or join to read it."
    >
      <PostDetail id={id} />
    </MemberGate>
  );
}
