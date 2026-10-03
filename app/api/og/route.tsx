import { ImageResponse } from 'next/og';
import { CARTAO_PADRAO, cartaoValido, type DadosCartao } from '@/lib/cartao-og';

// Imagem de compartilhamento 1200 × 630 (WhatsApp, Facebook, LinkedIn) para as páginas
// sem foto. Só desenha cartões pedidos pelo próprio portal (endereço assinado); qualquer
// outro pedido recebe o cartão padrão. Guardada no cache por um dia.
export const runtime = 'nodejs';

async function arquivo(url: URL): Promise<ArrayBuffer | null> {
  try {
    const r = await fetch(url, { cache: 'force-cache' });
    return r.ok ? await r.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const pedido: DadosCartao = { titulo: q.get('t') ?? '', sub: q.get('s'), selo: q.get('selo') };
  const d = pedido.titulo && cartaoValido(pedido, q.get('k')) ? pedido : CARTAO_PADRAO;

  const [titulos, texto, logo] = await Promise.all([
    arquivo(new URL('/fontes/Poppins-SemiBold.ttf', request.url)),
    arquivo(new URL('/fontes/Inter-Regular.otf', request.url)),
    arquivo(new URL('/marca/logo-documentos.png', request.url))
  ]);
  const fontes = [
    ...(titulos ? [{ name: 'Poppins', data: titulos, weight: 600 as const, style: 'normal' as const }] : []),
    ...(texto ? [{ name: 'Inter', data: texto, weight: 400 as const, style: 'normal' as const }] : [])
  ];
  const logoSrc = logo ? `data:image/png;base64,${Buffer.from(logo).toString('base64')}` : null;
  const tam = d.titulo.length > 60 ? 46 : d.titulo.length > 40 ? 54 : d.titulo.length > 28 ? 62 : 72;

  const resposta = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#FFFFFF', fontFamily: 'Inter' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '68px 76px 0' }}>
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} width={520} height={88} alt="" style={{ objectFit: 'contain', objectPosition: 'left' }} />
          ) : (
            <div style={{ display: 'flex', fontFamily: 'Poppins', fontSize: 48, color: '#14161A' }}>maisnovosimoveis.com</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', marginBottom: 64 }}>
            {d.selo && (
              <div style={{ display: 'flex', alignSelf: 'flex-start', background: '#257CFF', color: '#FFFFFF', fontFamily: 'Poppins', fontSize: 28, padding: '6px 22px', borderRadius: 999, marginBottom: 22 }}>
                {d.selo}
              </div>
            )}
            <div style={{ display: 'flex', fontFamily: 'Poppins', fontSize: tam, lineHeight: 1.12, color: '#14161A', maxWidth: 1040 }}>{d.titulo}</div>
            {d.sub && <div style={{ display: 'flex', fontSize: 34, color: '#5F6368', marginTop: 18, maxWidth: 1040 }}>{d.sub}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', height: 18, background: '#257CFF' }} />
      </div>
    ),
    { width: 1200, height: 630, fonts: fontes.length ? fontes : undefined }
  );
  resposta.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
  return resposta;
}
