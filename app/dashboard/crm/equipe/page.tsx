'use client';

// CRM · Equipe e distribuição (analista e admin): contatos sem corretor e a carteira de cada um.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { CanalChip, CrmNav, Iniciais, OrigemChip, tempoDesde } from '@/components/crm/comum';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo } from '@/lib/papeis';
import { atribuirContato, crmEquipe } from '@/lib/actions-crm';

export default function CrmEquipePage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [d, setD] = useState<Awaited<ReturnType<typeof crmEquipe>> | null>(null);
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (loaded && (!staff || !veTudo(staff.role))) router.replace(staff ? '/dashboard/crm' : '/dashboard/login');
  }, [loaded, staff, router]);
  const carregar = () =>
    crmEquipe()
      .then(setD)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'));
  useEffect(() => {
    if (staff && veTudo(staff.role)) carregar();
  }, [staff]);
  if (!loaded || !staff || !veTudo(staff.role)) return null;
  // sugestão: quem tem menos contatos sem resposta, depois menos contatos ativos (só corretores e analistas)
  const sugestao = d?.carteira.filter((c) => c.papel !== 'admin').sort((a, b) => a.semResposta - b.semResposta || a.ativos - b.ativos)[0]?.email ?? d?.carteira[0]?.email ?? '';

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <CrmNav ativo="/dashboard/crm/equipe" gestor />
      <main className="mx-auto w-full max-w-6xl px-5 py-6 md:px-8">
        <h1 className="text-2xl font-bold">Equipe e distribuição</h1>
        <p className="text-sm text-[var(--text-muted)]">Quem está atendendo o quê, e o que ainda não tem dono. Contatos que chegam por um anúncio já vão para o corretor do anúncio.</p>
        {erro && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        {!d ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : (
          <>
            <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)]">
              <h2 className="px-4 py-3 text-[15px] font-bold">Sem corretor ({d.semDono.length})</h2>
              {d.semDono.length === 0 && <p className="border-t border-[var(--border)] px-4 py-5 text-sm text-[var(--text-muted)]">Todos os contatos têm corretor.</p>}
              {d.semDono.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] px-4 py-3">
                  <Iniciais nome={c.nome} />
                  <Link href={`/dashboard/crm/contato/${c.id}`} className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <b className="text-[14px]">{c.nome}</b>
                      <OrigemChip origem={c.tipo === 'corretor' ? 'corretor' : c.origem} />
                      <CanalChip canal={c.canal} />
                    </span>
                    <span className="block truncate text-[12.5px] text-[var(--text-muted)]">{c.ultimaEntrada}</span>
                  </Link>
                  <span className="text-xs font-bold text-[#C2410C]">{tempoDesde(c.esperandoDesde)}</span>
                  <select
                    aria-label="Atribuir a"
                    value={escolha[c.id] ?? sugestao}
                    onChange={(e) => setEscolha({ ...escolha, [c.id]: e.target.value })}
                    className="h-9 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 text-[12.5px] font-semibold"
                  >
                    {d.carteira.map((p) => (
                      <option key={p.email} value={p.email}>
                        {p.nome}
                        {p.email === sugestao ? ' (sugestão)' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      atribuirContato(c.id, escolha[c.id] ?? sugestao)
                        .then(carregar)
                        .catch((e) => setErro(e.message))
                    }
                    className="h-9 rounded-full bg-accent px-4 text-[12.5px] font-bold text-white"
                  >
                    Atribuir
                  </button>
                </div>
              ))}
            </section>

            <section className="mt-5 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg)]">
              <div className="flex items-baseline justify-between px-4 py-3">
                <h2 className="text-[15px] font-bold">Carteira por corretor</h2>
                <span className="text-xs text-[var(--text-muted)]">visitas e propostas: últimos 30 dias</span>
              </div>
              <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                    <th className="px-4 py-2 text-left">Corretor</th>
                    <th className="px-3 py-2 text-right">Contatos</th>
                    <th className="px-3 py-2 text-right">Sem resposta</th>
                    <th className="px-3 py-2 text-right">Tempo de resposta</th>
                    <th className="px-3 py-2 text-right">Visitas</th>
                    <th className="px-4 py-2 text-right">Propostas</th>
                  </tr>
                </thead>
                <tbody>
                  {d.carteira.map((p) => (
                    <tr key={p.email} className="border-t border-[var(--border)]">
                      <td className="px-4 py-2.5">
                        <b>{p.nome}</b> <span className="text-xs text-[var(--text-muted)]">{p.papel}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.ativos}</td>
                      <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${p.semResposta > 0 ? 'text-[#C2410C]' : ''}`}>{p.semResposta}</td>
                      <td className={`px-3 py-2.5 text-right tabular-nums ${p.respostaMin != null && p.respostaMin > 60 ? 'font-bold text-[#C2410C]' : ''}`}>
                        {p.respostaMin == null ? '–' : p.respostaMin >= 60 ? `${Math.floor(p.respostaMin / 60)} h ${p.respostaMin % 60} min` : `${p.respostaMin} min`}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.visitas}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{p.propostas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
