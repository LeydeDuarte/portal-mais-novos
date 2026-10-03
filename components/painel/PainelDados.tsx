'use client';

import { useEffect, useState } from 'react';
import { dadosDoPainel, type DadosPainel, type LinhaFonte, type LinhaTop, type Periodo } from '@/lib/painel-dados';
import { baixarCsv, baixarXlsx, type Aba } from '@/lib/exportar-planilha';
import Comparativo, { COMPARATIVO_EXEMPLO } from './Comparativo';

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
                <td className="w-full max-w-0 py-2.5 pr-2">
                  <a href={l.url ?? '#'} target="_blank" rel="noopener" title={l.url ?? l.nome} className="block truncate font-semibold hover:text-accent">
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
                <td className="w-full max-w-0 py-2.5 pr-2">
                  {l.url ? (
                    <a href={l.url} target="_blank" rel="noopener" title={l.url} className="block truncate font-semibold hover:text-accent">
                      {l.nome}
                    </a>
                  ) : (
                    <span title={l.nome} className="block truncate font-semibold">{l.nome}</span>
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

/** Bloco recolhível: título + resumo de uma linha; abre para mostrar as tabelas. */
function Bloco({ titulo, resumo, aberto, children }: { titulo: string; resumo?: string; aberto: boolean; children: React.ReactNode }) {
  return (
    <details open={aberto} className="group rounded-2xl border border-[var(--border)] bg-[var(--bg)] open:bg-transparent open:border-transparent">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3.5 hover:bg-[var(--pill-bg)] group-open:mb-3 group-open:px-1 group-open:hover:bg-transparent [&::-webkit-details-marker]:hidden">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--pill-bg)] text-[13px] transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">{titulo}</span>
          {resumo && <span className="block truncate text-[12.5px] text-[var(--text-muted)] group-open:hidden">{resumo}</span>}
        </span>
        <span className="text-[12.5px] font-semibold text-accent group-open:hidden">Ver</span>
        <span className="hidden text-[12.5px] font-semibold text-[var(--text-muted)] group-open:inline">Recolher</span>
      </summary>
      <div className="grid gap-4 lg:grid-cols-2">{children}</div>
    </details>
  );
}

const primeiro = (l: LinhaTop[], sufixo = '') => (l[0] ? `Em 1º: ${l[0].nome} (${num(l[0].n)}${sufixo})` : 'Sem dados no período');

/** admin = administrador principal (blocos abertos, comparativo e exportação); analista vê tudo recolhido. */
export default function PainelDados({ admin = false, previa }: { admin?: boolean; previa?: DadosPainel }) {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [d, setD] = useState<DadosPainel | null>(previa ?? null);
  const [carregando, setCarregando] = useState(true);
  // período personalizado: começa no dia 1º do mês até hoje
  const hojeIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const [de, setDe] = useState(() => `${hojeIso().slice(0, 8)}01`);
  const [ate, setAte] = useState(hojeIso);
  const [aplicado, setAplicado] = useState({ de: '', ate: '' });
  useEffect(() => {
    if (previa) return setCarregando(false);
    if (periodo === 'personalizado' && !aplicado.de) return; // espera escolher as datas
    setCarregando(true);
    dadosDoPainel(periodo, aplicado.de, aplicado.ate)
      .then(setD)
      .catch(() => setD(null))
      .finally(() => setCarregando(false));
  }, [periodo, aplicado]);

  const maxDia = Math.max(1, ...(d?.porDia.map((x) => x.acessos) ?? [1]));
  const abrir = admin; // analista: tudo recolhido, para a tela não ficar comprida

  // planilha do período (admin): números gerais + uma aba por ranking
  const abasDoPeriodo = (x: DadosPainel): Aba[] => {
    const top = (nome: string, l: LinhaTop[], cols: [keyof LinhaTop, string][]): Aba => ({
      nome,
      linhas: [['Nome', 'Detalhe', ...cols.map(([, c]) => c)], ...l.map((r) => [r.nome, r.sub ?? '', ...cols.map(([k]) => Number(r[k] ?? 0))])]
    });
    const fontes = (nome: string, l: LinhaFonte[]): Aba => ({
      nome,
      linhas: [['Fonte', 'Campanha', 'Anúncio pago', 'Contatos', 'Em andamento', 'Visita ou proposta', 'Ganhos', 'Valor ganho'], ...l.map((r) => [r.canal, r.campanha ?? '', r.pago ? 'sim' : 'não', r.leads, r.andamento, r.avancados, r.ganhos, r.valorGanho])]
    });
    return [
      {
        nome: 'Resumo',
        linhas: [
          ['Indicador', 'Valor'],
          ['Período', `${dataBr(x.periodo.de)} a ${dataBr(x.periodo.ate)}`],
          ['Acessos ao site', x.acessos],
          ['Visitantes', x.visitantes],
          ['Visitantes novos', x.novos],
          ['Contatos pelo WhatsApp', x.contatosWhatsapp],
          ['Contatos pelo formulário', x.contatosFormulario],
          ['Cliques no WhatsApp', x.cliquesWhatsapp],
          ['Instagram', x.cliquesFundadora],
          ['Cliques em banners', x.cliquesBanner],
          ['Canal do WhatsApp', x.cliquesCanal],
          ['Avalie seu imóvel', x.cliquesAvaliar],
          ['Posição do sol', x.cliquesSol],
          ['Venda seu imóvel', x.cliquesVender],
          ['Leituras no News', x.leiturasNews],
          ['Favoritados', x.favoritos],
          ['Compartilhamentos', x.compartilhamentos],
          ['Tempo médio por página (s)', x.tempoMedio ?? '']
        ]
      },
      fontes('Fontes de contatos', x.fontes),
      fontes('Campanhas', x.campanhas),
      top('Chamadas no WhatsApp', x.chamadasWhatsapp, [['n', 'Cliques']]),
      top('Condomínios visitados', x.condominios, [['n', 'Visitas'], ['whatsapp', 'WhatsApp'], ['contatos', 'Contatos']]),
      top('Imóveis visitados', x.imoveis, [['n', 'Visitas'], ['whatsapp', 'WhatsApp']]),
      top('Bairros de interesse', x.bairros, [['n', 'Visitas'], ['whatsapp', 'WhatsApp']]),
      top('Cidades dos visitantes', x.cidades, [['n', 'Visitantes']]),
      top('Origem das visitas', x.origens, [['n', 'Acessos']]),
      top('Notícias', x.noticias, [['n', 'Leituras']]),
      top('Banners', x.banners, [['n', 'Cliques']])
    ];
  };

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Dados do portal</h2>
          <p className="text-sm text-[var(--text-muted)]">
            {d ? `De ${dataBr(d.periodo.de)} a ${dataBr(d.periodo.ate)}. ` : ''}Visitas da equipe logada e de robôs não entram.
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
          <button type="button" disabled={!de || !ate} onClick={() => setAplicado({ de, ate })} className="h-11 rounded-full bg-accent px-5 text-sm font-bold text-white disabled:opacity-50">
            Ver resultados
          </button>
          {!aplicado.de && <span className="text-sm text-[var(--text-muted)]">Escolha as datas e clique em Ver resultados.</span>}
        </div>
      )}

      {!d ? (
        <p className="text-sm text-[var(--text-muted)]">{carregando ? 'Carregando os números…' : 'Não foi possível carregar os dados.'}</p>
      ) : (
        <div className={`flex flex-col gap-5 transition-opacity ${carregando ? 'opacity-50' : ''}`}>
          {/* visitantes novos: janelas fixas, não dependem do período escolhido */}
          <div className="grid grid-cols-3 gap-3">
            <Cartao destaque rotulo="Novas visitas em 24 h" valor={d.novosRecentes.h24} detalhe="primeira vez no site" />
            <Cartao rotulo="Novas visitas em 7 dias" valor={d.novosRecentes.d7} detalhe="primeira vez no site" />
            <Cartao rotulo="Novas visitas em 30 dias" valor={d.novosRecentes.d30} detalhe="primeira vez no site" />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <Cartao destaque rotulo="Contatos pelo WhatsApp" valor={d.contatosWhatsapp} detalhe={`${num(d.contatosFormulario)} pelo formulário de interesse`} />
            <Cartao rotulo="Acessos ao site" valor={d.acessos} detalhe="páginas abertas" />
            <Cartao rotulo="Visitantes" valor={d.visitantes} detalhe={`${num(d.novos)} novos (primeira visita)`} />
            <Cartao rotulo="Cliques no WhatsApp" valor={d.cliquesWhatsapp} detalhe="botões Falar com a Leyde / Fale comigo" />
            <Cartao rotulo="Instagram" valor={d.cliquesFundadora} detalhe="cliques no Conheça a fundadora e no Direct" />
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

          {admin && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-[var(--text-muted)]">
                Baixar este período<span className="ml-0.5 font-bold text-accent">*</span>:
              </span>
              <button type="button" onClick={() => baixarXlsx(`resultados-${d.periodo.de}-a-${d.periodo.ate}`, abasDoPeriodo(d)).catch(() => alert('Não foi possível gerar a planilha.'))} className="h-9 rounded-full bg-ink px-4 text-[13px] font-semibold text-white">
                Planilha XLSX
              </button>
              <button type="button" onClick={() => baixarCsv(`resultados-${d.periodo.de}-a-${d.periodo.ate}`, abasDoPeriodo(d)[0].linhas)} className="h-9 rounded-full border border-[var(--border)] px-4 text-[13px] font-semibold">
                Resumo em CSV
              </button>
            </div>
          )}

          {d.porDia.length > 1 && (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
              <h3 className="mb-3 text-sm font-bold">Acessos por dia</h3>
              <div className="flex h-32 items-end gap-1 md:h-40">
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

          {admin && <Comparativo previa={previa ? COMPARATIVO_EXEMPLO : undefined} />}

          <div className="flex flex-col gap-3">
            <Bloco titulo="De onde vêm os contatos e as campanhas" resumo={d.fontes[0] ? `Em 1º: ${d.fontes[0].canal} (${num(d.fontes[0].leads)} contatos)` : 'Nenhum contato novo no período'} aberto={abrir}>
              <div className="lg:col-span-2 flex flex-col gap-4">
                <TabelaFontes titulo="Fontes de contatos (leads) e resultado no CRM" linhas={d.fontes} />
                <TabelaFontes titulo="Campanhas" linhas={d.campanhas} campanha />
              </div>
            </Bloco>

            <Bloco titulo="Mais chamadas no WhatsApp" resumo={primeiro(d.chamadasWhatsapp, ' cliques')} aberto={abrir}>
              <Tabela titulo="Condomínios e anúncios com mais cliques no WhatsApp" linhas={d.chamadasWhatsapp} colunas={[{ k: 'n', l: 'Cliques' }]} vazio="Nenhum clique no WhatsApp a partir de um anúncio ou condomínio no período." />
              <Tabela titulo="Condomínios mais visitados" linhas={d.condominios} colunas={[{ k: 'n', l: 'Visitas' }, { k: 'whatsapp', l: 'WhatsApp' }, { k: 'contatos', l: 'Contatos' }]} vazio="Nenhuma visita a condomínio no período." />
              <Tabela titulo="Imóveis mais visitados" linhas={d.imoveis} colunas={[{ k: 'n', l: 'Visitas' }, { k: 'whatsapp', l: 'WhatsApp' }]} vazio="Nenhuma visita a anúncio no período." />
            </Bloco>

            <Bloco titulo="Bairros e cidades" resumo={d.bairros[0] ? `Bairro mais procurado: ${d.bairros[0].nome} (${num(d.bairros[0].n)} visitas)` : 'Sem dados no período'} aberto={abrir}>
              <Tabela titulo="Bairros mais procurados (pelos anúncios e condomínios abertos)" linhas={d.bairros} colunas={[{ k: 'n', l: 'Visitas' }, { k: 'whatsapp', l: 'WhatsApp' }]} vazio="Sem visitas a anúncios ou condomínios no período." />
              <Tabela titulo="Cidade de quem visitou (aproximada)" linhas={d.cidades} colunas={[{ k: 'n', l: 'Visitantes' }]} vazio="A cidade passa a ser registrada a partir desta atualização." />
              <Tabela titulo="De onde vêm os visitantes (sites e redes)" linhas={d.origens} colunas={[{ k: 'n', l: 'Acessos' }]} vazio="Sem dados no período." />
            </Bloco>

            <Bloco titulo="Favoritos e compartilhamentos" resumo={`${num(d.favoritos)} favoritos e ${num(d.compartilhamentos)} compartilhamentos no período`} aberto={abrir}>
              <Tabela titulo="Imóveis mais favoritados" linhas={d.imoveisFavoritados} colunas={[{ k: 'n', l: 'Favoritos' }]} vazio="Nenhum imóvel favoritado no período." />
              <Tabela titulo="Condomínios mais favoritados" linhas={d.condominiosFavoritados} colunas={[{ k: 'n', l: 'Favoritos' }]} vazio="Nenhum condomínio favoritado no período." />
              <Tabela titulo="Imóveis mais compartilhados" linhas={d.imoveisCompartilhados} colunas={[{ k: 'n', l: 'Compart.' }]} vazio="Nenhum imóvel compartilhado no período." />
              <Tabela titulo="Condomínios mais compartilhados" linhas={d.condominiosCompartilhados} colunas={[{ k: 'n', l: 'Compart.' }]} vazio="Nenhum condomínio compartilhado no período." />
            </Bloco>

            <Bloco titulo="News, banners e incorporadoras" resumo={primeiro(d.noticias, ' leituras')} aberto={abrir}>
              <Tabela titulo="Notícias mais lidas" linhas={d.noticias} colunas={[{ k: 'n', l: 'Leituras' }]} vazio="Nenhuma leitura no período." />
              <Tabela titulo="Banners mais clicados" linhas={d.banners} colunas={[{ k: 'n', l: 'Cliques' }]} vazio="Nenhum clique em banner no período." />
              <Tabela titulo="Incorporadoras mais visitadas" linhas={d.incorporadoras} colunas={[{ k: 'n', l: 'Perfil' }, { k: 'whatsapp', l: 'Empreend.' }]} vazio="Nenhuma visita a perfil de incorporadora no período." />
            </Bloco>

            <Bloco titulo="Páginas e tempo de leitura" resumo={d.tempoMedio == null ? 'Sem medições' : `Tempo médio por página: ${duracao(d.tempoMedio)}`} aberto={abrir}>
              <Tabela titulo="Páginas mais acessadas" linhas={d.paginas} colunas={[{ k: 'n', l: 'Acessos' }]} vazio="Nenhum acesso no período." />
              <TabelaTempo linhas={d.paginasTempo} />
            </Bloco>
          </div>
        </div>
      )}
    </section>
  );
}
