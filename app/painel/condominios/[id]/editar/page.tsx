'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import DevelopmentForm from '@/components/forms/DevelopmentForm';
import { useStaffSession } from '@/lib/use-staff-session';
import { getDevelopmentForEdit, updateDevelopment, saveTipologias, type DevelopmentEditData } from '@/lib/actions';

export default function EditarCondominioPage() {
  const { id } = useParams<{ id: string }>();
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [data, setData] = useState<DevelopmentEditData | null>(null);
  const [status, setStatus] = useState<'carregando' | 'ok' | 'erro'>('carregando');
  const [aviso, setAviso] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (loaded && !staff) router.replace('/painel/login');
  }, [loaded, staff, router]);

  const carregar = () =>
    getDevelopmentForEdit(id)
      .then((d) => {
        setData(d);
        setStatus(d ? 'ok' : 'erro');
      })
      .catch(() => setStatus('erro'));

  useEffect(() => {
    if (staff) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, id]);

  if (!loaded || !staff) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-xl px-5 py-8 md:px-8">
        <Link href="/painel/condominios" className="text-sm font-semibold text-[var(--text-muted)] hover:underline">
          ← Condomínios
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <h1 className="font-serif text-2xl font-semibold">{data?.name || 'Condomínio'}</h1>
          {data && (
            <span
              className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase ${
                data.status === 'rascunho' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {data.status === 'rascunho' ? 'Rascunho' : 'Publicado'}
            </span>
          )}
        </div>
        {data && (
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {data.status === 'rascunho' ? 'Complete as informações e publique para ele aparecer no site.' : 'Está no ar. As alterações entram no site ao salvar.'}{' '}
            <Link href={`/empreendimento/${id}`} className="font-semibold text-accent hover:underline">
              Ver página
            </Link>
          </p>
        )}

        {aviso && <p className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{aviso}</p>}
        {status === 'carregando' && <p className="mt-6 text-sm text-[var(--text-muted)]">Carregando…</p>}
        {status === 'erro' && <p className="mt-6 text-sm text-red-700">Não foi possível abrir este condomínio (ou ele foi cadastrado por outro corretor).</p>}
        {status === 'ok' && data && (
          <div className="mt-5">
            <DevelopmentForm
              key={formKey}
              initial={data}
              onSave={async (fields, tipologias) => {
                setAviso(null);
                const res = await updateDevelopment(id, fields);
                if (!res.ok) return res;
                await saveTipologias(id, tipologias);
                await carregar();
                setFormKey((k) => k + 1);
                setAviso(fields.status === 'rascunho' ? 'Salvo como rascunho (não aparece no site).' : 'Publicado e atualizado no site.');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return res;
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
