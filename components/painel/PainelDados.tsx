'use client';

import { useEffect, useState } from 'react';
import { dadosDoPainel, type DadosPainel, type LinhaFonte, type LinhaTop, type Periodo } from '@/lib/painel-dados';

// Painel de dados do Início: monitoramento do portal inteiro no período escolhido.
const PERIODOS: [Periodo, string][] = [
  ['hoje', 'Hoje'],
  ['7d', '7 dias'],
  ['mes', 'Este mês'],
  ['mes-passado', 'Mês passado'],
  ['30d', '30 dias'],
  ['personalizado', 'Personalizado']
];
const num = (v: number) => v.toLocaleString('pt-BR');
const duracao = (seg: number) => (seg < 60 ? `${seg} s` : `${Math.floor(seg / 60)} min ${String(Math.round(seg % 60)).padStart(2, '0')} s`);

function TabelaTempo({ linhas }: { linhas: LinhaTop[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)]">
      <h3 className="border-b border-[var(--border)] px-4 py-3 text-sm font-bold">Páginas onde as pessoas passam mais tempo</h3>
      {linhas.length === 0 ? (
        <p className="p-4 text-sm text-[var(--text-muted)]">Ainda sem medições suficientes (cada página precisa de pelo menos 3 visitas medidas).</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className="border-t border-[var(--border)] first:border-t-0">
                <td className="px-4 py-2.5 text-[var(--text-muted)]">{i + 1}</td>
                <td className="max-w-0 py-2.5 pr-2">
                  <a href={l.url ?? '#'} target="_blank" rel="noopener" className="block truncate font-semibold hover:text-accent">
                    {l.nome}
                  </a>
                  <span className="block truncate text-xs text-[var(--text-muted)]">{l.contatos} visita(s) medida(s)</span>
                </td>
                <td className="px-4 py-2.5 text-right font-sans font-bold tabular-nums">{duracao(l.n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

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

function TabelaFontes({ titulo, linhas, campanha = false }: { titulo: string; linhas: LinhaFonte[]; campanha?: boolean }) {
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');
  const brl = (v: number) => (v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '–');
  return (
    <section className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg)]">
      <h3 className="border-b border-[var(--border)] px-4 py-3 text-sm font-bold">{titulo}</h3>
      {linhas.length === 0 ? (
        <p className="p-4 text-sm text-[var(--text-muted)]">
          {campanha ? 'Nenhum contato com campanha no período. Use etiquetas UTM nos links dos anúncios (utm_source, utm_medium=cpc, utm_campaign).' : 'Nenhum contato novo no período.'}
        </p>
      ) : (
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
              <th className="px-4 py-2 font-semibold">{campanha ? 'Campanha' : 'Fonte'}</th>
              <th className="px-2 py-2 text-right font-semibold">Contatos</th>
              <th className="px-2 py-2 text-right font-semibold">Em andamento</th>
              <th className="px-2 py-2 text-right font-semibold">Visita ou proposta</th>
              <th className="px-2 py-2 text-right font-semibold">Ganhos</th>
              <th className="px-2 py-2 text-right font-semibold">Conversão</th>
              <th className="px-4 py-2 text-right font-semibold">Valor ganho</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className="border-t border-[var(--border)]">
                <td className="px-4 py-2.5">
                  <span className="font-semibold">{campanha ? l.campanha : l.canal}</span>
                  {l.pago && <span className="ml-1.5 rounded-full bg-[#14161A] px-1.5 py-0.5 text-[10.5px] font-bold text-white">anúncio</span>}
                  {campanha && <span className="block text-xs text-[var(--text-muted)]">{l.canal}</span>}
                </td>
                <td className="px-2 py-2.5 text-right font-bold tabular-nums">{l.leads}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{l.andamento}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{l.avancados} <span className="text-xs text-[var(--text-muted)]">({pct(l.avancados, l.leads)})</span></td>
                <td className="px-2 py-2.5 text-right font-bold tabular-nums">{l.ganhos}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{pct(l.ganhos, l.leads)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{brl(l.valorGanho)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
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
  // período personalizado: começa no dia 1º do mês até hoje
  const hojeIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const [de, setDe] = useState(() => `${hojeIso().slice(0, 8)}01`);
  const [ate, setAte] = useState(hojeIso);
  const [aplicado, setAplicado] = useState({ de: '', ate: '' });
  useEffect(() => {
    if (periodo === 'personalizado' && !aplicado.de) return; // espera escolher as datas
    setCarregando(true);
    dadosDoPainel(periodo, aplicado.de, aplicado.ate)
      .then(setD)
      .catch(() => setD(null))
      .finally(() => setCarregando(false));
  }, [periodo, aplicado]);

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

      {periodo === 'personalizado' && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
            De
            <input type="date" value={de} max={ate || undefined} onChange={(e) => setDe(e.target.value)} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-ink" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
            Até
            <input type="date" value={ate} min={de || undefined} max={hojeIso()} onChange={(e) => setAte(e.target.value)} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-ink" />
          </label>
          <button
            type="button"
            disabled={!de || !ate}
            onClick={() => setAplicado({ de, ate })}
            className="h-11 rounded-full bg-accent px-5 text-sm font-bold text-white disabled:opacity-50"
          >
            Ver resultados
          </button>
          {!aplicado.de && <span className="text-sm text-[var(--text-muted)]">Escolha as datas e clique em Ver resultados.</span>}
        </div>
      )}

      {!d ? (
        <p className="text-sm text-[var(--text-muted)]">{carregando ? 'Carregando os números…' : 'Não foi possível carregar os dados.'}</p>
      ) : (
        <div className={`flex flex-col gap-5 transition-opacity ${carregando ? 'opacity-50' : ''}`}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <Cartao destaque rotulo="Contatos pelo WhatsApp" valor={d.contatosWhatsapp} detalhe={`${num(d.contatosFormulario)} pelo formulário de interesse`} />
            <Cartao rotulo="Acessos ao site" valor={d.acessos} detalhe="páginas abertas" />
            <Cartao rotulo="Visitantes" valor={d.visitantes} detalhe={`${num(d.novos)} novos (primeira visita)`} />
            <Cartao rotulo="Cliques no WhatsApp" valor={d.cliquesWhatsapp} detalhe="botões Falar com a Leyde / Fale comigo" />
            <Cartao rotulo="Instagram da Leyde" valor={d.cliquesFundadora} detalhe="cliques no Conheça a fundadora e no Direct" />
            <Cartao rotulo="Cliques em banners" valor={d.cliquesBanner} detalhe={`${num(d.cliquesAnuncie)} no "Anuncie aqui"`} />
            <Cartao rotulo="Canal do WhatsApp" valor={d.cliquesCanal} detalhe="cliques em Seguir no WhatsApp" />
            <Cartao rotulo="Avalie seu imóvel" valor={d.cliquesAvaliar} detalhe="cliques nas páginas de anúncio e condomínio" />
            <Cartao rotulo="Posição do sol" valor={d.cliquesSol} detalhe="cliques em Entrar para ver, nos condomínios" />
            <Cartao rotulo="Venda seu imóvel" valor={d.cliquesVender} detalhe="cliques na chamada das páginas do News" />
            <Cartao rotulo="Leituras no News" valor={d.leiturasNews} detalhe="páginas de notícia abertas" />
            <Cartao rotulo="Favoritados" valor={d.favoritos} detalhe="imóveis e condomínios salvos no coração" />
            <Cartao rotulo="Compartilhamentos" valor={d.compartilhamentos} detalhe="WhatsApp, link copiado ou menu do celular" />
            <Cartao rotulo="Tempo médio por página" valor={d.tempoMedio == null ? '-' : duracao(d.tempoMedio)} detalhe="só o tempo com a página visível" />
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

          {/* de onde vêm os contatos e quanto cada fonte vende */}
          <TabelaFontes titulo="Fontes de contatos (leads) e resultado no CRM" linhas={d.fontes} />
          <TabelaFontes titulo="Campanhas" linhas={d.campanhas} campanha />

          <div className="grid gap-4 lg:grid-cols-2">
            <Tabela titulo="Condomínios mais visitados" linhas={d.condominios} colunas={[{ k: 'n', l: 'Visitas' }, { k: 'whatsapp', l: 'WhatsApp' }, { k: 'contatos', l: 'Contatos' }]} vazio="Nenhuma visita a condomínio no período." />
            <Tabela titulo="Imóveis mais visitados" linhas={d.imoveis} colunas={[{ k: 'n', l: 'Visitas' }, { k: 'whatsapp', l: 'WhatsApp' }]} vazio="Nenhuma visita a anúncio no período." />
            <Tabela titulo="Notícias mais lidas" linhas={d.noticias} colunas={[{ k: 'n', l: 'Leituras' }]} vazio="Nenhuma leitura no período." />
            <Tabela titulo="Banners mais clicados" linhas={d.banners} colunas={[{ k: 'n', l: 'Cliques' }]} vazio="Nenhum clique em banner no período." />
            <Tabela titulo="Imóveis mais favoritados" linhas={d.imoveisFavoritados} colunas={[{ k: 'n', l: 'Favoritos' }]} vazio="Nenhum imóvel favoritado no período." />
            <Tabela titulo="Condomínios mais favoritados" linhas={d.condominiosFavoritados} colunas={[{ k: 'n', l: 'Favoritos' }]} vazio="Nenhum condomínio favoritado no período." />
            <Tabela titulo="Imóveis mais compartilhados" linhas={d.imoveisCompartilhados} colunas={[{ k: 'n', l: 'Compart.' }]} vazio="Nenhum imóvel compartilhado no período." />
            <Tabela titulo="Condomínios mais compartilhados" linhas={d.condominiosCompartilhados} colunas={[{ k: 'n', l: 'Compart.' }]} vazio="Nenhum condomínio compartilhado no período." />
            <Tabela titulo="Incorporadoras mais visitadas" linhas={d.incorporadoras} colunas={[{ k: 'n', l: 'Perfil' }, { k: 'whatsapp', l: 'Empreend.' }]} vazio="Nenhuma visita a perfil de incorporadora no período." />
            <TabelaTempo linhas={d.paginasTempo} />
            <Tabela titulo="Páginas mais acessadas" linhas={d.paginas} colunas={[{ k: 'n', l: 'Acessos' }]} vazio="Nenhum acesso no período." />
            <Tabela titulo="De onde vêm os visitantes" linhas={d.origens} colunas={[{ k: 'n', l: 'Acessos' }]} vazio="Sem dados no período." />
          </div>
        </div>
      )}
    </section>
  );
}
