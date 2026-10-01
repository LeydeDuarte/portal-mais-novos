'use client';

import { useEffect, useState } from 'react';
import GraficoIncorporadoras from './GraficoIncorporadoras';
import type { IncorporadoraFases } from '@/lib/news/mercado';

/** Capa do News: começa com Goiânia (página guardada em cache) e troca para a região do visitante */
export default function GraficoIncorporadorasRegiao({ inicial }: { inicial: IncorporadoraFases[] }) {
  const [d, setD] = useState<{ nome: string; dados: IncorporadoraFases[] }>({ nome: 'Goiás', dados: inicial });
  useEffect(() => {
    fetch('/api/news/incorporadoras')
      .then((r) => r.json())
      .then((j) => j?.dados?.length && setD(j))
      .catch(() => {});
  }, []);
  return <GraficoIncorporadoras dados={d.dados} titulo={`Quem mais está construindo em ${d.nome}`} completo linkTexto="Veja as maiores do país →" />;
}
