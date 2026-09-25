'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { ROLE_LABEL, veTudo } from '@/lib/papeis';
import InstalarApp from '@/components/InstalarApp';
import OtimizarFotos from '@/components/OtimizarFotos';
import { getPropertiesByCorretor } from '@/lib/actions';

export default function PainelPage() {
  const { staff, loaded, logout } = useStaffSession();
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);

  useEffect(() => {
    if (staff) getPropertiesByCorretor(staff.email, veTudo(staff.role)).then((rows) => setCount(rows.length));
  }, [staff]);

  if (!loaded || !staff) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-semibold">Olá, {staff.name}</h1>
            <span className="text-sm text-[var(--text-muted)]">
              {ROLE_LABEL[staff.role] ?? 'Corretor'} · {staff.email}
            </span>
          </div>
          <button
            type="button"
            onClick={async () => {
              await logout();
              window.location.href = '/dashboard/login';
            }}
            className="rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
          >
            Sair
          </button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/dashboard/imoveis/novo"
            className="flex flex-col gap-1 rounded-xl border border-[var(--border)] p-5 hover:bg-[var(--pill-bg)]"
          >
            <span className="font-serif text-lg font-semibold">Cadastrar imóvel ou condomínio</span>
            <span className="text-sm text-[var(--text-muted)]">Imóvel avulso, ou um empreendimento com várias unidades vinculadas.</span>
          </Link>

          <Link
            href="/dashboard/imoveis"
            className="flex flex-col gap-1 rounded-xl border border-[var(--border)] p-5 hover:bg-[var(--pill-bg)]"
          >
            <span className="font-serif text-lg font-semibold">{veTudo(staff.role) ? 'Imóveis' : 'Meus imóveis'}</span>
            <span className="text-sm text-[var(--text-muted)]">{count ?? '…'} {veTudo(staff.role) ? 'anúncio(s) de toda a equipe.' : 'cadastrado(s) por você.'}</span>
          </Link>

          <Link
            href="/dashboard/cadastro-ia"
            className="flex flex-col gap-1 rounded-xl border border-[var(--border)] p-5 hover:bg-[var(--pill-bg)]"
          >
            <span className="font-serif text-lg font-semibold">Cadastro assistido por IA</span>
            <span className="text-sm text-[var(--text-muted)]">Cole o texto do anúncio e revise o rascunho antes de publicar.</span>
          </Link>

          <Link
            href="/dashboard/monitoramento"
            className="flex flex-col gap-1 rounded-xl border border-[var(--border)] p-5 hover:bg-[var(--pill-bg)]"
          >
            <span className="font-serif text-lg font-semibold">Monitoramento de mercado</span>
            <span className="text-sm text-[var(--text-muted)]">Imóveis anunciados na cidade que ainda não estão na nossa base.</span>
          </Link>

          <InstalarApp />

          {veTudo(staff.role) && <OtimizarFotos />}

          {staff.role === 'admin' && (
            <Link href="/dashboard/equipe" className="flex flex-col gap-1 rounded-xl border border-[var(--border)] p-5 hover:bg-[var(--pill-bg)]">
              <span className="font-serif text-lg font-semibold">Equipe</span>
              <span className="text-sm text-[var(--text-muted)]">Adicionar analistas e corretores, trocar senha, remover acesso.</span>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
