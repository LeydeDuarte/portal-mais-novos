import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ContatoLateral from '@/components/ContatoLateral';
import type { AnuncioOculto } from '@/lib/actions';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';
import { brlCurto, tituloOculto } from '@/lib/ocultos';

// Página pública de um anúncio PRIVADO: mostra só o resumo (bom para o Google
// e para IAs encontrarem) e convida a pessoa a pedir o anúncio completo.
export default function OcultoView({ a }: { a: AnuncioOculto }) {
  const titulo = tituloOculto(a);
  const itens = [
    ['Tipo', TIPO_UNIDADE_LABEL[a.tipoUnidade]],
    ['Finalidade', a.finalidade === 'aluguel' ? 'Aluguel' : 'Venda'],
    ['Quartos', a.quartos ? String(a.quartos) : null],
    ['Vagas', a.vagas ? String(a.vagas) : null],
    ['Área', a.area ? `${a.area.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²` : null],
    ['Valor', a.preco ? brlCurto(a.preco) : 'Sob consulta'],
    ['Valor do m²', a.precoM2 ? `${brlCurto(a.precoM2)}/m²` : null],
    ['Condomínio', a.condominio ?? null],
    ['Localização', [a.bairro, a.cidade].filter(Boolean).join(', ') || null]
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8">
        <Link href="/" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text)]">
          ← Voltar para a Home
        </Link>
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-xs font-bold text-white">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              Anúncio reservado
            </span>
            <h1 className="mt-3 font-serif text-2xl font-semibold">{titulo}</h1>

            <div className="mt-5 flex h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--pill-bg)] px-6 text-center">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-faint)]" aria-hidden>
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              <p className="max-w-md text-sm text-[var(--text-muted)]">Fotos e endereço disponíveis sob solicitação.</p>
            </div>

            <div className="mt-6 rounded-2xl border border-accent/40 bg-[#f5f8ff] p-5">
              <h2 className="text-base font-bold">Este imóvel está oculto para o público em geral</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                O proprietário não autorizou a publicação aberta deste anúncio, por isso ele não aparece nas buscas com fotos e endereço. Mas você pode
                solicitar: fale com o nosso atendimento para verificar a disponibilidade e receber o anúncio completo, com fotos, localização e todos os
                detalhes.
              </p>
            </div>

            <h2 className="mt-8 mb-3 text-lg font-bold">Características</h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {itens.map(([k, v]) => (
                <div key={k} className="rounded-xl border border-[var(--border)] p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">{k}</dt>
                  <dd className={`mt-0.5 font-semibold ${k.startsWith('Valor') ? 'font-sans tabular-nums' : ''}`}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <aside>
            <div className="md:sticky md:top-24">
              <ContatoLateral
                titulo="Quero ver este imóvel"
                condominio={a.condominio || titulo}
                referencia={`Anúncio reservado ${a.id} — ${titulo} — /imovel/${a.id}`}
                mensagemInicial={`Olá! Quero ver o anúncio reservado: ${titulo}. Ainda está disponível?`}
              />
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
