'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import DocumentoProposta, { tituloArquivoProposta } from '@/components/DocumentoProposta';
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
  // "Baixar" da lista: abre já pedindo o PDF
  useEffect(() => {
    if (p && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('baixar') === '1') {
      const tm = setTimeout(() => imprimirProposta(tituloArquivoProposta(p)), 600);
      return () => clearTimeout(tm);
    }
  }, [p]);
  if (!loaded || !staff) return null;

  const tel = (p?.compradores[0]?.telefone ?? p?.comprador.telefone ?? '').replace(/\D/g, '');
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
              <button type="button" onClick={() => imprimirProposta(tituloArquivoProposta(p))} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white">
                Baixar PDF / imprimir
              </button>
              {(['aceita', 'recusada', 'cancelada'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={async () => {
                    setP({ ...p, status: st });
                    await mudarStatusProposta(p.id, st).catch(() => {});
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-bold ${
                    p.status === st
                      ? st === 'aceita'
                        ? 'bg-green-600 text-white'
                        : st === 'recusada'
                          ? 'bg-red-600 text-white'
                          : 'bg-[var(--text-muted)] text-white'
                      : 'bg-[var(--pill-bg)] hover:bg-[var(--pill-bg-hover)]'
                  }`}
                >
                  {st === 'aceita' ? 'Aceita' : st === 'recusada' ? 'Recusada' : 'Cancelar'}
                </button>
              ))}
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
                  compradores: p.compradores,
                  vendedores: p.vendedores,
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
