import Home from '@/components/Home';
import { buildAgentJsonLd } from '@/lib/seo';

export default function Page({ searchParams }: { searchParams: { q?: string } }) {
  const jsonLd = buildAgentJsonLd();
  const q = typeof searchParams?.q === 'string' ? searchParams.q.slice(0, 120) : '';
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Home initialQuery={q} />
    </>
  );
}
