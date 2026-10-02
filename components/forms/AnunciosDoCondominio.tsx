'use client';

// Na edição do condomínio: "Anúncios deste condomínio". Mostra os já ligados, as
// sugestões (mesmo nome digitado, mesmo CEP ou a menos de 150 m) e uma busca livre.
// Marca vários e liga de uma vez.
import { useEffect, useState } from 'react';
import { anunciosDoCondominio, buscarAnunciosParaVincular, desvincularAnuncios, vincularAnuncios, type AnuncioParaVincular } from '@/lib/actions-vinculo';

const brl = (n: number | null) => (n ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'sem valor');

function Linha({ a, marcado, onMarcar, acao }: { a: AnuncioParaVincular; marcado?: boolean; onMarcar?: () => void; acao?: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] p-2.5 text-sm hover:bg-[var(--pill-bg)]">
      {onMarcar && <input type="checkbox" checked={!!marcado} onChange={onMarcar} className="h-4 w-4 shrink-0 accent-[#257CFF]" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">
          {a.titulo}
          {a.codigo && <span className="ml-1.5 text-xs font-normal text-[var(--text-faint)]">cód. {a.codigo}</span>}
        </span>
        <span className="block truncate text-xs text-[var(--text-muted)]">
          {[brl(a.preco), a.detalhes, a.condominio && a.condominio !== a.titulo ? `cond.: ${a.condominio}` : null, a.bairro].filter(Boolean).join(' · ')}
        </span>
      </span>
      {a.motivo && <span className="shrink-0 rounded bg-[#EEF5FF] px-1.5 py-0.5 text-[10.5px] font-bold text-accent">{a.motivo}</span>}
      {acao}
    </label>
  );
}

export default function AnunciosDoCondominio({ developmentId }: { developmentId: string }) {
  const [dados, setDados] = useState<{ vinculados: AnuncioParaVincular[]; sugestoes: AnuncioParaVincular[] } | null>(null);
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState<AnuncioParaVincular[]>([]);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [trabalhando, setTrabalhando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = () => anunciosDoCondominio(developmentId).then(setDados).catch(() => setDados({ vinculados: [], sugestoes: [] }));
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [developmentId]);
  useEffect(() => {
    if (busca.trim().length < 2) return setAchados([]);
    const t = setTimeout(() => buscarAnunciosParaVincular(busca, developmentId).then(setAchados).catch(() => setAchados([])), 350);
    return () => clearTimeout(t);
  }, [busca, developmentId]);

  const marcar = (id: string) => setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  const ligar = async () => {
    setTrabalhando(true);
    setMsg(null);
    try {
      const r = await vincularAnuncios(marcados, developmentId);
      setMsg(`${r.ok} anúncio${r.ok === 1 ? '' : 's'} ligado${r.ok === 1 ? '' : 's'} ao ${r.condominio}.`);
      setMarcados([]);
      setBusca('');
      await carregar();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Não foi possível ligar agora.');
    } finally {
      setTrabalhando(false);
    }
  };
  const desligar = async (id: string) => {
    if (!window.confirm('Desligar este anúncio do condomínio?')) return;
    await desvincularAnuncios([id]).catch(() => 0);
    await carregar();
  };

  const ligadosIds = new Set((dados?.vinculados ?? []).map((a) => a.id));
  const sugestoes = (dados?.sugestoes ?? []).filter((a) => !ligadosIds.has(a.id));
  const resultados = achados.filter((a) => !ligadosIds.has(a.id));

  return (
    <section id="anuncios" className="mt-10 scroll-mt-28 rounded-2xl border border-[var(--border)] p-5">
      <h2 className="text-lg font-bold">Anúncios deste condomínio</h2>
      <p className="mt-0.5 text-sm text-[var(--text-muted)]">Marque vários e ligue de uma vez. Ligados, eles aparecem na página do condomínio, no mapa e nos avisos.</p>
      {msg && <p className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-sm font-semibold text-emerald-800">{msg}</p>}

      <h3 className="mt-5 text-sm font-bold">Ligados ({dados?.vinculados.length ?? '…'})</h3>
      <div className="mt-2 flex flex-col gap-2">
        {dados?.vinculados.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum anúncio ligado ainda.</p>}
        {dados?.vinculados.map((a) => (
          <Linha
            key={a.id}
            a={a}
            acao={
              <button type="button" onClick={() => desligar(a.id)} className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)] hover:bg-red-50 hover:text-red-700">
                Desligar
              </button>
            }
          />
        ))}
      </div>

      <h3 className="mt-6 text-sm font-bold">Sugestões ({sugestoes.length})</h3>
      <p className="text-xs text-[var(--text-muted)]">Anúncios sem condomínio com o mesmo nome digitado, o mesmo CEP ou a menos de 150 m.</p>
      <div className="mt-2 flex flex-col gap-2">
        {sugestoes.length === 0 && dados && <p className="text-sm text-[var(--text-muted)]">Nenhuma sugestão. Use a busca abaixo.</p>}
        {sugestoes.map((a) => (
          <Linha key={a.id} a={a} marcado={marcados.includes(a.id)} onMarcar={() => marcar(a.id)} />
        ))}
      </div>

      <h3 className="mt-6 text-sm font-bold">Buscar outros anúncios</h3>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Título, nome do condomínio, bairro ou código Jetimob"
        className="mt-2 w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-accent"
      />
      <div className="mt-2 flex flex-col gap-2">
        {resultados.map((a) => (
          <Linha key={a.id} a={a} marcado={marcados.includes(a.id)} onMarcar={() => marcar(a.id)} />
        ))}
      </div>

      <div className="sticky bottom-3 mt-5 flex items-center justify-between gap-3 rounded-2xl bg-[var(--bg)] p-2 shadow-[0_-4px_14px_rgba(0,0,0,0.06)]">
        <span className="text-sm font-semibold">{marcados.length} marcado{marcados.length === 1 ? '' : 's'}</span>
        <button
          type="button"
          disabled={!marcados.length || trabalhando}
          onClick={ligar}
          className="h-11 rounded-full bg-accent px-5 text-sm font-bold text-white disabled:opacity-40"
        >
          {trabalhando ? 'Ligando…' : 'Ligar ao condomínio'}
        </button>
      </div>
    </section>
  );
}
