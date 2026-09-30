'use client';

import { useEffect, useState } from 'react';
import { dadosDoPainel, type DadosPainel, type LinhaTop, type Periodo } from '@/lib/painel-dados';

// Painel de dados do Início: monitoramento do portal inteiro no período escolhido.
const PERIODOS: [Periodo, string][] = [
  ['hoje', 'Hoje'],
  ['7d', '7 dias'],
  ['mes', 'Este mês'],
  ['mes-passado', 'Mês passado'],
  ['30d', '30 dias']
];
const num = (v: number) => v.toLocaleString('pt-BR');
const dataBr = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');

function Cartao({ rotulo, valor, detalhe, destaque = false }: { rotulo: string; valor: number | string; detalhe?: string; destaque?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 rounded-2xl p-4 ${destaque ? 'bg-ink text-white' : 'border border-[var(--border)] bg-[var(--bg)]'}`}>
      <span className={`text-[11px] font-bold uppercase tracking-[0.08em] ${destaque ? 'text-[#C5CAD3]' : 'text-[var(--text-muted)]'}`}>{rotulo}</span>
      <span className="font-sans text-[28px] font-bold leading-none tabular-nums">{typeof valor === 'number' ? num(valor) : valor}</span>
      {detalhe && <span className={`text-xs ${destaque ? 'text-[#C5CAD3]' : 'text-[var(--text-muted)]'}`}>{detalhe}</span>}
    </div>
  );
}

function Tabela({ titulo, linhas, colunas, vazio }: { titulo: string; linhas: LinhaTop[]; colunas: { k: 'n' | 'whatsapp' | 'contatos'; l: string }[]; vazio: string }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)]">
      <h3 className="border-b border-[var(--border)] px-4 py-3 text-sm font-bold">{titulo}</h3>
      {linhas.length === 0 ? (
        <p className="p-4 text-sm text-[var(--text-muted)]">{vazio}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
              <th className="px-4 py-2 font-semibold">#</th>
              <th className="py-2 font-semibold">Nome</th>
              {colunas.map((c) => (
                <th key={c.k} className="px-4 py-2 text-right font-semibold">
                  {c.l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className="border-t border-[var(--border)]">
                <td className="px-4 py-2.5 text-[var(--text-muted)]">{i + 1}</td>
                <td className="max-w-0 py-2.5 pr-2">
                  {l.url ? (
                    <a href={l.url} target="_blank" rel="noopener" className="block truncate font-semibold hover:text-accent">
                      {l.nome}
                    </a>
                  ) : (
                    <span className="block truncate font-semibold">{l.nome}</span>
                  )}
                  {l.sub && <span className="block truncate text-xs text-[var(--text-muted)]">{l.sub}</span>}
                </td>
                {colunas.map((c) => (
                  <td key={c.k} className="px-4 py-2.5 text-right font-sans font-bold tabular-nums">
                    {num(l[c.k] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default function PainelDados() {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [d, setD] = useState<DadosPainel | null>(null);
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    setCarregando(true);
    dadosDoPainel(periodo)
      .then(setD)
      .catch(() => setD(null))
      .finally(() => setCarregando(false));
  }, [periodo]);

  const maxDia = Math.max(1, ...(d?.porDia.map((x) => x.acessos) ?? [1]));
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Dados do portal</h2>
          <p className="text-sm text-[var(--text-muted)]">
            {d ? `De ${dataBr(d.periodo.de)} a ${dataBr(d.periodo.ate)} · ` : ''}visitas da equipe logada e de robôs não entram
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PERIODOS.map(([v, l]) => (
            <button key={v} type="button" onClick={() => setPeriodo(v)} className={`rounded-full px-3.5 py-2 text-sm ${periodo === v ? 'bg-ink font-semibold text-white' : 'bg-[var(--pill-bg)]'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {!d ? (
        <p className="text-sm text-[var(--text-muted)]">{carregando ? 'Carregando os números…' : 'Não foi possível carregar os dados.'}</p>
      ) : (
        <div className={`flex flex-col gap-5 transition-opacity ${carregando ? 'opacity-50' : ''}`}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Cartao destaque rotulo="Contatos pelo WhatsApp" valor={d.contatosWhatsapp} detalhe={`${num(d.contatosFormulario)} pelo formulário de interesse`} />
            <Cartao rotulo="Acessos ao site" valor={d.acessos} detalhe="páginas abertas" />
            <Cartao rotulo="Visitantes" valor={d.visitantes} detalhe={`${num(d.novos)} novos (primeira visita)`} />
            <Cartao rotulo="Cliques no WhatsApp" valor={d.cliquesWhatsapp} detalhe="botões Falar com a Leyde / Fale comigo" />
            <Cartao rotulo="Conheça a fundadora" valor={d.cliquesFundadora} detalhe="cliques que foram para o Instagram" />
            <Cartao rotulo="Cliques em banners" valor={d.cliquesBanner} detalhe={`${num(d.cliquesAnuncie)} no "Anuncie aqui"`} />
            <Cartao rotulo="Canal do WhatsApp" valor={d.cliquesCanal} detalhe="cliques em Seguir no WhatsApp" />
            <Cartao rotulo="Leituras no News" valor={d.leiturasNews} detalhe="páginas de notícia abertas" />
          </div>

          {d.porDia.length > 1 && (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
              <h3 className="mb-3 text-sm font-bold">Acessos por dia</h3>
              <div className="flex h-40 items-end gap-1">
                {d.porDia.map((x) => (
                  <div key={x.dia} className="group relative flex h-full flex-1 flex-col justify-end" title={`${dataBr(x.dia)}: ${x.acessos} acessos, ${x.visitantes} visitantes, ${x.whatsapp} cliques no WhatsApp`}>
                    <div className="rounded-t bg-accent/80 group-hover:bg-accent" style={{ height: `${Math.max(2, (x.acessos / maxDia) * 100)}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-[var(--text-muted)]">
                <span>{dataBr(d.porDia[0].dia)}</span>
                <span>{dataBr(d.porDia[d.porDia.length - 1].dia)}</span>
              </div>
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Tabela titulo="Condomínios mais visitados" linhas={d.condominios} colunas={[{ k: 'n', l: 'Visitas' }, { k: 'whatsapp', l: 'WhatsApp' }, { k: 'contatos', l: 'Contatos' }]} vazio="Nenhuma visita a condomínio no período." />
            <Tabela titulo="Imóveis mais visitados" linhas={d.imoveis} colunas={[{ k: 'n', l: 'Visitas' }, { k: 'whatsapp', l: 'WhatsApp' }]} vazio="Nenhuma visita a anúncio no período." />
            <Tabela titulo="Notícias mais lidas" linhas={d.noticias} colunas={[{ k: 'n', l: 'Leituras' }]} vazio="Nenhuma leitura no período." />
            <Tabela titulo="Banners mais clicados" linhas={d.banners} colunas={[{ k: 'n', l: 'Cliques' }]} vazio="Nenhum clique em banner no período." />
            <Tabela titulo="Páginas mais acessadas" linhas={d.paginas} colunas={[{ k: 'n', l: 'Acessos' }]} vazio="Nenhum acesso no período." />
            <Tabela titulo="De onde vêm os visitantes" linhas={d.origens} colunas={[{ k: 'n', l: 'Acessos' }]} vazio="Sem dados no período." />
          </div>
        </div>
      )}
    </section>
  );
}
