'use client';

import Link from 'next/link';
import PainelNav from '@/components/PainelNav';
import { veTudo } from '@/lib/papeis';
import InstalarApp from '@/components/InstalarApp';
import OtimizarFotos from '@/components/OtimizarFotos';
import { GRUPOS, podeVer, rotuloFerramenta, soAdminPrincipal, type Ferramenta } from '@/lib/painel-menu';
import { dataPorExtenso, fraseDoDia, saudacao } from '@/lib/frases';
import SolNascente from '@/components/painel/SolNascente';
import FraseDoDia from '@/components/painel/FraseDoDia';
import IconeFerramenta from '@/components/painel/IconeFerramenta';
import PanoramaCRM from '@/components/painel/PanoramaCRM';

// Início do painel: saudação, frase do dia com o sol nascendo, e as ferramentas
// em quatro grupos. Cada pessoa só vê o que pode usar; o que só o administrador
// principal vê leva um asterisco (*).
export default function InicioPainel({ staff, count, financeiro, previaCrm }: { staff: { name: string; role: string }; count: number | null; financeiro: boolean; previaCrm?: import('@/lib/actions-crm').Panorama }) {
  const primeiroNome = staff.name.trim().split(/\s+/)[0] || staff.name;
  const gestor = veTudo(staff.role);
  const frase = fraseDoDia();
  const grupos = GRUPOS.map((g) => ({ ...g, itens: g.itens.filter((f) => podeVer(f, staff.role, financeiro)) })).filter((g) => g.itens.length);
  const temAsterisco = grupos.some((g) => g.itens.some(soAdminPrincipal));
  const descricao = (f: Ferramenta) =>
    f.href === '/dashboard/imoveis' && count != null ? (gestor ? `${count} anúncio(s) de toda a equipe.` : `${count} anúncio(s) cadastrado(s) por você.`) : f.descricao;

  return (
    <div className="flex min-h-screen flex-col">
      <PainelNav />
      <main className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-6 md:px-6 md:pt-8">
        {/* Abertura: saudação + frase do dia, com o sol nascendo */}
        <section className="relative overflow-hidden rounded-[28px] bg-[var(--ceu)]">
          <div className="grid md:grid-cols-[1fr_minmax(260px,380px)]">
            <div className="relative z-10 px-6 pb-8 pt-2 md:px-10 md:py-10">
              <p className="text-[14px] text-[var(--text-muted)]" suppressHydrationWarning>
                {dataPorExtenso().replace(/^./, (c) => c.toUpperCase())}
              </p>
              <h1 className="mt-1 font-serif text-[30px] font-semibold leading-tight tracking-tight text-[var(--ceu-texto)] md:text-[40px]" suppressHydrationWarning>
                {saudacao()}, {primeiroNome}!
              </h1>
              <div className="mt-6 md:mt-8">
                <FraseDoDia frase={frase} grande />
              </div>
              <div className="mt-8 flex flex-wrap gap-2.5">
                <Link href="/dashboard/imoveis/novo" className="flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-white hover:opacity-90">
                  <span className="text-lg leading-none">+</span> Cadastrar imóvel
                </Link>
                <Link href="/dashboard/imoveis" className="flex h-11 items-center rounded-full border border-[var(--border)] bg-[var(--bg)] px-5 text-[14px] font-semibold text-[var(--text)] hover:border-accent hover:text-accent">
                  {gestor ? 'Imóveis' : 'Meus imóveis'}
                  {count != null && <span className="ml-2 rounded-full bg-[var(--ceu)] px-2 py-0.5 text-[12px] tabular-nums">{count}</span>}
                </Link>
                <Link href="/dashboard/crm" className="flex h-11 items-center rounded-full border border-[var(--border)] bg-[var(--bg)] px-5 text-[14px] font-semibold text-[var(--text)] hover:border-accent hover:text-accent">
                  CRM
                </Link>
              </div>
            </div>
            {/* no celular o sol fica em cima, como um nascer do dia; no computador, à direita */}
            <div className="order-first flex items-end justify-center px-10 pt-6 md:order-none md:px-6 md:pt-0">
              <SolNascente className="h-auto w-[220px] md:w-full md:max-w-[360px]" />
            </div>
          </div>
        </section>

        {/* Panorama do CRM, no nível de cada um */}
        <div className="mt-6">
          <PanoramaCRM previa={previaCrm} />
        </div>

        {/* Ferramentas */}
        <div className="mt-10 grid gap-x-10 gap-y-10 lg:grid-cols-2">
          {grupos.map((g) => (
            <section key={g.titulo} aria-labelledby={`grupo-${g.titulo}`}>
              <h2 id={`grupo-${g.titulo}`} className="mb-3 font-serif text-[19px] font-semibold tracking-tight">
                {g.titulo}
              </h2>
              <ul className="grid gap-1 sm:grid-cols-2">
                {g.itens.map((f) => (
                  <li key={f.href}>
                    <Link
                      href={f.href}
                      className="group flex items-start gap-3 rounded-2xl px-3 py-3 outline-none transition-colors hover:bg-[var(--pill-bg)] focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--ceu)] text-accent">
                        <IconeFerramenta nome={f.icone} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14.5px] font-semibold leading-tight">
                          {rotuloFerramenta(f, staff.role)}
                          {soAdminPrincipal(f) && (
                            <span className="ml-0.5 font-bold text-accent" title="Só o administrador principal vê">
                              *
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-snug text-[var(--text-muted)]">{descricao(f)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {temAsterisco && (
          <p className="mt-6 text-[13px] text-[var(--text-muted)]">
            <span className="font-bold text-accent">*</span> Só o administrador principal vê estes itens. O resto da equipe não tem acesso a eles.
          </p>
        )}

        {/* Do aparelho */}
        <section className="mt-12" aria-labelledby="grupo-aparelho">
          <h2 id="grupo-aparelho" className="mb-3 font-serif text-[19px] font-semibold tracking-tight">
            No seu aparelho
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <InstalarApp />
            {gestor && <OtimizarFotos />}
          </div>
        </section>
      </main>
    </div>
  );
}
