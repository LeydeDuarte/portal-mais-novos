'use client';

import { useState } from 'react';
import BotaoWhatsapp from '@/components/BotaoWhatsapp';
import { avaliarImovel, type ResultadoAvaliacao } from '@/lib/avaliacao';

const TIPOS: [string, string][] = [
  ['apartamento', 'Apartamento'],
  ['cobertura', 'Cobertura'],
  ['studio', 'Studio / Flat'],
  ['casa_condominio', 'Casa em condomínio'],
  ['casa', 'Casa'],
  ['sobrado', 'Sobrado'],
  ['terreno_lote', 'Terreno / Lote'],
  ['sala_comercial', 'Sala comercial']
];
const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR')}`;
const campo = 'h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-[15px] outline-none focus:border-accent';

export default function FormAvaliacao() {
  const [f, setF] = useState({ cidade: 'Goiânia', bairro: '', tipo: 'apartamento', area: '', quartos: '', vagas: '', ano: '' });
  const [r, setR] = useState<ResultadoAvaliacao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v.trim() ? Number(v.replace(',', '.')) : null);

  return (
    <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <form
        className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setCarregando(true);
          setR(await avaliarImovel({ cidade: f.cidade, bairro: f.bairro, tipo: f.tipo, area: num(f.area) ?? 0, quartos: num(f.quartos), vagas: num(f.vagas), ano: num(f.ano) }).catch(() => ({ ok: false as const, erro: 'Não foi possível calcular agora.' })));
          setCarregando(false);
        }}
      >
        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
          Tipo de imóvel
          <select className={campo} value={f.tipo} onChange={(e) => set('tipo', e.target.value)}>
            {TIPOS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
            Cidade
            <input className={campo} value={f.cidade} onChange={(e) => set('cidade', e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
            Bairro
            <input className={campo} value={f.bairro} onChange={(e) => set('bairro', e.target.value)} placeholder="Ex.: Setor Bueno" required />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
          Área privativa (m²)
          <input className={campo} inputMode="decimal" value={f.area} onChange={(e) => set('area', e.target.value)} placeholder="Ex.: 120" required />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
            Quartos
            <input className={campo} inputMode="numeric" value={f.quartos} onChange={(e) => set('quartos', e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
            Vagas
            <input className={campo} inputMode="numeric" value={f.vagas} onChange={(e) => set('vagas', e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
            Ano de entrega
            <input className={campo} inputMode="numeric" value={f.ano} onChange={(e) => set('ano', e.target.value)} placeholder="2015" />
          </label>
        </div>
        <button type="submit" disabled={carregando} className="mt-1 h-12 rounded-full bg-accent text-[15px] font-bold text-white disabled:opacity-60">
          {carregando ? 'Calculando…' : 'Avaliar meu imóvel'}
        </button>
        <p className="text-[11px] leading-snug text-[var(--text-faint)]">Estimativa estatística com base em anúncios. Não substitui o laudo de avaliação exigido por bancos e cartórios.</p>
      </form>

      <div>
        {!r ? (
          <div className="rounded-2xl bg-[var(--pill-bg)] p-6 text-[15px] leading-relaxed text-[var(--text-muted)]">
            <strong className="text-[var(--text)]">Como funciona:</strong> buscamos anúncios do mesmo tipo no seu bairro e na vizinhança (até 3 km), ajustamos cada preço por m² às características do seu imóvel (área, quartos, vagas, idade e desconto de negociação), descartamos os valores fora da curva e calculamos a média ponderada pela semelhança, com intervalo de confiança de 80%.
          </div>
        ) : !r.ok ? (
          <div className="rounded-2xl bg-amber-50 p-5 text-[15px] text-amber-900">{r.erro}</div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-accent p-6 text-white">
              <p className="text-sm font-semibold opacity-90">Valor estimado</p>
              <p className="font-sans text-[38px] font-bold leading-tight tabular-nums">{brl(r.valor)}</p>
              <p className="mt-1 text-sm opacity-90">
                Faixa provável: {brl(r.minimo)} a {brl(r.maximo)} · {brl(r.m2)}/m²
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-[var(--pill-bg)] p-3">
                <p className="text-xl font-bold">{r.n}</p>
                <p className="text-xs text-[var(--text-muted)]">amostras usadas</p>
              </div>
              <div className="rounded-xl bg-[var(--pill-bg)] p-3">
                <p className="text-xl font-bold">{r.amplitudePct}%</p>
                <p className="text-xs text-[var(--text-muted)]">amplitude da faixa</p>
              </div>
              <div className="rounded-xl bg-[var(--pill-bg)] p-3">
                <p className="text-xl font-bold">{r.grau}</p>
                <p className="text-xs text-[var(--text-muted)]">grau de precisão (NBR)</p>
              </div>
            </div>
            {r.amostras.length > 0 && (
              <div className="rounded-2xl border border-[var(--border)] p-4">
                <p className="mb-2 text-sm font-bold">Imóveis comparados</p>
                <ul className="flex flex-col divide-y divide-[var(--border)] text-sm">
                  {r.amostras.map((a, i) => (
                    <li key={i} className="flex justify-between gap-3 py-2">
                      <span className="min-w-0 truncate">
                        {a.titulo} · {a.bairro} · {Math.round(a.area)} m²
                      </span>
                      <span className="shrink-0 tabular-nums text-[var(--text-muted)]">{brl(Math.round(a.m2))}/m²</span>
                    </li>
                  ))}
                </ul>
                {r.descartadas > 0 && <p className="mt-2 text-xs text-[var(--text-muted)]">{r.descartadas} anúncio(s) muito fora da média foram descartados.</p>}
              </div>
            )}
            <div className="rounded-2xl bg-[var(--pill-bg)] p-5">
              <p className="font-serif text-lg font-semibold">Quer vender por esse valor, ou saber o valor exato?</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">A Leyde visita o imóvel e faz a avaliação completa, com estratégia de venda.</p>
              <div className="mt-3">
                <BotaoWhatsapp ctx={{ titulo: `Avaliação: ${f.tipo} de ${f.area} m² no ${f.bairro} (estimativa ${brl(r.valor)})`, caminho: '/avaliar', condominio: 'Avaliação de imóvel' }} variante="pilula" rotulo="Quero a avaliação completa" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
