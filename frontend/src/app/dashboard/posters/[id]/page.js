import PosterEditor from '@/components/posters/PosterEditor';

export const metadata = { title: 'Edit my batch poster' };

export default async function EditPosterPage({ params }) {
  const { id } = await params;
  return <PosterEditor key={id} posterId={id} />;
}
