import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { randomUUID } from 'crypto';
import { query } from '@/lib/db';
import { verifySession } from '@/lib/session';

// Link curto dos imóveis enviados pelo CRM (maisnovosimoveis.com/r/<código>).
// Conta quando a PESSOA abre (não a prévia do WhatsApp, robôs ou a equipe logada),
// registra na ficha dela e liga este navegador ao contato, para o caminho dela no
// portal aparecer no CRM. Depois leva ao imóvel.
export const dynamic = 'force-dynamic';
const ROBO = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp\/|telegrambot|headless|lighthouse|vercel|monitor|skype|discord/i;

export async function GET(_req: Request, { params }: { params: { codigo: string } }) {
  const codigo = String(params.codigo ?? '').slice(0, 20);
  const e = /^[\w-]{4,20}$/.test(codigo)
    ? (await query<{ id: string; contato_id: string; destino: string; titulo: string | null; aberturas: number }>(`select id, contato_id, destino, titulo, aberturas from crm_envios where codigo = $1`, [codigo]).catch(() => []))[0]
    : undefined;
  if (!e) return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_SITE_URL || 'https://maisnovosimoveis.com'), 302);

  let destino: URL;
  try {
    destino = new URL(e.destino);
  } catch {
    destino = new URL('/', process.env.NEXT_PUBLIC_SITE_URL || 'https://maisnovosimoveis.com');
  }
  if (!destino.searchParams.has('utm_source')) {
    destino.searchParams.set('utm_source', 'crm');
    destino.searchParams.set('utm_medium', 'envio');
  }
  const res = NextResponse.redirect(destino, 302);
  const h = headers();
  const robo = ROBO.test(h.get('user-agent') ?? '');
  const equipe = !!verifySession(cookies().get('mn_staff')?.value);
  if (robo || equipe) return res;

  let vid = cookies().get('mn_vid')?.value;
  if (!vid) {
    vid = randomUUID();
    res.cookies.set('mn_vid', vid, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
  }
  await query(`update crm_envios set aberturas = aberturas + 1, primeiro_aberto_em = coalesce(primeiro_aberto_em, now()), ultimo_aberto_em = now() where id = $1`, [e.id]).catch(() => {});
  await query(
    `update crm_contatos set visitantes = case when $2 = any(visitantes) then visitantes else array_append(visitantes, $2) end where id = $1`,
    [e.contato_id, vid]
  ).catch(() => {});
  if (!e.aberturas)
    await query(`insert into crm_atividades (contato_id, tipo, texto) values ($1, 'abriu', $2)`, [e.contato_id, `Abriu o link: ${e.titulo ?? 'imóvel'}`]).catch(() => {});
  return res;
}
