'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DetailFavoriteButton from '@/components/DetailFavoriteButton';
import { getPropertyDetail, getDevelopment, type PropertyDetail } from '@/lib/property-details';
import { getCreatedPropertyById } from '@/lib/use-created-properties';
import { getStatusBadge } from '@/lib/classification';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';

const BED_PATH = 'M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6 M3 18h18 M5 10V7a2 2 0 0 1 2-2h3v5';

export default function ImovelPage({ params }: { params: { id: string } }) {
  // O catálogo de exemplo é estático (funciona em qualquer navegador); os
  // imóveis cadastrados pelo painel só existem no localStorage do navegador
  // de quem cadastrou — por isso o segundo é buscado à parte, depois de
  // montar, em vez de os dois virem prontos direto do servidor.
  const staticProperty = getPropertyDetail(params.id);
  const [createdProperty, setCreatedProperty] = useState<PropertyDetail | null | undefined>(undefined);

  useEffect(() => {
    if (!staticProperty) setCreatedProperty(getCreatedPropertyById(params.id));
  }, [params.id, staticProperty]);

  const property = staticProperty ?? createdProperty;

  if (!staticProperty && createdProperty === undefined) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <h1 className="font-serif text-xl font-semibold">Imóvel não encontrado</h1>
          <Link href="/" className="text-sm font-semibold text-accent hover:underline">
            ← Voltar para a Home
          </Link>
        </main>
      </div>
    );
  }

  const development = property.empreendimentoId ? getDevelopment(property.empreendimentoId) : null;
  const siblings = development ? development.units.filter((u) => u.id !== property.id) : [];
  const badge = getStatusBadge(property.deliveryDate);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8">
        <Link href="/" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text)]">
          ← Voltar para a Home
        </Link>

        <div className="grid gap-8 md:grid-cols-[1.3fr_1fr]">
          <div>
            <div
              className={`relative flex items-center justify-center overflow-hidden rounded-2xl bg-[var(--card-img-bg)] ${
                property.video ? 'video-playing' : ''
              }`}
              style={{ height: 360 }}
            >
              <span className="text-sm text-[var(--text-faint)]">{property.video ? '[CAPA EM VÍDEO]' : '[FOTO]'}</span>
              <div className="absolute left-3 top-3 flex items-center gap-2">
                <span
                  className="rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wide"
                  style={{ background: badge.bg, color: badge.color }}
                >
                  {badge.text}
                </span>
                {property.finalidade === 'aluguel' && (
                  <span className="rounded-md bg-ink/70 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                    Aluguel
                  </span>
                )}
                {property.aceitaTemporada && (
                  <span className="flex items-center gap-1.5 rounded-md bg-emerald-700/85 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="7" width="18" height="13" rx="2" />
                      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Aceita temporada
                  </span>
                )}
              </div>
            </div>

            <div className="mt-6">
              <h2 className="mb-2 text-lg font-bold">Sobre o imóvel</h2>
              <p className="text-sm leading-relaxed text-[var(--text-muted)]">{property.description}</p>
            </div>

            <div className="mt-6">
              <h2 className="mb-3 text-lg font-bold">O que tem no condomínio</h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {property.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-accent">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    {a}
                  </li>
                ))}
              </ul>
            </div>

            {development && (
              <div className="mt-6">
                <h2 className="mb-1 text-lg font-bold">Faz parte de um lançamento</h2>
                <Link href={`/empreendimento/${development.id}`} className="text-sm font-semibold text-accent hover:underline">
                  Ver o empreendimento {development.name} →
                </Link>

                {siblings.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-faint)]">Outras unidades deste empreendimento</span>
                    {siblings.map((s) => (
                      <Link
                        key={s.id}
                        href={`/imovel/${s.id}`}
                        className="flex items-center justify-between rounded-lg border border-[var(--border)] px-4 py-3 text-sm hover:bg-[var(--pill-bg)]"
                      >
                        <span>{s.beds} · {s.area}</span>
                        <span className="font-semibold">{s.price}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-5">
            <div className="rounded-2xl border border-[var(--border)] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-accent">{TIPO_UNIDADE_LABEL[property.tipoUnidade]}</div>
              <div className="font-serif text-2xl font-semibold">{property.price}</div>
              <div className="mt-1 text-sm text-[var(--text-muted)]">{property.location}</div>

              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-[var(--border)] pt-4">
                <span className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={BED_PATH} />
                  </svg>
                  {property.beds}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                  {property.parking}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3h7v7H3z" />
                    <path d="M14 14h7v7h-7z" />
                    <path d="M10 6.5h4" />
                    <path d="M17.5 10v4" />
                  </svg>
                  {property.area}
                </span>
              </div>

              <div className="mt-5">
                <DetailFavoriteButton propertyId={property.id} />
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] p-5">
              <h3 className="mb-3 text-sm font-bold">Falar com um corretor</h3>
              {/* Formulário só de interface — sem envio real ainda. Em produção isso
                  vira um `lead` na tabela do documento de arquitetura, com o imóvel
                  e o corretor responsável já associados. */}
              <form className="flex flex-col gap-2.5">
                <input type="text" placeholder="Seu nome" className="rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none" />
                <input type="tel" placeholder="WhatsApp" className="rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none" />
                <textarea placeholder="Mensagem" rows={3} className="resize-none rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none" />
                <button type="button" className="rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white hover:opacity-90">
                  Enviar interesse
                </button>
              </form>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
