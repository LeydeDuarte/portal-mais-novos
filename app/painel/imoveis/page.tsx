'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { useCreatedProperties } from '@/lib/use-created-properties';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';

export default function MeusImoveisPage() {
  const { staff, loaded } = useStaffSession();
  const { items, remove } = useCreatedProperties();
  const router = useRouter();

  useEffect(() => {
    if (loaded && !staff) router.replace('/painel/login');
  }, [loaded, staff, router]);

  if (!loaded || !staff) return null;

  const visible = staff.role === 'admin' ? items : items.filter((p) => p.corretorEmail === staff.email);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-2xl font-semibold">Meus imóveis</h1>
          <Link href="/painel/imoveis/novo" className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white hover:opacity-90">
            + Cadastrar
          </Link>
        </div>

        {visible.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Nenhum imóvel cadastrado ainda.</p>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {visible.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">{TIPO_UNIDADE_LABEL[p.tipoUnidade]}</span>
                  <span className="font-serif text-base font-semibold">{p.price}</span>
                  <span className="text-sm text-[var(--text-muted)]">{p.location}</span>
                  {staff.role === 'admin' && p.corretorEmail && (
                    <span className="text-xs text-[var(--text-faint)]">Cadastrado por {p.corretorEmail}</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Link href={`/imovel/${p.id}`} className="text-sm font-semibold text-accent hover:underline">
                    Ver
                  </Link>
                  <button type="button" onClick={() => remove(p.id)} className="text-sm font-semibold text-red-600 hover:underline">
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
