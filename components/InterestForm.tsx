'use client';

import { useState } from 'react';
import { registrarInteresse } from '@/lib/actions';
import { maskCurrencyInput } from '@/lib/currency';

type Props = {
  developmentId?: string;
  condominio: string;
  destaque?: boolean; // true quando o condomínio não tem nenhum anúncio (formulário em evidência)
};

const inputClass = 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none';

function maskTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

// "Quer um imóvel neste condomínio? Registre seu interesse" — vira um lead para
// a equipe e, quando um imóvel for cadastrado aqui, a pessoa recebe um e-mail.
export default function InterestForm({ developmentId, condominio, destaque }: Props) {
  const [f, setF] = useState({
    nome: '',
    telefone: '',
    email: '',
    finalidade: 'venda' as 'venda' | 'aluguel',
    areaMin: '',
    areaMax: '',
    valorMax: '',
    quartos: '',
    mensagem: '',
    aceita: true
  });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const n = (s: string) => (s ? Number(s.replace(/\D/g, '')) || undefined : undefined);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const res = await registrarInteresse({
        developmentId,
        condominio,
        nome: f.nome,
        email: f.email,
        telefone: f.telefone,
        finalidade: f.finalidade,
        areaMin: n(f.areaMin),
        areaMax: n(f.areaMax),
        valorMax: n(f.valorMax),
        quartos: n(f.quartos),
        mensagem: f.mensagem,
        aceitaContato: f.aceita
      });
      if (res.ok) setOk(true);
      else setErro(res.erro ?? 'Não foi possível registrar agora.');
    } catch {
      setErro('Não foi possível registrar agora. Tente de novo em instantes.');
    } finally {
      setEnviando(false);
    }
  };

  if (ok) {
    return (
      <section className="mt-10 rounded-2xl border border-emerald-300 bg-emerald-50 p-6">
        <h2 className="font-serif text-xl font-semibold text-emerald-900">Interesse registrado!</h2>
        <p className="mt-1 text-sm text-emerald-900">
          Assim que surgir um imóvel no {condominio} dentro do que você procura, avisamos você. Um corretor também pode entrar em contato.
        </p>
      </section>
    );
  }

  return (
    <section className={`mt-10 rounded-2xl border p-5 md:p-6 ${destaque ? 'border-accent/60 bg-[#f5f8ff]' : 'border-[var(--border)]'}`}>
      <h2 className="font-serif text-xl font-semibold">Quer um imóvel no {condominio}?</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Registre seu interesse e avisamos por e-mail ou WhatsApp quando surgir uma oportunidade aqui — muitas vendas acontecem antes de o imóvel ser anunciado.
      </p>

      <form onSubmit={enviar} className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="flex gap-2 md:col-span-2">
          {(['venda', 'aluguel'] as const).map((fin) => (
            <button
              key={fin}
              type="button"
              onClick={() => set('finalidade', fin)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${f.finalidade === fin ? 'bg-ink text-white' : 'bg-[var(--pill-bg)] hover:bg-[var(--pill-bg-hover)]'}`}
            >
              {fin === 'venda' ? 'Quero comprar' : 'Quero alugar'}
            </button>
          ))}
        </div>

        <input className={inputClass} placeholder="Seu nome *" value={f.nome} onChange={(e) => set('nome', e.target.value)} required />
        <input className={inputClass} placeholder="WhatsApp com DDD" inputMode="tel" value={maskTelefone(f.telefone)} onChange={(e) => set('telefone', e.target.value.replace(/\D/g, ''))} />
        <input className={`${inputClass} md:col-span-2`} placeholder="E-mail (para receber o aviso)" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />

        <div className="grid grid-cols-2 gap-2">
          <input className={inputClass} placeholder="Metragem de (m²)" inputMode="numeric" value={f.areaMin} onChange={(e) => set('areaMin', e.target.value.replace(/\D/g, ''))} />
          <input className={inputClass} placeholder="até (m²)" inputMode="numeric" value={f.areaMax} onChange={(e) => set('areaMax', e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className="grid grid-cols-[1fr_110px] gap-2">
          <input
            className={inputClass}
            placeholder={f.finalidade === 'aluguel' ? 'Aluguel até (R$/mês)' : 'Quanto pretende investir (até)'}
            inputMode="numeric"
            value={maskCurrencyInput(f.valorMax)}
            onChange={(e) => set('valorMax', e.target.value.replace(/\D/g, ''))}
          />
          <select className={inputClass} value={f.quartos} onChange={(e) => set('quartos', e.target.value)}>
            <option value="">Quartos</option>
            {['1', '2', '3', '4', '5'].map((q) => (
              <option key={q} value={q}>
                {q === '5' ? '5+' : q} {q === '1' ? 'quarto' : 'quartos'}
              </option>
            ))}
          </select>
        </div>

        <textarea className={`${inputClass} resize-none md:col-span-2`} rows={2} placeholder="Algo mais? (andar, posição do sol, vaga extra...)" value={f.mensagem} onChange={(e) => set('mensagem', e.target.value)} />

        <label className="flex items-start gap-2 text-xs text-[var(--text-muted)] md:col-span-2">
          <input type="checkbox" className="mt-0.5" checked={f.aceita} onChange={(e) => set('aceita', e.target.checked)} />
          Autorizo a Mais Novos Imóveis a entrar em contato por e-mail e WhatsApp sobre imóveis neste condomínio. Posso cancelar a qualquer momento.
        </label>

        {erro && <p className="text-sm font-semibold text-red-600 md:col-span-2">{erro}</p>}
        <button type="submit" disabled={enviando} className="rounded-full bg-ink px-5 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 md:col-span-2 md:justify-self-start">
          {enviando ? 'Enviando…' : 'Quero ser avisado(a)'}
        </button>
      </form>
    </section>
  );
}
