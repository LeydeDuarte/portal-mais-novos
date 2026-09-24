import Link from 'next/link';
import { SITE_URL } from '@/lib/seo';

// Trilha de navegação "Início › Imóveis em Goiânia › Setor Bueno" — ajuda a pessoa
// a explorar a região e o Google a entender a estrutura do site.
export default function Trilha({ itens }: { itens: { nome: string; url: string }[] }) {
  return (
    <nav aria-label="Você está em" className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-[var(--text-muted)]">
      {itens.map((it, i) => (
        <span key={it.url} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>›</span>}
          {i === itens.length - 1 && i > 0 ? (
            <span className="font-semibold text-[var(--text)]">{it.nome}</span>
          ) : (
            <Link href={it.url.replace(SITE_URL, '') || '/'} className="font-semibold hover:text-[var(--text)] hover:underline">
              {i === 0 ? '← Início' : it.nome}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
