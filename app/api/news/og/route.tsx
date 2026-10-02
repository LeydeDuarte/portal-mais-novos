import { ImageResponse } from 'next/og';
import { noticiaPorSlug } from '@/lib/news/dados';
import { nomeTopico } from '@/lib/news/base';

// Capa automática (1200×675) para notícia publicada sem imagem: fundo escuro, tópico e
// título. Gerada na hora e guardada no cache da Vercel; não ocupa espaço no armazenamento.
// Serve para o Google (Discover), WhatsApp, Instagram e redes sociais terem uma imagem.
export const runtime = 'nodejs';
export const revalidate = 86400;

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('s') ?? '';
  const n = slug ? await noticiaPorSlug(slug).catch(() => null) : null;
  const titulo = n?.titulo ?? 'Mais Novos News';
  const topico = n ? nomeTopico(n.topico) : 'Notícias do mercado imobiliário';
  const tam = titulo.length > 90 ? 52 : titulo.length > 60 ? 60 : 68;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: 'linear-gradient(135deg, #0E1014 0%, #1B2029 60%, #232A36 100%)',
          color: '#F4F1EA'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 4, background: '#C9A45C' }} />
          <div style={{ fontSize: 26, letterSpacing: 4, textTransform: 'uppercase', color: '#C9A45C' }}>{topico}</div>
        </div>
        <div style={{ display: 'flex', fontSize: tam, lineHeight: 1.12, fontWeight: 700, maxWidth: 1020 }}>{titulo}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 24, color: '#A9ADB5' }}>
          <div style={{ display: 'flex' }}>Mais Novos News</div>
          <div style={{ display: 'flex' }}>maisnovosimoveis.com</div>
        </div>
      </div>
    ),
    { width: 1200, height: 675 }
  );
}
