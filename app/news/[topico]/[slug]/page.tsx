import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import NoticiaView from '@/components/news/NoticiaView';
import { noticiaPorSlug } from '@/lib/news/dados';
import { importarCapaExterna } from '@/lib/news/capa';
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
  // sem capa: imagem automática com o título (Discover e redes sociais pedem uma imagem grande)
  const img = c.capa16x9 ?? c.capa ?? `${SITE_URL}/api/news/og?s=${encodeURIComponent(c.slug)}`;
  return {
    title: { absolute: titulo },
    description: desc,
    alternates: { canonical: url },
    // Google Discover: permite a imagem grande da capa
    robots: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
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
      images: img ? [c.capa16x9 ? { url: img, width: 1200, height: 675, alt: c.capaAlt ?? c.titulo } : { url: img }] : undefined
    },
    twitter: { card: 'summary_large_image', title: c.titulo, description: desc, images: img ? [img] : undefined }
  };
}

export default async function NoticiaPage({ params }: Props) {
  let n = await noticiaPorSlug(params.slug);
  if (!n) notFound();
  // capa ainda num link de fora (publicada pelo projeto News): copia agora para o portal
  if (n.capa && !n.capa16x9 && (await importarCapaExterna(n.id))) n = (await noticiaPorSlug(params.slug)) ?? n;
  if (n.topico !== params.topico) permanentRedirect(urlNoticia(n)); // mudou de tópico: endereço novo
  return <NoticiaView n={n} />;
}
