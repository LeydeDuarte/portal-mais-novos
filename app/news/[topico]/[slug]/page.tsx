import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import NoticiaView from '@/components/news/NoticiaView';
import { noticiaPorSlug } from '@/lib/news/dados';
import { nomeTopico, textoPuro, urlNoticia } from '@/lib/news/base';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { caber } from '@/lib/titulos';

// Guardada por 5 minutos (menos consulta ao banco). Rascunho: /news/previa/<id>.
export const revalidate = 300;
type Props = { params: { topico: string; slug: string } };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await noticiaPorSlug(params.slug);
  if (!c) return { title: 'Notícia', robots: { index: false } };
  const url = `${SITE_URL}${urlNoticia(c)}`;
  const titulo = c.seoTitulo || caber([c.titulo]);
  const desc = (c.seoDescricao || c.linhaFina || textoPuro(c.corpo)).slice(0, 160);
  const img = c.capa ?? undefined;
  return {
    title: { absolute: titulo },
    description: desc,
    alternates: { canonical: url },
    authors: [{ name: c.autor }],
    openGraph: {
      type: 'article',
      title: c.titulo,
      description: desc,
      url,
      siteName: SITE_NAME,
      locale: 'pt_BR',
      publishedTime: c.publicadoEm ?? undefined,
      modifiedTime: c.atualizadoEm,
      section: nomeTopico(c.topico),
      images: img ? [{ url: img }] : undefined
    },
    twitter: { card: 'summary_large_image', title: c.titulo, description: desc, images: img ? [img] : undefined }
  };
}

export default async function NoticiaPage({ params }: Props) {
  const n = await noticiaPorSlug(params.slug);
  if (!n) notFound();
  if (n.topico !== params.topico) permanentRedirect(urlNoticia(n)); // mudou de tópico: endereço novo
  return <NoticiaView n={n} />;
}
