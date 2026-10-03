'use client';

// Avaliação de imóveis (uso interno): imóvel → amostras (base, memória, portais, manual) →
// conferência → cálculo pela NBR 14653-2 → salvar → relatório em PDF.
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { getLocationIndex, type LocalSugestao } from '@/lib/actions';
import {
  abrirAvaliacaoInterna,
  amostrasDaBase,
  buscarCondominiosAval,
  buscarNosPortais,
  salvarAvaliacaoInterna,
  type CondominioAval
} from '@/lib/actions-avaliacoes';
import { TIPOS_AVALIACAO, calcularAvaliacaoInterna, type AmostraAvaliacao, type ImovelAvaliacao, type ResultadoAvaliacaoInterna } from '@/lib/avaliacao-calculo';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const campo = 'h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-[14px] outline-none focus:border-accent';
const rot = 'mb-1 block text-[12px] font-semibold text-[var(--text-muted)]';
const n = (v: string) => (v.trim() ? Number(v.replace(/\./g, '').replace(',', '.')) : null);
const ORIGEM: Record<AmostraAvaliacao['origem'], { nome: string; cor: string }> = {
  nosso: { nome: 'Nosso anúncio', cor: '#257CFF' },
  vendido: { nome: 'Vendido', cor: '#13874B' },
  portal: { nome: 'Portal', cor: '#6A3CFF' },
  manual: { nome: 'Manual', cor: '#5F6368' }
};

function Avaliar() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const sp = useSearchParams();
  const editId = sp?.get('id') ?? null;
  const contatoId = sp?.get('contato') ?? null;
  const [modo, setModo] = useState<'condominio' | 'regiao'>('condominio');
  const [cond, setCond] = useState<CondominioAval | null>(null);
  const [buscaCond, setBuscaCond] = useState('');
  const [opcoesCond, setOpcoesCond] = useState<CondominioAval[]>([]);
  const [indice, setIndice] = useState<LocalSugestao[]>([]);
  const [buscaBairro, setBuscaBairro] = useState('');
  const [f, setF] = useState({ bairro: '', cidade: '', tipo: 'apartamento', area: '', quartos: '', suites: '', vagas: '', ano: '', unidade: '', observacao: '' });
  const [amostras, setAmostras] = useState<AmostraAvaliacao[]>([]);
  const [resultado, setResultado] = useState<ResultadoAvaliacaoInterna | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [manual, setManual] = useState({ url: '', preco: '', area: '', quartos: '', vagas: '', ano: '' });
  const [verManual, setVerManual] = useState(false);
  const [id, setId] = useState<string | null>(editId);

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  useEffect(() => {
    getLocationIndex().then(setIndice).catch(() => {});
  }, []);
  useEffect(() => {
    if (!editId || !staff) return;
    abrirAvaliacaoInterna(editId).then((a) => {
      if (!a) return;
      const i = a.imovel;
      if (i.developmentId) {
        setModo('condominio');
        setCond({ id: i.developmentId, nome: i.condominio ?? '', bairro: i.bairro, cidade: i.cidade, horizontal: !!i.horizontal, ano: i.ano ?? null, lat: null, lng: null });
      } else setModo('regiao');
      setF({ bairro: i.bairro, cidade: i.cidade, tipo: i.tipo, area: String(i.area ?? ''), quartos: String(i.quartos ?? ''), suites: String(i.suites ?? ''), vagas: String(i.vagas ?? ''), ano: String(i.ano ?? ''), unidade: i.unidade ?? '', observacao: i.observacao ?? '' });
      setAmostras(a.amostras);
      setResultado(a.resultado);
    });
  }, [editId, staff]);
  useEffect(() => {
    const q = buscaCond.trim();
    if (q.length < 2) return setOpcoesCond([]);
    const tm = setTimeout(() => buscarCondominiosAval(q).then(setOpcoesCond).catch(() => {}), 250);
    return () => clearTimeout(tm);
  }, [buscaCond]);
  const sugestoesBairro = useMemo(() => {
    const t = semAcento(buscaBairro.trim());
    if (t.length < 2) return [];
    return indice.filter((l) => l.tipo === 'bairro' && semAcento(`${l.nome} ${l.cidade}`).includes(t)).slice(0, 8);
  }, [buscaBairro, indice]);

  if (!loaded || !staff) return null;

  const imovel = (): ImovelAvaliacao => ({
    developmentId: modo === 'condominio' ? cond?.id ?? null : null,
    condominio: modo === 'condominio' ? cond?.nome ?? null : null,
    horizontal: modo === 'condominio' ? !!cond?.horizontal : false,
    bairro: f.bairro,
    cidade: f.cidade,
    tipo: f.tipo,
    area: Number(n(f.area)) || 0,
    quartos: n(f.quartos),
    suites: n(f.suites),
    vagas: n(f.vagas),
    ano: n(f.ano),
    unidade: f.unidade.trim() || null,
    observacao: f.observacao.trim() || null
  });
  const pronto = !!f.bairro && !!n(f.area) && (modo === 'regiao' || !!cond);
  const juntar = (novas: AmostraAvaliacao[]) =>
    setAmostras((l) => {
      const ja = new Set(l.map((a) => a.id));
      return [...l, ...novas.filter((a) => !ja.has(a.id))];
    });
  const mudar = (k: keyof typeof f, v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    setResultado(null);
  };

  const daBase = async () => {
    setOcupado('base');
    setAviso(null);
    const l = await amostrasDaBase(imovel()).catch(() => []);
    juntar(l);
    setAviso(l.length ? `${l.length} amostra(s) da nossa base.` : 'Nenhuma amostra na nossa base com esse perfil.');
    setOcupado(null);
  };
  const dosPortais = async (forcar: boolean) => {
    setOcupado('portais');
    setAviso(null);
    const r = await buscarNosPortais(imovel(), forcar).catch((e) => ({ amostras: [], daMemoria: false, custoUsd: 0, erro: e instanceof Error ? e.message : 'Falhou.' }));
    juntar(r.amostras);
    setAviso(
      r.erro
        ? r.erro
        : r.daMemoria
          ? `${r.amostras.length} anúncio(s) de portais guardados de buscas recentes (sem custo). Para pesquisar de novo, use "Nova busca nos portais".`
          : `${r.amostras.length} anúncio(s) encontrados nos portais. Custo desta busca: cerca de R$ ${(r.custoUsd * 5.5).toFixed(2).replace('.', ',')}.`
    );
    setOcupado(null);
  };
  const addManual = () => {
    const preco = n(manual.preco);
    const area = n(manual.area);
    if (!preco || !area) return setAviso('Na amostra manual, preço e área são obrigatórios.');
    juntar([
      {
        id: `m-${Date.now()}`,
        origem: 'manual',
        url: manual.url.trim() || null,
        portal: manual.url ? new URL(manual.url.startsWith('http') ? manual.url : `https://${manual.url}`).hostname.replace(/^www\./, '') : null,
        area,
        preco,
        quartos: n(manual.quartos),
        vagas: n(manual.vagas),
        ano: n(manual.ano),
        usar: true
      }
    ]);
    setManual({ url: '', preco: '', area: '', quartos: '', vagas: '', ano: '' });
    setVerManual(false);
    setResultado(null);
  };
  const calcular = () => {
    const r = calcularAvaliacaoInterna(imovel(), amostras);
    setAmostras(r.amostras);
    if (r.ok) {
      setResultado(r.resultado);
      setAviso(null);
    } else {
      setResultado(null);
      setAviso(r.erro);
    }
  };
  const salvar = async () => {
    setOcupado('salvar');
    try {
      const r = await salvarAvaliacaoInterna({ id: id ?? undefined, imovel: imovel(), amostras, resultado, contatoId });
      setId(r.id);
      router.push(`/dashboard/avaliacoes/${r.id}`);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setOcupado(null);
    }
  };

  const usadas = amostras.filter((a) => a.usar).length;

  return (
    <div className="flex min-h-screen flex-col">
      <PainelNav />
      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="font-serif text-2xl font-semibold">{editId ? 'Avaliação de imóvel' : 'Nova avaliação de imóvel'}</h1>
            <p className="text-[13px] text-[var(--text-muted)]">Uso interno. Método comparativo (ABNT NBR 14653-2) com amostras da nossa base e dos portais.</p>
          </div>
          <Link href="/dashboard/avaliacoes" className="text-[13px] font-semibold text-accent">
            Ver avaliações salvas
          </Link>
        </div>

        {/* 1. imóvel avaliado */}
        <section className="mt-5 rounded-2xl border border-[var(--border)] p-4 md:p-5">
          <h2 className="text-[15px] font-bold">1. Imóvel avaliado</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(
              [
                ['condominio', 'Em condomínio ou prédio'],
                ['regiao', 'Lote ou imóvel de rua (pela região)']
              ] as const
            ).map(([v, l]) => (
              <button key={v} type="button" onClick={() => { setModo(v); setResultado(null); }} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${modo === v ? 'bg-ink text-white' : 'bg-[var(--pill-bg)]'}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {modo === 'condominio' ? (
              <label className="relative md:col-span-2">
                <span className={rot}>Condomínio *</span>
                <input
                  className={campo}
                  value={cond ? `${cond.nome}${cond.bairro ? `, ${cond.bairro}` : ''}` : buscaCond}
                  onChange={(e) => {
                    setBuscaCond(e.target.value);
                    if (cond) setCond(null);
                  }}
                  placeholder="Digite o nome do condomínio"
                />
                {!cond && opcoesCond.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-lg">
                    {opcoesCond.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCond(c);
                          setBuscaCond('');
                          setF((x) => ({ ...x, bairro: c.bairro ?? x.bairro, cidade: c.cidade ?? x.cidade, ano: c.ano && !c.horizontal ? String(c.ano) : x.ano, tipo: c.horizontal ? 'casa_condominio' : x.tipo }));
                          setResultado(null);
                        }}
                        className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[var(--pill-bg)]"
                      >
                        <b>{c.nome}</b>
                        <span className="text-[var(--text-muted)]">
                          {' '}
                          · {[c.bairro, c.cidade].filter(Boolean).join(', ')}
                          {c.horizontal ? ' · horizontal' : ''}
                          {c.ano ? ` · ${c.ano}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {cond && (
                  <span className="mt-1 block text-[12px] text-[var(--text-muted)]">
                    {cond.horizontal ? 'Condomínio horizontal: só casas dentro do condomínio, com a mesma idade (±2 anos).' : 'Prédio: amostras do condomínio e dos prédios a até 1 km.'}
                  </span>
                )}
              </label>
            ) : (
              <label className="relative md:col-span-2">
                <span className={rot}>Bairro *</span>
                <input
                  className={campo}
                  value={f.bairro ? `${f.bairro}, ${f.cidade}` : buscaBairro}
                  onChange={(e) => {
                    setBuscaBairro(e.target.value);
                    if (f.bairro) setF((x) => ({ ...x, bairro: '', cidade: '' }));
                  }}
                  placeholder="Digite e escolha na lista"
                />
                {!f.bairro && sugestoesBairro.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-lg">
                    {sugestoesBairro.map((s) => (
                      <button key={`${s.nome}-${s.cidade}`} type="button" onClick={() => { setF((x) => ({ ...x, bairro: s.nome, cidade: s.cidade })); setBuscaBairro(''); }} className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[var(--pill-bg)]">
                        {s.nome}, {s.cidade}
                      </button>
                    ))}
                  </div>
                )}
              </label>
            )}
            <label>
              <span className={rot}>Tipo *</span>
              <select className={campo} value={f.tipo} onChange={(e) => mudar('tipo', e.target.value)}>
                {TIPOS_AVALIACAO.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={rot}>Área privativa (m²) *</span>
              <input className={campo} inputMode="decimal" value={f.area} onChange={(e) => mudar('area', e.target.value.replace(/[^\d,.]/g, ''))} />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label>
                <span className={rot}>Quartos</span>
                <input className={campo} inputMode="numeric" value={f.quartos} onChange={(e) => mudar('quartos', e.target.value.replace(/\D/g, '').slice(0, 2))} />
              </label>
              <label>
                <span className={rot}>Suítes</span>
                <input className={campo} inputMode="numeric" value={f.suites} onChange={(e) => mudar('suites', e.target.value.replace(/\D/g, '').slice(0, 2))} />
              </label>
              <label>
                <span className={rot}>Vagas</span>
                <input className={campo} inputMode="numeric" value={f.vagas} onChange={(e) => mudar('vagas', e.target.value.replace(/\D/g, '').slice(0, 2))} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className={rot}>Ano de entrega (idade)</span>
                <input className={campo} inputMode="numeric" value={f.ano} onChange={(e) => mudar('ano', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Ex.: 2015" />
              </label>
              <label>
                <span className={rot}>Unidade e andar</span>
                <input className={campo} value={f.unidade} onChange={(e) => mudar('unidade', e.target.value)} />
              </label>
            </div>
          </div>
        </section>

        {/* 2. amostras */}
        <section className="mt-4 rounded-2xl border border-[var(--border)] p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold">2. Amostras ({usadas} em uso)</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!pronto || !!ocupado} onClick={daBase} className="h-9 rounded-full bg-ink px-4 text-[13px] font-semibold text-white disabled:opacity-40">
                {ocupado === 'base' ? 'Buscando…' : 'Buscar na nossa base (grátis)'}
              </button>
              <button type="button" disabled={!pronto || !!ocupado} onClick={() => dosPortais(false)} className="h-9 rounded-full border border-[#6A3CFF] px-4 text-[13px] font-semibold text-[#6A3CFF] disabled:opacity-40">
                {ocupado === 'portais' ? 'Pesquisando nos portais…' : 'Buscar nos portais'}
              </button>
              <button type="button" disabled={!pronto || !!ocupado} onClick={() => dosPortais(true)} title="Ignora a memória e pesquisa de novo (custa)" className="h-9 rounded-full px-3 text-[12.5px] font-semibold text-[var(--text-muted)] hover:bg-[var(--pill-bg)] disabled:opacity-40">
                Nova busca nos portais
              </button>
              <button type="button" onClick={() => setVerManual((v) => !v)} className="h-9 rounded-full px-3 text-[12.5px] font-semibold text-accent hover:bg-[var(--pill-bg)]">
                + Amostra manual
              </button>
            </div>
          </div>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">
            Comece pela nossa base. "Buscar nos portais" reaproveita buscas dos últimos 90 dias (do condomínio ou do bairro) sem custo; quando não há, pesquisa com a IA (cerca de R$ 0,30 a R$ 0,60). Tire as amostras que não servem antes de calcular.
          </p>
          {verManual && (
            <div className="mt-3 grid gap-2 rounded-xl bg-[var(--pill-bg)] p-3 md:grid-cols-6">
              <label className="md:col-span-2">
                <span className={rot}>Link do anúncio</span>
                <input className={campo} value={manual.url} onChange={(e) => setManual({ ...manual, url: e.target.value })} placeholder="https://..." />
              </label>
              <label>
                <span className={rot}>Preço (R$) *</span>
                <input className={campo} inputMode="numeric" value={manual.preco} onChange={(e) => setManual({ ...manual, preco: e.target.value.replace(/\D/g, '') })} />
              </label>
              <label>
                <span className={rot}>Área (m²) *</span>
                <input className={campo} inputMode="decimal" value={manual.area} onChange={(e) => setManual({ ...manual, area: e.target.value.replace(/[^\d,.]/g, '') })} />
              </label>
              <label>
                <span className={rot}>Quartos / vagas</span>
                <div className="flex gap-1">
                  <input className={campo} inputMode="numeric" value={manual.quartos} onChange={(e) => setManual({ ...manual, quartos: e.target.value.replace(/\D/g, '') })} />
                  <input className={campo} inputMode="numeric" value={manual.vagas} onChange={(e) => setManual({ ...manual, vagas: e.target.value.replace(/\D/g, '') })} />
                </div>
              </label>
              <div className="flex items-end">
                <button type="button" onClick={addManual} className="h-10 w-full rounded-full bg-ink text-[13px] font-semibold text-white">
                  Acrescentar
                </button>
              </div>
            </div>
          )}
          {aviso && <p className="mt-3 rounded-xl bg-[#F3F7FF] px-3 py-2 text-[13px]">{aviso}</p>}
          {amostras.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] text-[12.5px]">
                <thead>
                  <tr className="text-left text-[11.5px] text-[var(--text-muted)]">
                    <th className="py-1.5 pr-2 font-semibold">Usar</th>
                    <th className="py-1.5 pr-2 font-semibold">Imóvel</th>
                    <th className="px-2 py-1.5 font-semibold">Fonte</th>
                    <th className="px-2 py-1.5 text-right font-semibold">m²</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Qts / vg</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Entrega</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Preço</th>
                    <th className="px-2 py-1.5 text-right font-semibold">R$/m²</th>
                    <th className="py-1.5 pl-2 text-right font-semibold">Ajustado</th>
                  </tr>
                </thead>
                <tbody>
                  {amostras.map((a) => (
                    <tr key={a.id} className={`border-t border-[var(--border)] align-top ${!a.usar || a.descartada ? 'text-[var(--text-muted)]' : ''}`}>
                      <td className="py-1.5 pr-2">
                        <input
                          type="checkbox"
                          checked={a.usar}
                          onChange={() => {
                            setAmostras((l) => l.map((x) => (x.id === a.id ? { ...x, usar: !x.usar } : x)));
                            setResultado(null);
                          }}
                          className="h-4 w-4 accent-[#257CFF]"
                          aria-label="Usar esta amostra"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <span className="block font-semibold">{a.condominio || a.titulo || 'Imóvel'}</span>
                        <span className="text-[11.5px]">
                          {[a.bairro, a.mesmoCondominio ? 'mesmo condomínio' : a.distKm != null ? `${a.distKm.toFixed(1).replace('.', ',')} km` : null].filter(Boolean).join(' · ')}
                          {a.descartada ? ' · descartada (fora da faixa)' : ''}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="font-semibold" style={{ color: ORIGEM[a.origem].cor }}>
                          {a.origem === 'portal' && a.portal ? a.portal : ORIGEM[a.origem].nome}
                        </span>
                        {a.url && (
                          <a href={a.url} target="_blank" rel="noopener noreferrer nofollow" className="block text-[11.5px] text-accent hover:underline">
                            ver anúncio
                          </a>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{Math.round(a.area)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {a.quartos ?? '-'} / {a.vagas ?? '-'}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{a.ano ?? '-'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{brl(a.preco)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{Math.round(a.preco / a.area).toLocaleString('pt-BR')}</td>
                      <td className="py-1.5 pl-2 text-right font-semibold tabular-nums">{a.m2Homog && a.usar ? Math.round(a.m2Homog).toLocaleString('pt-BR') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 3. resultado */}
        <section className="mt-4 rounded-2xl border border-[var(--border)] p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold">3. Resultado</h2>
            <div className="flex gap-2">
              <button type="button" disabled={!pronto || usadas < 3} onClick={calcular} className="h-10 rounded-full bg-ink px-5 text-[14px] font-semibold text-white disabled:opacity-40">
                Calcular
              </button>
              <button type="button" disabled={!resultado || !!ocupado} onClick={salvar} className="h-10 rounded-full bg-accent px-5 text-[14px] font-semibold text-white disabled:opacity-40">
                {ocupado === 'salvar' ? 'Salvando…' : 'Salvar e ver o relatório'}
              </button>
            </div>
          </div>
          {resultado ? (
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-[#F3F7FF] p-3 md:col-span-2">
                <div className="text-[12px] font-semibold text-[var(--text-muted)]">Valor estimado</div>
                <div className="text-[26px] font-bold tabular-nums">{brl(resultado.valor)}</div>
                <div className="text-[13px] text-[var(--text-muted)]">
                  Faixa de {brl(resultado.minimo)} a {brl(resultado.maximo)}
                </div>
              </div>
              <div className="rounded-xl bg-[var(--pill-bg)] p-3">
                <div className="text-[12px] font-semibold text-[var(--text-muted)]">Valor do m²</div>
                <div className="text-[20px] font-bold tabular-nums">{brl(resultado.m2)}</div>
              </div>
              <div className="rounded-xl bg-[var(--pill-bg)] p-3">
                <div className="text-[12px] font-semibold text-[var(--text-muted)]">Precisão</div>
                <div className="text-[20px] font-bold">Grau {resultado.grau}</div>
                <div className="text-[12px] text-[var(--text-muted)]">
                  {resultado.n} amostras, {resultado.descartadas} descartada(s)
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">Com pelo menos 3 amostras em uso, clique em Calcular.</p>
          )}
        </section>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Avaliar />
    </Suspense>
  );
}
