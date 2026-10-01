// Gravação de notícias: usada pelo painel (Admin News) e pela API de publicação por IA.
import { randomBytes } from 'crypto';
import { query } from '../db';
import { slugNews, topicoValido, UFS, type Noticia } from './base';
import { mapNoticia } from './dados';
import { gerarCapa16x9 } from './capa';

export type NoticiaEntrada = {
  id?: string;
  titulo: string;
  linhaFina?: string | null;
  corpo?: string;
  resumo?: string[];
  faq?: { p: string; r: string }[];
  capa?: string | null;
  capaAlt?: string | null;
  videoUrl?: string | null;
  topico?: string;
  tags?: string[];
  uf?: string | null;
  cidade?: string | null;
  bairro?: string | null;
  empreendimentoId?: string | null;
  autor?: string;
  status?: 'rascunho' | 'agendada' | 'publicada';
  principal?: boolean;
  seoTitulo?: string | null;
  seoDescricao?: string | null;
  fontes?: { nome: string; url?: string }[];
  agendadoPara?: string | null;
  slug?: string;
  focoImoveis?: string;
};

const t = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '') || null;
const url = (v: unknown) => {
  const s = t(v, 1000);
  return s && /^https:\/\//.test(s) ? s : null;
};

export async function gravarNoticia(e: NoticiaEntrada, quem: { email?: string | null; origem: string }): Promise<{ ok: true; noticia: Noticia } | { ok: false; erro: string }> {
  const titulo = t(e.titulo, 200);
  if (!titulo) return { ok: false, erro: 'Informe o título.' };
  const topico = e.topico && topicoValido(e.topico) ? e.topico : 'mercado';
  const uf = e.uf && UFS[e.uf.toUpperCase()] ? e.uf.toUpperCase() : null;
  const status = e.status === 'publicada' || e.status === 'agendada' ? e.status : 'rascunho';
  const agendado = e.agendadoPara && !Number.isNaN(Date.parse(e.agendadoPara)) ? new Date(e.agendadoPara).toISOString() : null;
  if (status === 'agendada' && !agendado) return { ok: false, erro: 'Informe a data e a hora do agendamento.' };

  // slug único (título → endereço); na edição mantém o que já existe, salvo se pedido outro
  let slug = slugNews(e.slug || titulo) || 'noticia';
  const existe = async (s: string) => (await query('select 1 from noticias where slug = $1 and id <> $2', [s, e.id ?? ''])).length > 0;
  if (e.id && !e.slug) {
    const atual = await query<{ slug: string }>('select slug from noticias where id = $1', [e.id]);
    if (atual[0]) slug = atual[0].slug;
  }
  let n = 2;
  const base = slug;
  while (await existe(slug)) slug = `${base}-${n++}`;

  const lista = (v: unknown, max: number, len: number) => (Array.isArray(v) ? v.map((x) => t(x, len)).filter(Boolean).slice(0, max) : []);
  const faq = Array.isArray(e.faq) ? e.faq.map((f) => ({ p: t(f?.p, 300), r: t(f?.r, 1500) })).filter((f) => f.p && f.r).slice(0, 10) : [];
  const fontes = Array.isArray(e.fontes) ? e.fontes.map((f) => ({ nome: t(f?.nome, 200), url: url(f?.url) ?? undefined })).filter((f) => f.nome).slice(0, 20) : [];

  const vals = [
    slug,
    titulo,
    t(e.linhaFina, 400),
    String(e.corpo ?? '').slice(0, 100000),
    JSON.stringify(lista(e.resumo, 5, 300)),
    JSON.stringify(faq),
    url(e.capa),
    t(e.capaAlt, 300),
    url(e.videoUrl),
    topico,
    JSON.stringify(lista(e.tags, 15, 60)),
    uf,
    t(e.cidade, 100),
    t(e.bairro, 100),
    t(e.empreendimentoId, 80),
    t(e.autor, 100) ?? 'Leyde Duarte',
    status,
    !!e.principal,
    t(e.seoTitulo, 70),
    t(e.seoDescricao, 170),
    JSON.stringify(fontes),
    agendado,
    ['geral', 'horizontal', 'vertical', 'comercial'].includes(String(e.focoImoveis)) ? e.focoImoveis : 'auto'
  ];
  const r = e.id
    ? await query<Record<string, unknown>>(
        `update noticias set slug=$2, titulo=$3, linha_fina=$4, corpo=$5, resumo=$6::jsonb, faq=$7::jsonb, capa=$8, capa_alt=$9, video_url=$10,
           topico=$11, tags=$12::jsonb, uf=$13, cidade=$14, bairro=$15, empreendimento_id=$16, autor=$17, status=$18, principal=$19,
           seo_titulo=$20, seo_descricao=$21, fontes=$22::jsonb, agendado_para=$23, foco_imoveis=$24,
           capa_16x9 = case when capa is distinct from $8 then null else capa_16x9 end,
           publicado_em = case when $18 = 'publicada' then coalesce(publicado_em, now()) when $18 = 'agendada' then $23::timestamptz else publicado_em end,
           updated_at = now()
         where id = $1 returning *`,
        [e.id, ...vals]
      )
    : await query<Record<string, unknown>>(
        `insert into noticias (id, slug, titulo, linha_fina, corpo, resumo, faq, capa, capa_alt, video_url, topico, tags, uf, cidade, bairro,
           empreendimento_id, autor, status, principal, seo_titulo, seo_descricao, fontes, agendado_para, foco_imoveis, publicado_em, autor_email, origem)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,$23,$24,
           case when $18 = 'publicada' then now() when $18 = 'agendada' then $23::timestamptz else null end, $25, $26)
         returning *`,
        [`not-${randomBytes(6).toString('hex')}`, ...vals, quem.email ?? null, quem.origem]
      );
  if (!r[0]) return { ok: false, erro: 'Notícia não encontrada.' };
  if (r[0].capa && (!r[0].capa_16x9 || String(r[0].capa_16x9) === '' || !String(r[0].capa_16x9).includes(String(r[0].slug)))) {
    const nova = await gerarCapa16x9(String(r[0].id)).catch(() => null);
    if (nova) r[0].capa_16x9 = nova;
  }
  // só uma principal por vez
  if (e.principal) await query('update noticias set principal = false where id <> $1 and principal', [r[0].id]);
  return { ok: true, noticia: mapNoticia(r[0]) };
}
