import Header from '@/components/Header';
import Footer from '@/components/Footer';

// Página própria, ainda vazia — vai virar o blog/editorial (o "News" definido
// na conversa sobre a estrutura de páginas), separado do feed de imóveis.
export default function NewsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 py-24 text-center">
        <h1 className="font-serif text-2xl font-semibold">News</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Em breve.</p>
      </main>
      <Footer />
    </div>
  );
}
