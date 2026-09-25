'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import PropertyForm from '@/components/forms/PropertyForm';
import DevelopmentForm from '@/components/forms/DevelopmentForm';
import PreenchimentoRapido from '@/components/forms/PreenchimentoRapido';
import { useStaffSession } from '@/lib/use-staff-session';
import { createProperty, createDevelopment, saveTipologias, type PropertyEditData } from '@/lib/actions';

type Sucesso = { kind: 'imovel' | 'condominio'; id: string; status?: 'rascunho' | 'publicado' };

export default function NovoImovelPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [modo, setModo] = useState<'imovel' | 'empreendimento'>('imovel');
  const [success, setSuccess] = useState<Sucesso | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [inicial, setInicial] = useState<PropertyEditData | undefined>(undefined);
  const [resumo, setResumo] = useState<string[]>([]);

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);

  if (!loaded || !staff) return null;

  if (success) {
    const isCondo = success.kind === 'condominio';
    const rascunho = success.status === 'rascunho';
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <PainelNav />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center">
          <h1 className="font-serif text-2xl font-semibold">
            {isCondo ? (rascunho ? 'Condomínio salvo como rascunho' : 'Condomínio publicado!') : 'Imóvel publicado!'}
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            {isCondo
              ? rascunho
                ? 'Ele ainda não aparece no site. Termine o cadastro quando quiser em Painel → Condomínios.'
                : 'Já aparece no feed e em Lançamentos. Os imóveis vinculados a ele aparecem na página do condomínio.'
              : 'Já está publicado, aparece no feed do Comprar e tem página própria.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={isCondo ? (rascunho ? `/dashboard/condominios/${success.id}/editar` : `/empreendimento/${success.id}`) : `/imovel/${success.id}`}
              className="rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
            >
              {isCondo ? (rascunho ? 'Continuar editando' : 'Ver condomínio') : 'Ver o imóvel'}
            </a>
            <button
              type="button"
              onClick={() => {
                setSuccess(null);
                setInicial(undefined);
                setResumo([]);
                setFormKey((k) => k + 1);
              }}
              className="rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--pill-bg)]"
            >
              Cadastrar outro
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-xl px-5 py-8 md:px-8">
        <h1 className="font-serif text-2xl font-semibold">Cadastrar</h1>
        <p className="mt-1 mb-5 text-sm text-[var(--text-muted)]">Cadastro manual. Depois dá para editar tudo em Meus imóveis ou Condomínios.</p>

        <div className="mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => setModo('imovel')}
            className={`flex-1 rounded-full px-4 py-2.5 text-sm font-bold ${modo === 'imovel' ? 'bg-ink text-white' : 'bg-[var(--pill-bg)] hover:bg-[var(--pill-bg-hover)]'}`}
          >
            Imóvel
          </button>
          <button
            type="button"
            onClick={() => setModo('empreendimento')}
            className={`flex-1 rounded-full px-4 py-2.5 text-sm font-bold ${modo === 'empreendimento' ? 'bg-ink text-white' : 'bg-[var(--pill-bg)] hover:bg-[var(--pill-bg-hover)]'}`}
          >
            Condomínio / Empreendimento
          </button>
        </div>

        {modo === 'imovel' && (
          <PreenchimentoRapido
            onAplicar={(d, res) => {
              setInicial(d);
              setResumo(res);
              setFormKey((k) => k + 1);
            }}
          />
        )}
        {modo === 'imovel' && resumo.length > 0 && (
          <div className="mb-5 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
            <strong>Preenchido automaticamente, confira antes de publicar:</strong> {resumo.join(' · ')}
          </div>
        )}
        {modo === 'imovel' ? (
          <PropertyForm
            key={`p${formKey}`}
            initial={inicial}
            submitLabel="Publicar imóvel"
            onSave={async (fields) => {
              const id = `manual-${Date.now()}`;
              await createProperty({ ...fields, id });
              setSuccess({ kind: 'imovel', id });
            }}
          />
        ) : (
          <DevelopmentForm
            key={`d${formKey}`}
            onSave={async (fields, tipologias) => {
              const id = `condo-${Date.now()}`;
              const res = await createDevelopment({ ...fields, id });
              if (!res.ok) return res;
              if (tipologias.length) await saveTipologias(id, tipologias);
              setSuccess({ kind: 'condominio', id, status: fields.status });
              return res;
            }}
          />
        )}
      </main>
    </div>
  );
}
