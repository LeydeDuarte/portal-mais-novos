import { jsonLdSeguro } from '@/lib/seo';

// Dados estruturados (schema.org) para Google e buscadores de IA.
// jsonLdSeguro escapa "<" etc. — um texto de anúncio nunca vira código na página.
export default function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSeguro(data) }} />;
}
