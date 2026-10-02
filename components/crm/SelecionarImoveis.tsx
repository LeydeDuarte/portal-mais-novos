'use client';

// Escolher imóveis para o cliente: sugestões pelo que ele procura (ou busca livre),
// marca vários e envia pelo WhatsApp. Cada imóvel vai com um link curto rastreado
// (maisnovosimoveis.com/r/...), que avisa na ficha quando ele abre.
import { useEffect, useState } from 'react';
import { enviarImoveis, opcoesParaEnviar, type OpcaoEnvio } from '@/lib/actions-crm';
import { brl, linkWhats } from '@/components/crm/comum';

export default function SelecionarImoveis({ contatoId, telefone, onClose, onEnviado }: { contatoId: string; telefone: string | null; onClose: () => void; onEnviado: () => void }) {
  const [busca, setBusca] = useState('');
  const [opcoes, setOpcoes] = useState<OpcaoEnvio[] | null>(null);
  const [marcados, setMarcados] = useState<OpcaoEnvio[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => opcoesParaEnviar(contatoId, busca).then(setOpcoes).catch(() => setOpcoes([])), busca ? 300 : 0);
    return () => clearTimeout(t);
  }, [busca, contatoId]);
  const chave = (o: OpcaoEnvio) => `${o.tipo}:${o.id}`;
  const marcar = (o: OpcaoEnvio) => setMarcados((m) => (m.some((x) => chave(x) === chave(o)) ? m.filter((x) => chave(x) !== chave(o)) : m.length >= 12 ? m : [...m, o]));

  const enviar = async (modo: 'whatsapp' | 'copiar') => {
    setEnviando(true);
    setAviso(null);
    // abre a aba já no clique (depois da espera o navegador bloquearia a janela)
    const aba = modo === 'whatsapp' && telefone ? window.open('', '_blank') : null;
    try {
      const r = await enviarImoveis(
        contatoId,
        marcados.map((m) => ({ tipo: m.tipo, id: m.id }))
      );
      if (!r.enviados) {
        aba?.close();
        setAviso(r.avisos.join(' ') || 'Nada foi enviado.');
        return;
      }
      const wa = linkWhats(telefone, r.mensagem);
      if (aba && wa) aba.location.href = wa;
      else {
        aba?.close();
        await navigator.clipboard.writeText(r.mensagem).catch(() => {});
      }
      if (r.avisos.length) window.alert(r.avisos.join('\n'));
      onEnviado();
    } catch (e) {
      aba?.close();
      setAviso(e instanceof Error ? e.message : 'Não foi possível enviar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-3xl bg-[var(--bg)] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div>
            <h2 className="text-lg font-bold">Selecionar imóveis para enviar</h2>
            <p className="text-sm text-[var(--text-muted)]">{busca ? 'Resultado da busca' : 'Sugestões pelo que ele procura (quartos, valor e bairros)'}. Marque até 12.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full text-lg hover:bg-[var(--pill-bg)]">
            ×
          </button>
        </div>
        <div className="px-5">
          <input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por condomínio, bairro, título ou código"
            className="h-11 w-full rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-5">
          {opcoes === null && <p className="py-6 text-sm text-[var(--text-muted)]">Carregando…</p>}
          {opcoes?.length === 0 && <p className="py-6 text-sm text-[var(--text-muted)]">Nada encontrado. Tente outro nome ou bairro.</p>}
          <div className="flex flex-col gap-2 pb-3">
            {opcoes?.map((o) => {
              const on = marcados.some((x) => chave(x) === chave(o));
              return (
                <label key={chave(o)} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-2 ${on ? 'border-accent bg-[#F5F9FF]' : 'border-[var(--border)]'}`}>
                  <input type="checkbox" checked={on} onChange={() => marcar(o)} className="h-4 w-4 shrink-0 accent-[#257CFF]" />
                  <span className="h-12 w-16 shrink-0 overflow-hidden rounded-xl bg-[#DDE1E6]">
                    {o.capa && !o.privado && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.capa} alt="" className="h-full w-full object-cover" loading="lazy" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13.5px]">{o.titulo}</b>
                    <span className="block truncate text-[12px] text-[var(--text-muted)]">{o.sub}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <b className="block text-[13px] tabular-nums">{o.preco ? brl(o.preco) : ''}</b>
                    {o.privado && <span className="rounded bg-[#20242C] px-1.5 py-0.5 text-[10px] font-bold text-white">PRIVADO</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="border-t border-[var(--border)] p-4">
          {aviso && <p className="mb-2 text-sm font-semibold text-red-600">{aviso}</p>}
          <p className="mb-2 text-[12px] text-[var(--text-muted)]">Privados vão com o link privado preso ao celular do cliente. Cada link avisa na ficha quando ele abre.</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{marcados.length} selecionado{marcados.length === 1 ? '' : 's'}</span>
            <button type="button" disabled={!marcados.length || enviando} onClick={() => enviar('copiar')} className="ml-auto h-10 rounded-full border border-[var(--border)] px-4 text-sm font-semibold disabled:opacity-40">
              Copiar mensagem
            </button>
            {telefone && (
              <button type="button" disabled={!marcados.length || enviando} onClick={() => enviar('whatsapp')} className="h-10 rounded-full bg-[#25D366] px-4 text-sm font-bold text-[#08361A] disabled:opacity-40">
                {enviando ? 'Gerando os links…' : 'Enviar pelo WhatsApp'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
