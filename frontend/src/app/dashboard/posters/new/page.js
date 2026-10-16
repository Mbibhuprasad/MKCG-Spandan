import PosterEditor from '@/components/posters/PosterEditor';

export const metadata = { title: 'Create my batch poster' };

// ?template=<id> starts the poster with a template chosen in the gallery
// (unknown ids are ignored by the editor).
export default async function NewPosterPage({ searchParams }) {
  const { template } = await searchParams;
  return <PosterEditor initialTemplate={typeof template === 'string' ? template : null} />;
}
