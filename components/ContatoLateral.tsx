'use client';

import { useState } from 'react';
import { registrarInteresse } from '@/lib/actions';

type Props = {
  titulo?: string; // "Fale conosco" / "Falar com um corretor"
  condominio: string; // condomínio/empreendimento (ou título do imóvel) — vai para Painel → Interessados
  developmentId?: string;
  referencia?: string; // ex.: "Apartamento de 130 m² · /imovel/abc" — ajuda a equipe a saber de onde veio
  mensagemInicial?: string;
};

const inputClass = 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-accent';

function maskTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

// Caixa "Fale conosco" da lateral direita (imóvel e empreendimento). Vira um
// lead em Painel → Interessados (e e-mail para a equipe, se configurado).
export default function ContatoLateral({ titulo = 'Fale conosco', condominio, developmentId, referencia, mensagemInicial }: Props) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [mensagem, setMensagem] = useState(mensagemInicial ?? `Olá! Tenho interesse no ${condominio}. Podem me passar mais informações?`);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const res = await registrarInteresse({
        developmentId,
        condominio,
        nome,
        telefone,
        email,
        finalidade: 'venda',
        mensagem: referencia ? `${mensagem}\n\n[${referencia}]` : mensagem,
        aceitaContato: true
      });
      if (res.ok) setOk(true);
      else setErro(res.erro ?? 'Não foi possível enviar agora.');
    } catch {
      setErro('Não foi possível enviar agora. Tente de novo em instantes.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div id="fale-conosco" className="scroll-mt-24 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5">
      <h2 className="text-base font-bold">{titulo}</h2>
      {ok ? (
        <p className="mt-2 text-sm text-emerald-800">Mensagem enviada! Um corretor vai falar com você em breve.</p>
      ) : (
        <form onSubmit={enviar} className="mt-3 flex flex-col gap-2.5">
          <input className={inputClass} placeholder="Seu nome *" value={nome} onChange={(e) => setNome(e.target.value)} required />
          <input className={inputClass} placeholder="WhatsApp com DDD" inputMode="tel" value={maskTelefone(telefone)} onChange={(e) => setTelefone(e.target.value.replace(/\D/g, ''))} />
          <input className={inputClass} placeholder="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <textarea className={`${inputClass} resize-none`} rows={3} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
          {erro && <p className="text-xs font-semibold text-red-600">{erro}</p>}
          <button type="submit" disabled={enviando} className="rounded-full bg-accent px-4 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
            {enviando ? 'Enviando…' : 'Enviar mensagem'}
          </button>
          <p className="text-[11px] leading-snug text-[var(--text-faint)]">Ao enviar, você autoriza a Mais Novos Imóveis a responder por WhatsApp ou e-mail.</p>
        </form>
      )}
    </div>
  );
}
