'use client';

import { useEffect, useMemo, useState } from 'react';
import { getLocationIndex, type LocalSugestao } from '@/lib/actions';
import { avaliarParaEquipe, type Amostra, type ResultadoAvaliacao } from '@/lib/avaliacao';
import { excluirAvaliacao, listarAvaliacoes, salvarAvaliacao, type AvaliacaoSalva, type ImovelAvaliado } from '@/lib/actions-crm';

// Avaliação do imóvel do cliente (ficha do CRM): por exemplo, o imóvel que ele dá na
// permuta. Mesmo método do avaliador do site (comparativo, NBR 14653-2); fica salva no
// histórico do cliente com a amostragem do dia (sem fotos).
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
const MOTIVOS = ['Permuta', 'Venda', 'Captação', 'Outro'];
const CONSERVACAO = ['Novo', 'Muito bom', 'Bom', 'Precisa de reforma'];
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const campo = 'h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 text-[13px] outline-none focus:border-accent';
const rot = 'mb-0.5 block text-[11px] font-semibold text-[var(--text-muted)]';
const n = (v: string) => (v.trim() ? Number(v.replace(',', '.')) : null);

function TabelaAmostras({ amostras }: { amostras: (Amostra | Record<string, unknown>)[] }) {
  const [todas, setTodas] = useState(false);
  const lista = (todas ? amostras : amostras.slice(0, 6)) as Record<string, unknown>[];
  return (
    <div className="mt-2">
      <div className="text-[11px] font-semibold text-[var(--text-muted)]">Amostragem ({amostras.length} imóveis comparados)</div>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full min-w-[300px] text-[11.5px]">
          <thead>
            <tr className="text-left text-[10.5px] text-[var(--text-muted)]">
              <th className="py-1 pr-2 font-semibold">Imóvel</th>
              <th className="px-1 py-1 text-right font-semibold">m²</th>
              <th className="px-1 py-1 text-right font-semibold">Entrega</th>
              <th className="py-1 pl-1 text-right font-semibold">R$/m² ajust.</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((a, i) => (
              <tr key={i} className="border-t border-[var(--border)] align-top">
                <td className="py-1 pr-2">
                  <span className="block font-semibold">{String(a.condominio || a.titulo || 'Imóvel')}</span>
                  <span className="text-[10.5px] text-[var(--text-muted)]">
                    {[a.bairro, a.quartos ? `${a.quartos} qts` : null, a.vagas != null ? `${a.vagas} vg` : null, brl(Number(a.preco))].filter(Boolean).join(' · ')}
                    {a.mesmoCondominio ? ' · mesmo condomínio' : ''}
                  </span>
                </td>
                <td className="px-1 py-1 text-right tabular-nums">{Math.round(Number(a.area))}</td>
                <td className="px-1 py-1 text-right tabular-nums">{a.ano ? String(a.ano) : '-'}</td>
                <td className="py-1 pl-1 text-right font-semibold tabular-nums">{Math.round(Number(a.m2Homog)).toLocaleString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {amostras.length > 6 && (
        <button type="button" onClick={() => setTodas((v) => !v)} className="mt-1 text-[11.5px] font-semibold text-accent">
          {todas ? 'Mostrar menos' : `Ver as ${amostras.length}`}
        </button>
      )}
    </div>
  );
}

function Resultado({ r }: { r: { valor: number; minimo: number; maximo: number; m2: number; n: number; grau: string } }) {
  return (
    <div className="rounded-xl bg-[#F3F7FF] p-3">
      <div className="text-[11px] font-semibold text-[var(--text-muted)]">Valor estimado</div>
      <div className="text-[20px] font-bold tabular-nums">{brl(r.valor)}</div>
      <div className="text-[12px] text-[var(--text-muted)]">
        Faixa de {brl(r.minimo)} a {brl(r.maximo)}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1 text-[10.5px]">
        <span className="rounded-full bg-[var(--bg)] px-1.5 py-px">{brl(r.m2)}/m²</span>
        <span className="rounded-full bg-[var(--bg)] px-1.5 py-px">{r.n} amostras</span>
        <span className="rounded-full bg-[var(--bg)] px-1.5 py-px">Grau {r.grau}</span>
      </div>
    </div>
  );
}

export default function AvaliacaoImovel({ contatoId }: { contatoId: string }) {
  const [salvas, setSalvas] = useState<AvaliacaoSalva[] | null>(null);
  const [aberta, setAberta] = useState(false);
  const [verId, setVerId] = useState<string | null>(null);
  const [f, setF] = useState({ motivo: 'Permuta', condominio: '', bairro: '', cidade: '', tipo: 'apartamento', area: '', quartos: '', suites: '', vagas: '', ano: '', unidade: '', conservacao: '' });
  const [r, setR] = useState<ResultadoAvaliacao | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [indice, setIndice] = useState<LocalSugestao[]>([]);
  const [busca, setBusca] = useState('');
  const set = (k: keyof typeof f, v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    setR(null);
  };
  const carregar = () => listarAvaliacoes(contatoId).then(setSalvas).catch(() => setSalvas([]));
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contatoId]);
  useEffect(() => {
    if (aberta && !indice.length) getLocationIndex().then(setIndice).catch(() => {});
  }, [aberta, indice.length]);
  const sugestoes = useMemo(() => {
    const t = semAcento(busca.trim());
    if (t.length < 2) return [];
    return indice.filter((l) => l.tipo === 'bairro' && semAcento(`${l.nome} ${l.cidade}`).includes(t)).slice(0, 6);
  }, [busca, indice]);

  const imovel = (): ImovelAvaliado => ({
    motivo: f.motivo,
    condominio: f.condominio.trim() || null,
    bairro: f.bairro,
    cidade: f.cidade,
    tipo: f.tipo,
    area: Number(n(f.area)) || 0,
    quartos: n(f.quartos),
    suites: n(f.suites),
    vagas: n(f.vagas),
    ano: n(f.ano),
    unidade: f.unidade.trim() || null,
    conservacao: f.conservacao || null
  });
  const calcular = async () => {
    setCalculando(true);
    const i = imovel();
    const res = await avaliarParaEquipe({ cidade: i.cidade, bairro: i.bairro, tipo: i.tipo, area: i.area, quartos: i.quartos, vagas: i.vagas, ano: i.ano, condominio: i.condominio }).catch(
      (e) => ({ ok: false as const, erro: e instanceof Error ? e.message : 'Não foi possível calcular.' })
    );
    setR(res);
    setCalculando(false);
  };
  const salvar = async () => {
    if (!r || !r.ok) return;
    setSalvando(true);
    try {
      await salvarAvaliacao(contatoId, imovel(), { valor: r.valor, minimo: r.minimo, maximo: r.maximo, m2: r.m2, n: r.n, descartadas: r.descartadas, grau: r.grau, amplitudePct: r.amplitudePct }, r.amostras as unknown as Record<string, unknown>[]);
      setAberta(false);
      setR(null);
      await carregar();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-bold">Avaliação do imóvel</h2>
        {!aberta && (
          <button type="button" onClick={() => setAberta(true)} className="text-[12.5px] font-semibold text-accent">
            + Nova avaliação
          </button>
        )}
      </div>
      <p className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">Para permuta, venda ou captação. Mesmo método do avaliador do site.</p>

      {aberta && (
        <div className="mt-3 flex flex-col gap-2.5 rounded-xl border border-[var(--border)] p-3">
          <div className="flex flex-wrap gap-1">
            {MOTIVOS.map((m) => (
              <button key={m} type="button" onClick={() => set('motivo', m)} className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${f.motivo === m ? 'bg-ink text-white' : 'bg-[var(--pill-bg)]'}`}>
                {m}
              </button>
            ))}
          </div>
          <label>
            <span className={rot}>Condomínio (se tiver)</span>
            <input className={campo} value={f.condominio} onChange={(e) => set('condominio', e.target.value)} placeholder="Ex.: Ambiente Terral Vaca Brava" />
          </label>
          <label className="relative">
            <span className={rot}>Bairro *</span>
            <input
              className={campo}
              value={f.bairro ? `${f.bairro}, ${f.cidade}` : busca}
              onChange={(e) => {
                setBusca(e.target.value);
                if (f.bairro) setF((x) => ({ ...x, bairro: '', cidade: '' }));
              }}
              placeholder="Digite e escolha na lista"
            />
            {!f.bairro && sugestoes.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-lg">
                {sugestoes.map((s) => (
                  <button
                    key={`${s.nome}-${s.cidade}`}
                    type="button"
                    onClick={() => {
                      setF((x) => ({ ...x, bairro: s.nome, cidade: s.cidade }));
                      setBusca('');
                      setR(null);
                    }}
                    className="block w-full px-2.5 py-1.5 text-left text-[12.5px] hover:bg-[var(--pill-bg)]"
                  >
                    {s.nome}, {s.cidade}
                  </button>
                ))}
              </div>
            )}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className={rot}>Tipo *</span>
              <select className={campo} value={f.tipo} onChange={(e) => set('tipo', e.target.value)}>
                {TIPOS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={rot}>Área privativa (m²) *</span>
              <input className={campo} inputMode="decimal" value={f.area} onChange={(e) => set('area', e.target.value.replace(/[^\d,.]/g, ''))} />
            </label>
            <label>
              <span className={rot}>Quartos</span>
              <input className={campo} inputMode="numeric" value={f.quartos} onChange={(e) => set('quartos', e.target.value.replace(/\D/g, '').slice(0, 2))} />
            </label>
            <label>
              <span className={rot}>Suítes</span>
              <input className={campo} inputMode="numeric" value={f.suites} onChange={(e) => set('suites', e.target.value.replace(/\D/g, '').slice(0, 2))} />
            </label>
            <label>
              <span className={rot}>Vagas</span>
              <input className={campo} inputMode="numeric" value={f.vagas} onChange={(e) => set('vagas', e.target.value.replace(/\D/g, '').slice(0, 2))} />
            </label>
            <label>
              <span className={rot}>Ano de entrega</span>
              <input className={campo} inputMode="numeric" value={f.ano} onChange={(e) => set('ano', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Ex.: 2015" />
            </label>
            <label>
              <span className={rot}>Unidade e andar</span>
              <input className={campo} value={f.unidade} onChange={(e) => set('unidade', e.target.value)} />
            </label>
            <label>
              <span className={rot}>Conservação</span>
              <select className={campo} value={f.conservacao} onChange={(e) => set('conservacao', e.target.value)}>
                <option value="">-</option>
                {CONSERVACAO.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          {r && !r.ok && <p className="rounded-lg bg-red-50 p-2 text-[12px] text-red-700">{r.erro}</p>}
          {r && r.ok && (
            <>
              <Resultado r={r} />
              <TabelaAmostras amostras={r.amostras} />
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {!(r && r.ok) ? (
              <button type="button" disabled={calculando || !f.bairro || !n(f.area)} onClick={calcular} className="h-9 flex-1 rounded-full bg-ink px-4 text-[13px] font-semibold text-white disabled:opacity-50">
                {calculando ? 'Calculando…' : 'Calcular avaliação'}
              </button>
            ) : (
              <button type="button" disabled={salvando} onClick={salvar} className="h-9 flex-1 rounded-full bg-accent px-4 text-[13px] font-semibold text-white disabled:opacity-50">
                {salvando ? 'Salvando…' : 'Salvar avaliação'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setAberta(false);
                setR(null);
              }}
              className="h-9 rounded-full border border-[var(--border)] px-3 text-[13px] font-semibold"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {salvas && salvas.length === 0 && !aberta && <p className="mt-2 text-[12.5px] text-[var(--text-muted)]">Nenhuma avaliação ainda.</p>}
      {salvas?.map((a) => (
        <div key={a.id} className="mt-2 rounded-xl border border-[var(--border)] p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[var(--text-muted)]">
                {a.imovel.motivo ?? 'Avaliação'} · {new Date(a.criadoEm).toLocaleDateString('pt-BR')}
              </div>
              <div className="truncate text-[13px] font-semibold">{[a.imovel.condominio, a.imovel.bairro].filter(Boolean).join(', ')}</div>
              <div className="text-[12px] text-[var(--text-muted)]">
                {a.imovel.area} m²{a.imovel.quartos ? ` · ${a.imovel.quartos} qts` : ''}
                {a.imovel.vagas != null ? ` · ${a.imovel.vagas} vg` : ''}
                {a.imovel.ano ? ` · entrega ${a.imovel.ano}` : ''}
              </div>
            </div>
            <div className="shrink-0 text-right text-[14px] font-bold tabular-nums">{brl(a.resultado.valor)}</div>
          </div>
          <div className="mt-1.5 flex gap-3 text-[12px]">
            <button type="button" onClick={() => setVerId(verId === a.id ? null : a.id)} className="font-semibold text-accent">
              {verId === a.id ? 'Fechar' : 'Ver detalhes'}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm('Excluir esta avaliação?')) return;
                await excluirAvaliacao(a.id).catch(() => {});
                carregar();
              }}
              className="font-semibold text-red-600"
            >
              Excluir
            </button>
          </div>
          {verId === a.id && (
            <div className="mt-2">
              <Resultado r={a.resultado} />
              <TabelaAmostras amostras={a.amostras} />
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
