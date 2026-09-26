import { NextResponse, type NextRequest } from 'next/server';
import { APP_URL, ehDominioAntigo, ehHostApp, ehHostPrincipal } from '@/lib/dominios';

// 1) Domínios e subdomínio:
//    - site antigo (imoveisavendaemgoias.com.br): a rota /api/antigo responde com 301
//      para a página equivalente no portal (anúncio, condomínio ou região).
//    - app.maisnovosimoveis.com: só a área da equipe (/dashboard). Qualquer outra
//      página vai para o site público (o cookie da equipe vale nos dois).
//    - maisnovosimoveis.com/dashboard (ou o antigo /painel) → app.maisnovosimoveis.com/dashboard
// 2) Páginas de região antigas /imoveis/... → /imoveis-a-venda/go/... (301)
// 3) Dois cookies de visitante, criados já na primeira requisição e repassados para
//    a própria requisição (a página enxerga na hora):
//    - mn_dev (2 anos): identifica o APARELHO — prende o link de anúncio privado a ele.
//    - mn_sessao (até fechar o navegador): "semente" da ordem aleatória do feed.
export function middleware(req: NextRequest) {
  const host = req.headers.get('host');
  const { pathname, search } = req.nextUrl;

  if (ehDominioAntigo(host)) {
    const url = req.nextUrl.clone();
    url.pathname = '/api/antigo';
    url.search = `?p=${encodeURIComponent(pathname + search)}`;
    return NextResponse.rewrite(url);
  }

  // Arquivos e APIs: passam direto (no app também — upload de fotos, PDF.js, ícones do app)
  const tecnico = /^\/(api|pdfjs|icons|marca)\//.test(pathname) || /^\/(favicon|manifest|sw\.js|robots|sitemap|llms)/.test(pathname);
  if (tecnico) return NextResponse.next();

  if (ehHostApp(host)) {
    if (pathname === '/' || pathname === '') return NextResponse.redirect(`${APP_URL}/dashboard`, 308);
    if (pathname === '/painel' || pathname.startsWith('/painel/')) return NextResponse.redirect(`${APP_URL}/dashboard${pathname.slice(7)}${search}`, 308);
    if (!pathname.startsWith('/dashboard')) {
      const destino = new URL(pathname + search, `https://${host?.replace(/^app\./, '')}`);
      return NextResponse.redirect(destino, 308);
    }
    const res = NextResponse.next();
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return res;
  }

  if (ehHostPrincipal(host) && (pathname === '/dashboard' || pathname.startsWith('/dashboard/') || pathname === '/painel' || pathname.startsWith('/painel/'))) {
    const resto = pathname.replace(/^\/(dashboard|painel)/, '');
    return NextResponse.redirect(`${APP_URL}/dashboard${resto}${search}`, 308);
  }
  // Nos endereços da Vercel (…vercel.app) o /painel antigo vira /dashboard
  if (pathname === '/painel' || pathname.startsWith('/painel/')) {
    const url = req.nextUrl.clone();
    url.pathname = `/dashboard${pathname.slice(7)}`;
    return NextResponse.redirect(url, 308);
  }

  // Páginas de região: estrutura nova em silos com o estado (UF) na URL
  if (pathname === '/imoveis' || pathname.startsWith('/imoveis/')) {
    const url = req.nextUrl.clone();
    url.pathname = pathname === '/imoveis' ? '/imoveis-a-venda' : `/imoveis-a-venda/go${pathname.slice(8)}`;
    return NextResponse.redirect(url, 301);
  }

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
  matcher: ['/((?!_next/).*)']
};
