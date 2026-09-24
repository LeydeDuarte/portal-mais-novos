'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { listClientes, type ClienteLinha } from '@/lib/cliente-auth';

// Pessoas que entraram com o Google (um registro por e-mail, sem repetição).
// Para marketing, usar só quem marcou "quero receber oportunidades".
export default function ClientesPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [rows, setRows] = useState<ClienteLinha[] | null>(null);
  const [soMarketing, setSoMarketing] = useState(true);

  useEffect(() => {
    if (loaded && !staff) router.replace('/painel/login');
  }, [loaded, staff, router]);
  useEffect(() => {
    if (staff) listClientes().then(setRows).catch(() => setRows([]));
  }, [staff]);

  if (!loaded || !staff) return null;
  const lista = (rows ?? []).filter((r) => !soMarketing || r.aceitaMarketing);

  const exportar = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const linhas = [
      ['nome', 'email', 'aceita_marketing', 'aceitou_termos_em', 'cadastrado_em', 'ultimo_login', 'logins', 'favoritos'].join(','),
      ...lista.map((r) =>
        [esc(r.nome ?? ''), esc(r.email), r.aceitaMarketing ? 'sim' : 'nao', r.aceitouTermosEm ?? '', r.criadoEm, r.ultimoLoginEm, r.logins, r.favoritos].join(',')
      )
    ];
    const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `clientes-mais-novos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-semibold">Clientes</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Quem entrou no site com o Google e aceitou os Termos de uso — cada e-mail aparece uma vez só.</p>
          </div>
          <button type="button" onClick={exportar} disabled={!lista.length} className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">
            Baixar planilha (CSV)
          </button>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={soMarketing} onChange={(e) => setSoMarketing(e.target.checked)} />
          Só quem aceitou receber marketing ({(rows ?? []).filter((r) => r.aceitaMarketing).length} de {(rows ?? []).length})
        </label>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--pill-bg)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">E-mail</th>
                <th className="px-3 py-2">Marketing</th>
                <th className="px-3 py-2">Desde</th>
                <th className="px-3 py-2 text-right">Favoritos</th>
              </tr>
            </thead>
            <tbody>
              {rows === null && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-[var(--text-muted)]">Carregando…</td>
                </tr>
              )}
              {rows && lista.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-[var(--text-muted)]">Ninguém ainda.</td>
                </tr>
              )}
              {lista.map((r) => (
                <tr key={r.email} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-semibold">{r.nome}</td>
                  <td className="px-3 py-2">{r.email}</td>
                  <td className="px-3 py-2">{r.aceitaMarketing ? 'Sim' : 'Não'}</td>
                  <td className="px-3 py-2">{new Date(r.criadoEm).toLocaleDateString('pt-BR')}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.favoritos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
