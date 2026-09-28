'use client';

import Link from 'next/link';
import type { ImovelPainel } from '@/lib/actions-painel-imoveis';
import { TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';

export const brlPainel = (v: number | null) => (v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : null);
export const whats = (d?: string | null) => {
  const n = (d ?? '').replace(/\D/g, '');
  return n.length >= 10 ? `https://wa.me/${n.startsWith('55') ? n : `55${n}`}` : null;
};

// Card compacto do painel: tudo do imóvel num relance. Clicar abre a ficha
// dentro do painel (não a página pública).
export default function ImovelCardPainel({
  i,
  onPrivar,
  onCompartilhar,
  onMais
}: {
  i: ImovelPainel;
  onPrivar: () => void;
  onCompartilhar: () => void;
  onMais: () => void;
}) {
  const dono = i.proprietarios.find((p) => p.principal) ?? i.proprietarios[0];
  const w = whats(dono?.whatsapp);
  const tipo = TIPO_UNIDADE_LABEL[i.tipo as TipoUnidade] ?? i.tipo;
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[12.5px] transition-shadow hover:shadow-md">
      <Link href={`/dashboard/imoveis/${i.id}`} className="block">
        <div className="relative aspect-[4/3] bg-[var(--card-img-bg)]">
          {i.capa ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={i.capa} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] text-[var(--text-faint)]">sem foto</div>
          )}
          <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
            {i.visibilidade === 'privado' && <span className="rounded bg-ink px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-white">Privado</span>}
            {i.vendidoEm && <span className="rounded bg-[#e62f2f] px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-white">Vendido</span>}
            {i.fotosInternas.length > 0 && <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[9.5px] font-bold text-white">{i.fotosInternas.length} oculta(s)</span>}
          </div>
          <div className="absolute bottom-1.5 right-1.5 flex gap-1 text-[10px] font-bold text-white">
            <span className="rounded bg-black/55 px-1.5 py-0.5" title="Visualizações">👁 {i.visualizacoes}</span>
            <span className="rounded bg-black/55 px-1.5 py-0.5" title="Salvamentos">♥ {i.salvamentos}</span>
            <span className="rounded bg-black/55 px-1.5 py-0.5" title="Compartilhamentos">↗ {i.compartilhamentos}</span>
          </div>
        </div>
        <div className="flex flex-col gap-0.5 px-2.5 pt-2">
          <div className="truncate font-bold">{i.condominio ?? tipo}</div>
          <div className="truncate text-[var(--text-muted)]">
            {tipo}
            {i.complemento ? ` · ${i.complemento}` : ''} · {[i.bairro, i.cidade].filter(Boolean).join(', ')}
          </div>
          <div className="text-[var(--text-muted)]">
            {[
              i.area ? `${i.area} m²` : null,
              i.areaLote ? `lote ${i.areaLote} m²` : null,
              i.quartos ? `${i.quartos} qt` : null,
              i.banheiros ? `${i.banheiros} bh` : null,
              i.vagas ? `${i.vagas} vg` : null
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
          <div className="mt-0.5 text-[14px] font-bold">{brlPainel(i.preco) ?? 'Sem valor'}</div>
          {(i.valorCondominio || i.iptuMensal) && (
            <div className="text-[11px] text-[var(--text-muted)]">
              {[i.valorCondominio ? `Cond. ${brlPainel(i.valorCondominio)}` : null, i.iptuMensal ? `IPTU ${brlPainel(i.iptuMensal)}/mês` : null].filter(Boolean).join(' · ')}
            </div>
          )}
          {i.obsInterna && (
            <div className="mt-1 line-clamp-2 rounded bg-amber-50 px-1.5 py-1 text-[11px] text-amber-900 dark:bg-amber-950 dark:text-amber-200">OBS: {i.obsInterna}</div>
          )}
        </div>
      </Link>
      <div className="mt-auto flex flex-col gap-1.5 px-2.5 pb-2.5 pt-2">
        {dono ? (
          <div className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-[11px]">
              <span className="text-[var(--text-faint)]">Prop.:</span> {dono.nome}
            </span>
            {w && (
              <a href={w} target="_blank" rel="noopener" className="shrink-0 rounded-full bg-[#16A34A] px-2 py-0.5 text-[10.5px] font-bold text-white">
                WhatsApp
              </a>
            )}
          </div>
        ) : (
          <div className="text-[11px] text-[var(--text-faint)]">Sem proprietário cadastrado</div>
        )}
        <div className="flex flex-wrap gap-1">
          <Link href={`/dashboard/imoveis/${i.id}/editar`} className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white">
            Editar
          </Link>
          <button type="button" onClick={onPrivar} className="rounded-full bg-[var(--pill-bg)] px-2.5 py-1 text-[11px] font-bold hover:bg-[var(--pill-bg-hover)]">
            {i.visibilidade === 'privado' ? 'Publicar' : 'Privar'}
          </button>
          {i.visibilidade !== 'privado' && (
            <button
              type="button"
              onClick={onCompartilhar}
              className="rounded-full bg-[var(--pill-bg)] px-2.5 py-1 text-[11px] font-bold hover:bg-[var(--pill-bg-hover)]"
              title="Resumo sem nossos contatos, para outro corretor"
            >
              p/ corretor
            </button>
          )}
          <button type="button" onClick={onMais} className="rounded-full bg-[var(--pill-bg)] px-2.5 py-1 text-[11px] font-bold hover:bg-[var(--pill-bg-hover)]">
            ⋯
          </button>
        </div>
      </div>
    </div>
  );
}
