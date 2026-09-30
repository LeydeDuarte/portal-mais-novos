import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { randomUUID } from 'crypto';
import { query } from '@/lib/db';
import { verifySession } from '@/lib/session';

// Recebe os eventos do site (visitas e cliques) para o painel de dados do Início.
// Não conta a equipe logada nem robôs. Visitante = cookie anônimo "mn_vid" (1 ano):
// sem o cookie, é visitante novo.
export const dynamic = 'force-dynamic';
const TIPOS = new Set(['ping', 'visita', 'whatsapp', 'whatsapp_lead', 'formulario_lead', 'fundadora', 'banner', 'anuncie', 'canal', 'compartilhar', 'tempo']);
const ROBO = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp\/|headless|lighthouse|vercel|monitor/i;

export async function POST(request: Request) {
  const h = headers();
  if (ROBO.test(h.get('user-agent') ?? '')) return new NextResponse(null, { status: 204 });
  if (verifySession(cookies().get('mn_staff')?.value)) return new NextResponse(null, { status: 204 });
  let b: { t?: string; p?: string; r?: string; o?: string; v?: number };
  try {
    b = JSON.parse(await request.text());
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  if (!b.t || !TIPOS.has(b.t)) return new NextResponse(null, { status: 204 });
  const pagina = String(b.p ?? '').slice(0, 300) || null;
  const ref = String(b.r ?? '').slice(0, 300) || null;
  // origem: só o domínio de quem mandou a pessoa (google.com, instagram.com, ...)
  let origem: string | null = null;
  try {
    const u = b.o ? new URL(b.o) : null;
    if (u && !/maisnovosimoveis\.com$/.test(u.hostname)) origem = u.hostname.replace(/^www\.|^m\.|^l\./, '').slice(0, 80);
  } catch {
    /* sem origem */
  }
  // tempo na página: segundos com a página visível (entre 2 s e 30 min)
  const valor = b.t === 'tempo' ? Math.round(Number(b.v)) : null;
  if (b.t === 'tempo' && !(valor && valor >= 2 && valor <= 1800)) return new NextResponse(null, { status: 204 });
  let vid = cookies().get('mn_vid')?.value;
  const novo = !vid;
  if (!vid) vid = randomUUID();
  // "online agora": uma linha por visitante, sobrescrita (não vira histórico)
  if (b.t === 'ping' || b.t === 'visita') {
    await query(
      `insert into online (visitante, pagina, origem, visto_em) values ($1, $2, $3, now())
       on conflict (visitante) do update set pagina = excluded.pagina, visto_em = now(), origem = coalesce(excluded.origem, online.origem)`,
      [vid, pagina, origem]
    ).catch(() => {});
    if (Math.random() < 0.01) await query("delete from online where visto_em < now() - interval '1 day'").catch(() => {});
    if (b.t === 'ping') {
      const r = new NextResponse(null, { status: 204 });
      if (novo) r.cookies.set('mn_vid', vid, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
      return r;
    }
  }
  await query('insert into eventos (tipo, pagina, ref, visitante, novo, origem, valor) values ($1, $2, $3, $4, $5, $6, $7)', [b.t, pagina, ref, vid, novo && b.t === 'visita', origem, valor]).catch(() => {});
  if (b.t === 'banner' && ref) await query('update banners set cliques = cliques + 1 where id = $1', [ref]).catch(() => {});
  const res = new NextResponse(null, { status: 204 });
  if (novo) res.cookies.set('mn_vid', vid, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
  return res;
}
