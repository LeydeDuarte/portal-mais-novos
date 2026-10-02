// WhatsApp Business (Cloud API da Meta) — módulo do servidor.
// Variáveis na Vercel: WHATSAPP_TOKEN (token permanente do usuário do sistema),
// WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_WABA_ID, WHATSAPP_APP_SECRET (confere a assinatura
// das mensagens recebidas) e WHATSAPP_VERIFY_TOKEN (confirmação do webhook).
import crypto from 'crypto';

const VERSAO = 'v21.0';

export const whatsappConfigurado = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

/** confere que o aviso veio mesmo da Meta (cabeçalho X-Hub-Signature-256) */
export function assinaturaValida(corpo: string, assinatura: string | null): boolean {
  const segredo = process.env.WHATSAPP_APP_SECRET;
  if (!segredo) return false;
  if (!assinatura?.startsWith('sha256=')) return false;
  const esperado = crypto.createHmac('sha256', segredo).update(corpo, 'utf8').digest('hex');
  const a = Buffer.from(assinatura.slice(7), 'hex');
  const b = Buffer.from(esperado, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** envia um texto (só funciona dentro das 24 h depois da última mensagem do cliente) */
export async function enviarTextoWhatsapp(para: string, texto: string): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  if (!whatsappConfigurado()) return { ok: false, erro: 'A API do WhatsApp ainda não está configurada.' };
  const r = await fetch(`https://graph.facebook.com/${VERSAO}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: para.replace(/\D/g, ''), type: 'text', text: { body: texto.slice(0, 4000), preview_url: true } }),
    signal: AbortSignal.timeout(15000)
  }).catch((e) => ({ ok: false, json: async () => ({ error: { message: String(e) } }) }) as unknown as Response);
  const j = (await r.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
  if (!r.ok || !j.messages?.[0]?.id) {
    const cod = j.error?.code;
    // 131047: passou das 24 h; 131030: número fora da lista de teste
    const erro =
      cod === 131047
        ? 'Passaram mais de 24 h desde a última mensagem do cliente: o WhatsApp só deixa reabrir a conversa com um modelo aprovado.'
        : cod === 131030
          ? 'Este número não está na lista de destinatários do número de teste da Meta.'
          : j.error?.message ?? 'Falha ao enviar.';
    return { ok: false, erro };
  }
  return { ok: true, id: j.messages[0].id };
}

/** marca como lida (os dois tiques azuis) */
export async function marcarLida(waId: string): Promise<void> {
  if (!whatsappConfigurado()) return;
  await fetch(`https://graph.facebook.com/${VERSAO}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: waId }),
    signal: AbortSignal.timeout(8000)
  }).catch(() => {});
}
