'use client';

// CRM · Funil: um quadro por tipo de negócio, arrastando o cartão entre as etapas.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { CanalChip, CrmNav, Iniciais, NotaChip, OrigemChip, brl } from '@/components/crm/comum';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo } from '@/lib/papeis';
import { crmFunil, moverNegocio, type CardNegocio } from '@/lib/actions-crm';
import { FUNIS, type Funil } from '@/lib/crm-tipos';

const CORES = ['#5B6B7A', '#1A5FD0', '#6A3CFF', '#B45F06', '#13874B'];

export default function CrmFunilPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [funil, setFunil] = useState<Funil>('comprar');
  const [corretor, setCorretor] = useState('');
  const [d, setD] = useState<Awaited<ReturnType<typeof crmFunil>> | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  const carregar = () =>
    crmFunil(funil, corretor || undefined)
      .then(setD)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'));
  useEffect(() => {
    if (staff) {
      setD(null);
      carregar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, funil, corretor]);
  if (!loaded || !staff) return null;
  const gestor = veTudo(staff.role);

  const mover = async (id: string, etapa: string) => {
    let motivo: string | undefined;
    if (etapa === 'perdido') {
      const m = window.prompt('Por que foi perdido? (opcional)');
      if (m === null) return;
      motivo = m;
    }
    setD((x) => (x ? { ...x, cards: etapa === 'ganho' || etapa === 'perdido' ? x.cards.filter((c) => c.id !== id) : x.cards.map((c) => (c.id === id ? { ...c, etapa, diasNaEtapa: 0 } : c)) } : x));
    try {
      await moverNegocio(id, etapa, motivo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível mover.');
      carregar();
    }
  };

  const Card = ({ c }: { c: CardNegocio }) => (
    <div
      draggable
      onDragStart={() => setArrastando(c.id)}
      onDragEnd={() => {
        setArrastando(null);
        setSobre(null);
      }}
      className={`flex cursor-grab flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 shadow-sm active:cursor-grabbing ${arrastando === c.id ? 'opacity-50' : ''}`}
    >
      <Link href={`/dashboard/crm/contato/${c.contatoId}`} className="flex items-center gap-2">
        <Iniciais nome={c.nome} tam={28} />
        <b className="min-w-0 flex-1 truncate text-[13.5px]">{c.nome}</b>
        {gestor && c.corretor && (
          <span title={c.corretor} className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#14161A] text-[10px] font-bold text-white">
            {c.corretor.slice(0, 2).toUpperCase()}
          </span>
        )}
      </Link>
      {c.titulo && <div className="text-[12.5px] leading-snug text-[var(--text-muted)]">{c.titulo}</div>}
      <div className="flex flex-wrap items-center gap-1">
        {c.valor ? <span className="rounded-full bg-[var(--pill-bg)] px-2 py-0.5 text-[11.5px] font-bold">{brl(c.valor)}</span> : null}
        <OrigemChip origem={c.origem} />
        <CanalChip canal={c.canal} />
        <NotaChip nota={c.nota} />
      </div>
      <div className="flex gap-2.5 border-t border-dashed border-[var(--border)] pt-1.5 text-[11.5px] text-[var(--text-muted)]">
        <span>
          <b className="text-[var(--text)]">{c.stats.paginas}</b> págs
        </span>
        <span>
          <b className="text-[var(--text)]">{c.stats.condominios}</b> cond.
        </span>
        <span>
          <b className="text-[var(--text)]">{c.stats.simulacoes}</b> simul.
        </span>
        <span>
          <b className="text-[var(--text)]">{c.stats.propostas}</b> prop.
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-[11.5px] text-[var(--text-muted)]">
        <span>{c.diasNaEtapa === 0 ? 'hoje nesta etapa' : `${c.diasNaEtapa} dia${c.diasNaEtapa > 1 ? 's' : ''} nesta etapa`}</span>
        {c.proximaTarefa && <span className={`truncate font-semibold ${c.proximaTarefa.atrasada ? 'text-[#C2410C]' : ''}`}>{c.proximaTarefa.titulo}</span>}
      </div>
      {/* no celular (sem arrastar): escolher a etapa */}
      <select aria-label="Mudar etapa" value={c.etapa} onChange={(e) => mover(c.id, e.target.value)} className="mt-0.5 h-8 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 text-[12px] md:hidden">
        {d?.etapas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome}
          </option>
        ))}
        <option value="ganho">Ganho</option>
        <option value="perdido">Perdido</option>
      </select>
    </div>
  );

  const Zona = ({ id, nome, cor, cards }: { id: string; nome: string; cor: string; cards: CardNegocio[] }) => (
    <section
      onDragOver={(e) => {
        e.preventDefault();
        setSobre(id);
      }}
      onDragLeave={() => setSobre((s) => (s === id ? null : s))}
      onDrop={(e) => {
        e.preventDefault();
        if (arrastando) mover(arrastando, id);
        setArrastando(null);
        setSobre(null);
      }}
      className="flex w-[270px] shrink-0 flex-col gap-2 md:w-auto md:min-w-[220px] md:flex-1"
    >
      <div className="flex items-center gap-2 px-1">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: cor }} />
        <h2 className="text-[13.5px] font-bold">{nome}</h2>
        <span className="text-xs text-[var(--text-muted)]">{cards.length}</span>
        <span className="ml-auto text-xs font-bold text-[var(--text-muted)]">{brl(cards.reduce((a, c) => a + (c.valor ?? 0), 0)) || ''}</span>
      </div>
      <div className={`flex min-h-[120px] flex-col gap-2 rounded-2xl p-2 transition-colors ${sobre === id ? 'bg-[#DCE8FF]' : 'bg-[#EDEFF2]'}`}>
        {cards
          .slice()
          .sort((a, b) => b.nota.valor - a.nota.valor)
          .map((c) => (
            <Card key={c.id} c={c} />
          ))}
      </div>
    </section>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <CrmNav ativo="/dashboard/crm/funil" gestor={gestor} />
      <main className="w-full px-5 py-5 md:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-full border border-[var(--border)] bg-[var(--bg)] p-1">
            {FUNIS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFunil(f.id)}
                className={`h-8 rounded-full px-3.5 text-[12.5px] font-semibold ${funil === f.id ? 'bg-ink text-white' : 'hover:bg-[var(--pill-bg)]'}`}
              >
                {f.nome}
              </button>
            ))}
          </div>
          {gestor && d && (
            <select value={corretor} onChange={(e) => setCorretor(e.target.value)} className="h-10 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] font-semibold">
              <option value="">Corretor: todos</option>
              {d.corretores.map((c) => (
                <option key={c.email} value={c.email}>
                  {c.nome}
                </option>
              ))}
            </select>
          )}
          <span className="ml-auto hidden text-xs text-[var(--text-muted)] md:block">Arraste o cartão para mudar de etapa. Em cada coluna, os mais quentes ficam em cima.</span>
        </div>
        {erro && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        {!d ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : (
          <>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-4">
              {d.etapas.map((e, i) => (
                <Zona key={e.id} id={e.id} nome={e.nome} cor={CORES[i % CORES.length]} cards={d.cards.filter((c) => c.etapa === e.id)} />
              ))}
            </div>
            {/* soltar aqui para fechar */}
            <div className="mt-2 hidden gap-3 md:flex">
              {[
                ['ganho', 'Soltar aqui: ganho', '#E7F9EE', '#0B6B33'],
                ['perdido', 'Soltar aqui: perdido', '#FDECEC', '#B42318']
              ].map(([id, t, bg, tx]) => (
                <div
                  key={id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setSobre(id);
                  }}
                  onDragLeave={() => setSobre((s) => (s === id ? null : s))}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (arrastando) mover(arrastando, id);
                    setArrastando(null);
                    setSobre(null);
                  }}
                  className={`flex-1 rounded-2xl border-2 border-dashed p-4 text-center text-sm font-bold ${sobre === id ? 'opacity-100' : 'opacity-70'}`}
                  style={{ background: bg, color: tx, borderColor: tx }}
                >
                  {t}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
