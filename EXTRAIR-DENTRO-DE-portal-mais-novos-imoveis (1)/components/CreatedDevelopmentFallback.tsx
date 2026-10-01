'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import DevelopmentDetailView from '@/components/DevelopmentDetailView';
import { getCreatedDevelopmentById } from '@/lib/use-created-developments';
import type { Development } from '@/lib/property-details';

export default function CreatedDevelopmentFallback({ id }: { id: string }) {
  const [development, setDevelopment] = useState<Development | null | undefined>(undefined);

  useEffect(() => {
    setDevelopment(getCreatedDevelopmentById(id));
  }, [id]);

  if (development === undefined) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
      </div>
    );
  }

  if (!development) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <h1 className="font-serif text-xl font-semibold">Empreendimento não encontrado</h1>
          <Link href="/" className="text-sm font-semibold text-accent hover:underline">
            ← Voltar para a Home
          </Link>
        </main>
      </div>
    );
  }

  return <DevelopmentDetailView development={development} />;
}
