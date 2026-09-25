'use client';

import { useState } from 'react';
import CepField, { ENDERECO_VAZIO, type Endereco } from './CepField';
import { registrarCaptacao } from '@/lib/actions-captacao';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';
import { WHATSAPP_ATENDIMENTO } from '@/lib/marca';

const input = 'w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-accent';
const label = 'mb-1 block text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]';

const soNumero = (v: string) => Number(v.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')) || null;
const moeda = (v: string) => {
  const d = v.replace(/\D/g, '');
  return d ? Number(d).toLocaleString('pt-BR') : '';
};
const mascaraTel = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
};

// Formulário público "Venda seu imóvel": só o básico (CEP, tipo, tamanho, valor) + contato.
export default function FormVender() {
  const [end, setEnd] = useState<Endereco>(ENDERECO_VAZIO);
  const [f, setF] = useState({
    nome: '',
    telefone: '',
    email: '',
    condominio: '',
    tipoUnidade: '',
    quartos: '',
    area: '',
    valor: '',
    finalidade: 'venda' as 'venda' | 'aluguel' | 'venda_aluguel',
    observacoes: '',
    aceite: false,
    site: ''
  });
  const [estado, setEstado] = useState<'form' | 'enviando' | 'ok'>('form');
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEstado('enviando');
    try {
      const r = await registrarCaptacao({
        ...end,
        nome: f.nome,
        telefone: f.telefone,
        email: f.email,
        condominio: f.condominio,
        tipoUnidade: f.tipoUnidade,
        quartos: soNumero(f.quartos),
        area: soNumero(f.area),
        valorPretendido: soNumero(f.valor),
        finalidade: f.finalidade,
        observacoes: f.observacoes,
        aceite: f.aceite,
        site: f.site
      });
      if (!r.ok) {
        setErro(r.erro ?? 'Não foi possível enviar.');
        setEstado('form');
        return;
      }
      setEstado('ok');
    } catch {
      setErro('Não foi possível enviar agora. Tente de novo ou fale pelo WhatsApp.');
      setEstado('form');
    }
  };

  if (estado === 'ok') {
    return (
      <div className="rounded-2xl border border-[var(--border)] p-6 text-center">
        <div className="text-3xl">✓</div>
        <h2 className="mt-2 font-serif text-2xl font-semibold">Recebemos seu imóvel</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-muted)]">
          Nossa equipe vai entrar em contato pelo telefone informado para conhecer o imóvel e combinar os próximos passos.
        </p>
        <a
          href={`https://wa.me/${WHATSAPP_ATENDIMENTO}?text=${encodeURIComponent(`Olá! Acabei de cadastrar meu imóvel para venda no site (${f.nome}).`)}`}
          target="_blank"
          rel="noopener"
          className="mt-5 inline-block rounded-full bg-[#16A34A] px-5 py-2.5 text-sm font-bold text-white"
        >
          Adiantar pelo WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5">
      <input type="text" name="site" value={f.site} onChange={(e) => setF({ ...f, site: e.target.value })} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">1. Onde fica o imóvel</h2>
        <CepField value={end} onChange={setEnd} />
        <div>
          <span className={label}>Condomínio ou edifício (se tiver)</span>
          <input className={input} value={f.condominio} onChange={(e) => setF({ ...f, condominio: e.target.value })} maxLength={120} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">2. Como é o imóvel</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className={label}>Tipo</span>
            <select className={input} value={f.tipoUnidade} onChange={(e) => setF({ ...f, tipoUnidade: e.target.value })}>
              <option value="">Selecione</option>
              {Object.entries(TIPO_UNIDADE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className={label}>Quero</span>
            <select className={input} value={f.finalidade} onChange={(e) => setF({ ...f, finalidade: e.target.value as typeof f.finalidade })}>
              <option value="venda">Vender</option>
              <option value="aluguel">Alugar</option>
              <option value="venda_aluguel">Vender ou alugar</option>
            </select>
          </div>
          <div>
            <span className={label}>Quartos</span>
            <input className={input} inputMode="numeric" value={f.quartos} onChange={(e) => setF({ ...f, quartos: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
          </div>
          <div>
            <span className={label}>Área (m²)</span>
            <input className={input} inputMode="decimal" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value.replace(/[^\d,]/g, '').slice(0, 9) })} />
          </div>
          <div className="sm:col-span-2">
            <span className={label}>Valor pretendido (R$)</span>
            <input className={input} inputMode="numeric" placeholder="Opcional" value={f.valor} onChange={(e) => setF({ ...f, valor: moeda(e.target.value) })} />
          </div>
        </div>
        <div>
          <span className={label}>Algo mais que devemos saber?</span>
          <textarea
            className={`${input} min-h-[90px]`}
            value={f.observacoes}
            onChange={(e) => setF({ ...f, observacoes: e.target.value })}
            placeholder="Ex.: reformado, quitado, aceita financiamento, melhor horário para visita…"
            maxLength={1500}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">3. Seu contato</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <span className={label}>Nome *</span>
            <input className={input} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} autoComplete="name" required maxLength={100} />
          </div>
          <div>
            <span className={label}>Telefone / WhatsApp *</span>
            <input className={input} inputMode="tel" value={f.telefone} onChange={(e) => setF({ ...f, telefone: mascaraTel(e.target.value) })} autoComplete="tel" required />
          </div>
          <div>
            <span className={label}>E-mail</span>
            <input className={input} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" />
          </div>
        </div>
        <label className="flex items-start gap-2.5 text-sm text-[var(--text-muted)]">
          <input type="checkbox" className="mt-1" checked={f.aceite} onChange={(e) => setF({ ...f, aceite: e.target.checked })} />
          <span>
            Autorizo a Mais Novos Imóveis a entrar em contato comigo sobre a venda deste imóvel e a guardar estes dados para esse fim, conforme os{' '}
            <a href="/termos" className="underline">
              Termos
            </a>
            .
          </span>
        </label>
      </section>

      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</p>}
      <button disabled={estado === 'enviando'} className="rounded-full bg-accent px-6 py-3.5 text-[15px] font-bold text-white disabled:opacity-60">
        {estado === 'enviando' ? 'Enviando…' : 'Quero vender meu imóvel'}
      </button>
    </form>
  );
}
