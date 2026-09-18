import Header from '@/components/Header';
import Footer from '@/components/Footer';

// Página própria, ainda vazia — o financiamento vai ganhar seu próprio fluxo
// (simulação, análise de crédito) mais adiante, separado do feed de imóveis.
export default function FinanciamentoPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 py-24 text-center">
        <h1 className="font-serif text-2xl font-semibold">Financiamento</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Em breve.</p>
      </main>
      <Footer />
    </div>
  );
}
