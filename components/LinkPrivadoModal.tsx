'use client';

import { useEffect, useState } from 'react';
import { criarLinkPrivado, listarLinksPrivados, revogarLinkPrivado, type LinkPrivado } from '@/lib/links-privados';

function maskTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

const inputClass = 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-accent';

// Painel → Imóveis → "Enviar link privado": gera um link pessoal para o telefone
// do cliente. Ele abre só no primeiro aparelho (ou nos 2 primeiros) e em nenhum outro.
export default function LinkPrivadoModal({ propertyId, titulo, onClose }: { propertyId: string; titulo: string; onClose: () => void }) {
  const [telefone, setTelefone] = useState('');
  const [nome, setNome] = useState('');
  const [max, setMax] = useState<1 | 2>(1);
  const [links, setLinks] = useState<LinkPrivado[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  const carregar = () => listarLinksPrivados(propertyId).then(setLinks).catch(() => {});
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const gerar = async (enviar: 'whatsapp' | 'copiar') => {
    setErro(null);
    setAviso(null);
    // abre a aba já no clique (senão o navegador bloqueia o pop-up) e depois aponta para o WhatsApp
    const janela = enviar === 'whatsapp' ? window.open('', '_blank') : null;
    setGerando(true);
    try {
      const r = await criarLinkPrivado(propertyId, { telefone, nome, maxAparelhos: max });
      if (!r.ok) {
        janela?.close();
        setErro(r.erro);
        return;
      }
      const texto = `Olá${nome ? `, ${nome.split(' ')[0]}` : ''}! Segue o anúncio exclusivo que separamos para você (${titulo}). O link é pessoal e abre só no seu aparelho: ${r.link.url}`;
      if (enviar === 'whatsapp' && janela) {
        const d = telefone.replace(/\D/g, '');
        janela.location.href = `https://wa.me/${d.length <= 11 ? `55${d}` : d}?text=${encodeURIComponent(texto)}`;
        setAviso('Link gerado. Confira a conversa que abriu no WhatsApp.');
      } else {
        try {
          await navigator.clipboard.writeText(texto);
          setAviso('Link gerado e copiado (com a mensagem). É só colar na conversa do cliente.');
        } catch {
          window.prompt('Copie a mensagem com o link:', texto);
        }
      }
      setTelefone('');
      setNome('');
      carregar();
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-[var(--bg)] p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Enviar link privado</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{titulo}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full px-2 py-1 text-sm hover:bg-[var(--pill-bg)]" aria-label="Fechar">
            ✕
          </button>
        </div>
        <p className="mt-3 rounded-lg bg-[var(--pill-bg)] p-3 text-xs leading-relaxed text-[var(--text-muted)]">
          O link é <strong>pessoal</strong>: abre só no aparelho de quem abrir primeiro. Se a pessoa repassar (para o marido, um grupo…), o link <strong>não abre</strong>.{' '}
          Quem recebeu repassado pede acesso ao atendimento e você gera outro link para o telefone dele. As fotos saem com uma marca d&apos;água com esse telefone.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Telefone (WhatsApp) *
            <input value={telefone} onChange={(e) => setTelefone(maskTelefone(e.target.value))} inputMode="tel" placeholder="(62) 99999-0000" className={`${inputClass} mt-1`} />
          </label>
          <label className="text-sm font-semibold">
            Nome do cliente
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="opcional" className={`${inputClass} mt-1`} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">Abre em:</span>
          {([1, 2] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setMax(n)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${max === n ? 'bg-ink text-white' : 'bg-[var(--pill-bg)]'}`}
            >
              {n === 1 ? '1 aparelho' : '2 aparelhos'}
            </button>
          ))}
          <span className="text-xs text-[var(--text-faint)]">(ex.: celular e computador da mesma pessoa)</span>
        </div>

        {erro && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{erro}</p>}
        {aviso && <p className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-2.5 text-sm font-semibold text-emerald-800">{aviso}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={gerando} onClick={() => gerar('whatsapp')} className="rounded-full bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
            Gerar e abrir no WhatsApp
          </button>
          <button type="button" disabled={gerando} onClick={() => gerar('copiar')} className="rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-bold hover:bg-[var(--pill-bg)] disabled:opacity-50">
            Gerar e copiar
          </button>
        </div>

        {links.length > 0 && (
          <section className="mt-6">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Links já enviados</h3>
            <ul className="mt-2 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] text-sm">
              {links.map((l) => (
                <li key={l.id} className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 ${l.revogado ? 'opacity-50' : ''}`}>
                  <div>
                    <div className="font-semibold">
                      {l.nome ? `${l.nome} · ` : ''}
                      {l.telefone}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {new Date(l.criadoEm).toLocaleDateString('pt-BR')} · aparelhos {l.aparelhosUsados}/{l.maxAparelhos} · aberto {l.aberturas}x
                      {l.bloqueios > 0 && <strong className="text-[#e62f2f]"> · {l.bloqueios} tentativa(s) em outro aparelho</strong>}
                      {l.revogado && ' · cancelado'}
                    </div>
                  </div>
                  {!l.revogado && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm('Cancelar este link? Ele para de abrir, inclusive no aparelho do cliente.')) return;
                        await revogarLinkPrivado(l.id);
                        carregar();
                      }}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Cancelar link
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
