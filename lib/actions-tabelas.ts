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

export type UnidadeGravar = { unidade: string; area: number; valor?: number | null; vagas?: number | null; garagens?: string | null; escaninho?: string | null; torre?: string | null; empreendimento?: string | null; parcelas?: number[] | null; situacao: string };
/** tipo 'lancamento' = tabela de um empreendimento; 'revenda' = estoque de revenda (permutas) de uma incorporadora */
export type TabelaGravar = { developmentId: string | null; nome: string | null; mes: string; arquivo: string; hash: string; unidades: UnidadeGravar[]; tipo?: 'lancamento' | 'revenda'; empresaId?: string | null; pagamento?: { texto: string; fluxo: { nome: string; qtd: number; inicio: string | null; pct: number }[] | null } | null };

const chaveNome = (n: string) =>
  String(n ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(edificio|residencial|condominio)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** incorporadoras/construtoras cadastradas (para o estoque de revenda) */
export async function nomesIncorporadoras(): Promise<{ id: string; nome: string }[]> {
  await exigirGestorAval();
  const r = await query<{ id: string; nome: string }>(
    `select id, coalesce(nullif(nome_perfil, ''), nullif(nome_fantasia, ''), razao_social) nome from empresas order by 2`
  );
  return r.filter((x) => x.nome);
}

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

export async function gravarTabelas(lote: TabelaGravar[]): Promise<{ gravadas: number; repetidas: number; aplicadas: number; erros: string[]; porHash: Record<string, 'gravada' | 'repetida' | string> }> {
  const eu = await exigirEquipe();
  if (!veTudo(eu.role)) throw new Error('Só admin e analista gravam tabelas de preços.');
  let gravadas = 0;
  let repetidas = 0;
  const erros: string[] = [];
  // situação de cada arquivo (pelo hash): 'gravada', 'repetida' ou a mensagem de erro
  const porHash: Record<string, string> = {};
  const devs = new Set<string>();
  const await_nomes = new Map<string, string>();
  if (lote.some((t) => t.tipo === 'revenda')) {
    for (const d of await query<{ id: string; name: string }>(`select id, name from developments where name is not null`)) await_nomes.set(chaveNome(d.name), d.id);
  }
  for (const t of lote.slice(0, 50)) {
    if (!/^\d{4}-\d{2}$/.test(t.mes)) {
      erros.push(`${t.arquivo}: falta o mês de referência.`);
      porHash[t.hash] = 'falta o mês de referência';
      continue;
    }
    const revenda = t.tipo === 'revenda';
    if (revenda && !(t.empresaId && /^[0-9a-f-]{36}$/i.test(t.empresaId))) {
      erros.push(`${t.arquivo}: escolha a incorporadora do estoque de revenda.`);
      porHash[t.hash] = 'escolha a incorporadora';
      continue;
    }
    const uns = (t.unidades ?? []).filter((u) => u && Number(u.area) > 0).slice(0, 3000);
    if (!uns.length) {
      erros.push(`${t.arquivo}: nenhuma unidade.`);
      porHash[t.hash] = 'nenhuma unidade';
      continue;
    }
    const comValor = uns.filter((u) => Number(u.valor) > 0);
    const disp = comValor.filter((u) => u.situacao === 'disponivel');
    const base = disp.length ? disp : comValor;
    const m2 = base.length ? base.reduce((s, u) => s + Number(u.valor) / Number(u.area), 0) / base.length : null;
    const valores = base.map((u) => Number(u.valor));
    const r = await query<{ id: string }>(
      `insert into tabelas_precos (development_id, empreendimento_nome, mes_referencia, arquivo, hash, unidades, disponiveis, valor_min, valor_max, m2_medio, criado_por, area_min, area_max, tipo, empresa_id, vgv_disponivel, pagamento)
       values ($1, $2, ($3 || '-01')::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb) on conflict (hash) do nothing returning id`,
      [
        revenda ? null : t.developmentId,
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
        Math.max(...uns.map((u) => Number(u.area))),
        revenda ? 'revenda' : 'lancamento',
        revenda ? t.empresaId : null,
        disp.reduce((s2, u) => s2 + (Number(u.valor) || 0), 0) || null,
        t.pagamento && (t.pagamento.texto || t.pagamento.fluxo)
          ? JSON.stringify({ texto: String(t.pagamento.texto ?? '').slice(0, 2000), fluxo: Array.isArray(t.pagamento.fluxo) ? t.pagamento.fluxo.slice(0, 20) : null })
          : null
      ]
    );
    if (!r[0]) {
      repetidas++;
      porHash[t.hash] = 'repetida';
      continue;
    }
    await query(
      `insert into tabelas_precos_unidades (tabela_id, unidade, area, vagas, valor, situacao, garagens, escaninho, torre, empreendimento_nome, development_id, parcelas)
       select $1, u, a, v, p, s, g, e, t, en, ed, pc::jsonb from unnest($2::text[], $3::numeric[], $4::int[], $5::numeric[], $6::text[], $7::text[], $8::text[], $9::text[], $10::text[], $11::text[], $12::text[]) x(u, a, v, p, s, g, e, t, en, ed, pc)`,
      [
        r[0].id,
        uns.map((u) => String(u.unidade).slice(0, 40)),
        uns.map((u) => Number(u.area)),
        uns.map((u) => (u.vagas != null && Number.isFinite(Number(u.vagas)) ? Math.round(Number(u.vagas)) : null)),
        uns.map((u) => (Number(u.valor) > 0 ? Number(u.valor) : null)),
        uns.map((u) => String(u.situacao ?? 'disponivel').slice(0, 20)),
        uns.map((u) => (u.garagens ? String(u.garagens).slice(0, 120) : null)),
        uns.map((u) => (u.escaninho ? String(u.escaninho).slice(0, 30) : null)),
        uns.map((u) => (u.torre ? String(u.torre).slice(0, 30) : null)),
        uns.map((u) => (u.empreendimento ? String(u.empreendimento).slice(0, 160) : null)),
        uns.map((u) => (revenda && u.empreendimento ? (await_nomes.get(chaveNome(u.empreendimento)) ?? null) : null)),
        uns.map((u) => (Array.isArray(u.parcelas) && u.parcelas.length ? JSON.stringify(u.parcelas.filter((v) => Number.isFinite(Number(v))).slice(0, 20).map(Number)) : null))
      ]
    );
    gravadas++;
    porHash[t.hash] = 'gravada';
    if (t.developmentId && !revenda) devs.add(t.developmentId);
  }
  let aplicadas = 0;
  for (const d of Array.from(devs)) if (await aplicarTabelaMaisRecente(d)) aplicadas++;
  if (gravadas) await atualizarFechamentos().catch(() => {});
  return { gravadas, repetidas, aplicadas, erros, porHash };
}

/** O empreendimento recebe a tabela de mês mais recente: preço de cada tipologia = menor
 *  valor disponível de mesma metragem (±2%). Devolve true se mudou algo. */
async function aplicarTabelaMaisRecente(developmentId: string): Promise<boolean> {
  const t = (
    await query<{ id: string; mes: string }>(
      `select id, to_char(mes_referencia, 'YYYY-MM-DD') mes from tabelas_precos where development_id = $1 and tipo = 'lancamento' order by mes_referencia desc, criado_em desc limit 1`,
      [developmentId]
    )
  )[0];
  if (!t) return false;
  const atual = (await query<{ ref: string | null }>(`select to_char(tabela_referencia, 'YYYY-MM-DD') ref from developments where id = $1`, [developmentId]))[0];
  if (atual?.ref && atual.ref > t.mes) return false; // já tem uma tabela mais nova aplicada
  await query(`update developments set tabela_referencia = $2::date, tabela_acompanhar = true, tabela_parou_motivo = null, tabela_parou_em = null where id = $1`, [developmentId, t.mes]);
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
  const PER = `t.mes_referencia between $1::date and $2::date and t.m2_medio > 0 and t.tipo = 'lancamento'`;
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
  await query(`update developments set disponibilidade = $2::jsonb, disponiveis = $3, vendido_100 = case when $3 > 0 then false else vendido_100 end where id = $1`, [
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

// ---------------- acompanhamento das tabelas (o que falta atualizar) ----------------
/** Para de cobrar a tabela de um condomínio (esgotado, a incorporadora não envia mais...).
 *  "Esgotado" zera as unidades disponíveis. Uma tabela nova volta a acompanhar sozinha. */
export async function acompanharTabela(developmentId: string, acompanhar: boolean, motivo?: string): Promise<void> {
  const eu = await exigirGestorAval();
  const m = String(motivo ?? '').trim().slice(0, 200) || null;
  if (acompanhar) {
    await query(`update developments set tabela_acompanhar = true, tabela_parou_motivo = null, tabela_parou_em = null where id = $1`, [developmentId]);
    return;
  }
  const esgotado = !!m && /esgotad|100%|vendid/i.test(m);
  await query(
    `update developments set tabela_acompanhar = false, tabela_parou_motivo = $2, tabela_parou_em = now()${esgotado ? `, disponiveis = 0, disponibilidade = '[]'::jsonb, vendido_100 = true, vendido_100_em = now()` : ''} where id = $1`,
    [developmentId, m ? `${m} (por ${eu.email})` : `por ${eu.email}`]
  );
}

export type CondoParaAtualizar = { id: string; nome: string; bairro: string | null; ultimaTabela: string; disponiveis: number | null; entrega: string | null };
/** Lançamento, obras e pronto novo com tabela de mais de 3 meses e ainda acompanhados. */
export async function condominiosParaAtualizar(): Promise<CondoParaAtualizar[]> {
  await exigirGestorAval();
  const r = await query<{ id: string; name: string; bairro: string | null; ref: string; disponiveis: number | null; entrega: string | null }>(
    `select id, name, bairro, to_char(tabela_referencia, 'YYYY-MM') ref, disponiveis, to_char(delivery_date, 'YYYY-MM') entrega
       from developments
      where tabela_referencia is not null and tabela_acompanhar
        and tabela_referencia < date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '2 months'
        and (delivery_date is null or delivery_date >= (now() - interval '36 months'))
      order by tabela_referencia asc, name limit 300`
  );
  return r.map((x) => ({ id: x.id, nome: x.name, bairro: x.bairro, ultimaTabela: x.ref, disponiveis: x.disponiveis, entrega: x.entrega }));
}

// ---------------- fechamento mensal por incorporadora (lançamento e revenda) ----------------
type ParVenda = { chave: string; mes: string; vendidas: number; vgv: number };
const UNIDADE = `regexp_replace(lower(coalesce(u.empreendimento_nome, '') || '|' || u.unidade), '\\s', '', 'g')`;
const UNIDADE_V = `regexp_replace(lower(coalesce(v.empreendimento_nome, '') || '|' || v.unidade), '\\s', '', 'g')`;

/** vendidas entre tabelas seguidas do mesmo "dono" (empreendimento no lançamento, incorporadora na revenda) */
async function paresDeVenda(tipo: 'lancamento' | 'revenda'): Promise<ParVenda[]> {
  const dono = tipo === 'lancamento' ? 'development_id' : 'empresa_id::text';
  const r = await query<{ dono: string; mes: string; vendidas: string; vgv: string }>(
    `with t as (select id, ${dono} dono, mes_referencia mes, lag(id) over (partition by ${dono} order by mes_referencia, criado_em) ant,
                       lag(mes_referencia) over (partition by ${dono} order by mes_referencia, criado_em) mes_ant
                  from tabelas_precos where tipo = $1 and ${dono} is not null)
     select t.dono, to_char(t.mes, 'YYYY-MM') mes, count(u.*) vendidas, coalesce(sum(u.valor), 0) vgv
       from t join tabelas_precos_unidades u on u.tabela_id = t.ant and u.situacao = 'disponivel'
      where t.ant is not null and t.mes > t.mes_ant
        and not exists (select 1 from tabelas_precos_unidades v where v.tabela_id = t.id and v.situacao = 'disponivel' and ${UNIDADE_V} = ${UNIDADE})
      group by t.dono, t.mes`,
    [tipo]
  );
  return r.map((x) => ({ chave: x.dono, mes: x.mes, vendidas: Number(x.vendidas), vgv: Number(x.vgv) }));
}

const somarMes = (m: string, n: number) => {
  const [a, mm] = m.split('-').map(Number);
  const d = new Date(a, mm - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Recalcula e GRAVA o fechamento de cada mês por incorporadora (estoque, VGV, vendidas e VGV
 *  vendido, separado em lançamento e revenda). Roda a cada tabela gravada. Os dados de origem
 *  (as tabelas) ficam para sempre; o fechamento é refeito a partir deles. */
export async function atualizarFechamentos(): Promise<number> {
  await exigirGestorAval();
  const lanc = await query<{ dev: string; mes: string; disp: number; vgv: string | null; incs: string[] | null }>(
    `select t.development_id dev, to_char(t.mes_referencia, 'YYYY-MM') mes, t.disponiveis disp, t.vgv_disponivel vgv,
            (select array_agg(de.empresa_id::text) from development_empresas de where de.development_id = t.development_id) incs
       from tabelas_precos t where t.tipo = 'lancamento' and t.development_id is not null order by t.mes_referencia, t.criado_em`
  );
  const rev = await query<{ emp: string; mes: string; disp: number; vgv: string | null; emps: string }>(
    `select t.empresa_id::text emp, to_char(t.mes_referencia, 'YYYY-MM') mes, t.disponiveis disp, t.vgv_disponivel vgv,
            (select count(distinct coalesce(u.development_id, u.empreendimento_nome)) from tabelas_precos_unidades u where u.tabela_id = t.id and u.situacao = 'disponivel') emps
       from tabelas_precos t where t.tipo = 'revenda' and t.empresa_id is not null order by t.mes_referencia, t.criado_em`
  );
  if (!lanc.length && !rev.length) {
    await query(`delete from estoque_incorporadoras_mensal`);
    return 0;
  }
  const [paresL, paresR] = await Promise.all([paresDeVenda('lancamento'), paresDeVenda('revenda')]);
  const incsDoDev = new Map(lanc.map((l) => [l.dev, l.incs ?? []]));
  const todosMeses = [...lanc.map((l) => l.mes), ...rev.map((r) => r.mes)].sort();
  const hoje = new Date();
  const fim = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  type Linha = { estoque: number; vgv: number; vendidas: number; vgvVendido: number; emps: number };
  const linhas = new Map<string, Linha>(); // chave: empresa|mes|tipo
  const pegar = (emp: string, mes: string, tipo: string) => {
    const k = `${emp}|${mes}|${tipo}`;
    let l = linhas.get(k);
    if (!l) linhas.set(k, (l = { estoque: 0, vgv: 0, vendidas: 0, vgvVendido: 0, emps: 0 }));
    return l;
  };
  for (let m = todosMeses[0]; m <= fim; m = somarMes(m, 1)) {
    const desde = somarMes(m, -2); // tabela vale por 3 meses
    // lançamento: tabela mais recente de cada empreendimento até o mês m
    const ultLanc = new Map<string, (typeof lanc)[number]>();
    for (const l of lanc) if (l.mes <= m && l.mes >= desde) ultLanc.set(l.dev, l);
    for (const l of Array.from(ultLanc.values()))
      for (const emp of l.incs ?? []) {
        const x = pegar(emp, m, 'lancamento');
        x.estoque += Number(l.disp) || 0;
        x.vgv += Number(l.vgv) || 0;
        if (Number(l.disp) > 0) x.emps++;
      }
    // revenda: planilha mais recente de cada incorporadora até o mês m
    const ultRev = new Map<string, (typeof rev)[number]>();
    for (const r of rev) if (r.mes <= m && r.mes >= desde) ultRev.set(r.emp, r);
    for (const r of Array.from(ultRev.values())) {
      const x = pegar(r.emp, m, 'revenda');
      x.estoque += Number(r.disp) || 0;
      x.vgv += Number(r.vgv) || 0;
      x.emps += Number(r.emps) || 0;
    }
  }
  for (const p of paresL) for (const emp of incsDoDev.get(p.chave) ?? []) {
    const x = pegar(emp, p.mes, 'lancamento');
    x.vendidas += p.vendidas;
    x.vgvVendido += p.vgv;
  }
  for (const p of paresR) {
    const x = pegar(p.chave, p.mes, 'revenda');
    x.vendidas += p.vendidas;
    x.vgvVendido += p.vgv;
  }
  const ent = Array.from(linhas.entries()).filter(([, l]) => l.estoque > 0 || l.vendidas > 0);
  await query(`delete from estoque_incorporadoras_mensal`);
  for (let i = 0; i < ent.length; i += 500) {
    const lote = ent.slice(i, i + 500);
    await query(
      `insert into estoque_incorporadoras_mensal (empresa_id, mes, tipo, estoque, vgv, vendidas, vgv_vendido, empreendimentos)
       select e::uuid, (m || '-01')::date, t, es, vg, ve, vv, ep from unnest($1::text[], $2::text[], $3::text[], $4::int[], $5::numeric[], $6::int[], $7::numeric[], $8::int[]) x(e, m, t, es, vg, ve, vv, ep)`,
      [
        lote.map(([k]) => k.split('|')[0]),
        lote.map(([k]) => k.split('|')[1]),
        lote.map(([k]) => k.split('|')[2]),
        lote.map(([, l]) => l.estoque),
        lote.map(([, l]) => Math.round(l.vgv)),
        lote.map(([, l]) => l.vendidas),
        lote.map(([, l]) => Math.round(l.vgvVendido)),
        lote.map(([, l]) => l.emps)
      ]
    );
  }
  return ent.length;
}

export type RankingIncorporadora = {
  empresaId: string;
  nome: string;
  vendidasLanc: number;
  vendidasRev: number;
  vgvVendido: number;
  estoqueInicio: number; // lançamento + revenda no primeiro mês do período
  estoqueFim: number; // no último mês do período
  eliminadoPct: number | null; // vendidas / estoque no início
  meses: { mes: string; estoqueLanc: number; estoqueRev: number; vendidasLanc: number; vendidasRev: number }[];
};

/** Ranking: quem mais eliminou estoque no período (lançamento + revenda), com a série mensal. */
export async function rankingIncorporadoras(de: string, ate: string): Promise<RankingIncorporadora[]> {
  await exigirGestorAval();
  const ok = (m: string) => /^\d{4}-\d{2}$/.test(m);
  const r = await query<{ emp: string; nome: string; mes: string; tipo: string; estoque: number; vendidas: number; vgv_vendido: string }>(
    `select f.empresa_id::text emp, coalesce(nullif(e.nome_perfil, ''), nullif(e.nome_fantasia, ''), e.razao_social) nome,
            to_char(f.mes, 'YYYY-MM') mes, f.tipo, f.estoque, f.vendidas, f.vgv_vendido
       from estoque_incorporadoras_mensal f join empresas e on e.id = f.empresa_id
      where f.mes between $1::date and $2::date order by f.mes`,
    [ok(de) ? `${de}-01` : '1990-01-01', ok(ate) ? `${ate}-01` : '2100-01-01']
  );
  const porEmp = new Map<string, RankingIncorporadora>();
  for (const x of r) {
    let e = porEmp.get(x.emp);
    if (!e) porEmp.set(x.emp, (e = { empresaId: x.emp, nome: x.nome, vendidasLanc: 0, vendidasRev: 0, vgvVendido: 0, estoqueInicio: 0, estoqueFim: 0, eliminadoPct: null, meses: [] }));
    let m = e.meses.find((y) => y.mes === x.mes);
    if (!m) e.meses.push((m = { mes: x.mes, estoqueLanc: 0, estoqueRev: 0, vendidasLanc: 0, vendidasRev: 0 }));
    if (x.tipo === 'revenda') {
      m.estoqueRev += Number(x.estoque);
      m.vendidasRev += Number(x.vendidas);
      e.vendidasRev += Number(x.vendidas);
    } else {
      m.estoqueLanc += Number(x.estoque);
      m.vendidasLanc += Number(x.vendidas);
      e.vendidasLanc += Number(x.vendidas);
    }
    e.vgvVendido += Number(x.vgv_vendido);
  }
  for (const e of Array.from(porEmp.values())) {
    e.meses.sort((a, b) => a.mes.localeCompare(b.mes));
    // estoque inicial: primeiro estoque conhecido de CADA tipo no período (mais o que foi vendido
    // naquele mês, que ainda estava no estoque); final: o último estoque conhecido de cada tipo
    const inicio = (tipo: 'Lanc' | 'Rev') => {
      const m = e.meses.find((x) => x[`estoque${tipo}`] > 0);
      return m ? m[`estoque${tipo}`] + m[`vendidas${tipo}`] : 0;
    };
    const final = (tipo: 'Lanc' | 'Rev') => {
      const m = [...e.meses].reverse().find((x) => x[`estoque${tipo}`] > 0);
      return m ? m[`estoque${tipo}`] : 0;
    };
    e.estoqueInicio = inicio('Lanc') + inicio('Rev');
    e.estoqueFim = final('Lanc') + final('Rev');
    const vend = e.vendidasLanc + e.vendidasRev;
    e.eliminadoPct = e.estoqueInicio > 0 ? Math.round((vend / e.estoqueInicio) * 1000) / 10 : null;
  }
  return Array.from(porEmp.values()).sort((a, b) => b.vendidasLanc + b.vendidasRev - (a.vendidasLanc + a.vendidasRev) || (b.eliminadoPct ?? 0) - (a.eliminadoPct ?? 0));
}

/** Marca/desmarca "100% vendido" (só analista e admin). Marcar também para de cobrar a tabela. */
export async function marcarVendido100(developmentId: string, vendido: boolean): Promise<void> {
  const eu = await exigirGestorAval();
  if (vendido)
    await query(
      `update developments set vendido_100 = true, vendido_100_em = now(), disponiveis = 0, disponibilidade = '[]'::jsonb,
              tabela_acompanhar = false, tabela_parou_motivo = $2, tabela_parou_em = now() where id = $1`,
      [developmentId, `Esgotado (100% vendido) (por ${eu.email})`]
    );
  else await query(`update developments set vendido_100 = false, vendido_100_em = null, tabela_acompanhar = true, tabela_parou_motivo = null, tabela_parou_em = null where id = $1`, [developmentId]);
}
