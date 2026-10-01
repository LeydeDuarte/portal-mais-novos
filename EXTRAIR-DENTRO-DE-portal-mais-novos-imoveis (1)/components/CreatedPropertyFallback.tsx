'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import PropertyDetailView from '@/components/PropertyDetailView';
import { getCreatedPropertyById } from '@/lib/use-created-properties';
import type { PropertyDetail } from '@/lib/property-details';

// Só entra em cena quando o id não está no catálogo estático — checa o
// localStorage do navegador (onde ficam os imóveis cadastrados pelo painel).
// Não tem como ter metadata/SEO aqui: esse conteúdo só existe no navegador
// de quem cadastrou, o Google nunca teria acesso a ele de qualquer forma.
export default function CreatedPropertyFallback({ id }: { id: string }) {
  const [property, setProperty] = useState<PropertyDetail | null | undefined>(undefined);

  useEffect(() => {
    setProperty(getCreatedPropertyById(id));
  }, [id]);

  if (property === undefined) {
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

  return <PropertyDetailView property={property} />;
}
