// Texto da notícia: parágrafos, subtítulos, citações, listas, imagens e os blocos
// especiais ([[imoveis]], [[dados]], [[video]], [[banner]], [[leia]]).
import Link from 'next/link';
import type { ReactNode } from 'react';
import { blocosDoTexto, urlNoticia, videoEmbed, type Bloco } from '@/lib/news/base';
import { condominiosParaLink, noticiaPorSlug } from '@/lib/news/dados';
import { imoveisDoBairro } from '@/lib/news/imoveis';
import { mercadoDoBairro } from '@/lib/actions';
import RelatedListings from '@/components/RelatedListings';
import { Banner } from './Pecas';

type FocoFixo = 'horizontal' | 'vertical' | 'comercial' | null;
const TITULO_FOCO: Record<string, string> = { horizontal: 'Casas em condomínio à venda', vertical: 'Apartamentos à venda', comercial: 'Imóveis comerciais à venda' };
const brl = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;

/** **negrito**, *itálico* e [texto](link) */
export function Inline({ texto }: { texto: string }) {
  const partes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\((?:https?:\/\/|\/)[^)\s]+\))/g;
  let ult = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(texto))) {
    if (m.index > ult) partes.push(texto.slice(ult, m.index));
    const s = m[0];
    // negrito e itálico podem ter link dentro (o nome do condomínio vira link automático
    // mesmo quando está em **negrito**), então o conteúdo passa de novo por aqui
    if (s.startsWith('**')) partes.push(<strong key={k++}><Inline texto={s.slice(2, -2)} /></strong>);
    else if (s.startsWith('*')) partes.push(<em key={k++}><Inline texto={s.slice(1, -1)} /></em>);
    else {
      const [, t, u] = s.match(/\[([^\]]+)\]\(([^)]+)\)/)!;
      const interno = u.startsWith('/') || u.includes('maisnovosimoveis.com');
      partes.push(
        interno ? (
          <Link key={k++} href={u.replace(/^https?:\/\/(www\.)?maisnovosimoveis\.com/, '') || '/'} className="font-semibold text-accent underline underline-offset-2">
            <Inline texto={t} />
          </Link>
        ) : (
          <a key={k++} href={u} target="_blank" rel="noopener" className="font-semibold text-accent underline underline-offset-2">
            <Inline texto={t} />
          </a>
        )
      );
    }
    ult = m.index + s.length;
  }
  if (ult < texto.length) partes.push(texto.slice(ult));
  return <>{partes}</>;
}

async function BlocoEspecial({ b, banners, foco }: { b: Bloco; banners: Parameters<typeof Banner>[0]['banners']; foco?: FocoFixo }) {
  if (b.t === 'imoveis') {
    const itens = await imoveisDoBairro(b.bairro, b.cidade, b.qtd, b.tipo ?? foco ?? null);
    if (!itens.length) return null;
    const oque = TITULO_FOCO[b.tipo ?? foco ?? ''] ?? 'À venda';
    return (
      <div className="rounded-[20px] bg-[var(--pill-bg)] p-5 [&>section]:mt-0">
        <RelatedListings grade title={`${oque} ${b.bairro ? `no ${b.bairro}` : b.cidade ? `em ${b.cidade}` : ''} agora`.replace(/\s+agora$/, ' agora')} items={itens} limite={b.qtd} />
      </div>
    );
  }
  if (b.t === 'dados') {
    const m = await mercadoDoBairro(b.cidade ?? 'Goiânia', b.bairro);
    if (!m || (!m.m2Anunciado && !m.anuncios)) return null;
    const hoje = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return (
      <div className="not-prose rounded-[20px] border border-[var(--border)] p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-serif text-[21px] font-semibold">{m.bairro} em números</span>
          <span className="text-xs text-[var(--text-muted)]">Fonte: Mais Novos Imóveis · {hoje}</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { v: m.m2Anunciado ? `${brl(m.m2Anunciado)}/m²` : '-', r: 'média dos anúncios no bairro' },
            { v: String(m.anuncios), r: 'imóveis à venda agora' },
            { v: String(m.vendidos12m), r: `vendidos em 12 meses${m.m2Vendido ? ` (${brl(m.m2Vendido)}/m²)` : ''}` }
          ].map((x) => (
            <div key={x.r} className="rounded-xl bg-[var(--pill-bg)] p-4">
              <div className="font-sans text-[24px] font-bold tabular-nums">{x.v}</div>
              <div className="text-[13px] text-[var(--text-muted)]">{x.r}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (b.t === 'video') {
    const src = videoEmbed(b.url);
    return src ? (
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#20242C]">
        <iframe src={src.replace('controls=0', 'controls=1')} title="Vídeo" allow="autoplay; encrypted-media; picture-in-picture" className="absolute inset-0 h-full w-full border-0" loading="lazy" />
      </div>
    ) : null;
  }
  if (b.t === 'banner') return <Banner banners={banners} posicao="texto" />;
  if (b.t === 'leia') {
    const n = await noticiaPorSlug(b.slug);
    return n ? (
      <Link href={urlNoticia(n)} className="block rounded-2xl border-l-0 bg-[var(--pill-bg)] p-4 no-underline">
        <span className="text-[11px] font-bold tracking-[0.1em] text-accent">LEIA TAMBÉM</span>
        <span className="mt-1 block font-serif text-[19px] font-semibold leading-snug text-ink">{n.titulo}</span>
      </Link>
    ) : null;
  }
  return null;
}

/** Transforma a 1ª menção de cada condomínio cadastrado em link para a página dele */
function linkarCondominios(texto: string, condos: { nome: string; url: string }[], usados: Set<string>): string {
  let out = texto;
  for (const c of condos) {
    if (usados.has(c.url) || !out.includes(c.nome)) continue;
    if (out.includes(`[${c.nome}](`)) {
      usados.add(c.url); // já tem link escrito à mão
      continue;
    }
    // ignora se o nome já está dentro de um link [..](..)
    const esc = c.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^\\[\\p{L}])(${esc})(?![\\p{L}\\]])(?![^\\[]*\\]\\()`, 'u');
    if (re.test(out)) {
      out = out.replace(re, `$1[$2](${c.url})`);
      usados.add(c.url);
    }
  }
  return out;
}

export default async function Corpo({ corpo, banners, foco }: { corpo: string; banners: Parameters<typeof Banner>[0]['banners']; foco?: FocoFixo }) {
  const condos = await condominiosParaLink();
  const usados = new Set<string>(Array.from(corpo.matchAll(/\]\((\/empreendimento\/[^)]+)\)/g)).map((m) => m[1]));
  const blocos = blocosDoTexto(corpo).map((b) =>
    b.t === 'p' || b.t === 'citacao' ? { ...b, texto: linkarCondominios(b.texto, condos, usados) } : b.t === 'lista' ? { ...b, itens: b.itens.map((i) => linkarCondominios(i, condos, usados)) } : b
  );
  return (
    <div className="flex flex-col gap-5 text-[17.5px] leading-[1.75] text-[#22262E] md:text-[18px]">
      {blocos.map((b, i) => {
        switch (b.t) {
          case 'p':
            return (
              <p key={i}>
                <Inline texto={b.texto} />
              </p>
            );
          case 'h2':
            return (
              <h2 key={i} id={b.id} className="mt-3 scroll-mt-24 font-serif text-[26px] font-semibold leading-tight text-ink md:text-[32px]">
                {b.texto}
              </h2>
            );
          case 'h3':
            return (
              <h3 key={i} id={b.id} className="mt-2 scroll-mt-24 text-[20px] font-bold text-ink">
                {b.texto}
              </h3>
            );
          case 'citacao':
            return (
              <blockquote key={i} className="my-2 font-serif text-[23px] italic leading-snug text-ink md:text-[28px]">
                <Inline texto={b.texto} />
              </blockquote>
            );
          case 'lista':
            return (
              <ul key={i} className="flex list-none flex-col gap-2 pl-0">
                {b.itens.map((it, j) => (
                  <li key={j} className="flex gap-2.5">
                    <span className="font-bold text-accent">›</span>
                    <span>
                      <Inline texto={it} />
                    </span>
                  </li>
                ))}
              </ul>
            );
          case 'imagem':
            return (
              <figure key={i} className="flex flex-col gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.url} alt={b.legenda || ''} className="w-full rounded-2xl" loading="lazy" />
                {b.legenda && <figcaption className="text-[13px] text-[var(--text-muted)]">{b.legenda}</figcaption>}
              </figure>
            );
          default:
            return <BlocoEspecial key={i} b={b} banners={banners} foco={foco} />;
        }
      })}
    </div>
  );
}
