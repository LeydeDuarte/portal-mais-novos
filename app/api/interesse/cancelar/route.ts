import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Link "Cancelar avisos" dos e-mails de interesse
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('t') ?? '';
  let ok = false;
  if (/^[0-9a-f-]{36}$/i.test(token)) {
    const rows = await query<{ id: string }>(
      'update interest_leads set descadastrado_em = now() where unsubscribe_token = $1::uuid and descadastrado_em is null returning id',
      [token]
    );
    ok = rows.length > 0;
  }
  const msg = ok ? 'Pronto! Você não vai mais receber avisos deste condomínio.' : 'Este link já foi usado ou não é válido.';
  return new Response(
    `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Avisos cancelados</title>
     <body style="font-family:Arial,sans-serif;background:#f2f1ee;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
     <div style="background:#fff;padding:32px;border-radius:16px;max-width:420px;text-align:center"><p style="font-size:16px">${msg}</p>
     <a href="/" style="color:#c9a227;font-weight:bold">Voltar para o site</a></div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
