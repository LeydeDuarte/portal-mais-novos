import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

// Página 404: em vez de um beco sem saída, leva a pessoa de volta aos imóveis
export default function NaoEncontrado() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-5 py-20 text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-accent">Página não encontrada</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold">Este imóvel pode já ter sido vendido</h1>
        <p className="mt-3 text-[15px] text-[var(--text-muted)]">
          O endereço mudou ou o anúncio saiu do ar. Temos outras opções parecidas esperando por você.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/" className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">
            Ver imóveis à venda
          </Link>
          <Link href="/imoveis" className="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-bold hover:bg-[var(--pill-bg)]">
            Buscar por bairro
          </Link>
          <Link href="/lancamentos" className="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-bold hover:bg-[var(--pill-bg)]">
            Lançamentos
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
