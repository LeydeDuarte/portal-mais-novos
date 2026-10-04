'use client';

// Painel → Imóveis → "Anúncios de mercado": anúncios de outros anunciantes (imobiliárias e portais)
// com o nome do condomínio, para o atendente quando não houver imóvel nosso que sirva. Usa os mesmos
// filtros da busca de imóveis. Clicar abre o anúncio no site do anunciante.
import { useEffect, useState } from 'react';
import { listarAnunciosMercado, type AnuncioMercado, type FiltroMercado } from '@/lib/actions-anuncios-mercado';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const data = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

export default function AnunciosMercado({ filtros }: { filtros: FiltroMercado }) {
  const [lista, setLista] = useState<AnuncioMercado[] | null>(null);
  const [modo, setModo] = useState<'cartoes' | 'lista'>('cartoes');
  const [aberto, setAberto] = useState(true);
  const chave = JSON.stringify(filtros);

  useEffect(() => {
    let vivo = true;
    setLista(null);
    const t = setTimeout(() => {
      listarAnunciosMercado(filtros)
        .then((r) => vivo && setLista(r))
        .catch(() => vivo && setLista([]));
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const Fonte = ({ a }: { a: AnuncioMercado }) => (
    <span className="text-[11.5px]">
      <span className={`font-semibold ${a.imobiliaria ? 'text-[#13874B]' : 'text-[#6B4FD8]'}`}>{a.site}</span>
      {a.anunciante ? <span className="text-[var(--text-muted)]"> · {a.anunciante}</span> : null}
    </span>
  );
  const Quando = ({ a }: { a: AnuncioMercado }) => (
    <span className="text-[11px] text-[var(--text-faint)]">{a.atualizadoPortal ? `atualizado no anúncio em ${data(a.atualizadoPortal)}` : `visto em ${data(a.vistoEm)}`}</span>
  );

  return (
    <section className="mt-10 border-t border-[var(--border)] pt-6">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setAberto(!aberto)} className="flex items-center gap-1.5 text-[16px] font-bold">
          <span className="text-[var(--text-muted)]">{aberto ? '▾' : '▸'}</span>
          Anúncios de mercado
          {lista ? <span className="text-[13px] font-semibold text-[var(--text-muted)]">({lista.length})</span> : null}
        </button>
        {aberto && (
          <div className="ml-auto flex gap-1">
            {(
              [
                ['cartoes', 'Cartões'],
                ['lista', 'Lista']
              ] as const
            ).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setModo(v)} className={`rounded-full px-3 py-1 text-[12.5px] font-semibold ${modo === v ? 'bg-ink text-white' : 'bg-[var(--pill-bg)]'}`}>
                {l}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">
        Para o atendimento: anúncios de outros anunciantes com o nome do condomínio, com os mesmos filtros da busca acima. Sites de imobiliárias primeiro (em verde), depois os portais. O mesmo imóvel em vários sites aparece uma vez. Uso interno: confira com o anunciante antes de oferecer ao cliente.
      </p>

      {aberto &&
        (!lista ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : !lista.length ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">Nenhum anúncio de mercado com esse perfil. A base é alimentada pelo Projeto &quot;Pesquisa de Mercado&quot;.</p>
        ) : modo === 'cartoes' ? (
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {lista.map((a) => (
              <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer nofollow" className="flex flex-col gap-1 rounded-2xl border border-[var(--border)] p-3 hover:border-accent hover:shadow-sm">
                <span className="text-[14px] font-bold leading-snug">{a.condominio}</span>
                <span className="text-[12px] text-[var(--text-muted)]">
                  {[a.bairro, a.cidade].filter(Boolean).join(', ')}
                  {a.ano ? ` · entregue em ${a.ano}` : ''}
                </span>
                <span className="text-[12.5px]">
                  {a.area ? `${Math.round(a.area)} m²` : ''}
                  {a.quartos != null ? ` · ${a.quartos} qt` : ''}
                  {a.vagas != null ? ` · ${a.vagas} vg` : ''}
                </span>
                <span className="text-[15px] font-bold tabular-nums">
                  {brl(a.preco)}
                  {a.area ? <span className="ml-1 text-[11.5px] font-normal text-[var(--text-muted)]">{brl(a.preco / a.area)}/m²</span> : null}
                </span>
                <Fonte a={a} />
                <span className="flex items-center justify-between">
                  <Quando a={a} />
                  <span className="text-[12px] font-semibold text-accent">Abrir anúncio ↗</span>
                </span>
              </a>
            ))}
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--border)]">
            <table className="w-full min-w-[760px] text-[12.5px]">
              <thead className="bg-[var(--pill-bg)] text-left text-[11.5px] text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-2">Condomínio</th>
                  <th className="px-2 py-2 text-right">m²</th>
                  <th className="px-2 py-2 text-right">Qts/vg</th>
                  <th className="px-2 py-2 text-right">Preço</th>
                  <th className="px-2 py-2 text-right">R$/m²</th>
                  <th className="px-2 py-2">Fonte</th>
                  <th className="px-3 py-2">Atualização</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((a) => (
                  <tr key={a.url} className="border-t border-[var(--border)] align-top">
                    <td className="px-3 py-1.5">
                      <a href={a.url} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold hover:text-accent hover:underline">
                        {a.condominio} ↗
                      </a>
                      <span className="block text-[11.5px] text-[var(--text-muted)]">{[a.bairro, a.cidade].filter(Boolean).join(', ')}</span>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{a.area ? Math.round(a.area) : '-'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {a.quartos ?? '-'}/{a.vagas ?? '-'}
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{brl(a.preco)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{a.area ? brl(a.preco / a.area) : '-'}</td>
                    <td className="px-2 py-1.5">
                      <Fonte a={a} />
                    </td>
                    <td className="px-3 py-1.5">
                      <Quando a={a} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </section>
  );
}
