// Peças do Mais Novos News (servidor). Cores e tags do portal.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { TOPICOS, nomeTopico, urlNoticia, urlRegiao, UFS, videoEmbed, miniaturaVideo, minutosLeitura, textoPuro, type Noticia } from '@/lib/news/base';
import { mesAno, pct, type Indicador } from '@/lib/indicadores';
import { INSTAGRAM_DIRECT } from '@/lib/marca';
import { regioesComNoticias, type BannerAtivo } from '@/lib/news/dados';
import { mercadoPorBairro } from '@/lib/news/mercado';
import { lerIndicadores } from '@/lib/indicadores';
import { SeletorRegiao } from './SeletorRegiao';
import BotaoInstagram from './BotaoInstagram';

export const dataCurta = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' }).replace('.', '') : '';

export function Marca({ tamanho = 'g' }: { tamanho?: 'g' | 'p' }) {
  const cls = tamanho === 'g' ? 'text-[30px] md:text-[40px]' : 'text-[22px] md:text-[26px]';
  return (
    <Link href="/news" className="flex items-baseline gap-2" aria-label="Mais Novos News">
      <span className={`font-serif font-bold tracking-tight ${cls}`}>Mais Novos</span>
      <span className={`font-serif italic text-accent ${cls}`}>News</span>
    </Link>
  );
}

export async function TopoNews({ ativo, q, regiaoAtual }: { ativo?: string; q?: string; regiaoAtual?: string }) {
  const [regioes, bairros, ind] = await Promise.all([regioesComNoticias(), mercadoPorBairro('GO', 8), lerIndicadores(2)]);
  const radar = [
    ...ind.filter((i) => i.valor != null && (i.id === 'selic' || i.id === 'incc-di' || i.id === 'ipca')).map((i) => ({ k: i.nome, v: i.id === 'selic' ? `${pct(i.valor)} a.a.` : `${pct(i.valor)} no mês`, href: `/news/indicadores?serie=${i.id}` })),
    ...bairros.map((b) => ({ k: b.nome, v: `R$ ${b.m2.toLocaleString('pt-BR')}/m²`, href: '/news/mercado' }))
  ];
  return (
    <>
    {radar.length > 0 && (
      // Radar do mercado: m² dos bairros (nossos dados) e indicadores do Banco Central
      <div className="w-full overflow-hidden bg-ink text-white">
        <div className="mx-auto flex h-10 max-w-6xl items-center gap-6 overflow-x-auto whitespace-nowrap px-5 text-[13px] [scrollbar-width:none] md:px-8">
          <span className="shrink-0 text-[11px] font-bold tracking-[0.08em] text-accent">RADAR DO MERCADO</span>
          {radar.map((r) => (
            <Link key={r.k} href={r.href} className="flex shrink-0 gap-1.5 hover:underline">
              <span className="text-[#B9C0CC]">{r.k}</span>
              <span className="font-semibold tabular-nums">{r.v}</span>
            </Link>
          ))}
        </div>
      </div>
    )}
    <div className="mx-auto w-full max-w-6xl px-5 pt-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Marca />
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <SeletorRegiao regioes={regioes} atual={regiaoAtual} />
          <form action="/news" className="flex h-11 min-w-[220px] flex-1 items-center gap-2 rounded-full border border-[var(--border)] px-4 text-sm md:max-w-[320px]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <label htmlFor="busca-news" className="sr-only">Buscar no News</label>
            <input id="busca-news" name="q" defaultValue={q} placeholder="Buscar bairro, condomínio ou assunto" className="min-w-0 flex-1 bg-transparent outline-none" />
          </form>
          {/* Canal do WhatsApp (variável NEXT_PUBLIC_WHATSAPP_CANAL) quando existir; até lá,
              pede o nome, grava em Interessados e abre a conversa com a Leyde */}
          {process.env.NEXT_PUBLIC_WHATSAPP_CANAL ? (
            <a href={process.env.NEXT_PUBLIC_WHATSAPP_CANAL} target="_blank" rel="noopener" data-rastro="canal" className="flex h-11 items-center rounded-full bg-[#25D366] px-4 text-sm font-semibold text-white">
              Seguir no WhatsApp
            </a>
          ) : (
            <BotaoInstagram rotulo="Seguir no Instagram" />
          )}
        </div>
      </div>
      <nav aria-label="Tópicos" className="mt-5 flex gap-2 overflow-x-auto border-y border-[var(--border)] py-3 [scrollbar-width:none]">
        <Chip href="/news" ativo={!ativo}>Tudo</Chip>
        {TOPICOS.map((t) => (
          <Chip key={t.id} href={`/news/${t.id}`} ativo={ativo === t.id}>
            {t.nome}
          </Chip>
        ))}
        <Chip href="/news/indicadores" ativo={ativo === 'indicadores'}>Indicadores</Chip>
      </nav>
    </div>
    </>
  );
}
function Chip({ href, ativo, children }: { href: string; ativo: boolean; children: ReactNode }) {
  return (
    <Link href={href} className={`flex h-9 shrink-0 items-center rounded-full px-4 text-sm ${ativo ? 'bg-ink font-semibold text-white' : 'bg-[var(--pill-bg)] font-medium'}`}>
      {children}
    </Link>
  );
}

/** Capa: vídeo (autoplay, mudo) ou foto */
export function Midia({ n, grande = false, className = '' }: { n: Noticia; grande?: boolean; className?: string }) {
  const embed = grande ? videoEmbed(n.videoUrl) : null;
  const img = n.capa || miniaturaVideo(n.videoUrl);
  return (
    <div className={`relative overflow-hidden bg-[#20242C] ${className}`}>
      {embed ? (
        <>
          <iframe
            src={embed}
            title={n.titulo}
            allow="autoplay; encrypted-media; picture-in-picture"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 border-0"
            loading="lazy"
          />
          <span className="absolute left-3 top-3 z-10 rounded-md bg-black/55 px-2 py-1 text-[11px] font-bold text-white">▶ VÍDEO · sem som</span>
        </>
      ) : img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt={n.capaAlt || n.titulo} className="absolute inset-0 h-full w-full object-cover" loading={grande ? 'eager' : 'lazy'} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--pill-bg)] p-4 text-center font-serif text-lg font-semibold text-[var(--text-muted)]">
          {nomeTopico(n.topico)}
        </div>
      )}
      {!embed && n.videoUrl && (
        <span className="absolute left-3 top-3 rounded-md bg-black/55 px-2 py-1 text-[11px] font-bold text-white">▶ VÍDEO</span>
      )}
    </div>
  );
}

const Rotulo = ({ n }: { n: Noticia }) => (
  <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-accent">
    {nomeTopico(n.topico)}
    {n.bairro ? <span className="text-[var(--text-muted)]"> · {n.bairro}</span> : n.cidade ? <span className="text-[var(--text-muted)]"> · {n.cidade}</span> : null}
  </span>
);

export function CardNoticia({ n, variante = 'medio' }: { n: Noticia; variante?: 'principal' | 'medio' | 'linha' }) {
  const min = minutosLeitura(textoPuro(n.corpo));
  if (variante === 'principal')
    return (
      <article className="flex flex-col gap-4">
        <div className="relative">
          <Midia n={n} grande className="aspect-[4/5] rounded-[20px] md:aspect-[16/9]" />
          {/* a foto/vídeo inteiro abre a notícia */}
          <Link href={urlNoticia(n)} aria-label={n.titulo} className="absolute inset-0 z-20 rounded-[20px]" />
        </div>
        <Rotulo n={n} />
        <Link href={urlNoticia(n)}>
          <h2 className="font-serif text-[30px] font-semibold leading-[1.06] tracking-tight md:text-[46px]">{n.titulo}</h2>
        </Link>
        {n.linhaFina && <p className="max-w-[760px] text-[17px] leading-relaxed text-[var(--text-muted)] md:text-[19px]">{n.linhaFina}</p>}
        <p className="text-[13px] text-[var(--text-muted)]">
          <strong className="text-ink">{n.autor}</strong> · {min} min de leitura · {dataCurta(n.publicadoEm)}
        </p>
      </article>
    );
  if (variante === 'linha')
    return (
      <Link href={urlNoticia(n)} className="flex gap-3.5">
        <Midia n={n} className="h-[78px] w-[104px] shrink-0 rounded-xl md:h-24 md:w-32" />
        <span className="flex min-w-0 flex-col gap-1">
          <Rotulo n={n} />
          <span className="text-[15px] font-semibold leading-snug md:text-[17px]">{n.titulo}</span>
          <span className="text-xs text-[var(--text-muted)]">
            {min} min · {dataCurta(n.publicadoEm)}
          </span>
        </span>
      </Link>
    );
  return (
    <Link href={urlNoticia(n)} className="flex flex-col gap-3">
      <Midia n={n} className="aspect-[16/10] rounded-2xl" />
      <Rotulo n={n} />
      <span className="font-serif text-[21px] font-semibold leading-tight md:text-[24px]">{n.titulo}</span>
      <span className="text-[13px] text-[var(--text-muted)]">
        {min} min · {n.autor}
      </span>
    </Link>
  );
}

export function MaisLidas({ itens }: { itens: Noticia[] }) {
  if (!itens.length) return null;
  return (
    <div>
      <h2 className="mb-2 text-[13px] font-bold tracking-[0.1em]">MAIS LIDAS</h2>
      {itens.map((n, i) => (
        <Link key={n.id} href={urlNoticia(n)} className="flex gap-3.5 border-b border-[var(--border)] py-3">
          <span className="w-6 font-serif text-[30px] font-semibold leading-none text-accent">{i + 1}</span>
          <span className="text-[15px] font-semibold leading-snug">{n.titulo}</span>
        </Link>
      ))}
    </div>
  );
}

export function Regioes({ lista, atual }: { lista: { uf: string; cidade: string | null; n: number }[]; atual?: string }) {
  if (!lista.length) return null;
  const ufs = lista.filter((r) => !r.cidade);
  return (
    <nav aria-label="Notícias por região" className="rounded-2xl bg-[var(--pill-bg)] p-4">
      <h2 className="mb-2 text-[13px] font-bold tracking-[0.1em]">NOVIDADES POR REGIÃO</h2>
      {ufs.map((u) => (
        <div key={u.uf} className="mb-1">
          <Link href={urlRegiao(u.uf)} className={`flex justify-between rounded-lg px-2 py-2 text-sm font-bold ${atual === u.uf ? 'bg-[var(--bg)]' : ''}`}>
            <span>{UFS[u.uf] ?? u.uf}</span>
            <span className="font-medium text-[var(--text-muted)]">{u.n}</span>
          </Link>
          {lista
            .filter((c) => c.uf === u.uf && c.cidade)
            .slice(0, 8)
            .map((c) => (
              <Link key={c.cidade} href={urlRegiao(c.uf, c.cidade)} className={`flex justify-between rounded-lg py-1.5 pl-5 pr-2 text-sm ${atual === `${c.uf}/${c.cidade}` ? 'bg-[var(--bg)] font-semibold' : ''}`}>
                <span>{c.cidade}</span>
                <span className="text-[var(--text-muted)]">{c.n}</span>
              </Link>
            ))}
        </div>
      ))}
    </nav>
  );
}

/** Espaço de publicidade: banner ativo da posição (imagem ou vídeo vertical do YouTube/Vimeo),
 *  ou o convite "Anuncie aqui". Vídeo sempre vertical (9:16), preenchendo o quadro sem bordas. */
export function Banner({ banners, posicao, className = '' }: { banners: BannerAtivo[]; posicao: string; className?: string }) {
  const b = banners.find((x) => x.posicao === posicao);
  const formato = posicao === 'perfil' ? 'aspect-[9/16]' : posicao === 'lateral-grande' ? 'aspect-[1/2]' : posicao === 'texto' ? 'aspect-[728/120]' : 'aspect-[6/5]';
  if (!b)
    return (
      <a
        href={INSTAGRAM_DIRECT}
        target="_blank"
        rel="noopener"
        data-rastro="anuncie"
        className={`flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-[#C9CED6] bg-[#F6F7F9] p-4 text-center text-[13px] text-[var(--text-muted)] ${posicao === 'perfil' ? 'aspect-[4/3]' : formato} ${className}`}
      >
        <span className="text-[10px] font-bold tracking-[0.12em]">PUBLICIDADE</span>
        <span className="font-semibold text-ink">Anuncie aqui</span>
        <span>Fale com a gente no Instagram</span>
      </a>
    );
  const video = videoEmbed(b.video_url);
  const conteudo = video ? (
    // vertical: o player ocupa o quadro 9:16 inteiro, levemente ampliado para não sobrar borda
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl bg-ink">
      <iframe
        src={video}
        title={b.titulo ?? 'Publicidade'}
        allow="autoplay; encrypted-media; picture-in-picture"
        loading="lazy"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[104%] w-[104%] -translate-x-1/2 -translate-y-1/2 border-0"
      />
      {b.link && <span className="absolute inset-x-3 bottom-3 rounded-full bg-white/90 py-2 text-center text-[13px] font-bold text-ink">Saiba mais →</span>}
    </div>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={b.imagem ?? ''} alt={b.titulo ?? 'Publicidade'} className={`w-full rounded-2xl object-cover ${formato}`} loading="lazy" />
  );
  return (
    <div className={className}>
      <span className="mb-1 block text-center text-[10px] font-bold tracking-[0.12em] text-[var(--text-faint)]">PUBLICIDADE</span>
      {b.link ? (
        <a href={b.link} target="_blank" rel="noopener sponsored" className="block" data-rastro="banner" data-rastro-ref={b.id}>
          {conteudo}
        </a>
      ) : (
        conteudo
      )}
    </div>
  );
}

/** Minigráfico de linha (SVG) */
export function Linha({ valores, altura = 34, className = '' }: { valores: number[]; altura?: number; className?: string }) {
  if (valores.length < 2) return null;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const pts = valores.map((v, i) => `${(i / (valores.length - 1)) * 160},${altura - 3 - ((v - min) / (max - min || 1)) * (altura - 6)}`).join(' ');
  return (
    <svg viewBox={`0 0 160 ${altura}`} preserveAspectRatio="none" className={`h-[34px] w-full ${className}`} aria-hidden>
      <polyline points={pts} fill="none" stroke="#257CFF" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function FaixaIndicadores({ lista }: { lista: Indicador[] }) {
  const com = lista.filter((i) => i.valor != null);
  if (!com.length) return null;
  return (
    <section aria-label="Indicadores do mês">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-serif text-[26px] font-semibold md:text-[30px]">Indicadores do mês</h2>
        <span className="text-[13px] text-[var(--text-muted)]">Fonte: Banco Central (SGS), IBGE e FGV · atualiza sozinho</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {com.map((i) => (
          <Link key={i.id} href={`/news/indicadores?serie=${i.id}`} className="flex flex-col gap-1 rounded-2xl border border-[var(--border)] p-4 hover:border-accent">
            <span className="text-xs font-bold tracking-wide text-[var(--text-muted)]">{i.nome.toUpperCase()}</span>
            <span className="font-sans text-[24px] font-bold tabular-nums">{i.id === 'selic' ? `${pct(i.valor)} a.a.` : pct(i.valor)}</span>
            <span className="text-xs text-[var(--text-muted)]">
              {i.id === 'selic' ? `meta do Copom · ${mesAno(i.data)}` : `${mesAno(i.data)}${i.acumulado12 != null ? ` · ${pct(i.acumulado12)} em 12 meses` : ''}`}
            </span>
            <Linha valores={i.historico.slice(-12).map((h) => h.valor)} />
            <span className="text-xs font-semibold text-accent">Ver gráfico →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
