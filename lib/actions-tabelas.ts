'use server';

// Tabelas de preços (vendas) com HISTÓRICO: cada tabela fica guardada com o seu mês de
// referência, para sempre. O empreendimento recebe só a tabela mais recente (preço das
// tipologias e "a partir de"). Tabelas antigas, enviadas em qualquer ordem, só entram no
// histórico. A mesma tabela enviada duas vezes (mesmo arquivo) não entra de novo.
import { query } from './db';
import { exigirEquipe } from './staff-auth';

async function exigirGestorAval() {
  const eu = await exigirEquipe();
  if (!veTudo(eu.role)) throw new Error('Ferramenta só do analista e do administrador.');
  return eu;
}
import { veTudo } from './papeis';

export type UnidadeGravar = { unidade: string; area: number; valor?: number | null; vagas?: number | null; garagens?: string | null; escaninho?: string | null; torre?: string | null; situacao: string };
export type TabelaGravar = { developmentId: string | null; nome: string | null; mes: string; arquivo: string; hash: string; unidades: UnidadeGravar[] };

export async function nomesEmpreendimentos(): Promise<{ id: string; nome: string }[]> {
  await exigirGestorAval();
  const r = await query<{ id: string; name: string }>(`select id, name from developments where name is not null`);
  return r.map((x) => ({ id: x.id, nome: x.name }));
}

export async function hashesJaGravados(hashes: string[]): Promise<string[]> {
  await exigirGestorAval();
  if (!hashes.length) return [];
  const r = await query<{ hash: string }>(`select hash from tabelas_precos where hash = any($1::text[])`, [hashes.slice(0, 2000)]);
  return r.map((x) => x.hash);
}

export async function gravarTabelas(lote: TabelaGravar[]): Promise<{ gravadas: number; repetidas: number; aplicadas: number; erros: string[] }> {
  const eu = await exigirEquipe();
  if (!veTudo(eu.role)) throw new Error('Só admin e analista gravam tabelas de preços.');
  let gravadas = 0;
  let repetidas = 0;
  const erros: string[] = [];
  const devs = new Set<string>();
  for (const t of lote.slice(0, 50)) {
    if (!/^\d{4}-\d{2}$/.test(t.mes)) {
      erros.push(`${t.arquivo}: falta o mês de referência.`);
      continue;
    }
    const uns = (t.unidades ?? []).filter((u) => u && Number(u.area) > 0).slice(0, 3000);
    if (!uns.length) {
      erros.push(`${t.arquivo}: nenhuma unidade.`);
      continue;
    }
    const comValor = uns.filter((u) => Number(u.valor) > 0);
    const disp = comValor.filter((u) => u.situacao === 'disponivel');
    const base = disp.length ? disp : comValor;
    const m2 = base.length ? base.reduce((s, u) => s + Number(u.valor) / Number(u.area), 0) / base.length : null;
    const valores = base.map((u) => Number(u.valor));
    const r = await query<{ id: string }>(
      `insert into tabelas_precos (development_id, empreendimento_nome, mes_referencia, arquivo, hash, unidades, disponiveis, valor_min, valor_max, m2_medio, criado_por, area_min, area_max)
       values ($1, $2, ($3 || '-01')::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) on conflict (hash) do nothing returning id`,
      [
        t.developmentId,
        t.nome?.slice(0, 200) ?? null,
        t.mes,
        t.arquivo.slice(0, 400),
        t.hash.slice(0, 64),
        uns.length,
        disp.length,
        valores.length ? Math.min(...valores) : null,
        valores.length ? Math.max(...valores) : null,
        m2 ? Math.round(m2) : null,
        eu.email,
        Math.min(...uns.map((u) => Number(u.area))),
        Math.max(...uns.map((u) => Number(u.area)))
      ]
    );
    if (!r[0]) {
      repetidas++;
      continue;
    }
    await query(
      `insert into tabelas_precos_unidades (tabela_id, unidade, area, vagas, valor, situacao, garagens, escaninho, torre)
       select $1, u, a, v, p, s, g, e, t from unnest($2::text[], $3::numeric[], $4::int[], $5::numeric[], $6::text[], $7::text[], $8::text[], $9::text[]) x(u, a, v, p, s, g, e, t)`,
      [
        r[0].id,
        uns.map((u) => String(u.unidade).slice(0, 40)),
        uns.map((u) => Number(u.area)),
        uns.map((u) => (u.vagas != null && Number.isFinite(Number(u.vagas)) ? Math.round(Number(u.vagas)) : null)),
        uns.map((u) => (Number(u.valor) > 0 ? Number(u.valor) : null)),
        uns.map((u) => String(u.situacao ?? 'disponivel').slice(0, 20)),
        uns.map((u) => (u.garagens ? String(u.garagens).slice(0, 120) : null)),
        uns.map((u) => (u.escaninho ? String(u.escaninho).slice(0, 30) : null)),
        uns.map((u) => (u.torre ? String(u.torre).slice(0, 30) : null))
      ]
    );
    gravadas++;
    if (t.developmentId) devs.add(t.developmentId);
  }
  let aplicadas = 0;
  for (const d of Array.from(devs)) if (await aplicarTabelaMaisRecente(d)) aplicadas++;
  return { gravadas, repetidas, aplicadas, erros };
}

/** O empreendimento recebe a tabela de mês mais recente: preço de cada tipologia = menor
 *  valor disponível de mesma metragem (±2%). Devolve true se mudou algo. */
async function aplicarTabelaMaisRecente(developmentId: string): Promise<boolean> {
  const t = (
    await query<{ id: string; mes: string }>(
      `select id, to_char(mes_referencia, 'YYYY-MM-DD') mes from tabelas_precos where development_id = $1 order by mes_referencia desc, criado_em desc limit 1`,
      [developmentId]
    )
  )[0];
  if (!t) return false;
  const atual = (await query<{ ref: string | null }>(`select to_char(tabela_referencia, 'YYYY-MM-DD') ref from developments where id = $1`, [developmentId]))[0];
  if (atual?.ref && atual.ref > t.mes) return false; // já tem uma tabela mais nova aplicada
  await query(`update developments set tabela_referencia = $2::date where id = $1`, [developmentId, t.mes]);
  await gravarDisponibilidade(developmentId, t.id);
  await query(
    `with u as (select area, valor from tabelas_precos_unidades where tabela_id = $2 and valor > 0 and situacao = 'disponivel')
     update properties p set price_value = x.menor, preco_origem = 'tabela'
       from (select p2.id, (select min(u.valor) from u where abs(u.area - p2.area) <= p2.area * 0.02) menor
               from properties p2 where p2.empreendimento_id = $1 and p2.is_tipologia) x
      where p.id = x.id and x.menor is not null`,
    [developmentId, t.id]
  );
  return true;
}

export type TabelaResumo = { id: string; developmentId: string | null; empreendimento: string | null; mes: string; arquivo: string; unidades: number; disponiveis: number; valorMin: number | null; m2: number | null; areaMin: number | null; areaMax: number | null; criadoEm: string };

export async function listarTabelas(limite = 300): Promise<TabelaResumo[]> {
  await exigirGestorAval();
  const r = await query<Record<string, unknown>>(
    `select t.*, coalesce(d.name, t.empreendimento_nome) nome from tabelas_precos t left join developments d on d.id = t.development_id order by t.criado_em desc limit $1`,
    [Math.min(1000, limite)]
  );
  return r.map((x) => ({
    id: String(x.id),
    developmentId: (x.development_id as string) ?? null,
    empreendimento: (x.nome as string) ?? null,
    mes: String(x.mes_referencia).slice(0, 7),
    arquivo: String(x.arquivo ?? ''),
    unidades: Number(x.unidades) || 0,
    disponiveis: Number(x.disponiveis) || 0,
    valorMin: x.valor_min != null ? Number(x.valor_min) : null,
    m2: x.m2_medio != null ? Number(x.m2_medio) : null,
    areaMin: x.area_min != null ? Number(x.area_min) : null,
    areaMax: x.area_max != null ? Number(x.area_max) : null,
    criadoEm: new Date(x.criado_em as string).toISOString()
  }));
}

/** Liga uma tabela gravada sem empreendimento (ou corrige o empreendimento). */
export async function ligarTabela(id: string, developmentId: string): Promise<void> {
  const eu = await exigirEquipe();
  if (!veTudo(eu.role)) throw new Error('Só admin e analista.');
  await query(`update tabelas_precos set development_id = $2 where id = $1`, [id, developmentId]);
  await aplicarTabelaMaisRecente(developmentId);
}

// ---------------- panorama: lançamentos e obras ----------------
export type LinhaLancamentos = { nome: string; sub?: string | null; m2: number | null; n: number; m2Inicio?: number | null; m2Fim?: number | null; variacaoPct?: number | null };
export type PanoramaLancamentos = {
  mensal: { mes: string; m2: number | null; tabelas: number }[];
  bairros: LinhaLancamentos[];
  incorporadoras: LinhaLancamentos[];
  reajustes: LinhaLancamentos[];
};

/** m² médio das tabelas (disponíveis) entre dois meses: por mês, por bairro, por incorporadora
 *  e o reajuste de cada empreendimento (primeira x última tabela do período). */
export async function panoramaLancamentos(de: string, ate: string): Promise<PanoramaLancamentos> {
  await exigirGestorAval();
  const ok = (m: string) => /^\d{4}-\d{2}$/.test(m);
  const p = [ok(de) ? `${de}-01` : '2000-01-01', ok(ate) ? `${ate}-01` : '2100-01-01'];
  const PER = `t.mes_referencia between $1::date and $2::date and t.m2_medio > 0`;
  const [mensal, bairros, incorp, reaj] = await Promise.all([
    query<{ mes: string; m2: string; n: string }>(`select to_char(t.mes_referencia, 'YYYY-MM') mes, avg(t.m2_medio) m2, count(*) n from tabelas_precos t where ${PER} group by 1 order by 1`, p),
    query<{ nome: string; cidade: string; m2: string; n: string }>(
      `with ult as (select distinct on (t.development_id) t.development_id, t.m2_medio from tabelas_precos t where ${PER} and t.development_id is not null order by t.development_id, t.mes_referencia desc)
       select d.bairro nome, d.cidade, avg(u.m2_medio) m2, count(*) n from ult u join developments d on d.id = u.development_id where d.bairro is not null group by 1, 2 order by 3 desc limit 60`,
      p
    ),
    query<{ nome: string; m2: string; n: string }>(
      `with ult as (select distinct on (t.development_id) t.development_id, t.m2_medio from tabelas_precos t where ${PER} and t.development_id is not null order by t.development_id, t.mes_referencia desc)
       select coalesce(nullif(e.nome_perfil, ''), nullif(e.nome_fantasia, ''), e.razao_social) nome, avg(u.m2_medio) m2, count(*) n
         from ult u join development_empresas de on de.development_id = u.development_id join empresas e on e.id = de.empresa_id
        group by 1 order by 3 desc, 2 desc limit 60`,
      p
    ).catch(() => []),
    query<{ nome: string; bairro: string | null; a: string; b: string; n: string }>(
      `with x as (select t.development_id, t.m2_medio, t.mes_referencia,
                         row_number() over (partition by t.development_id order by t.mes_referencia asc) pri,
                         row_number() over (partition by t.development_id order by t.mes_referencia desc) ult,
                         count(*) over (partition by t.development_id) n
                    from tabelas_precos t where ${PER} and t.development_id is not null)
       select d.name nome, d.bairro, max(x.m2_medio) filter (where pri = 1) a, max(x.m2_medio) filter (where ult = 1) b, max(n) n
         from x join developments d on d.id = x.development_id group by d.id, d.name, d.bairro having max(n) > 1 order by 1 limit 200`,
      p
    )
  ]);
  const r = (v: unknown) => (v == null ? null : Math.round(Number(v)));
  return {
    mensal: mensal.map((x) => ({ mes: x.mes, m2: r(x.m2), tabelas: Number(x.n) })),
    bairros: bairros.map((x) => ({ nome: x.nome, sub: x.cidade, m2: r(x.m2), n: Number(x.n) })),
    incorporadoras: incorp.map((x) => ({ nome: x.nome, m2: r(x.m2), n: Number(x.n) })),
    reajustes: reaj
      .map((x) => {
        const a = r(x.a);
        const b = r(x.b);
        return { nome: x.nome, sub: x.bairro, m2: b, n: Number(x.n), m2Inicio: a, m2Fim: b, variacaoPct: a && b ? Math.round(((b - a) / a) * 1000) / 10 : null };
      })
      .sort((p1, p2) => (p2.variacaoPct ?? -999) - (p1.variacaoPct ?? -999))
  };
}

// ---------------- estoque e vendas (pelas tabelas das incorporadoras) ----------------
// Vendida entre duas tabelas seguidas do mesmo empreendimento = unidade que estava
// DISPONÍVEL na anterior e não está mais disponível na seguinte (saiu da tabela ou
// virou vendida/reservada). Unidade comparada pelo número (sem espaços, minúsculo).
export type LinhaEstoque = {
  nome: string;
  sub?: string | null;
  empreendimentos: number;
  disponiveis: number; // estoque na tabela mais recente (até o fim do período)
  vgvDisponivel: number;
  vendidas: number; // no período
  meses: number; // meses cobertos pelas comparações
  velocidade: number | null; // unidades vendidas por mês
  vsoPct: number | null; // vendas sobre oferta, % ao mês
  mesesEstoque: number | null; // quanto dura o estoque nesse ritmo
  ultimaTabela?: string | null;
};
export type PanoramaEstoque = {
  total: LinhaEstoque;
  porMes: { mes: string; vendidas: number; disponiveis: number }[];
  empreendimentos: LinhaEstoque[];
  bairros: LinhaEstoque[];
  incorporadoras: LinhaEstoque[];
};

export async function panoramaEstoque(de: string, ate: string): Promise<PanoramaEstoque> {
  await exigirGestorAval();
  const ok = (m: string) => /^\d{4}-\d{2}$/.test(m);
  const p = [ok(de) ? `${de}-01` : '2000-01-01', ok(ate) ? `${ate}-01` : '2100-01-01'];
  // pares de tabelas seguidas (por empreendimento) cuja tabela mais nova cai no período
  const pares = await query<{ dev: string; mes: string; mes_ant: string; vendidas: string; estoque_ant: string }>(
    `with t as (
       select id, development_id dev, mes_referencia mes,
              lag(id) over (partition by development_id order by mes_referencia, criado_em) ant,
              lag(mes_referencia) over (partition by development_id order by mes_referencia, criado_em) mes_ant
         from tabelas_precos where development_id is not null)
     select t.dev, to_char(t.mes, 'YYYY-MM') mes, to_char(t.mes_ant, 'YYYY-MM') mes_ant,
            (select count(*) from tabelas_precos_unidades u
              where u.tabela_id = t.ant and u.situacao = 'disponivel'
                and not exists (select 1 from tabelas_precos_unidades v where v.tabela_id = t.id and v.situacao = 'disponivel'
                                  and regexp_replace(lower(v.unidade), '\\s', '', 'g') = regexp_replace(lower(u.unidade), '\\s', '', 'g'))) vendidas,
            (select count(*) from tabelas_precos_unidades u where u.tabela_id = t.ant and u.situacao = 'disponivel') estoque_ant
       from t where t.ant is not null and t.mes between $1::date and $2::date and t.mes > t.mes_ant`,
    p
  );
  // estoque: tabela mais recente de cada empreendimento até o fim do período
  const estoque = await query<{ dev: string; nome: string; bairro: string | null; cidade: string | null; mes: string; disp: string; vgv: string; incorporadoras: string[] | null }>(
    `with ult as (select distinct on (development_id) id, development_id, mes_referencia from tabelas_precos
                   where development_id is not null and mes_referencia <= $2::date order by development_id, mes_referencia desc, criado_em desc)
     select u.development_id dev, d.name nome, d.bairro, d.cidade, to_char(u.mes_referencia, 'YYYY-MM') mes,
            (select count(*) from tabelas_precos_unidades x where x.tabela_id = u.id and x.situacao = 'disponivel') disp,
            (select coalesce(sum(x.valor), 0) from tabelas_precos_unidades x where x.tabela_id = u.id and x.situacao = 'disponivel') vgv,
            (select array_agg(distinct coalesce(nullif(e.nome_perfil, ''), nullif(e.nome_fantasia, ''), e.razao_social))
               from development_empresas de join empresas e on e.id = de.empresa_id where de.development_id = u.development_id) incorporadoras
       from ult u join developments d on d.id = u.development_id`,
    p
  );
  const mesesEntre = (a: string, b: string) => {
    const [ya, ma] = a.split('-').map(Number);
    const [yb, mb] = b.split('-').map(Number);
    return Math.max(1, (yb - ya) * 12 + (mb - ma));
  };
  type Acum = { empreendimentos: Set<string>; disponiveis: number; vgv: number; vendidas: number; meses: number; estoqueBase: number; ultima: string | null };
  const novo = (): Acum => ({ empreendimentos: new Set(), disponiveis: 0, vgv: 0, vendidas: 0, meses: 0, estoqueBase: 0, ultima: null });
  const porDev = new Map<string, { vendidas: number; meses: number; estoqueBase: number }>();
  const porMes = new Map<string, { vendidas: number; disponiveis: number }>();
  for (const x of pares) {
    const m = mesesEntre(x.mes_ant, x.mes);
    const a = porDev.get(x.dev) ?? { vendidas: 0, meses: 0, estoqueBase: 0 };
    a.vendidas += Number(x.vendidas);
    a.meses += m;
    a.estoqueBase += Number(x.estoque_ant) * m; // estoque médio ponderado pelo tempo
    porDev.set(x.dev, a);
    const pm = porMes.get(x.mes) ?? { vendidas: 0, disponiveis: 0 };
    pm.vendidas += Number(x.vendidas);
    porMes.set(x.mes, pm);
  }
  const total = novo();
  const bairros = new Map<string, Acum & { sub: string | null }>();
  const incs = new Map<string, Acum>();
  const linhasDev: LinhaEstoque[] = [];
  const somar = (acc: Acum, dev: string, disp: number, vgv: number, v: { vendidas: number; meses: number; estoqueBase: number } | undefined, mes: string) => {
    acc.empreendimentos.add(dev);
    acc.disponiveis += disp;
    acc.vgv += vgv;
    if (v) {
      acc.vendidas += v.vendidas;
      acc.meses = Math.max(acc.meses, v.meses);
      acc.estoqueBase += v.estoqueBase;
    }
    if (!acc.ultima || mes > acc.ultima) acc.ultima = mes;
  };
  const fechar = (nome: string, sub: string | null, a: Acum, mesesDev?: number): LinhaEstoque => {
    const meses = mesesDev ?? a.meses;
    const velocidade = meses ? Math.round((a.vendidas / meses) * 10) / 10 : null;
    // VSO mensal: vendas por mês sobre o estoque médio do período
    const estoqueMedio = meses ? a.estoqueBase / meses : 0;
    const vsoPct = velocidade != null && estoqueMedio > 0 ? Math.round((velocidade / estoqueMedio) * 1000) / 10 : null;
    const mesesEstoque = velocidade ? Math.round((a.disponiveis / velocidade) * 10) / 10 : null;
    return { nome, sub, empreendimentos: a.empreendimentos.size, disponiveis: a.disponiveis, vgvDisponivel: Math.round(a.vgv), vendidas: a.vendidas, meses, velocidade, vsoPct, mesesEstoque, ultimaTabela: a.ultima };
  };
  for (const e of estoque) {
    const disp = Number(e.disp);
    const vgv = Number(e.vgv);
    const v = porDev.get(e.dev);
    const acc = novo();
    somar(acc, e.dev, disp, vgv, v, e.mes);
    linhasDev.push(fechar(e.nome, [e.bairro, e.cidade].filter(Boolean).join(', ') || null, acc, v?.meses));
    somar(total, e.dev, disp, vgv, v, e.mes);
    const kb = `${e.bairro ?? 'Sem bairro'}|${e.cidade ?? ''}`;
    const b = bairros.get(kb) ?? { ...novo(), sub: e.cidade };
    somar(b, e.dev, disp, vgv, v, e.mes);
    bairros.set(kb, b);
    for (const inc of e.incorporadoras ?? []) {
      const a = incs.get(inc) ?? novo();
      somar(a, e.dev, disp, vgv, v, e.mes);
      incs.set(inc, a);
    }
    const pm = porMes.get(e.mes) ?? { vendidas: 0, disponiveis: 0 };
    pm.disponiveis += disp;
    porMes.set(e.mes, pm);
  }
  // nos grupos: velocidade = soma das velocidades de cada empreendimento;
  // VSO = essa velocidade / soma dos estoques médios de cada empreendimento
  const fecharGrupo = (nome: string, sub: string | null, a: Acum): LinhaEstoque => {
    let velocidade = 0;
    let estoqueMedio = 0;
    let algum = false;
    for (const dev of Array.from(a.empreendimentos)) {
      const v = porDev.get(dev);
      if (!v || !v.meses) continue;
      algum = true;
      velocidade += v.vendidas / v.meses;
      estoqueMedio += v.estoqueBase / v.meses;
    }
    const base = fechar(nome, sub, a);
    const vel = algum ? Math.round(velocidade * 10) / 10 : null;
    return {
      ...base,
      velocidade: vel,
      vsoPct: vel != null && estoqueMedio > 0 ? Math.round((velocidade / estoqueMedio) * 1000) / 10 : null,
      mesesEstoque: vel ? Math.round((a.disponiveis / velocidade) * 10) / 10 : null
    };
  };
  return {
    total: fecharGrupo('Total', null, total),
    porMes: Array.from(porMes.entries())
      .filter(([m]) => m >= p[0].slice(0, 7) && m <= p[1].slice(0, 7))
      .map(([mes, x]) => ({ mes, ...x }))
      .sort((a, b) => a.mes.localeCompare(b.mes)),
    empreendimentos: linhasDev.sort((a, b) => b.disponiveis - a.disponiveis),
    bairros: Array.from(bairros.entries())
      .map(([k, a]) => fecharGrupo(k.split('|')[0], a.sub, a))
      .sort((a, b) => b.disponiveis - a.disponiveis),
    incorporadoras: Array.from(incs.entries())
      .map(([k, a]) => fecharGrupo(k, null, a))
      .sort((a, b) => b.disponiveis - a.disponiveis)
  };
}

export type UnidadeSalva = { unidade: string; torre: string | null; area: number | null; vagas: number | null; garagens: string | null; escaninho: string | null; valor: number | null; situacao: string | null };
/** Unidades de uma tabela gravada (número, torre, metragem, garagens, escaninho, preço, situação). */
export async function unidadesDaTabela(id: string): Promise<UnidadeSalva[]> {
  await exigirGestorAval();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return [];
  const r = await query<Record<string, unknown>>(
    `select unidade, torre, area, vagas, garagens, escaninho, valor, situacao from tabelas_precos_unidades where tabela_id = $1
      order by torre nulls first, nullif(regexp_replace(unidade, '\\D', '', 'g'), '')::bigint nulls last, unidade`,
    [id]
  );
  const n = (v: unknown) => (v == null ? null : Number(v));
  return r.map((x) => ({
    unidade: String(x.unidade ?? ''),
    torre: (x.torre as string) ?? null,
    area: n(x.area),
    vagas: n(x.vagas),
    garagens: (x.garagens as string) ?? null,
    escaninho: (x.escaninho as string) ?? null,
    valor: n(x.valor),
    situacao: (x.situacao as string) ?? null
  }));
}

/** Disponibilidade por metragem (tabela mais recente) gravada no empreendimento: metragens
 *  parecidas (até 1% de diferença) contam como a mesma planta. Sem disponíveis = vazio. */
async function gravarDisponibilidade(developmentId: string, tabelaId: string) {
  const us = await query<{ area: string; valor: string | null }>(
    `select area, valor from tabelas_precos_unidades where tabela_id = $1 and situacao = 'disponivel' and area > 0 order by area`,
    [tabelaId]
  );
  const grupos: { area: number; disponiveis: number; aPartirDe: number | null }[] = [];
  for (const u of us) {
    const a = Number(u.area);
    const v = u.valor != null ? Number(u.valor) : null;
    const g = grupos.find((x) => Math.abs(x.area - a) / x.area <= 0.01);
    if (g) {
      g.disponiveis++;
      if (v && (!g.aPartirDe || v < g.aPartirDe)) g.aPartirDe = v;
    } else grupos.push({ area: Math.round(a * 100) / 100, disponiveis: 1, aPartirDe: v && v > 0 ? v : null });
  }
  await query(`update developments set disponibilidade = $2::jsonb, disponiveis = $3 where id = $1`, [
    developmentId,
    JSON.stringify(grupos),
    grupos.reduce((s2, g) => s2 + g.disponiveis, 0)
  ]);
}

/** Recalcula a disponibilidade de todos os empreendimentos que têm tabela (para as tabelas
 *  gravadas antes desta função existir). */
export async function recalcularDisponibilidade(): Promise<number> {
  await exigirGestorAval();
  const devs = await query<{ development_id: string }>(`select distinct development_id from tabelas_precos where development_id is not null`);
  let n = 0;
  for (const d of devs) if (await aplicarTabelaMaisRecente(d.development_id)) n++;
  return n;
}
