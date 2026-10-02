// Endereços do site antigo (/empreendimentos/<nome>) ainda aparecem no Google.
// Em vez de "página não encontrada", leva (301) ao condomínio de mesmo nome; sem par, à busca.
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { urlCondominio } from '@/lib/urls';

const DE = 'áàâãäéèêëíìîïóòôõöúùûüç';
const PARA = 'aaaaaeeeeiiiiooooouuuuc';
const IGNORAR = new Set(['condominio', 'residencial', 'edificio', 'residence', 'de', 'do', 'da', 'dos', 'das', 'e', 'goiania', 'go']);

export async function GET(req: Request, { params }: { params: { partes: string[] } }) {
  const base = new URL(req.url).origin;
  const slug = decodeURIComponent(params.partes[params.partes.length - 1] ?? '').toLowerCase();
  const palavras = slug
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !/^\d+$/.test(w) && !IGNORAR.has(w))
    .slice(0, 6);
  if (palavras.length) {
    const conds = palavras.map((_, i) => `translate(lower(name), '${DE}', '${PARA}') like $${i + 1}`).join(' and ');
    const r = await query<{ id: string; slug: string | null; uf: string | null; bairro: string | null; cidade: string | null }>(
      `select id, slug, uf, bairro, cidade from developments where status = 'publicado' and ${conds}
        order by coalesce(visualizacoes, 0) desc, length(name) limit 1`,
      palavras.map((w) => `%${w}%`)
    ).catch(() => []);
    if (r[0]) return NextResponse.redirect(`${base}${urlCondominio(r[0])}`, 301);
  }
  return NextResponse.redirect(`${base}/${palavras.length ? `?q=${encodeURIComponent(palavras.join(' '))}` : ''}`, 301);
}
