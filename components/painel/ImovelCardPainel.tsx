'use client';

import Link from 'next/link';
import type { ImovelPainel } from '@/lib/actions-painel-imoveis';
import { TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';
import { MenuAcoes } from './ui';

export const brlPainel = (v: number | null) => (v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : null);
export const whats = (d?: string | null) => {
  const n = (d ?? '').replace(/\D/g, '');
  return n.length >= 10 ? `https://wa.me/${n.startsWith('55') ? n : `55${n}`}` : null;
};

type ItemMenu = Parameters<typeof MenuAcoes>[0]['itens'][number];

// Card do painel: foto à esquerda, dados à direita, proprietário e ações embaixo.
// Clicar na foto/título abre a ficha dentro do painel.
export default function ImovelCardPainel({
  i,
  selecionado,
  onSelecionar,
  onPrivar,
  onCompartilhar,
  menu
}: {
  i: ImovelPainel;
  selecionado: boolean;
  onSelecionar: () => void;
  onPrivar: () => void;
  onCompartilhar: () => void;
  menu: ItemMenu[];
}) {
  const dono = i.proprietarios.find((p) => p.principal) ?? i.proprietarios[0];
  const w = whats(dono?.whatsapp);
  const tipo = TIPO_UNIDADE_LABEL[i.tipo as TipoUnidade] ?? i.tipo;
  const ficha = `/dashboard/imoveis/${i.id}`;
  return (
    <div
      className={`group flex flex-col rounded-[20px] border bg-[var(--bg)] transition hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] ${
        selecionado ? 'border-ink ring-1 ring-ink' : 'border-[var(--border)]'
      }`}
    >
      <div className="flex gap-3 p-3">
        <div className="relative h-[112px] w-[128px] shrink-0 overflow-hidden rounded-xl bg-[var(--card-img-bg)] md:h-[120px] md:w-[144px]">
          <Link href={ficha} className="block h-full w-full">
            {i.capa ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={i.capa} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
            ) : (
              <div className="grid h-full place-items-center text-[11px] text-[var(--text-faint)]">sem foto</div>
            )}
          </Link>
          <label className="absolute left-1.5 top-1.5 grid h-6 w-6 cursor-pointer place-items-center rounded-full bg-white/90 shadow" title="Selecionar">
            <input type="checkbox" checked={selecionado} onChange={onSelecionar} className="h-3.5 w-3.5 accent-[#14161a]" />
          </label>
          {i.vendidoEm && <span className="absolute right-1.5 top-1.5 rounded-full bg-[#e62f2f] px-2 py-0.5 text-[9.5px] font-bold tracking-wide text-white">VENDIDO</span>}
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[10.5px] font-medium text-white backdrop-blur">
            {i.fotos.length} foto(s){i.fotosInternas.length ? ` · ${i.fotosInternas.length} oculta(s)` : ''}
          </span>
        </div>

        <Link href={ficha} className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">{tipo}</span>
            {i.visibilidade === 'privado' && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-white">Privado</span>}
            {i.destaque && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">★ Destaque</span>}
            {i.codigo && <span className="text-[11px] font-medium text-[var(--text-muted)]">cód. {i.codigo}</span>}
          </div>
          <div className="mt-1.5 truncate text-[15px] font-bold leading-tight">{i.condominio ?? i.titulo ?? tipo}</div>
          <div className="truncate text-[12px] text-[var(--text-muted)]">
            {[i.complemento, i.bairro, i.cidade].filter(Boolean).join(' · ')}
          </div>
          <div className="mt-1 text-[18px] font-bold leading-none tracking-tight">{brlPainel(i.preco) ?? 'Sem valor'}</div>
          <div className="mt-1 text-[11.5px] text-[var(--text-muted)]">
            {[
              i.area ? `${i.area} m²` : null,
              i.areaLote ? `lote ${i.areaLote} m²` : null,
              i.quartos ? `${i.quartos} qts` : null,
              i.banheiros ? `${i.banheiros} bh` : null,
              i.vagas ? `${i.vagas} vg` : null
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
          {(i.valorCondominio || i.iptuMensal) && (
            <div className="text-[11px] text-[var(--text-muted)]">
              {[i.valorCondominio ? `Cond. ${brlPainel(i.valorCondominio)}` : null, i.iptuMensal ? `IPTU ${brlPainel(i.iptuMensal)}` : null].filter(Boolean).join(' · ')}
            </div>
          )}
        </Link>
      </div>

      {i.descricao && <p className="mx-3 -mt-1 mb-2 line-clamp-2 text-[12px] leading-snug text-[var(--text-muted)]">{i.descricao.replace(/[#*_>-]+/g, ' ')}</p>}
      {i.obsInterna && (
        <div className="mx-3 -mt-1 mb-2 line-clamp-2 rounded-xl bg-amber-50 px-2.5 py-1.5 text-[11.5px] text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>OBS:</strong> {i.obsInterna}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 px-3 pb-3">
        <div className="flex min-w-0 items-center gap-1.5">
          {dono ? (
            <>
              <span className="truncate text-[12px] font-medium">{dono.nome}</span>
              {w && (
                <a href={w} target="_blank" rel="noopener" className="shrink-0 rounded-full bg-[#E7F5E6] px-2.5 py-1 text-[11px] font-semibold text-[#0A8A00]">
                  WhatsApp
                </a>
              )}
            </>
          ) : (
            <span className="text-[11.5px] text-[var(--text-faint)]">Sem proprietário</span>
          )}
          <span className="ml-1 hidden shrink-0 text-[11px] text-[var(--text-faint)] xl:inline" title="Visualizações · salvamentos · compartilhamentos">
            👁 {i.visualizacoes} · ♥ {i.salvamentos} · ↗ {i.compartilhamentos}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onPrivar}
            title={i.visibilidade === 'privado' ? 'Tornar público' : 'Privar anúncio'}
            className="grid h-8 w-8 place-items-center rounded-full bg-[var(--pill-bg)] text-[13px] transition hover:bg-[var(--pill-bg-hover)]"
          >
            {i.visibilidade === 'privado' ? '🔓' : '🔒'}
          </button>
          {i.visibilidade !== 'privado' && (
            <button
              type="button"
              onClick={onCompartilhar}
              title="Compartilhar com corretor (sem nossos contatos)"
              className="grid h-8 w-8 place-items-center rounded-full bg-[var(--pill-bg)] text-[13px] transition hover:bg-[var(--pill-bg-hover)]"
            >
              ↗
            </button>
          )}
          <Link href={`/dashboard/imoveis/${i.id}/editar`} title="Editar" className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[13px] text-white hover:opacity-90">
            ✎
          </Link>
          <MenuAcoes itens={menu} />
        </div>
      </div>
    </div>
  );
}
