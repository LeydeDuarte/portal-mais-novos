import { NextResponse, type NextRequest } from 'next/server';

// Identificador do aparelho (cookie mn_dev, 2 anos). É o que prende um link de
// anúncio privado ao aparelho de quem recebeu. Criado já na primeira visita e
// repassado para a própria requisição, para a página enxergar na hora.
export function middleware(req: NextRequest) {
  if (req.cookies.get('mn_dev')?.value) return NextResponse.next();
  const id = crypto.randomUUID();
  const headers = new Headers(req.headers);
  const atual = req.headers.get('cookie');
  headers.set('cookie', `${atual ? `${atual}; ` : ''}mn_dev=${id}`);
  const res = NextResponse.next({ request: { headers } });
  res.cookies.set('mn_dev', id, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 730 });
  return res;
}

export const config = {
  matcher: ['/((?!_next/|pdfjs/|icons/|favicon|manifest|sw\\.js|robots|sitemap|api/).*)']
};
