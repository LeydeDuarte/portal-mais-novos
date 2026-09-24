'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { listCondominios, type CondominioResumo } from '@/lib/actions';

function normalize(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function CondominiosPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [items, setItems] = useState<CondominioResumo[] | null>(null);
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'rascunho' | 'publicado'>('todos');
  const [limite, setLimite] = useState(100);

  useEffect(() => {
    if (loaded && !staff) router.replace('/painel/login');
  }, [loaded, staff, router]);

  useEffect(() => {
    if (staff) listCondominios().then(setItems).catch(() => setItems([]));
  }, [staff]);

  const lista = useMemo(() => {
    const tokens = normalize(q).split(/\s+/).filter(Boolean);
    return (items ?? []).filter(
      (c) => (filtro === 'todos' || c.status === filtro) && tokens.every((t) => normalize(`${c.name} ${c.bairro ?? ''} ${c.cidade ?? ''}`).includes(t))
    );
  }, [items, q, filtro]);

  if (!loaded || !staff) return null;
  const rascunhos = (items ?? []).filter((c) => c.status === 'rascunho').length;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-semibold">Condomínios</h1>
            <p className="text-sm text-[var(--text-muted)]">
              {rascunhos > 0 ? `${rascunhos} rascunho(s) esperando para ser finalizado(s) e publicado(s).` : 'Todos os condomínios cadastrados.'}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <Link href="/painel/condominios/importar" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-bold hover:bg-[var(--pill-bg)]">
              Importar planilha
            </Link>
            <Link href="/painel/imoveis/novo" className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white hover:opacity-90">
              + Cadastrar
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, bairro ou cidade"
            className="min-w-[220px] flex-1 rounded-full border border-[var(--border)] px-4 py-2 text-sm outline-none"
          />
          {(['todos', 'rascunho', 'publicado'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={`rounded-full px-3.5 py-2 text-sm font-semibold ${filtro === f ? 'bg-ink text-white' : 'bg-[var(--pill-bg)] hover:bg-[var(--pill-bg-hover)]'}`}
            >
              {f === 'todos' ? 'Todos' : f === 'rascunho' ? 'Rascunhos' : 'Publicados'}
            </button>
          ))}
        </div>

        {items === null ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Nenhum condomínio encontrado.</p>
        ) : (
          <div className="mt-5 flex flex-col gap-3">
            <p className="text-xs text-[var(--text-muted)]">{lista.length} condomínio(s){lista.length > limite ? ` — mostrando ${limite}; use a busca para achar um específico` : ''}</p>
            {lista.slice(0, limite).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] p-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-serif text-base font-semibold">{c.name}</span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        c.status === 'rascunho' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <span className="text-sm text-[var(--text-muted)]">{[c.bairro, c.cidade].filter(Boolean).join(', ') || 'Sem endereço'}</span>
                  <span className="text-xs text-[var(--text-faint)]">
                    {c.anuncios} imóvel(is) à venda · {c.tipologias} tipologia(s) · {c.temFotos ? 'com fotos' : 'sem fotos'}
                    {staff.role === 'admin' && c.corretorEmail ? ` · ${c.corretorEmail}` : ''}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {c.status === 'publicado' && (
                    <Link href={`/empreendimento/${c.id}`} className="text-sm font-semibold text-accent hover:underline">
                      Ver
                    </Link>
                  )}
                  <Link
                    href={`/painel/condominios/${c.id}/editar`}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${c.status === 'rascunho' ? 'bg-ink text-white' : 'border border-[var(--border)]'}`}
                  >
                    {c.status === 'rascunho' ? 'Finalizar' : 'Editar'}
                  </Link>
                </div>
              </div>
            ))}
            {lista.length > limite && (
              <button type="button" onClick={() => setLimite((l) => l + 200)} className="self-center rounded-full bg-[var(--pill-bg)] px-4 py-2 text-sm font-semibold hover:bg-[var(--pill-bg-hover)]">
                Mostrar mais
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
