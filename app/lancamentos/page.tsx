import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { DEVELOPMENTS } from '@/lib/property-details';
import { getStatusBadge, isFutureDelivery } from '@/lib/classification';

export default function LancamentosPage() {
  // Só entram aqui empreendimentos cuja data de entrega ainda não passou —
  // depois que passa, as unidades continuam existindo, só que já aparecem
  // como "Usado" no feed geral do Comprar, não mais agrupadas como lançamento.
  const upcoming = DEVELOPMENTS.filter((d) => isFutureDelivery(d.deliveryDate));

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8">
        <h1 className="font-serif text-2xl font-semibold">Lançamentos e empreendimentos</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Unidades na planta e em construção, agrupadas por empreendimento.</p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {upcoming.map((dev) => {
            const badge = getStatusBadge(dev.deliveryDate);
            return (
            <Link
              key={dev.id}
              href={`/empreendimento/${dev.id}`}
              className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-[var(--border)] hover:bg-[var(--pill-bg)]"
            >
              <div className="flex items-center justify-center bg-[var(--card-img-bg)]" style={{ height: 180 }}>
                <span className="text-xs text-[var(--text-faint)]">[FOTO DO EMPREENDIMENTO]</span>
              </div>
              <div className="flex flex-col gap-1 px-4 pb-4">
                <span
                  className="w-fit rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                  style={{ background: badge.bg, color: badge.color }}
                >
                  {badge.text}
                </span>
                <div className="font-serif text-lg font-semibold">{dev.name}</div>
                <div className="text-sm text-[var(--text-muted)]">{dev.location}</div>
                <div className="text-xs text-[var(--text-faint)]">{dev.units.length} unidades disponíveis</div>
              </div>
            </Link>
            );
          })}
        </div>
      </main>

      <Footer />
    </div>
  );
}
