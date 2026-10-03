'use client';

// CRM · Hoje: quem está esperando resposta, tarefas e visitas do dia.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import { CanalChip, CrmNav, Iniciais, OrigemChip, dataHora, linkWhats, tempoDesde } from '@/components/crm/comum';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo } from '@/lib/papeis';
import { concluirTarefa, crmHoje, crmVgv, marcarRespondido, registrarAtividade, type Hoje, type Vgv } from '@/lib/actions-crm';
import { SAUDACAO_DA_FASE, faseDoDia } from '@/lib/frases';

const brlCurto = (v: number) => (v >= 1_000_000 ? `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi` : v ? `R$ ${Math.round(v / 1000).toLocaleString('pt-BR')} mil` : 'R$ 0');

export default function CrmHojePage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [d, setD] = useState<Hoje | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [vgv, setVgv] = useState<Vgv | null>(null);
  const [verTodos, setVerTodos] = useState(false);
  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  const carregar = () =>
    crmHoje()
      .then(setD)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'));
  useEffect(() => {
    if (staff) {
      carregar();
      crmVgv().then(setVgv).catch(() => {});
    }
  }, [staff]);
  if (!loaded || !staff) return null;
  const gestor = veTudo(staff.role);
  const primeiro = (staff.name || '').split(' ')[0];

  const responder = async (id: string, nome: string, tel: string | null) => {
    const link = linkWhats(tel, `Olá, ${nome.split(' ')[0]}! Aqui é ${primeiro} da Mais Novos Imóveis.`);
    if (link) window.open(link, '_blank');
    await registrarAtividade(id, 'whatsapp', 'Respondeu pelo WhatsApp (pelo CRM)').catch(() => {});
    setD((x) => (x ? { ...x, responder: x.responder.filter((r) => r.id !== id), numeros: { ...x.numeros, esperando: x.numeros.esperando - 1 } } : x));
  };

  const Num = ({ n, t, sub, alerta }: { n: number | string; t: string; sub?: string; alerta?: boolean }) => (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
      <div className="text-[12.5px] font-semibold text-[var(--text-muted)]">{t}</div>
      <div className={`text-[28px] font-bold leading-tight tabular-nums ${alerta ? 'text-[#C2410C]' : ''}`}>{n}</div>
      {sub && <div className="text-xs text-[var(--text-muted)]">{sub}</div>}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[var(--pill-bg)]/40">
      <PainelNav />
      <CrmNav ativo="/dashboard/crm" gestor={gestor} />
      <main className="mx-auto w-full max-w-6xl px-5 py-6 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" suppressHydrationWarning>{SAUDACAO_DA_FASE[faseDoDia()]}, {primeiro}</h1>
            <p className="text-sm text-[var(--text-muted)]">O que precisa de você hoje{gestor ? ' (você vê toda a equipe)' : ' (só os seus contatos)'}.</p>
          </div>
          <Link href="/dashboard/crm/contatos?novo=1" className="rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-white hover:brightness-110">
            + Novo contato
          </Link>
        </div>
        {erro && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        {!d ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Num n={d.numeros.esperando} t="Esperando resposta" sub={d.numeros.maisAntigoMin != null ? `o mais antigo ${tempoDesde(d.responder[0]?.esperandoDesde ?? null)}` : 'ninguém esperando'} alerta={d.numeros.esperando > 0} />
              <Num n={d.numeros.tarefas} t="Tarefas de hoje" sub={d.numeros.atrasadas ? `${d.numeros.atrasadas} atrasada(s)` : 'em dia'} alerta={d.numeros.atrasadas > 0} />
              <Num n={d.numeros.visitas} t="Visitas" sub="agendadas para hoje" />
              {gestor ? (
                <Link href="/dashboard/crm/equipe" className="block">
                  <Num n={d.numeros.semDono} t="Sem corretor" sub="distribuir na Equipe →" alerta={d.numeros.semDono > 0} />
                </Link>
              ) : (
                <Link href="/dashboard/crm/funil?f=comprar" className="block">
                  <Num n="→" t="Funil de vendas" sub="seus negócios em andamento" />
                </Link>
              )}
            </div>

            {/* VGV: o que está em proposta, em contrato e o que já foi fechado */}
            {vgv && (
              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Link href="/dashboard/propostas" className="block">
                  <Num n={brlCurto(vgv.propostas.valor)} t="VGV em propostas" sub={`${vgv.propostas.n} proposta(s) ativa(s)`} />
                </Link>
                <Link href="/dashboard/crm/funil?f=comprar" className="block">
                  <Num n={brlCurto(vgv.contrato.valor)} t="VGV em contrato" sub={`${vgv.contrato.n} contrato(s) em assinatura`} />
                </Link>
                <Num n={vgv.fechadosMes.n} t="Contratos fechados no mês" sub={brlCurto(vgv.fechadosMes.valor)} />
                <Num n={vgv.fechadosAno.n} t="Contratos fechados no ano" sub={brlCurto(vgv.fechadosAno.valor)} />
              </div>
            )}

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
              <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)]">
                <div className="flex items-baseline justify-between gap-3 px-4 py-3">
                  <h2 className="text-[15px] font-bold">Responder agora</h2>
                  <span className="text-xs text-[var(--text-muted)]">mais antigos primeiro</span>
                </div>
                {d.responder.length === 0 && <p className="border-t border-[var(--border)] px-4 py-6 text-sm text-[var(--text-muted)]">Ninguém esperando resposta agora.</p>}
                {(verTodos ? d.responder : d.responder.slice(0, 8)).map((r) => {
                  const min = r.esperandoDesde ? (Date.now() - new Date(r.esperandoDesde).getTime()) / 60000 : 0;
                  return (
                    <div key={r.id} className="flex items-center gap-2.5 border-t border-[var(--border)] px-4 py-2">
                      <Iniciais nome={r.nome} tam={28} />
                      <Link href={`/dashboard/crm/contato/${r.id}`} className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <b className="text-[13px] font-semibold">{r.nome}</b>
                          <OrigemChip origem={r.tipo === 'corretor' ? 'corretor' : r.origem} />
                          <CanalChip canal={r.canal} />
                          {r.possivelCorretor && r.tipo !== 'corretor' && <span className="rounded-full bg-[#FDECEC] px-2 py-0.5 text-[11px] font-bold text-[#B42318]">Possível corretor</span>}
                        </span>
                        <span className="block truncate text-[12px] text-[var(--text-muted)]">{r.ultimaEntrada}</span>
                      </Link>
                      <span className={`shrink-0 text-xs font-bold ${min > 30 ? 'text-[#C2410C]' : 'text-[var(--text-muted)]'}`}>{tempoDesde(r.esperandoDesde)}</span>
                      {r.telefone ? (
                        <button type="button" onClick={() => responder(r.id, r.nome, r.telefone)} className="h-8 shrink-0 rounded-full bg-[#25D366] px-3 text-[12px] font-bold text-[#08361A]">
                          Responder
                        </button>
                      ) : (
                        <button type="button" onClick={() => marcarRespondido(r.id).then(carregar)} className="h-8 shrink-0 rounded-full border border-[var(--border)] px-3 text-[12px] font-semibold">
                          Já respondi
                        </button>
                      )}
                    </div>
                  );
                })}
                {d.responder.length > 8 && (
                  <button type="button" onClick={() => setVerTodos((v) => !v)} className="w-full border-t border-[var(--border)] px-4 py-2.5 text-[12.5px] font-semibold text-accent hover:bg-[var(--pill-bg)]">
                    {verTodos ? 'Mostrar menos' : `Ver todos (${d.responder.length})`}
                  </button>
                )}
              </section>
              <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3">
                <h2 className="text-[15px] font-bold">Tarefas e visitas</h2>
                {d.tarefas.length === 0 && <p className="py-4 text-sm text-[var(--text-muted)]">Nada para hoje. Crie tarefas na ficha de cada contato.</p>}
                {d.tarefas.map((t) => (
                  <label key={t.id} className="flex cursor-pointer items-start gap-2.5 border-t border-[var(--border)] py-2.5 first:border-t-0">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-[18px] w-[18px] accent-[#13874B]"
                      onChange={() => concluirTarefa(t.id).then(() => setD((x) => (x ? { ...x, tarefas: x.tarefas.filter((y) => y.id !== t.id) } : x)))}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold">
                        {t.tipo === 'visita' ? 'Visita: ' : t.tipo === 'ligacao' ? 'Ligar: ' : ''}
                        {t.titulo}
                      </span>
                      {t.contatoId && (
                        <Link href={`/dashboard/crm/contato/${t.contatoId}`} className="text-xs text-accent hover:underline">
                          {t.contato}
                        </Link>
                      )}
                    </span>
                    <span className={`text-xs font-bold ${t.atrasada ? 'text-[#C2410C]' : 'text-[var(--text-muted)]'}`}>{t.venceEm ? dataHora(t.venceEm) : 'sem data'}</span>
                  </label>
                ))}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
