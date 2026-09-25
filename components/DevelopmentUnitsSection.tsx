'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAveragePricePerM2, formatPricePerM2, type Development, type PropertyDetail } from '@/lib/property-details';
import { useCreatedProperties } from '@/lib/use-created-properties';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';
import { urlImovel, urlCondominio } from '@/lib/urls';

// Começa mostrando só as unidades que já vêm com o condomínio (isso já
// renderiza no servidor, sem esperar nada) e, depois de montar, acrescenta
// qualquer imóvel avulso que tenha sido vinculado a este condomínio pelo
// painel — esses só existem no localStorage de quem cadastrou.
export default function DevelopmentUnitsSection({ development }: { development: Development }) {
  const [linkedUnits, setLinkedUnits] = useState<PropertyDetail[]>([]);
  const { items: createdProperties } = useCreatedProperties();

  useEffect(() => {
    setLinkedUnits(createdProperties.filter((p) => p.empreendimentoId === development.id));
  }, [createdProperties, development.id]);

  const allUnits = [...development.units, ...linkedUnits];

  return (
    <div className="mt-8">
      <h2 className="mb-4 text-lg font-bold">{allUnits.length > 0 ? 'Anúncios neste condomínio' : 'Ainda sem anúncios vinculados'}</h2>
      {allUnits.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Cadastre um imóvel avulso e vincule a este condomínio para ele aparecer aqui.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {[...allUnits]
            .sort((a, b) => (a.areaValue ?? parseFloat(a.area)) - (b.areaValue ?? parseFloat(b.area)))
            .map((unit) => (
              <Link
                key={unit.id}
                href={urlImovel(unit)}
                className="flex flex-col gap-2 rounded-xl border border-[var(--border)] p-4 hover:bg-[var(--pill-bg)]"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-accent">{TIPO_UNIDADE_LABEL[unit.tipoUnidade]}</div>
                <div className="font-sans tabular-nums text-lg font-bold tracking-tight">{unit.price}</div>
                <div className="text-xs text-[var(--text-muted)]">{unit.beds} · {unit.parking} · {unit.area}</div>
                <div className="text-xs text-[var(--text-faint)]">{formatPricePerM2(getAveragePricePerM2([unit]))}</div>
                <span className="mt-1 text-xs font-semibold text-accent">Ver unidade →</span>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
