'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useStaffSession } from '@/lib/use-staff-session';

export default function PainelLoginPage() {
  const { login } = useStaffSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const user = login(email, password);
    if (!user) {
      setError('E-mail ou senha incorretos.');
      return;
    }
    router.push('/painel');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-16">
        <h1 className="font-serif text-2xl font-semibold">Painel da equipe</h1>
        <p className="mt-1 mb-6 text-sm text-[var(--text-muted)]">Login de administrador ou corretor.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none"
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none"
          />
          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
          <button type="submit" className="mt-1 rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white hover:opacity-90">
            Entrar
          </button>
        </form>

        <div className="mt-6 rounded-lg bg-[var(--pill-bg)] p-3 text-xs text-[var(--text-muted)]">
          Contas de demonstração:
          <br />admin@maisnovos.com / admin123 (Admin)
          <br />corretor@maisnovos.com / corretor123 (Corretor)
        </div>
      </main>
    </div>
  );
}
