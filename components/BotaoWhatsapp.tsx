'use client';

import { useEffect, useRef, useState } from 'react';
import { registrarLeadWhatsapp } from '@/lib/actions';
import { WHATSAPP_ATENDIMENTO } from '@/lib/marca';
import { SITE_URL } from '@/lib/seo';

export type WhatsappContexto = {
  titulo: string; // ex.: "Apartamento à venda com 3 quartos — Edifício X, Setor Bueno"
  caminho: string; // /imovel/xxx ou /empreendimento/xxx
  condominio?: string;
  developmentId?: string;
};

function maskTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

const IconeWhats = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2Zm0 18.15a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.54-3.7 8.24-8.24 8.24Zm4.52-6.17c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07s.89 2.4 1.01 2.57c.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.14-1.18-.06-.1-.23-.17-.48-.29Z" />
  </svg>
);

// Botão "Falar com Leyde Duarte pelo WhatsApp": abre um balão pedindo o nome
// (e o telefone, opcional), grava o contato em Painel → Interessados com o link
// do anúncio e abre o WhatsApp já com a mensagem pronta.
export default function BotaoWhatsapp({ ctx, variante = 'bloco' }: { ctx: WhatsappContexto; variante?: 'bloco' | 'flutuante' }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);
  const campo = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem('mn_contato') || '{}');
      if (salvo.nome) setNome(salvo.nome);
      if (salvo.telefone) setTelefone(salvo.telefone);
    } catch {
      /* sem memória */
    }
  }, []);
  useEffect(() => {
    if (aberto) setTimeout(() => campo.current?.focus(), 50);
  }, [aberto]);

  const abrirWhats = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = nome.trim();
    if (n.length < 2) return setErro('Digite seu nome para continuar.');
    setErro(null);
    setIndo(true);
    const link = `${SITE_URL}${ctx.caminho}`;
    const texto = `Olá, Leyde! Meu nome é ${n}. Tenho interesse em: ${ctx.titulo}\n${link}`;
    const url = `https://wa.me/${WHATSAPP_ATENDIMENTO}?text=${encodeURIComponent(texto)}`;
    // abre a aba já no clique (o navegador não bloqueia) e grava o contato em paralelo
    const janela = window.open('', '_blank');
    try {
      localStorage.setItem('mn_contato', JSON.stringify({ nome: n, telefone }));
    } catch {
      /* ok */
    }
    await registrarLeadWhatsapp({ nome: n, telefone, titulo: ctx.titulo, caminho: ctx.caminho, condominio: ctx.condominio, developmentId: ctx.developmentId }).catch(() => null);
    if (janela) janela.location.href = url;
    else window.location.href = url;
    setIndo(false);
    setAberto(false);
  };

  return (
    <>
      {variante === 'bloco' ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-sm hover:brightness-95"
        >
          <IconeWhats />
          Falar com Leyde Duarte
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Falar com Leyde Duarte pelo WhatsApp"
          className="fixed bottom-5 right-5 z-[90] flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg hover:brightness-95 md:bottom-7 md:right-7"
        >
          <IconeWhats size={28} />
        </button>
      )}

      {aberto && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-4" onClick={() => setAberto(false)}>
          <form
            onSubmit={abrirWhats}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-t-2xl bg-[var(--bg)] p-5 shadow-xl sm:rounded-2xl"
            aria-label="Falar pelo WhatsApp"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white">
                <IconeWhats />
              </span>
              <div>
                <div className="text-sm font-bold">Leyde Duarte</div>
                <div className="text-xs text-[var(--text-muted)]">Corretora · atendimento pelo WhatsApp</div>
              </div>
              <button type="button" onClick={() => setAberto(false)} className="ml-auto rounded-full px-2 py-1 text-sm hover:bg-[var(--pill-bg)]" aria-label="Fechar">
                ✕
              </button>
            </div>
            <p className="mt-4 rounded-2xl rounded-tl-sm bg-[#E7FBEF] px-3.5 py-2.5 text-sm text-[#14161A]">
              Olá! 👋 Para eu te atender melhor, como posso te chamar?
            </p>
            <input
              ref={campo}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome *"
              className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[#25D366]"
              autoComplete="name"
              required
            />
            <input
              value={maskTelefone(telefone)}
              onChange={(e) => setTelefone(e.target.value.replace(/\D/g, ''))}
              placeholder="Seu WhatsApp com DDD (opcional)"
              inputMode="tel"
              autoComplete="tel"
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[#25D366]"
            />
            {erro && <p className="mt-2 text-xs font-semibold text-red-600">{erro}</p>}
            <button
              type="submit"
              disabled={indo}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-bold text-white hover:brightness-95 disabled:opacity-60"
            >
              <IconeWhats />
              {indo ? 'Abrindo o WhatsApp…' : 'Continuar no WhatsApp'}
            </button>
            <p className="mt-2 text-[11px] leading-snug text-[var(--text-faint)]">A mensagem já vai com o link deste anúncio. Ao continuar, você autoriza o nosso contato.</p>
          </form>
        </div>
      )}
    </>
  );
}
