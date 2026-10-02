'use client';

// Painel → Custos da operação (só admin): o que a operação está custando no mês, em reais.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { excluirConta, marcarContaPaga, painelCustos, salvarConta, salvarPrecosIA, type Conta, type PainelCustos } from '@/lib/actions-custos';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const usd = (n: number) => `US$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const mil = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : n >= 1000 ? `${Math.round(n / 1000)} mil` : String(n));
const campo = 'h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-accent';
const VAZIA = { fornecedor: '', descricao: '', valor: '', moeda: 'BRL' as 'BRL' | 'USD', recorrencia: 'mensal' as Conta['recorrencia'], vencimento: '', categoria: '' };

export default function CustosPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [d, setD] = useState<PainelCustos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nova, setNova] = useState<typeof VAZIA & { id?: string }>(VAZIA);
  const [editandoPrecos, setEditandoPrecos] = useState(false);
  const [precos, setPrecos] = useState<{ modelo: string; entrada: string; saida: string }[]>([]);
  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  const carregar = () =>
    painelCustos(mes)
      .then((r) => {
        setD(r);
        setPrecos(Object.entries(r.precos).map(([modelo, p]) => ({ modelo, entrada: String(p.entrada), saida: String(p.saida) })));
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'));
  useEffect(() => {
    if (staff) {
      setD(null);
      carregar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, mes]);
  if (!loaded || !staff) return null;

  const salvar = async () => {
    setErro(null);
    try {
      await salvarConta({ ...nova, valor: Number(String(nova.valor).replace(/\./g, '').replace(',', '.')), vencimento: nova.vencimento || null });
      setNova(VAZIA);
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
    }
  };

  const Card = ({ t, v, sub, forte }: { t: string; v: string; sub?: string; forte?: boolean }) => (
    <div className={`rounded-2xl border p-4 ${forte ? 'border-[#14161A] bg-[#14161A] text-white' : 'border-[var(--border)] bg-[var(--bg)]'}`}>
      <div className={`text-[12.5px] font-semibold ${forte ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>{t}</div>
      <div className="text-[26px] font-bold leading-tight tabular-nums">{v}</div>
      {sub && <div className={`text-xs ${forte ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>{sub}</div>}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-5xl px-5 py-6 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Custos da operação</h1>
            <p className="text-sm text-[var(--text-muted)]">IA, WhatsApp e contas fixas do portal, em reais.</p>
          </div>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className={campo} aria-label="Mês" />
        </div>
        {erro && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        {!d ? (
          !erro && <p className="mt-8 text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Card t="Total do mês" v={brl(d.totais.total)} sub={`a pagar: ${brl(d.totais.aPagarBrl)}`} forte />
              <Card t="IA (Anthropic)" v={brl(d.totais.iaBrl)} sub={`${d.ia.respostas} respostas · ${usd(d.ia.usd)}`} />
              <Card t="WhatsApp (Meta)" v={brl(d.totais.whatsappBrl)} sub={d.whatsapp.meta.ok ? `${d.whatsapp.meta.mensagens} mensagens cobradas` : 'relatório da Meta indisponível'} />
              <Card t="Contas fixas" v={brl(d.totais.contasBrl)} sub={`${d.contas.length} no mês`} />
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Dólar: R$ {d.dolar.valor.toLocaleString('pt-BR', { minimumFractionDigits: 4 })} ({d.dolar.fonte}
              {d.dolar.data ? ` de ${d.dolar.data}` : ''}). Na fatura do cartão entram ainda o IOF de 3,5% e o câmbio do seu banco.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <section className="rounded-2xl border border-[var(--border)] p-4">
                <h2 className="text-[15px] font-bold">IA de atendimento</h2>
                <dl className="mt-2 grid grid-cols-2 gap-y-1.5 text-sm">
                  <dt className="text-[var(--text-muted)]">Respostas da IA</dt>
                  <dd className="text-right font-semibold tabular-nums">{d.ia.respostas}</dd>
                  <dt className="text-[var(--text-muted)]">Clientes atendidos</dt>
                  <dd className="text-right font-semibold tabular-nums">{d.ia.atendimentos}</dd>
                  <dt className="text-[var(--text-muted)]">Custo por cliente</dt>
                  <dd className="text-right font-semibold tabular-nums">{d.ia.porAtendimentoBrl != null ? brl(d.ia.porAtendimentoBrl) : '–'}</dd>
                  <dt className="text-[var(--text-muted)]">Tokens lidos / escritos</dt>
                  <dd className="text-right tabular-nums">
                    {mil(d.ia.entrada)} / {mil(d.ia.saida)}
                  </dd>
                  <dt className="text-[var(--text-muted)]">Lidos do cache (mais baratos)</dt>
                  <dd className="text-right tabular-nums">{mil(d.ia.cacheLeitura)}</dd>
                </dl>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Calculado a cada resposta, pelos preços abaixo. O valor exato está no Claude Console (créditos e faturas).{' '}
                  <button type="button" onClick={() => setEditandoPrecos((v) => !v)} className="font-semibold text-accent">
                    {editandoPrecos ? 'Fechar preços' : 'Ver preços'}
                  </button>
                </p>
                {editandoPrecos && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {precos.map((p, i) => (
                      <div key={i} className="flex gap-1.5">
                        <input value={p.modelo} onChange={(e) => setPrecos(precos.map((x, k) => (k === i ? { ...x, modelo: e.target.value } : x)))} className={`${campo} min-w-0 flex-1`} />
                        <input value={p.entrada} onChange={(e) => setPrecos(precos.map((x, k) => (k === i ? { ...x, entrada: e.target.value } : x)))} className={`${campo} w-20`} aria-label="US$ por milhão lidos" />
                        <input value={p.saida} onChange={(e) => setPrecos(precos.map((x, k) => (k === i ? { ...x, saida: e.target.value } : x)))} className={`${campo} w-20`} aria-label="US$ por milhão escritos" />
                      </div>
                    ))}
                    <span className="text-[11.5px] text-[var(--text-muted)]">US$ por milhão de tokens: lidos e escritos.</span>
                    <button
                      type="button"
                      onClick={() =>
                        salvarPrecosIA(Object.fromEntries(precos.map((p) => [p.modelo, { entrada: Number(p.entrada.replace(',', '.')), saida: Number(p.saida.replace(',', '.')) }]))).then(carregar)
                      }
                      className="h-9 self-start rounded-full bg-accent px-4 text-[12.5px] font-bold text-white"
                    >
                      Salvar preços
                    </button>
                  </div>
                )}
              </section>
              <section className="rounded-2xl border border-[var(--border)] p-4">
                <h2 className="text-[15px] font-bold">WhatsApp</h2>
                <dl className="mt-2 grid grid-cols-2 gap-y-1.5 text-sm">
                  <dt className="text-[var(--text-muted)]">Mensagens recebidas</dt>
                  <dd className="text-right font-semibold tabular-nums">{d.whatsapp.recebidas}</dd>
                  <dt className="text-[var(--text-muted)]">Enviadas pela IA</dt>
                  <dd className="text-right font-semibold tabular-nums">{d.whatsapp.enviadasIa}</dd>
                  <dt className="text-[var(--text-muted)]">Enviadas pela equipe (CRM)</dt>
                  <dd className="text-right font-semibold tabular-nums">{d.whatsapp.enviadasEquipe}</dd>
                  <dt className="text-[var(--text-muted)]">Cobrado pela Meta</dt>
                  <dd className="text-right font-semibold tabular-nums">{d.whatsapp.meta.ok ? `${brl(d.whatsapp.meta.brl)} (${usd(d.whatsapp.meta.usd)})` : '–'}</dd>
                </dl>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  {d.whatsapp.meta.ok
                    ? 'Valor do relatório de preços da própria Meta. Responder clientes dentro de 24 h é gratuito; a Meta cobra as mensagens que a empresa inicia (modelos).'
                    : `Relatório da Meta indisponível agora (${d.whatsapp.meta.erro ?? 'sem dados'}). Responder clientes dentro de 24 h é gratuito.`}
                </p>
              </section>
            </div>

            <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)]">
              <div className="flex items-baseline justify-between px-4 py-3">
                <h2 className="text-[15px] font-bold">Contas a pagar · {mes.split('-').reverse().join('/')}</h2>
                <span className="text-xs text-[var(--text-muted)]">mensais entram todo mês; anuais no mês do vencimento</span>
              </div>
              {d.contas.length === 0 && <p className="border-t border-[var(--border)] px-4 py-4 text-sm text-[var(--text-muted)]">Nenhuma conta cadastrada. Comece pelas fixas: Vercel, banco de dados, domínio, recarga da IA.</p>}
              {d.contas.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] px-4 py-2.5 text-sm">
                  <input type="checkbox" checked={c.pagaNoMes} onChange={(e) => marcarContaPaga(c.id, mes, e.target.checked).then(carregar)} className="h-4 w-4 accent-[#13874B]" aria-label="Paga neste mês" />
                  <span className="min-w-0 flex-1">
                    <b className={c.pagaNoMes ? 'text-[var(--text-muted)] line-through' : ''}>{c.fornecedor}</b>
                    <span className="block text-xs text-[var(--text-muted)]">
                      {[c.descricao, c.categoria, c.recorrencia === 'mensal' ? 'mensal' : c.recorrencia === 'anual' ? 'anual' : 'única', c.vencimento ? `vence dia ${c.vencimento.slice(8)}` : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="text-right font-semibold tabular-nums">
                    {brl(c.valorBrl)}
                    {c.moeda === 'USD' && <span className="block text-[11px] font-normal text-[var(--text-muted)]">{usd(c.valor)}</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => setNova({ id: c.id, fornecedor: c.fornecedor, descricao: c.descricao ?? '', valor: String(c.valor).replace('.', ','), moeda: c.moeda, recorrencia: c.recorrencia, vencimento: c.vencimento ?? '', categoria: c.categoria ?? '' })}
                    className="text-xs font-semibold text-accent"
                  >
                    Editar
                  </button>
                  <button type="button" onClick={() => window.confirm(`Excluir ${c.fornecedor}?`) && excluirConta(c.id).then(carregar)} className="text-xs font-semibold text-red-600">
                    Excluir
                  </button>
                </div>
              ))}
              <div className="grid gap-2 border-t border-[var(--border)] bg-[var(--pill-bg)]/50 p-4 sm:grid-cols-6">
                <input placeholder="Fornecedor (ex.: Vercel)" value={nova.fornecedor} onChange={(e) => setNova({ ...nova, fornecedor: e.target.value })} className={`${campo} sm:col-span-2`} />
                <input placeholder="Descrição" value={nova.descricao} onChange={(e) => setNova({ ...nova, descricao: e.target.value })} className={`${campo} sm:col-span-2`} />
                <input placeholder="Valor" inputMode="decimal" value={nova.valor} onChange={(e) => setNova({ ...nova, valor: e.target.value })} className={campo} />
                <select value={nova.moeda} onChange={(e) => setNova({ ...nova, moeda: e.target.value as 'BRL' | 'USD' })} className={campo}>
                  <option value="BRL">R$</option>
                  <option value="USD">US$</option>
                </select>
                <select value={nova.recorrencia} onChange={(e) => setNova({ ...nova, recorrencia: e.target.value as Conta['recorrencia'] })} className={campo}>
                  <option value="mensal">Mensal</option>
                  <option value="anual">Anual</option>
                  <option value="unica">Única</option>
                </select>
                <input type="date" value={nova.vencimento} onChange={(e) => setNova({ ...nova, vencimento: e.target.value })} className={campo} aria-label="Vencimento" />
                <input placeholder="Categoria (ex.: hospedagem)" value={nova.categoria} onChange={(e) => setNova({ ...nova, categoria: e.target.value })} className={`${campo} sm:col-span-2`} />
                <div className="flex gap-2 sm:col-span-2">
                  <button type="button" onClick={salvar} className="h-10 flex-1 rounded-full bg-accent px-4 text-sm font-bold text-white">
                    {nova.id ? 'Salvar' : '+ Adicionar conta'}
                  </button>
                  {nova.id && (
                    <button type="button" onClick={() => setNova(VAZIA)} className="h-10 rounded-full border border-[var(--border)] px-4 text-sm font-semibold">
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </section>

            {d.historico.length > 1 && (
              <section className="mt-5 rounded-2xl border border-[var(--border)] p-4">
                <h2 className="text-[15px] font-bold">Últimos meses (IA)</h2>
                <div className="mt-3 flex h-36 items-end gap-3">
                  {d.historico.map((h) => {
                    const max = Math.max(...d.historico.map((x) => x.iaBrl), 1);
                    return (
                      <div key={h.mes} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-[11px] font-semibold tabular-nums">{brl(h.iaBrl)}</span>
                        <div className="w-full rounded-t-md bg-accent" style={{ height: `${Math.max(4, (h.iaBrl / max) * 100)}px` }} />
                        <span className="text-[11px] text-[var(--text-muted)]">{h.mes.split('-').reverse().join('/')}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
