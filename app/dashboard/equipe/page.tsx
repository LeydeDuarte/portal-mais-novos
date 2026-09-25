'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { listarEquipe, removerMembro, salvarMembro, type MembroEquipe } from '@/lib/actions';
import { ROLE_LABEL, type StaffRole } from '@/lib/papeis';

const DESCRICAO: Record<StaffRole, string> = {
  admin: 'Vê e edita tudo, gerencia a equipe e a migração.',
  analista: 'Vê e edita todos os anúncios e condomínios, inclusive dos corretores; cadastra imóveis e notícias.',
  corretor: 'Cadastra e edita só os próprios anúncios.'
};

const vazio = { email: '', name: '', role: 'corretor' as StaffRole, senha: '' };

export default function EquipePage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [form, setForm] = useState(vazio);
  const [editando, setEditando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  useEffect(() => {
    if (loaded && (!staff || staff.role !== 'admin')) router.replace(staff ? '/dashboard' : '/dashboard/login');
  }, [loaded, staff, router]);
  const carregar = () => listarEquipe().then(setMembros).catch(() => {});
  useEffect(() => {
    if (staff?.role === 'admin') carregar();
  }, [staff]);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await salvarMembro(form);
    if (!r.ok) return setMsg({ ok: false, t: r.erro ?? 'Não foi possível salvar.' });
    setMsg({ ok: true, t: editando ? 'Alterações salvas.' : `${form.name} já pode entrar no painel com o e-mail ${form.email}.` });
    setForm(vazio);
    setEditando(false);
    carregar();
  };

  const remover = async (m: MembroEquipe) => {
    if (!window.confirm(`Remover o acesso de ${m.name}?`)) return;
    const transferir = m.imoveis > 0 && window.confirm(`${m.name} tem ${m.imoveis} imóvel(is). Passar esses anúncios para você? (Cancelar = continuam no nome dela/dele)`);
    const r = await removerMembro(m.email, transferir ? staff!.email : undefined);
    setMsg(r.ok ? { ok: true, t: 'Acesso removido.' } : { ok: false, t: r.erro ?? 'Falhou.' });
    carregar();
  };

  if (!loaded || staff?.role !== 'admin') return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8">
        <h1 className="font-serif text-2xl font-semibold">Equipe</h1>
        <ul className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
          {(Object.keys(DESCRICAO) as StaffRole[]).map((r) => (
            <li key={r}>
              <strong className="text-[var(--text)]">{ROLE_LABEL[r]}:</strong> {DESCRICAO[r]}
            </li>
          ))}
        </ul>

        {msg && (
          <p className={`mt-4 rounded-lg p-3 text-sm font-semibold ${msg.ok ? 'border border-emerald-300 bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{msg.t}</p>
        )}

        <form onSubmit={salvar} className="mt-5 grid gap-3 rounded-2xl border border-[var(--border)] p-4 sm:grid-cols-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)] sm:col-span-2">{editando ? `Editar ${form.name}` : 'Adicionar pessoa'}</h2>
          <input required placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
          <input
            required
            type="email"
            placeholder="E-mail (login)"
            value={form.email}
            disabled={editando}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-60"
          />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
            {(Object.keys(ROLE_LABEL) as StaffRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <input
            type="text"
            autoComplete="new-password"
            placeholder={editando ? 'Nova senha (deixe em branco para manter)' : 'Senha inicial (mín. 8 caracteres)'}
            value={form.senha}
            onChange={(e) => setForm({ ...form, senha: e.target.value })}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-white hover:opacity-90">
              {editando ? 'Salvar' : 'Adicionar'}
            </button>
            {editando && (
              <button type="button" onClick={() => (setForm(vazio), setEditando(false))} className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-[var(--pill-bg)]">
                Cancelar
              </button>
            )}
          </div>
        </form>

        <ul className="mt-6 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)]">
          {membros.map((m) => (
            <li key={m.email} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="font-semibold">
                  {m.name} <span className="ml-1 rounded bg-[var(--pill-bg)] px-1.5 py-0.5 text-[11px] font-bold uppercase">{ROLE_LABEL[m.role] ?? m.role}</span>
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {m.email} · {m.imoveis} imóvel(is)
                </div>
              </div>
              <div className="flex gap-3 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setForm({ email: m.email, name: m.name, role: m.role, senha: '' });
                    setEditando(true);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-accent hover:underline"
                >
                  Editar
                </button>
                {m.email !== staff.email && (
                  <button type="button" onClick={() => remover(m)} className="text-red-600 hover:underline">
                    Remover
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
