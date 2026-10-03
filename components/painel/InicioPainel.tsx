'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import PainelNav from '@/components/PainelNav';
import { veTudo } from '@/lib/papeis';
import InstalarApp from '@/components/InstalarApp';
import OtimizarFotos from '@/components/OtimizarFotos';
import { GRUPOS, podeVer, rotuloFerramenta, soAdminPrincipal, type Ferramenta } from '@/lib/painel-menu';
import { CORES_DO_CEU, SAUDACAO_DA_FASE, dataPorExtenso, faseDoDia, fraseDoDia, type FaseDoDia } from '@/lib/frases';
import SolNascente from '@/components/painel/SolNascente';
import FraseDoDia from '@/components/painel/FraseDoDia';
import IconeFerramenta from '@/components/painel/IconeFerramenta';
import PanoramaCRM from '@/components/painel/PanoramaCRM';

const CHAVE_GRUPOS = 'mn_painel_grupos';

/** Grupo de ferramentas: no celular abre e recolhe com um toque (começa recolhido e
 *  o aparelho lembra o que ficou aberto); no computador fica sempre aberto. */
function Grupo({ id, titulo, resumo, aberto, alternar, children }: { id: string; titulo: string; resumo: string; aberto: boolean; alternar: () => void; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`grupo-${id}`} className={`min-w-0 rounded-2xl border md:rounded-none md:border-0 ${aberto ? 'border-transparent' : 'border-[var(--border)]'}`}>
      <h2 id={`grupo-${id}`} className="font-serif text-[19px] font-semibold tracking-tight">
        <button
          type="button"
          onClick={alternar}
          aria-expanded={aberto}
          aria-controls={`conteudo-${id}`}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent md:pointer-events-none md:mb-3 md:p-0"
        >
          <span className="min-w-0 flex-1">
            <span className="block">{titulo}</span>
            {!aberto && <span className="block truncate font-sans text-[12.5px] font-normal tracking-normal text-[var(--text-muted)] md:hidden">{resumo}</span>}
          </span>
          <span aria-hidden className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--pill-bg)] font-sans text-[15px] transition-transform md:hidden ${aberto ? 'rotate-90' : ''}`}>
            ›
          </span>
        </button>
      </h2>
      <div id={`conteudo-${id}`} className={aberto ? 'block' : 'hidden md:block'}>
        {children}
      </div>
    </section>
  );
}

// Início do painel: saudação, frase do dia com o sol nascendo, e as ferramentas
// em quatro grupos. Cada pessoa só vê o que pode usar; o que só o administrador
// principal vê leva um asterisco (*).
export default function InicioPainel({ staff, count, financeiro, previaCrm, fase: faseFixa }: { staff: { name: string; role: string }; count: number | null; financeiro: boolean; previaCrm?: import('@/lib/actions-crm').Panorama; fase?: FaseDoDia }) {
  const primeiroNome = staff.name.trim().split(/\s+/)[0] || staff.name;
  const gestor = veTudo(staff.role);
  const frase = fraseDoDia();
  const fase = faseFixa ?? faseDoDia();
  const grupos = GRUPOS.map((g) => ({ ...g, itens: g.itens.filter((f) => podeVer(f, staff.role, financeiro)) })).filter((g) => g.itens.length);
  const temAsterisco = grupos.some((g) => g.itens.some(soAdminPrincipal));
  const [abertos, setAbertos] = useState<string[]>([]);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(CHAVE_GRUPOS) ?? '[]');
      if (Array.isArray(v)) setAbertos(v.filter((x) => typeof x === 'string'));
    } catch {
      /* sem memória do aparelho: tudo recolhido */
    }
  }, []);
  const alternar = (id: string) =>
    setAbertos((l) => {
      const novo = l.includes(id) ? l.filter((x) => x !== id) : [...l, id];
      try {
        localStorage.setItem(CHAVE_GRUPOS, JSON.stringify(novo));
      } catch {
        /* ignora */
      }
      return novo;
    });
  const resumoDo = (itens: Ferramenta[]) => {
    const nomes = itens.map((f) => rotuloFerramenta(f, staff.role));
    return `${itens.length} ${itens.length === 1 ? 'ferramenta' : 'ferramentas'}: ${nomes.join(', ')}`;
  };
  const descricao = (f: Ferramenta) =>
    f.href === '/dashboard/imoveis' && count != null ? (gestor ? `${count} anúncio(s) de toda a equipe.` : `${count} anúncio(s) cadastrado(s) por você.`) : f.descricao;

  return (
    <div className="flex min-h-screen flex-col">
      <PainelNav />
      <main className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-6 md:px-6 md:pt-8">
        {/* Abertura: saudação + frase do dia, com o sol nascendo */}
        <section className="relative overflow-hidden rounded-[28px] bg-[var(--ceu)] transition-colors" style={CORES_DO_CEU[fase] as React.CSSProperties}>
          <div className="grid md:grid-cols-[1fr_minmax(260px,380px)]">
            <div className="relative z-10 px-6 pb-8 pt-2 md:px-10 md:py-10">
              <p className="text-[14px] text-[var(--ceu-suave)]" suppressHydrationWarning>
                {dataPorExtenso().replace(/^./, (c) => c.toUpperCase())}
              </p>
              <h1 className="mt-1 font-serif text-[30px] font-semibold leading-tight tracking-tight text-[var(--ceu-texto)] md:text-[40px]" suppressHydrationWarning>
                {SAUDACAO_DA_FASE[fase]}, {primeiroNome}!
              </h1>
              <div className="mt-6 md:mt-8">
                <FraseDoDia frase={frase} grande />
              </div>
              <div className="mt-8 flex flex-wrap gap-2.5">
                <Link href="/dashboard/imoveis/novo" className="flex h-11 items-center gap-2 rounded-full bg-[var(--ceu-botao)] px-5 text-[14px] font-semibold text-[var(--ceu-botao-texto)] hover:opacity-90">
                  <span className="text-lg leading-none">+</span> Cadastrar imóvel
                </Link>
                <Link href="/dashboard/imoveis" className="flex h-11 items-center rounded-full border border-[var(--border)] bg-[var(--bg)] px-5 text-[14px] font-semibold text-[var(--text)] hover:border-accent hover:text-accent">
                  {gestor ? 'Imóveis' : 'Meus imóveis'}
                  {count != null && <span className="ml-2 rounded-full bg-[var(--pill-bg)] px-2 py-0.5 text-[12px] tabular-nums">{count}</span>}
                </Link>
                <Link href="/dashboard/crm" className="flex h-11 items-center rounded-full border border-[var(--border)] bg-[var(--bg)] px-5 text-[14px] font-semibold text-[var(--text)] hover:border-accent hover:text-accent">
                  CRM
                </Link>
              </div>
            </div>
            {/* no celular o sol fica em cima, como um nascer do dia; no computador, à direita */}
            <div className="order-first flex items-end justify-center px-10 pt-6 md:order-none md:px-6 md:pt-0">
              <SolNascente fase={fase} className="h-auto w-[220px] md:w-full md:max-w-[360px]" />
            </div>
          </div>
        </section>

        {/* Panorama do CRM, no nível de cada um */}
        <div className="mt-6">
          <PanoramaCRM previa={previaCrm} />
        </div>

        {/* Ferramentas */}
        <div className="mt-8 grid gap-x-10 gap-y-3 md:mt-10 md:gap-y-10 lg:grid-cols-2">
          {grupos.map((g) => (
            <Grupo key={g.titulo} id={g.titulo} titulo={g.titulo} resumo={resumoDo(g.itens)} aberto={abertos.includes(g.titulo)} alternar={() => alternar(g.titulo)}>
              <ul className="grid gap-1 px-1 pb-2 sm:grid-cols-2 md:px-0 md:pb-0">
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
            </Grupo>
          ))}
        </div>

        {temAsterisco && (
          <p className="mt-4 px-1 text-[13px] text-[var(--text-muted)] md:mt-6 md:px-0">
            <span className="font-bold text-accent">*</span> Só o administrador principal vê estes itens. O resto da equipe não tem acesso a eles.
          </p>
        )}

        {/* Do aparelho */}
        <div className="mt-3 md:mt-12">
          <Grupo id="aparelho" titulo="No seu aparelho" resumo={gestor ? 'Instalar o app no celular, otimizar fotos do feed' : 'Instalar o app no celular'} aberto={abertos.includes('aparelho')} alternar={() => alternar('aparelho')}>
            <div className="grid gap-4 px-1 pb-2 sm:grid-cols-2 md:px-0 md:pb-0">
              <InstalarApp />
              {gestor && <OtimizarFotos />}
            </div>
          </Grupo>
        </div>
      </main>
    </div>
  );
}
