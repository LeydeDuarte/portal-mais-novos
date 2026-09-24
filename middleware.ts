import { NextResponse, type NextRequest } from 'next/server';

// Dois cookies de visitante, criados já na primeira requisição e repassados para
// a própria requisição (a página enxerga na hora):
// - mn_dev (2 anos): identifica o APARELHO — prende o link de anúncio privado a ele.
// - mn_sessao (até fechar o navegador): "semente" da ordem aleatória do feed —
//   cada visita vê uma ordem nova, que não muda enquanto a pessoa rola a página.
export function middleware(req: NextRequest) {
  const faltaDev = !req.cookies.get('mn_dev')?.value;
  const faltaSessao = !req.cookies.get('mn_sessao')?.value;
  if (!faltaDev && !faltaSessao) return NextResponse.next();

  const novos: Record<string, string> = {};
  if (faltaDev) novos.mn_dev = crypto.randomUUID();
  if (faltaSessao) novos.mn_sessao = crypto.randomUUID().slice(0, 12);

  const headers = new Headers(req.headers);
  const atual = req.headers.get('cookie');
  const extra = Object.entries(novos)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  headers.set('cookie', atual ? `${atual}; ${extra}` : extra);
  const res = NextResponse.next({ request: { headers } });
  if (novos.mn_dev) res.cookies.set('mn_dev', novos.mn_dev, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 730 });
  if (novos.mn_sessao) res.cookies.set('mn_sessao', novos.mn_sessao, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  return res;
}

export const config = {
  matcher: ['/((?!_next/|pdfjs/|icons/|favicon|manifest|sw\\.js|robots|sitemap|llms|api/).*)']
};
