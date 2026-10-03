'use client';

// CRM · Contatos: busca, filtro por tipo (clientes, corretores, possíveis corretores) e novo contato.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import { CanalChip, CrmNav, Iniciais, OrigemChip, dataHora } from '@/components/crm/comum';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo } from '@/lib/papeis';
import { crmContatos, novoContato } from '@/lib/actions-crm';
import { CANAIS_MANUAIS, FUNIS, type Funil } from '@/lib/crm-tipos';

type Item = Awaited<ReturnType<typeof crmContatos>>[number];
const campo = 'h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-accent';

export default function CrmContatosPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [itens, setItens] = useState<Item[] | null>(null);
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [novo, setNovo] = useState(false);
  const [f, setF] = useState({ nome: '', telefone: '', email: '', funil: 'comprar' as Funil, titulo: '', observacao: '', canal: 'Indicação' });
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('novo')) setNovo(true);
  }, [loaded, staff, router]);
  useEffect(() => {
    if (!staff) return;
    const t = setTimeout(() => crmContatos(busca, tipo).then(setItens).catch(() => setItens([])), 250);
    return () => clearTimeout(t);
  }, [staff, busca, tipo]);
  if (!loaded || !staff) return null;
  const gestor = veTudo(staff.role);

  const salvar = async () => {
    setErro(null);
    try {
      const r = await novoContato(f);
      router.push(`/dashboard/crm/contato/${r.id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <PainelNav />
      <CrmNav ativo="/dashboard/crm/contatos" gestor={gestor} />
      <main className="mx-auto w-full max-w-5xl px-5 py-6 md:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, telefone ou e-mail" className="h-11 min-w-[240px] flex-1 rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 text-sm outline-none focus:border-accent" />
          {[
            ['todos', 'Todos'],
            ['cliente', 'Clientes'],
            ['corretor', 'Corretores'],
            ['possivel', 'Possíveis corretores']
          ].map(([v, t]) => (
            <button key={v} type="button" onClick={() => setTipo(v)} className={`h-10 rounded-full px-3.5 text-[13px] font-semibold ${tipo === v ? 'bg-ink text-white' : 'bg-[var(--pill-bg)]'}`}>
              {t}
            </button>
          ))}
          <button type="button" onClick={() => setNovo(true)} className="h-10 rounded-full bg-accent px-4 text-[13px] font-bold text-white">
            + Novo contato
          </button>
        </div>

        {novo && (
          <section className="mt-4 rounded-2xl border border-accent/40 bg-[#F5F9FF] p-4">
            <h2 className="text-[15px] font-bold">Novo contato</h2>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <input className={campo} placeholder="Nome *" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
              <input className={campo} placeholder="WhatsApp com DDD" inputMode="tel" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} />
              <input className={campo} placeholder="E-mail" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
              <select className={campo} value={f.funil} onChange={(e) => setF({ ...f, funil: e.target.value as Funil })}>
                {FUNIS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
              </select>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-[var(--text-muted)] sm:col-span-2">
                Como chegou
                <select className={campo} value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value })}>
                  {CANAIS_MANUAIS.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <input className={`${campo} sm:col-span-2`} placeholder="Interesse (condomínio, imóvel ou região)" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
              <textarea className={`${campo} h-20 py-2 sm:col-span-2`} placeholder="Observação (como chegou, o que procura…)" value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} />
            </div>
            {erro && <p className="mt-2 text-sm font-semibold text-red-600">{erro}</p>}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={salvar} className="h-10 rounded-full bg-accent px-5 text-sm font-bold text-white">
                Salvar e abrir a ficha
              </button>
              <button type="button" onClick={() => setNovo(false)} className="h-10 rounded-full border border-[var(--border)] px-4 text-sm font-semibold">
                Cancelar
              </button>
            </div>
          </section>
        )}

        {itens === null ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : itens.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Nenhum contato encontrado.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)]">
            {itens.map((c) => (
              <Link key={c.id} href={`/dashboard/crm/contato/${c.id}`} className="flex items-center gap-3 border-t border-[var(--border)] px-4 py-3 first:border-t-0 hover:bg-[var(--pill-bg)]">
                <Iniciais nome={c.nome} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <b className="text-[14px]">{c.nome}</b>
                    <OrigemChip origem={c.tipo === 'corretor' ? 'corretor' : c.origem} />
                    <CanalChip canal={c.canal} />
                    {c.possivelCorretor && c.tipo !== 'corretor' && <span className="rounded-full bg-[#FDECEC] px-2 py-0.5 text-[11px] font-bold text-[#B42318]">Possível corretor</span>}
                  </span>
                  <span className="block text-[12.5px] text-[var(--text-muted)]">
                    {[c.telefone ? `+${c.telefone}` : null, gestor ? c.corretor ?? 'sem corretor' : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="text-xs text-[var(--text-muted)]">{dataHora(c.criadoEm)}</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
