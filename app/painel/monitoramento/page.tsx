'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { useMarketLeads } from '@/lib/use-market-leads';
import { CIDADES_MONITORADAS, MARKET_REFERENCES } from '@/lib/market-mock';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';

const STATUS_LABEL = { novo: 'Novo', contatado: 'Contatado', descartado: 'Descartado' } as const;

export default function MonitoramentoPage() {
  const { staff, loaded } = useStaffSession();
  const { items: leads, takenIds, error, addLead, updateStatus } = useMarketLeads(loaded && !!staff);
  const router = useRouter();
  const [cidade, setCidade] = useState(CIDADES_MONITORADAS[0]);

  useEffect(() => {
    if (loaded && !staff) router.replace('/painel/login');
  }, [loaded, staff, router]);

  if (!loaded || !staff) return null;

  const referencias = MARKET_REFERENCES.filter((r) => r.cidade === cidade);
  const myLeadIds = new Set(leads.map((l) => l.id));
  const isAdmin = staff.role === 'admin';

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8">
        <h1 className="font-serif text-2xl font-semibold">Monitoramento de mercado</h1>
        <p className="mt-1 mb-2 text-sm text-[var(--text-muted)]">
          Imóveis anunciados recentemente na cidade selecionada, que ainda não estão na nossa base — use como referência pra
          contatar o proprietário e tentar a captação.
        </p>
        <p className="mb-6 rounded-lg bg-[var(--pill-bg)] p-3 text-xs text-[var(--text-muted)]">
          Protótipo com dados de exemplo — ainda sem nenhuma fonte de mercado real conectada. Nunca copiamos fotos de
          anúncios de terceiros; a ideia é só te avisar que aquele imóvel existe, pra você buscar a captação diretamente com
          o proprietário.
        </p>

        <div className="flex flex-col gap-1 mb-6">
          <label className="text-xs font-semibold text-[var(--text-muted)]">Cidade</label>
          <select
            className="w-fit rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
          >
            {CIDADES_MONITORADAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>
        ) : null}

        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-faint)]">
          {referencias.length} anúncio(s) encontrado(s) em {cidade}
        </h2>
        <div className="flex flex-col gap-3">
          {referencias.map((ref) => {
            const jaEhLead = takenIds.has(ref.id);
            const ehMeu = myLeadIds.has(ref.id);
            return (
              <div key={ref.id} className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">{TIPO_UNIDADE_LABEL[ref.tipoUnidade]}</span>
                  <span className="font-serif text-base font-semibold">{ref.precoAproximado}</span>
                  <span className="text-sm text-[var(--text-muted)]">
                    {ref.bairro}, {ref.cidade} — {ref.areaAproximada}
                    {ref.quartos !== '—' ? ` · ${ref.quartos} qts` : ''}
                  </span>
                  <span className="text-xs text-[var(--text-faint)]">Fonte: {ref.fonte}</span>
                </div>
                <button
                  type="button"
                  disabled={jaEhLead}
                  onClick={() => addLead(ref)}
                  className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-40"
                >
                  {jaEhLead ? (ehMeu ? 'Já é seu lead' : 'Lead de outro corretor') : 'Marcar como lead'}
                </button>
              </div>
            );
          })}
        </div>

        <h2 className="mt-10 mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-faint)]">
          {isAdmin ? 'Leads de captação da equipe' : 'Meus leads de captação'} ({leads.length})
        </h2>
        {leads.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhum lead marcado ainda.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {leads.map((lead) => (
              <div key={lead.leadId} className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="font-serif text-base font-semibold">{lead.precoAproximado}</span>
                  <span className="text-sm text-[var(--text-muted)]">{lead.bairro}, {lead.cidade}</span>
                  {isAdmin && lead.corretorEmail ? (
                    <span className="text-xs text-[var(--text-faint)]">Corretor: {lead.corretorEmail}</span>
                  ) : null}
                </div>
                <select
                  className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold"
                  value={lead.status}
                  onChange={(e) => updateStatus(lead.leadId, e.target.value as typeof lead.status)}
                >
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
