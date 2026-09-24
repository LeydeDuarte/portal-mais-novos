// Envio de e-mail pela Resend (https://resend.com) — só funciona quando as
// variáveis estão configuradas na Vercel:
//   RESEND_API_KEY  → chave da conta Resend
//   EMAIL_FROM      → remetente, ex: "Mais Novos Imóveis <contato@maisnovosimoveis.com>"
//                     (o domínio precisa estar verificado na Resend)
//   EMAIL_EQUIPE    → para onde vão os avisos de novos leads (pode ter vários, separados por vírgula)
// Sem essas variáveis, nada quebra: o lead é salvo normalmente e só o e-mail não sai.

export function emailConfigurado(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export async function enviarEmail(para: string | string[], assunto: string, html: string): Promise<boolean> {
  if (!emailConfigurado()) return false;
  const to = (Array.isArray(para) ? para : para.split(',')).map((e) => e.trim()).filter(Boolean);
  if (!to.length) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject: assunto, html }),
      cache: 'no-store'
    });
    if (!res.ok) console.error('Falha ao enviar e-mail', res.status, await res.text().catch(() => ''));
    return res.ok;
  } catch (err) {
    console.error('Falha ao enviar e-mail', err);
    return false;
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

// Moldura simples, nas cores do site
export function emailLayout(titulo: string, corpo: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#14161a">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="font-family:Georgia,serif;font-size:20px;font-weight:bold;margin-bottom:16px">Mais Novos <span style="color:#257cff">Imóveis</span></div>
    <div style="background:#fff;border-radius:16px;padding:24px">
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">${titulo}</h1>
      ${corpo}
    </div>
    <p style="font-size:11px;color:#9aa0a8;margin-top:16px">Mais Novos Inteligência Imobiliária · CRECI C17586 · Goiânia — GO</p>
  </div></body></html>`;
}
