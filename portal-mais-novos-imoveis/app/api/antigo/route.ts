import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { SITE_URL } from '@/lib/seo';

// Site antigo (imoveisavendaemgoias.com.br, feito na Jetimob) → portal novo.
// O middleware manda para cá TODO acesso ao domínio antigo; respondemos com
// redirecionamento PERMANENTE (301), para o Google transferir a relevância:
//   - endereço de anúncio (tem o código/ID da Jetimob) → /imovel/<id> do portal
//   - endereço de condomínio (ID da Jetimob) → /empreendimento/<id>
//   - páginas institucionais → página equivalente
//   - resto (inclusive a home antiga) → /imoveis-a-venda/go/goiania
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PADRAO = '/imoveis-a-venda/go/goiania';

async function destino(caminho: string): Promise<string> {
  const p = decodeURIComponent(caminho || '/').toLowerCase();
  const numeros = Array.from(new Set(p.match(/\d{4,10}/g) ?? [])).slice(-3);

  if (numeros.length) {
    const imovel = await query<{ id: string }>(
      `select id from properties
        where not is_tipologia and (jetimob_id::text = any($1::text[]) or jetimob_codigo = any($1::text[]))
        order by (vendido_em is null) desc limit 1`,
      [numeros]
    ).catch(() => []);
    if (imovel[0]) return `/imovel/${imovel[0].id}`;
    const condo = await query<{ id: string }>(
      `select id from developments where status = 'publicado' and jetimob_id::text = any($1::text[]) limit 1`,
      [numeros]
    ).catch(() => []);
    if (condo[0]) return `/empreendimento/${condo[0].id}`;
  }

  if (/lancament/.test(p)) return '/lancamentos';
  if (/financ|credito|home-equity|emprestimo/.test(p)) return '/financiamento';
  if (/anuncie|cadastr.*imovel|venda-seu|vender|avalia/.test(p)) return '/vender';
  if (/sobre|quem-somos|empresa|contato|fale-conosco/.test(p)) return '/quem-somos';
  return PADRAO;
}

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams.get('p') ?? '/';
  const para = await destino(p.split('?')[0]);
  return new NextResponse(null, {
    status: 301,
    headers: { Location: `${SITE_URL}${para}`, 'Cache-Control': 'public, max-age=86400' }
  });
}
export const HEAD = GET;
