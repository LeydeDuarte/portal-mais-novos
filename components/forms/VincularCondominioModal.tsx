'use client';

// Painel → Imóveis: liga um ou vários anúncios a um condomínio (seleção em lote ou
// pelo menu ⋯ de cada anúncio). Usa o mesmo seletor de condomínio do cadastro.
import { useEffect, useState } from 'react';
import CondominioPicker from '@/components/forms/CondominioPicker';
import { listCondominios, type CondominioResumo } from '@/lib/actions';
import { vincularAnuncios } from '@/lib/actions-vinculo';

export default function VincularCondominioModal({
  ids,
  onClose,
  onDone
}: {
  ids: string[];
  onClose: () => void;
  onDone: (developmentId: string, nome: string) => void;
}) {
  const [condos, setCondos] = useState<CondominioResumo[] | null>(null);
  const [escolhido, setEscolhido] = useState<CondominioResumo | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    listCondominios().then(setCondos).catch(() => setCondos([]));
  }, []);
  const ligar = async () => {
    if (!escolhido) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await vincularAnuncios(ids, escolhido.id);
      onDone(escolhido.id, r.condominio);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível ligar agora.');
    } finally {
      setSalvando(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-3xl bg-[var(--bg)] p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Ligar a um condomínio</h2>
            <p className="text-sm text-[var(--text-muted)]">
              {ids.length} anúncio{ids.length === 1 ? '' : 's'}. O endereço vazio de cada um é completado com o do condomínio.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--pill-bg)]">
            ×
          </button>
        </div>
        <div className="mt-4">
          {condos === null ? (
            <p className="text-sm text-[var(--text-muted)]">Carregando condomínios…</p>
          ) : (
            <CondominioPicker
              condominios={condos}
              selectedId={escolhido?.id ?? ''}
              onSelect={setEscolhido}
              onCreated={(c) => {
                setCondos((l) => [c, ...(l ?? [])]);
                setEscolhido(c);
              }}
            />
          )}
        </div>
        {erro && <p className="mt-3 text-sm font-semibold text-red-600">{erro}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-11 rounded-full border border-[var(--border)] px-4 text-sm font-semibold">
            Cancelar
          </button>
          <button type="button" disabled={!escolhido || salvando} onClick={ligar} className="h-11 rounded-full bg-accent px-5 text-sm font-bold text-white disabled:opacity-40">
            {salvando ? 'Ligando…' : escolhido ? `Ligar ao ${escolhido.name}` : 'Escolha o condomínio'}
          </button>
        </div>
      </div>
    </div>
  );
}
