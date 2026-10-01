import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashChave } from '@/lib/news/actions';
import { gravarNoticia, type NoticiaEntrada } from '@/lib/news/gravar';
import { prepararFoto } from '@/lib/fotos-fila';
import { enviarParaR2, r2Configurado } from '@/lib/r2';
import { SITE_URL } from '@/lib/seo';
import { urlNoticia } from '@/lib/news/base';

// Publicação de notícias por IA (Claude ou outra), com a chave gerada em Painel → News.
//   POST /api/news   Authorization: Bearer mnn_...
//   corpo JSON: { titulo, linhaFina, corpo, resumo[], faq[{p,r}], topico, uf, cidade, bairro, tags[],
//                 capaUrl (https: a imagem é baixada e guardada no nosso armazenamento), capaAlt,
//                 videoUrl, fontes[{nome,url}], status: "rascunho" | "publicada" | "agendada", agendadoPara }
// Sem "status", entra como rascunho para a equipe revisar.
export const maxDuration = 60;

export async function POST(request: Request) {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token.startsWith('mnn_')) return NextResponse.json({ erro: 'Chave ausente.' }, { status: 401 });
  const chave = await query<{ id: string; nome: string }>('select id, nome from news_chaves where hash = $1 and ativa', [await hashChave(token)]);
  if (!chave[0]) return NextResponse.json({ erro: 'Chave inválida ou revogada.' }, { status: 401 });
  await query('update news_chaves set ultimo_uso = now() where id = $1', [chave[0].id]);

  let e: NoticiaEntrada & { capaUrl?: string };
  try {
    e = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Envie JSON.' }, { status: 400 });
  }
  // capa: baixa a imagem e guarda no nosso armazenamento (nunca aponta para site de terceiro)
  if (e.capaUrl && /^https:\/\//.test(e.capaUrl) && !r2Configurado().length) {
    try {
      const r = await fetch(e.capaUrl, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const pronta = await prepararFoto(Buffer.from(await r.arrayBuffer()), r.headers.get('content-type') ?? '');
      e.capa = await enviarParaR2(pronta.buf, pronta.tipo, 'noticias', e.titulo || 'noticia');
    } catch (err) {
      return NextResponse.json({ erro: `Não consegui baixar a capa: ${err instanceof Error ? err.message : String(err)}` }, { status: 400 });
    }
  }
  const r = await gravarNoticia({ ...e, id: undefined }, { email: `ia:${chave[0].nome}`, origem: 'ia' });
  if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 400 });
  return NextResponse.json({ ok: true, id: r.noticia.id, status: r.noticia.status, url: `${SITE_URL}${urlNoticia(r.noticia)}` });
}
