import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { assinaturaValida, marcarLida } from '@/lib/whatsapp';
import { contatoDoWhatsapp } from '@/lib/crm';
import { responderComIA } from '@/lib/ia-atendimento';

// Webhook do WhatsApp (Cloud API da Meta): https://maisnovosimoveis.com/api/whatsapp/webhook
//  GET: confirmação do webhook (hub.verify_token = WHATSAPP_VERIFY_TOKEN)
//  POST: mensagens recebidas e status das enviadas. Cada mensagem vai para a ficha do
//  contato no CRM (cria o contato se for novo) e a IA responde, se estiver ligada.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const ok = u.searchParams.get('hub.mode') === 'subscribe' && !!process.env.WHATSAPP_VERIFY_TOKEN && u.searchParams.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN;
  return ok ? new NextResponse(u.searchParams.get('hub.challenge') ?? '', { status: 200 }) : new NextResponse('forbidden', { status: 403 });
}

type Entrada = {
  from: string;
  id: string;
  timestamp?: string;
  type: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  image?: { caption?: string };
  document?: { caption?: string; filename?: string };
  location?: { latitude: number; longitude: number; name?: string };
  referral?: { headline?: string; source_url?: string; source_type?: string; body?: string };
};

function textoDa(m: Entrada): string {
  switch (m.type) {
    case 'text':
      return m.text?.body ?? '';
    case 'button':
      return m.button?.text ?? '';
    case 'interactive':
      return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? '';
    case 'image':
      return `[foto]${m.image?.caption ? ` ${m.image.caption}` : ''}`;
    case 'document':
      return `[documento${m.document?.filename ? `: ${m.document.filename}` : ''}]${m.document?.caption ? ` ${m.document.caption}` : ''}`;
    case 'audio':
      return '[áudio]';
    case 'video':
      return '[vídeo]';
    case 'location':
      return `[localização${m.location?.name ? `: ${m.location.name}` : ''}]`;
    case 'sticker':
      return '[figurinha]';
    default:
      return `[${m.type}]`;
  }
}

export async function POST(req: Request) {
  const corpo = await req.text();
  if (!assinaturaValida(corpo, req.headers.get('x-hub-signature-256'))) return new NextResponse('assinatura inválida', { status: 401 });
  let j: { entry?: { changes?: { value?: { contacts?: { wa_id: string; profile?: { name?: string } }[]; messages?: Entrada[]; statuses?: { id: string; status: string }[] } }[] }[] };
  try {
    j = JSON.parse(corpo);
  } catch {
    return NextResponse.json({ ok: true });
  }
  const paraResponder = new Set<string>();
  for (const e of j.entry ?? [])
    for (const ch of e.changes ?? []) {
      const v = ch.value ?? {};
      // status das mensagens enviadas (enviada, entregue, lida, falhou)
      for (const s of v.statuses ?? []) await query(`update crm_mensagens set status = $2 where wa_id = $1`, [s.id, s.status]).catch(() => {});
      for (const m of v.messages ?? []) {
        const perfil = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? '';
        const texto = textoDa(m).slice(0, 4000);
        const { id: contatoId } = await contatoDoWhatsapp({ telefone: m.from, nome: perfil, texto, anuncio: m.referral ?? null });
        // a Meta pode reenviar o mesmo aviso: o id da mensagem é único
        const r = await query<{ id: string }>(
          `insert into crm_mensagens (contato_id, direcao, autor, tipo, texto, wa_id, dados, criado_em)
           values ($1, 'entrada', 'cliente', $2, $3, $4, $5::jsonb, coalesce(to_timestamp($6::bigint), now()))
           on conflict (wa_id) do nothing returning id`,
          [contatoId, m.type, texto, m.id, JSON.stringify(m.referral ? { anuncio: m.referral } : {}), m.timestamp ?? null]
        ).catch(() => []);
        if (!r[0]) continue;
        await query(`update crm_contatos set ultimo_contato_em = now(), atualizado_em = now() where id = $1`, [contatoId]).catch(() => {});
        await marcarLida(m.id);
        paraResponder.add(contatoId);
      }
    }
  for (const id of Array.from(paraResponder)) await responderComIA(id).catch((e) => console.error('IA', e));
  return NextResponse.json({ ok: true });
}
