'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import DocumentoProposta from '@/components/DocumentoProposta';
import { useStaffSession } from '@/lib/use-staff-session';
import { excluirProposta, getProposta, mudarStatusProposta, type Proposta } from '@/lib/actions-propostas';
import { STATUS_PROPOSTA } from '@/lib/proposta-textos';
import { imprimirProposta } from '@/lib/imprimir-proposta';

export default function PropostaDetalhe({ params }: { params: { id: string } }) {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [p, setP] = useState<Proposta | null | undefined>(undefined);

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  useEffect(() => {
    if (staff) getProposta(params.id).then(setP).catch(() => setP(null));
  }, [staff, params.id]);
  if (!loaded || !staff) return null;

  const tel = (p?.comprador.telefone ?? '').replace(/\D/g, '');
  const wa = tel ? `https://wa.me/${tel.startsWith('55') ? tel : `55${tel}`}` : null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8">
        <Link href="/dashboard/propostas" className="text-sm font-semibold text-[var(--text-muted)] hover:underline">
          ← Propostas
        </Link>
        {p === undefined ? (
          <p className="mt-6 text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : p === null ? (
          <p className="mt-6 text-sm text-[var(--text-muted)]">Proposta não encontrada ou sem permissão.</p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={imprimirProposta} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white">
                Salvar em PDF / imprimir
              </button>
              <Link href={`/dashboard/propostas/nova?id=${p.id}`} className="rounded-full bg-[var(--pill-bg)] px-4 py-2 text-sm font-bold hover:bg-[var(--pill-bg-hover)]">
                Editar
              </Link>
              <select
                value={p.status}
                onChange={async (e) => {
                  const status = e.target.value as Proposta['status'];
                  setP({ ...p, status });
                  await mudarStatusProposta(p.id, status).catch(() => {});
                }}
                className="rounded-full border border-[var(--border)] px-3.5 py-2 text-sm font-semibold"
              >
                {Object.entries(STATUS_PROPOSTA).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              {wa && (
                <a href={wa} target="_blank" rel="noopener" className="rounded-full bg-[#16A34A] px-4 py-2 text-sm font-bold text-white">
                  WhatsApp do comprador
                </a>
              )}
              {p.propertyId && (
                <Link href={`/dashboard/propostas/nova?imovel=${p.propertyId}`} className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-[var(--pill-bg)]">
                  + Outra proposta neste imóvel
                </Link>
              )}
              <button
                type="button"
                onClick={async () => {
                  if (!confirm('Apagar esta proposta?')) return;
                  await excluirProposta(p.id);
                  router.push('/dashboard/propostas');
                }}
                className="ml-auto rounded-full px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Apagar
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Para gerar o PDF: &quot;Salvar em PDF&quot; → no destino escolha &quot;Salvar como PDF&quot;. Feita por {p.corretor?.nome ?? p.criadoPor} em{' '}
              {new Date(p.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.
            </p>
            <div className="mt-6">
              <DocumentoProposta
                d={{
                  numero: p.numero,
                  imovel: p.imovelTexto ?? '',
                  unidade: p.unidade,
                  comprador: p.comprador,
                  vendedor: p.vendedor,
                  corretor: p.corretor,
                  valor: p.valor,
                  formas: p.formas,
                  entrada: p.entrada,
                  condicoes: p.condicoes,
                  validadeDias: p.validadeDias,
                  data: p.criadoEm
                }}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
