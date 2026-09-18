'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Header from '@/components/Header';
import { useStaffSession } from '@/lib/use-staff-session';
import { useCreatedProperties } from '@/lib/use-created-properties';

export default function PainelPage() {
  const { staff, loaded, logout } = useStaffSession();
  const { items } = useCreatedProperties();
  const router = useRouter();

  useEffect(() => {
    if (loaded && !staff) router.replace('/painel/login');
  }, [loaded, staff, router]);

  if (!loaded || !staff) return null;

  const myProperties = staff.role === 'admin' ? items : items.filter((p) => p.corretorEmail === staff.email);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-semibold">Olá, {staff.name}</h1>
            <span className="text-sm text-[var(--text-muted)]">
              {staff.role === 'admin' ? 'Administrador' : 'Corretor'} · {staff.email}
            </span>
          </div>
          <button type="button" onClick={logout} className="text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text)]">
            Sair
          </button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/painel/imoveis/novo"
            className="flex flex-col gap-1 rounded-xl border border-[var(--border)] p-5 hover:bg-[var(--pill-bg)]"
          >
            <span className="font-serif text-lg font-semibold">Cadastrar imóvel ou condomínio</span>
            <span className="text-sm text-[var(--text-muted)]">Imóvel avulso, ou um empreendimento com várias unidades vinculadas.</span>
          </Link>

          <Link
            href="/painel/imoveis"
            className="flex flex-col gap-1 rounded-xl border border-[var(--border)] p-5 hover:bg-[var(--pill-bg)]"
          >
            <span className="font-serif text-lg font-semibold">Meus imóveis</span>
            <span className="text-sm text-[var(--text-muted)]">{myProperties.length} cadastrado(s) por você.</span>
          </Link>

          {staff.role === 'admin' && (
            <div className="flex flex-col gap-1 rounded-xl border border-dashed border-[var(--border)] p-5 opacity-60">
              <span className="font-serif text-lg font-semibold">Gerenciar corretores</span>
              <span className="text-sm text-[var(--text-muted)]">Em breve — convidar, desativar contas.</span>
            </div>
          )}
          {staff.role === 'admin' && (
            <div className="flex flex-col gap-1 rounded-xl border border-dashed border-[var(--border)] p-5 opacity-60">
              <span className="font-serif text-lg font-semibold">Cadastro por IA</span>
              <span className="text-sm text-[var(--text-muted)]">Em breve — subir PDF/fotos e a IA preenche.</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
