import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ContatoLateral from '@/components/ContatoLateral';
import type { AnuncioOculto } from '@/lib/actions';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';
import IconeOlhoCortado from '@/components/IconeOlhoCortado';
import { brlCurto, tituloOculto } from '@/lib/ocultos';

// Página pública de um anúncio PRIVADO: mostra só o resumo (bom para o Google
// e para IAs encontrarem) e convida a pessoa a pedir o anúncio completo.
export default function OcultoView({ a, bloqueado = false }: { a: AnuncioOculto; bloqueado?: boolean }) {
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
              <IconeOlhoCortado size={12} strokeWidth={2.4} />
              Anúncio privado
            </span>
            <h1 className="mt-3 font-serif text-2xl font-semibold">{titulo}</h1>

            <div className="mt-5 flex h-[260px] flex-col items-center justify-center gap-3 rounded-2xl bg-[#1d2026] px-6 text-center text-white">
              <IconeOlhoCortado size={44} strokeWidth={1.6} className="opacity-90" />
              <p className="text-lg font-extrabold uppercase tracking-[0.2em]">Anúncio privado</p>
              <p className="max-w-md text-sm text-white/70">Fotos e endereço disponíveis sob solicitação.</p>
            </div>

            {bloqueado && (
              <div className="mt-6 rounded-2xl border border-[#e62f2f]/40 bg-[#fff5f5] p-5">
                <h2 className="text-base font-bold">Este link é pessoal</h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                  Ele foi liberado para outra pessoa e só abre no aparelho dela. Quer ver este imóvel? Deixe seu nome e telefone ao lado e o nosso
                  atendimento envia um link exclusivo para você.
                </p>
              </div>
            )}
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
                referencia={`Anúncio reservado ${a.id} · ${titulo} · /imovel/${a.id}`}
                whatsapp={{ titulo: `Anúncio privado: ${titulo}`, caminho: `/imovel/${a.id}`, condominio: a.condominio ?? undefined }}
                mensagemInicial={
                  bloqueado
                    ? `Olá! Recebi o link do anúncio ${titulo}, mas ele não abriu no meu aparelho. Podem me enviar um link?`
                    : `Olá! Quero ver o anúncio privado: ${titulo}. Ainda está disponível?`
                }
              />
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
