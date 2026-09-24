'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { getPropertiesByCorretor, deleteProperty } from '@/lib/actions';
import type { PropertyDetail } from '@/lib/property-details';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';

export default function MeusImoveisPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [items, setItems] = useState<PropertyDetail[]>([]);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (loaded && !staff) router.replace('/painel/login');
  }, [loaded, staff, router]);

  useEffect(() => {
    if (staff) {
      getPropertiesByCorretor(staff.email, staff.role === 'admin').then((rows) => {
        setItems(rows);
        setFetched(true);
      });
    }
  }, [staff]);

  const handleRemove = async (id: string) => {
    if (!window.confirm('Excluir este imóvel? Isso não pode ser desfeito.')) return;
    await deleteProperty(id);
    setItems((prev) => prev.filter((p) => p.id !== id));
  };

  if (!loaded || !staff) return null;

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

        {!fetched ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Nenhum imóvel cadastrado ainda.</p>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {items.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">{TIPO_UNIDADE_LABEL[p.tipoUnidade]}</span>
                  <span className="font-sans tabular-nums text-base font-bold tracking-tight">{p.price}</span>
                  <span className="text-sm text-[var(--text-muted)]">
                    {p.condominio ? `${p.condominio} · ` : ''}
                    {p.location}
                  </span>
                  <span className="text-xs text-[var(--text-faint)]">{p.photos?.length ? `${p.photos.length} foto(s)` : 'Sem fotos — edite para adicionar'}</span>
                  {staff.role === 'admin' && p.corretorEmail && (
                    <span className="text-xs text-[var(--text-faint)]">Cadastrado por {p.corretorEmail}</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Link href={`/imovel/${p.id}`} className="text-sm font-semibold text-accent hover:underline">
                    Ver
                  </Link>
                  <Link href={`/painel/imoveis/${p.id}/editar`} className="rounded-full bg-ink px-3.5 py-1.5 text-sm font-bold text-white hover:opacity-90">
                    Editar
                  </Link>
                  <button type="button" onClick={() => handleRemove(p.id)} className="text-sm font-semibold text-red-600 hover:underline">
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
