import Home from '@/components/Home';
import { buildAgentJsonLd } from '@/lib/seo';

export default function Page() {
  const jsonLd = buildAgentJsonLd();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Home />
    </>
  );
}
