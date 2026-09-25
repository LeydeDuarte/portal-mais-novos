'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { listInteresses, updateInteresseStatus, type InteresseLead } from '@/lib/actions';

const STATUS_LABEL = { novo: 'Novo', contatado: 'Contatado', descartado: 'Descartado' } as const;
const brl = (n: number | null) => (n ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : null);

function whatsappLink(tel: string, nome: string, condo: string) {
  const d = tel.replace(/\D/g, '');
  const num = d.startsWith('55') ? d : `55${d}`;
  const msg = `Olá, ${nome.split(' ')[0]}! Aqui é da Mais Novos Imóveis. Vi que você tem interesse em imóveis no ${condo}.`;
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

// Pessoas que registraram interesse em um condomínio ("Quer um imóvel no X?")
export default function InteressadosPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [items, setItems] = useState<InteresseLead[] | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'novo' | 'contatado' | 'descartado'>('todos');
  const [condo, setCondo] = useState('');

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);

  useEffect(() => {
    if (staff) listInteresses().then(setItems).catch(() => setItems([]));
  }, [staff]);

  const condos = useMemo(() => Array.from(new Set((items ?? []).map((i) => i.condominio))).sort(), [items]);
  const lista = (items ?? []).filter((i) => (filtro === 'todos' || i.status === filtro) && (!condo || i.condominio === condo));

  const mudarStatus = async (id: string, status: InteresseLead['status']) => {
    setItems((prev) => prev?.map((i) => (i.id === id ? { ...i, status } : i)) ?? prev);
    await updateInteresseStatus(id, status).catch(() => undefined);
  };

  if (!loaded || !staff) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8">
        <h1 className="font-serif text-2xl font-semibold">Interessados</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Pessoas que pediram para ser avisadas quando surgir um imóvel num condomínio. Quando um imóvel é cadastrado no condomínio, elas recebem um e-mail
          automático (se o envio de e-mail estiver configurado).
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <select value={condo} onChange={(e) => setCondo(e.target.value)} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm">
            <option value="">Todos os condomínios</option>
            {condos.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {(['todos', 'novo', 'contatado', 'descartado'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFiltro(s)}
              className={`rounded-full px-3.5 py-2 text-sm font-semibold ${filtro === s ? 'bg-ink text-white' : 'bg-[var(--pill-bg)] hover:bg-[var(--pill-bg-hover)]'}`}
            >
              {s === 'todos' ? 'Todos' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {items === null ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Nenhum interessado ainda.</p>
        ) : (
          <div className="mt-5 flex flex-col gap-3">
            {lista.map((i) => (
              <div key={i.id} className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-4 md:flex-row md:items-start md:justify-between">
                <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-serif text-base font-semibold">{i.nome}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${i.finalidade === 'aluguel' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}`}>
                      {i.finalidade === 'aluguel' ? 'Quer alugar' : 'Quer comprar'}
                    </span>
                    {i.descadastrado && <span className="rounded bg-[var(--pill-bg)] px-1.5 py-0.5 text-[10px] font-bold uppercase">cancelou avisos</span>}
                  </div>
                  <span>
                    {i.developmentId ? (
                      <Link href={`/empreendimento/${i.developmentId}`} className="font-semibold text-accent hover:underline">
                        {i.condominio}
                      </Link>
                    ) : (
                      <strong>{i.condominio}</strong>
                    )}
                  </span>
                  <span className="text-[var(--text-muted)]">
                    {[
                      i.areaMin || i.areaMax ? `${i.areaMin ?? '?'} a ${i.areaMax ?? '?'} m²` : null,
                      i.valorMax ? `até ${brl(i.valorMax)}` : null,
                      i.quartos ? `${i.quartos}+ quartos` : null
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Sem preferências informadas'}
                  </span>
                  {i.mensagem && <span className="text-[var(--text-muted)]">“{i.mensagem}”</span>}
                  <span className="text-xs text-[var(--text-faint)]">
                    {new Date(i.criadoEm).toLocaleString('pt-BR')}
                    {i.ultimoAviso ? ` · último aviso enviado em ${new Date(i.ultimoAviso).toLocaleDateString('pt-BR')}` : ''}
                  </span>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {i.telefone && (
                    <a href={whatsappLink(i.telefone, i.nome, i.condominio)} target="_blank" rel="noreferrer" className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:opacity-90">
                      WhatsApp
                    </a>
                  )}
                  {i.email && (
                    <a href={`mailto:${i.email}`} className="rounded-full border border-[var(--border)] px-3.5 py-1.5 text-xs font-bold hover:bg-[var(--pill-bg)]">
                      E-mail
                    </a>
                  )}
                  <select value={i.status} onChange={(e) => mudarStatus(i.id, e.target.value as InteresseLead['status'])} className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold">
                    {Object.entries(STATUS_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
