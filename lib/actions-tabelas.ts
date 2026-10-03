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

export type UnidadeGravar = { unidade: string; area: number; valor?: number | null; vagas?: number | null; situacao: string };
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
      `insert into tabelas_precos (development_id, empreendimento_nome, mes_referencia, arquivo, hash, unidades, disponiveis, valor_min, valor_max, m2_medio, criado_por)
       values ($1, $2, ($3 || '-01')::date, $4, $5, $6, $7, $8, $9, $10, $11) on conflict (hash) do nothing returning id`,
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
        eu.email
      ]
    );
    if (!r[0]) {
      repetidas++;
      continue;
    }
    await query(
      `insert into tabelas_precos_unidades (tabela_id, unidade, area, vagas, valor, situacao)
       select $1, u, a, v, p, s from unnest($2::text[], $3::numeric[], $4::int[], $5::numeric[], $6::text[]) x(u, a, v, p, s)`,
      [
        r[0].id,
        uns.map((u) => String(u.unidade).slice(0, 40)),
        uns.map((u) => Number(u.area)),
        uns.map((u) => (u.vagas != null && Number.isFinite(Number(u.vagas)) ? Math.round(Number(u.vagas)) : null)),
        uns.map((u) => (Number(u.valor) > 0 ? Number(u.valor) : null)),
        uns.map((u) => String(u.situacao ?? 'disponivel').slice(0, 20))
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

export type TabelaResumo = { id: string; developmentId: string | null; empreendimento: string | null; mes: string; arquivo: string; unidades: number; disponiveis: number; valorMin: number | null; m2: number | null; criadoEm: string };

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
