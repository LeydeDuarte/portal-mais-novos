'use client';

import { useEffect, useMemo, useState } from 'react';
import LoginModal from '@/components/LoginModal';
import { useSession } from '@/lib/use-session';
import { getLocationIndex, type LocalSugestao } from '@/lib/actions';
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
const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const campo = 'h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-[15px] outline-none focus:border-accent';

export default function FormAvaliacao() {
  const [f, setF] = useState({ cidade: '', bairro: '', tipo: 'apartamento', area: '', quartos: '', vagas: '', ano: '' });
  const [r, setR] = useState<ResultadoAvaliacao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const { session, signIn } = useSession();
  const [login, setLogin] = useState(false);
  // bairro: a pessoa digita e CONFIRMA na lista (mesmo índice dos filtros do site)
  const [indice, setIndice] = useState<LocalSugestao[]>([]);
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState(false);
  useEffect(() => {
    getLocationIndex().then(setIndice).catch(() => {});
  }, []);
  const sugestoes = useMemo(() => {
    const t = semAcento(busca.trim());
    if (t.length < 2) return [];
    return indice.filter((l) => l.tipo === 'bairro' && semAcento(`${l.nome} ${l.cidade}`).includes(t)).slice(0, 8);
  }, [busca, indice]);
  const avaliar = async () => {
    setCarregando(true);
    setR(await avaliarImovel({ cidade: f.cidade, bairro: f.bairro, tipo: f.tipo, area: num(f.area) ?? 0, quartos: num(f.quartos), vagas: num(f.vagas), ano: num(f.ano) }).catch(() => ({ ok: false as const, erro: 'Não foi possível calcular agora.' })));
    setCarregando(false);
  };
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v.trim() ? Number(v.replace(',', '.')) : null);

  return (
    <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <form
        className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!f.bairro) return setR({ ok: false, erro: 'Escolha o bairro na lista.' });
          if (!session.cliente) return setLogin(true); // entra com a conta e a avaliação sai em seguida
          await avaliar();
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
        <div className="relative flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
          Bairro
          {f.bairro ? (
            <div className="flex h-12 items-center justify-between rounded-xl border border-accent bg-[#F3F7FF] px-3 text-[15px] font-semibold text-[var(--text)]">
              <span className="truncate">
                {f.bairro} · {f.cidade}
              </span>
              <button type="button" onClick={() => { setF((x) => ({ ...x, bairro: '', cidade: '' })); setBusca(''); }} className="text-sm font-bold text-accent">
                Trocar
              </button>
            </div>
          ) : (
            <input
              className={campo}
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setAberta(true);
              }}
              onFocus={() => setAberta(true)}
              placeholder="Digite o bairro: bueno, marista…"
              autoComplete="off"
            />
          )}
          {!f.bairro && aberta && sugestoes.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-1 shadow-xl">
              {sugestoes.map((l) => (
                <li key={`${l.nome}-${l.cidade}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setF((x) => ({ ...x, bairro: l.nome, cidade: l.cidade }));
                      setAberta(false);
                    }}
                    className="flex w-full justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[var(--text)] hover:bg-[var(--pill-bg)]"
                  >
                    <span>{l.nome}</span>
                    <span className="text-xs text-[var(--text-muted)]">{l.cidade}/{l.uf}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!f.bairro && busca.trim().length >= 2 && sugestoes.length === 0 && <span className="font-normal">Nenhum bairro encontrado com esse nome.</span>}
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
        <p className="text-[11px] leading-snug text-[var(--text-faint)]">
          {session.cliente ? 'Estimativa estatística com base em anúncios.' : 'Para ver a avaliação, entre com a sua conta (leva 5 segundos).'} Não substitui o laudo exigido por bancos e cartórios.
        </p>
      </form>
      <LoginModal
        open={login}
        onClose={() => setLogin(false)}
        titulo="Entre para ver a avaliação"
        texto="Entrando, você recebe a avaliação na hora e pode receber o estudo completo por e-mail."
        onSignIn={async (c) => {
          signIn(c);
          setLogin(false);
          await avaliar();
        }}
      />

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
              <p className="font-serif text-lg font-semibold">Quer anunciar seu imóvel conosco?</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Anuncie no Mais Novos e fale com quem está procurando imóvel na sua região.</p>
              <a href="/vender" className="mt-3 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-bold text-white hover:brightness-95">
                Anunciar meu imóvel →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
