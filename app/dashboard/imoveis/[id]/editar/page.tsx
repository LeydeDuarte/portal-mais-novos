'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import PropertyForm from '@/components/forms/PropertyForm';
import { useStaffSession } from '@/lib/use-staff-session';
import { getPropertyForEdit, updateProperty, type PropertyEditData } from '@/lib/actions';

export default function EditarImovelPage() {
  const { id } = useParams<{ id: string }>();
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [data, setData] = useState<PropertyEditData | null>(null);
  const [status, setStatus] = useState<'carregando' | 'ok' | 'erro' | 'salvo'>('carregando');

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);

  useEffect(() => {
    if (!staff) return;
    getPropertyForEdit(id)
      .then((d) => {
        setData(d);
        setStatus(d ? 'ok' : 'erro');
      })
      .catch(() => setStatus('erro'));
  }, [staff, id]);

  if (!loaded || !staff) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-xl px-5 py-8 md:px-8">
        <Link href="/dashboard/imoveis" className="text-sm font-semibold text-[var(--text-muted)] hover:underline">
          ← Meus imóveis
        </Link>
        <h1 className="mt-3 font-serif text-2xl font-semibold">Editar imóvel</h1>

        {status === 'carregando' && <p className="mt-6 text-sm text-[var(--text-muted)]">Carregando…</p>}
        {status === 'erro' && <p className="mt-6 text-sm text-red-700">Não foi possível abrir este imóvel (ele pode ter sido excluído, ou foi cadastrado por outro corretor).</p>}
        {status === 'salvo' && (
          <div className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-800">Alterações salvas e já no ar.</p>
            <div className="flex gap-3">
              <Link href={`/imovel/${id}`} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white">
                Ver o imóvel
              </Link>
              <button type="button" onClick={() => setStatus('ok')} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold">
                Continuar editando
              </button>
            </div>
          </div>
        )}
        {status === 'ok' && data && (
          <div className="mt-5">
            <PropertyForm
              initial={data}
              submitLabel="Salvar alterações"
              onSave={async (fields) => {
                await updateProperty(id, fields);
                const fresh = await getPropertyForEdit(id);
                if (fresh) setData(fresh);
                setStatus('salvo');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
