import PosterRenderer from '@/components/posters/PosterRenderer';

// Opened only inside the Android app (a WebView): draws a poster the app sends.
export const metadata = {
  title: 'Poster renderer',
  robots: { index: false, follow: false },
};

export default function PosterRendererPage() {
  return <PosterRenderer />;
}
