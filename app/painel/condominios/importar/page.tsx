'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { conferirExistentes, importarCondominios, type ResultadoImport } from '@/lib/actions';
import {
  CAMPOS,
  combina,
  lerCsv,
  linhasParaCondominios,
  mapearCabecalho,
  mesclarCondominios,
  padronizarBairro,
  type CampoPlanilha,
  type CondoPlanilha
} from '@/lib/planilha-condominios';

type Arquivo = { nome: string; cabecalho: string[]; linhas: unknown[][]; mapa: Partial<Record<CampoPlanilha, number>> };
type Linha = CondoPlanilha & { existe?: boolean; incluir: boolean };

const LOTE = 250;

async function lerArquivo(f: File): Promise<{ cabecalho: string[]; linhas: unknown[][] }> {
  if (/\.xlsx$/i.test(f.name)) {
    const { default: readXlsxFile } = await import('read-excel-file');
    const rows = (await readXlsxFile(f)) as unknown[][];
    return { cabecalho: (rows[0] ?? []).map((c) => String(c ?? '')), linhas: rows.slice(1) };
  }
  const buf = await f.arrayBuffer();
  let texto = new TextDecoder('utf-8').decode(buf);
  if (texto.includes('�')) texto = new TextDecoder('windows-1252').decode(buf); // CSV salvo no Excel antigo
  const rows = lerCsv(texto.replace(/^﻿/, ''));
  return { cabecalho: rows[0] ?? [], linhas: rows.slice(1) };
}

export default function ImportarCondominiosPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [mesclados, setMesclados] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [opStatus, setOpStatus] = useState<'publicado' | 'rascunho'>('publicado');
  const [opExist, setOpExist] = useState<'pular' | 'completar'>('completar');
  const [filtro, setFiltro] = useState<'todos' | 'novos' | 'existem' | 'problemas'>('todos');
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [cepConferido, setCepConferido] = useState(false);

  useEffect(() => {
    if (loaded && !staff) router.replace('/painel/login');
  }, [loaded, staff, router]);

  const adicionar = async (files: File[]) => {
    setErro(null);
    setResultado(null);
    const novos: Arquivo[] = [];
    for (const f of files) {
      if (!/\.(xlsx|csv)$/i.test(f.name)) {
        setErro(`"${f.name}": use .xlsx ou .csv (no Excel: Salvar como → Pasta de Trabalho do Excel ou CSV).`);
        continue;
      }
      try {
        setStatus(`Lendo ${f.name}…`);
        const { cabecalho, linhas: ls } = await lerArquivo(f);
        novos.push({ nome: f.name, cabecalho, linhas: ls, mapa: mapearCabecalho(cabecalho) });
      } catch {
        setErro(`Não foi possível ler "${f.name}". Abra no Excel e use Salvar como (.xlsx) de novo, ou salve como CSV.`);
      }
    }
    setStatus(null);
    setArquivos((a) => [...a, ...novos]);
    setLinhas(null);
  };

  const setMapa = (i: number, campo: CampoPlanilha, col: number | undefined) =>
    setArquivos((a) => a.map((x, j) => (j === i ? { ...x, mapa: { ...x.mapa, [campo]: col } } : x)));

  // Monta a lista final: lê cada arquivo, junta, tira repetidos e confere com o que já está no banco
  const preparar = async () => {
    setErro(null);
    setResultado(null);
    const falta = arquivos.find((a) => a.mapa.nome == null);
    if (falta) return setErro(`Em "${falta.nome}", indique qual coluna tem o nome do condomínio.`);
    const todas = arquivos.flatMap((a) => linhasParaCondominios(a.linhas, a.mapa).map((c) => ({ ...c, fonte: a.nome })));
    const { lista, mesclados: m } = mesclarCondominios(todas);
    setMesclados(m);
    setStatus('Conferindo quais já estão cadastrados…');
    const existem = new Set<number>();
    for (let i = 0; i < lista.length; i += 800) {
      const parte = lista.slice(i, i + 800).map((c) => ({ nome: c.nome, cep: c.cep, bairro: c.bairro, cidade: c.cidade }));
      const idx = await conferirExistentes(parte).catch(() => []);
      idx.forEach((k) => existem.add(i + k));
    }
    setStatus(null);
    setCepConferido(false);
    setLinhas(lista.map((c, i) => ({ ...c, existe: existem.has(i), incluir: true })));
  };

  // Opcional: corrige bairro/cidade/rua com os dados oficiais do CEP (acentos e nomes completos)
  const conferirCeps = async () => {
    if (!linhas) return;
    const ceps = Array.from(new Set(linhas.filter((l) => l.cep && !l.cepGenerico).map((l) => l.cep)));
    const cache = new Map<string, { bairro: string; localidade: string; logradouro: string } | null>();
    let feitos = 0;
    const worker = async () => {
      while (ceps.length) {
        const cep = ceps.shift()!;
        try {
          const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
          const d = await r.json();
          cache.set(cep, d && !d.erro ? d : null);
        } catch {
          cache.set(cep, null);
        }
        feitos++;
        if (feitos % 20 === 0) setStatus(`Conferindo CEPs… ${feitos} de ${feitos + ceps.length}`);
      }
    };
    setStatus('Conferindo CEPs…');
    await Promise.all(Array.from({ length: 6 }, worker));
    let corrigidos = 0;
    setLinhas((ls) =>
      (ls ?? []).map((l) => {
        const v = l.cep ? cache.get(l.cep) : null;
        if (!v) return l;
        const n = { ...l };
        if (v.bairro && combina(l.bairro, v.bairro) && v.bairro !== l.bairro) {
          n.bairro = padronizarBairro(v.bairro);
          corrigidos++;
        }
        if (v.localidade && combina(l.cidade, v.localidade)) n.cidade = v.localidade;
        const rua = l.logradouro.split(',')[0];
        if (v.logradouro && (!rua || combina(rua, v.logradouro))) n.logradouro = [v.logradouro, ...l.logradouro.split(',').slice(rua ? 1 : 0)].map((x) => x.trim()).filter(Boolean).join(', ');
        return n;
      })
    );
    setCepConferido(true);
    setStatus(`${cache.size} CEP(s) conferidos, ${corrigidos} bairro(s) corrigido(s).`);
    setTimeout(() => setStatus(null), 4000);
  };

  const importar = async () => {
    if (!linhas) return;
    const escolhidas = linhas.filter((l) => l.incluir && (opExist === 'completar' || !l.existe));
    if (!escolhidas.length) return setErro('Nada para importar.');
    setErro(null);
    const total: ResultadoImport = { criados: 0, atualizados: 0, pulados: 0, erros: [] };
    for (let i = 0; i < escolhidas.length; i += LOTE) {
      setStatus(`Gravando ${Math.min(i + LOTE, escolhidas.length)} de ${escolhidas.length}…`);
      const lote = escolhidas.slice(i, i + LOTE).map((l) => ({
        nome: l.nome,
        tipo: l.tipo,
        tiposUnidade: l.tiposUnidade,
        cep: l.cep,
        uf: l.uf,
        cidade: l.cidade,
        bairro: l.bairro,
        logradouro: l.logradouro,
        entrega: l.entrega,
        descricao: l.descricao,
        pavimentos: l.pavimentos,
        amenities: l.amenities,
        rascunho: l.rascunho,
        lat: l.lat,
        lng: l.lng,
        videoUrl: l.videoUrl
      }));
      try {
        const r = await importarCondominios(lote, { status: opStatus, existentes: opExist });
        total.criados += r.criados;
        total.atualizados += r.atualizados;
        total.pulados += r.pulados;
        total.erros.push(...r.erros);
      } catch {
        total.erros.push(`Lote ${i / LOTE + 1}: falha de conexão.`);
      }
    }
    setStatus(null);
    setResultado(total);
    setLinhas(null);
  };

  const baixarModelo = () => {
    const cab = 'Nome do condomínio;Tipo (vertical/horizontal);CEP;UF;Cidade;Bairro;Logradouro;Número;Ano de entrega;Pavimentos;Lazer;Descrição';
    const ex = 'Residencial Exemplo;Vertical;74215170;GO;Goiânia;Setor Bueno;Rua T-55;120;2019;18;Piscina, academia, salão de festas;Condomínio com lazer completo no Setor Bueno.';
    const blob = new Blob(['﻿' + cab + '\n' + ex + '\n'], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'modelo-condominios.csv';
    a.click();
  };

  const visiveis = useMemo(() => {
    const l = linhas ?? [];
    const f = l.filter((x) =>
      filtro === 'novos' ? !x.existe : filtro === 'existem' ? x.existe : filtro === 'problemas' ? x.problemas.length > 0 : true
    );
    return f;
  }, [linhas, filtro]);

  if (!loaded || !staff) return null;
  const n = linhas ?? [];
  const novos = n.filter((l) => !l.existe && l.incluir).length;
  const existentes = n.filter((l) => l.existe).length;
  const semEntrega = n.filter((l) => !l.entrega).length;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8">
        <Link href="/painel/condominios" className="text-sm font-semibold text-[var(--text-muted)] hover:underline">
          ← Condomínios
        </Link>
        <h1 className="mt-3 font-serif text-2xl font-semibold">Importar condomínios por planilha</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Envie uma ou mais planilhas (.xlsx ou .csv). As colunas são reconhecidas pelo nome do cabeçalho. Condomínios repetidos, na mesma planilha, entre planilhas
          ou já cadastrados, <strong>não são duplicados</strong>: mesmo nome + mesmo CEP (ou mesmo bairro) conta como o mesmo condomínio.{' '}
          <button type="button" onClick={baixarModelo} className="font-semibold text-accent underline">
            Baixar planilha modelo
          </button>
        </p>

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            adicionar(Array.from(e.dataTransfer.files));
          }}
          className="mt-5 cursor-pointer rounded-2xl border-2 border-dashed border-[var(--border)] p-6 text-center text-sm hover:bg-[var(--pill-bg)]"
        >
          <strong>Clique ou arraste as planilhas aqui</strong>
          <div className="mt-1 text-xs text-[var(--text-muted)]">.xlsx ou .csv, pode mandar várias</div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = Array.from(e.target.files ?? []);
              e.target.value = '';
              adicionar(f);
            }}
          />
        </div>

        {arquivos.map((a, i) => (
          <section key={a.nome + i} className="mt-4 rounded-2xl border border-[var(--border)] p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold">
                {a.nome} <span className="font-normal text-[var(--text-muted)]">· {a.linhas.length} linha(s)</span>
              </h2>
              <button
                type="button"
                onClick={() => {
                  setArquivos((x) => x.filter((_, j) => j !== i));
                  setLinhas(null);
                }}
                className="text-xs text-[var(--text-muted)] hover:text-red-600"
              >
                ✕ tirar
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {CAMPOS.map((c) => (
                <label key={c.campo} className="flex flex-col gap-0.5 text-[11px] font-semibold text-[var(--text-muted)]">
                  {c.rotulo}
                  {c.obrigatorio ? ' *' : ''}
                  <select
                    className={`rounded-lg border px-2 py-1.5 text-xs font-normal text-[var(--text)] ${a.mapa[c.campo] != null ? 'border-accent/60' : 'border-[var(--border)]'}`}
                    value={a.mapa[c.campo] ?? ''}
                    onChange={(e) => {
                      setMapa(i, c.campo, e.target.value === '' ? undefined : Number(e.target.value));
                      setLinhas(null);
                    }}
                  >
                    <option value="">(não tem)</option>
                    {a.cabecalho.map((h, k) => (
                      <option key={k} value={k}>
                        {h || `Coluna ${k + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </section>
        ))}

        {arquivos.length > 0 && !linhas && (
          <button type="button" disabled={!!status} onClick={preparar} className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            Conferir planilha{arquivos.length > 1 ? 's' : ''}
          </button>
        )}

        {status && <p className="mt-4 text-sm font-semibold text-accent">{status}</p>}
        {erro && <p className="mt-4 text-sm font-semibold text-red-600">{erro}</p>}

        {resultado && (
          <div className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-sm text-emerald-900">
            <h2 className="text-base font-bold">Importação concluída</h2>
            <p className="mt-1">
              {resultado.criados} condomínio(s) novo(s) · {resultado.atualizados} já existente(s) completado(s) · {resultado.pulados} pulado(s)
            </p>
            {resultado.erros.length > 0 && <p className="mt-1 text-red-700">Erros: {resultado.erros.join(' · ')}</p>}
            <Link href="/painel/condominios" className="mt-3 inline-block font-bold underline">
              Ver condomínios →
            </Link>
          </div>
        )}

        {linhas && (
          <section className="mt-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Condomínios únicos', n.length],
                ['Novos', novos],
                ['Já cadastrados', existentes],
                ['Repetidos juntados', mesclados]
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-[var(--border)] p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">{k}</div>
                  <div className="font-sans text-2xl font-bold tabular-nums">{v}</div>
                </div>
              ))}
            </div>
            {semEntrega > 0 && (
              <p className="mt-3 text-xs text-amber-800">
                {semEntrega} sem data de entrega, entram normalmente e no feed aparece <strong>----</strong> no lugar do ano. Dá para completar depois em Condomínios.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--border)] p-4 text-sm">
              <label className="flex items-center gap-2">
                Salvar como
                <select className="rounded-lg border border-[var(--border)] px-2 py-1.5" value={opStatus} onChange={(e) => setOpStatus(e.target.value as 'publicado' | 'rascunho')}>
                  <option value="publicado">Publicado (os completos)</option>
                  <option value="rascunho">Rascunho (todos)</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                Já cadastrados
                <select className="rounded-lg border border-[var(--border)] px-2 py-1.5" value={opExist} onChange={(e) => setOpExist(e.target.value as 'pular' | 'completar')}>
                  <option value="completar">Completar só o que estiver vazio</option>
                  <option value="pular">Não mexer</option>
                </select>
              </label>
              <button type="button" disabled={!!status || cepConferido} onClick={conferirCeps} className="rounded-full border border-[var(--border)] px-4 py-2 font-semibold hover:bg-[var(--pill-bg)] disabled:opacity-50">
                {cepConferido ? 'CEPs conferidos ✓' : 'Corrigir bairros e ruas pelo CEP (opcional)'}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  ['todos', `Todos (${n.length})`],
                  ['novos', `Novos (${n.filter((l) => !l.existe).length})`],
                  ['existem', `Já cadastrados (${existentes})`],
                  ['problemas', `Com aviso (${n.filter((l) => l.problemas.length).length})`]
                ] as const
              ).map(([f, r]) => (
                <button key={f} type="button" onClick={() => setFiltro(f)} className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${filtro === f ? 'bg-ink text-white' : 'bg-[var(--pill-bg)]'}`}>
                  {r}
                </button>
              ))}
            </div>

            <div className="mt-3 max-h-[520px] overflow-auto rounded-2xl border border-[var(--border)]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[var(--pill-bg)] text-left uppercase tracking-wide text-[var(--text-muted)]">
                  <tr>
                    <th className="px-2 py-2"></th>
                    <th className="px-2 py-2">Condomínio</th>
                    <th className="px-2 py-2">Bairro / cidade</th>
                    <th className="px-2 py-2">Endereço</th>
                    <th className="px-2 py-2">Entrega</th>
                    <th className="px-2 py-2">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.slice(0, 400).map((l) => (
                    <tr key={`${l.fonte}-${l.linha}-${l.nome}`} className="border-t border-[var(--border)] align-top">
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={l.incluir}
                          onChange={(e) => setLinhas((ls) => (ls ?? []).map((x) => (x === l ? { ...x, incluir: e.target.checked } : x)))}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="font-semibold">{l.nome}</div>
                        <div className="text-[10px] text-[var(--text-faint)]">
                          {l.tipo === 'horizontal' ? 'Horizontal' : 'Vertical'} · {l.fonte}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        {l.bairro}
                        <div className="text-[var(--text-muted)]">
                          {l.cidade}
                          {l.uf ? `/${l.uf}` : ''}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        {l.logradouro || '-'}
                        <div className="text-[var(--text-muted)]">{l.cep ? `${l.cep.slice(0, 5)}-${l.cep.slice(5)}` : 'sem CEP'}</div>
                      </td>
                      <td className="px-2 py-1.5 tabular-nums">{l.entrega ? `${l.entrega.slice(5)}/${l.entrega.slice(0, 4)}` : '-'}</td>
                      <td className="px-2 py-1.5">
                        {l.existe ? (
                          <span className="rounded bg-[var(--pill-bg)] px-1.5 py-0.5 font-bold">Já cadastrado</span>
                        ) : (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-800">Novo</span>
                        )}
                        {l.problemas.map((p) => (
                          <div key={p} className="mt-0.5 text-amber-800">
                            {p}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visiveis.length > 400 && <p className="p-3 text-center text-xs text-[var(--text-muted)]">Mostrando 400 de {visiveis.length}, todos entram na importação.</p>}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" disabled={!!status} onClick={importar} className="rounded-full bg-accent px-6 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
                Importar {novos} novo(s){opExist === 'completar' && existentes ? ` e completar ${existentes}` : ''}
              </button>
              <span className="text-xs text-[var(--text-muted)]">Sem foto e sem imóvel anunciado, o condomínio não aparece no feed, só nas buscas e na própria página (bom para o Google).</span>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
