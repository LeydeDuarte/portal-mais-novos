// Números do mercado por bairro e por cidade, calculados com os nossos dados
// (anúncios à venda + vendas registradas). Base da "Valorização" do News: a
// variação em 12 meses aparece quando o bairro tiver histórico suficiente.
import { query } from '../db';

export type LinhaMercado = { nome: string; cidade: string; uf: string; m2: number; anuncios: number; vendidos12m: number; variacao12m: number | null };

const MIN_ANUNCIOS = 4; // bairro com poucos anúncios fica fora (número instável)

export async function mercadoPorBairro(uf = 'GO', limite = 8): Promise<LinhaMercado[]> {
  const rows = await query<{ bairro: string; cidade: string; uf: string; m2: string; n: string; vendidos: string; m2_ant: string | null }>(
    `with atual as (
       select bairro, cidade, upper(uf) uf, avg(price_value / nullif(area, 0)) m2, count(*) n
         from properties
        where visibilidade = 'publico' and not is_tipologia and finalidade = 'venda' and vendido_em is null
          and price_value > 0 and area > 20 and bairro is not null and upper(coalesce(uf, 'GO')) = upper($1)
        group by bairro, cidade, upper(uf) having count(*) >= ${MIN_ANUNCIOS}),
     vend as (
       select lower(bairro) b, lower(cidade) c, count(*) filter (where encerrado_em > now() - interval '12 months') v12,
              avg(valor_m2) filter (where encerrado_em between now() - interval '24 months' and now() - interval '12 months') m2_ant
         from imoveis_historico where motivo = 'vendido' group by 1, 2)
     select a.bairro, a.cidade, a.uf, a.m2, a.n, coalesce(v.v12, 0) vendidos, v.m2_ant
       from atual a left join vend v on v.b = lower(a.bairro) and v.c = lower(a.cidade)
      order by a.n desc limit $2`,
    [uf, limite]
  ).catch(() => []);
  return rows.map((r) => {
    const m2 = Math.round(Number(r.m2));
    const ant = r.m2_ant ? Number(r.m2_ant) : null;
    return {
      nome: r.bairro,
      cidade: r.cidade,
      uf: r.uf,
      m2,
      anuncios: Number(r.n),
      vendidos12m: Number(r.vendidos),
      variacao12m: ant ? Math.round(((m2 - ant) / ant) * 1000) / 10 : null
    };
  });
}

export async function mercadoPorCidade(uf = 'GO', limite = 6): Promise<LinhaMercado[]> {
  const rows = await query<{ cidade: string; uf: string; m2: string; n: string }>(
    `select cidade, upper(uf) uf, avg(price_value / nullif(area, 0)) m2, count(*) n from properties
      where visibilidade = 'publico' and not is_tipologia and finalidade = 'venda' and vendido_em is null
        and price_value > 0 and area > 20 and cidade is not null and upper(coalesce(uf, 'GO')) = upper($1)
      group by cidade, upper(uf) having count(*) >= ${MIN_ANUNCIOS} order by n desc limit $2`,
    [uf, limite]
  ).catch(() => []);
  return rows.map((r) => ({ nome: r.cidade, cidade: r.cidade, uf: r.uf, m2: Math.round(Number(r.m2)), anuncios: Number(r.n), vendidos12m: 0, variacao12m: null }));
}

// Lançamentos por incorporadora (fase pela data de entrega: breve lançamento, lançamento e obras)
import { getStatusBucket } from '../classification';
export type IncorporadoraFases = { nome: string; slug: string | null; breve: number; lancamento: number; obras: number; total: number };
export async function lancamentosPorIncorporadora(cidade: string | null = 'Goiânia', limite = 10, uf: string | null = null): Promise<IncorporadoraFases[]> {
  const rows = await query<{ nome: string; slug: string | null; entrega: string | Date }>(
    `select coalesce(nullif(e.nome_perfil, ''), nullif(e.nome_fantasia, ''), e.razao_social) nome, e.slug, d.delivery_date entrega
       from developments d
       join development_empresas de on de.development_id = d.id and de.ordem = 0
       join empresas e on e.id = de.empresa_id
      where d.status = 'publicado' and d.delivery_date > now()
        and ($1::text is null or lower(d.cidade) = lower($1)) and ($2::text is null or upper(coalesce(d.uf, 'GO')) = upper($2))`,
    [cidade, uf]
  ).catch(() => []);
  const mapa = new Map<string, IncorporadoraFases>();
  for (const r of rows) {
    const k = r.nome;
    const it = mapa.get(k) ?? { nome: r.nome, slug: r.slug, breve: 0, lancamento: 0, obras: 0, total: 0 };
    const iso = (r.entrega instanceof Date ? r.entrega.toISOString() : String(r.entrega)).slice(0, 10);
    const b = getStatusBucket(iso);
    if (b === 'breve_lancamento') it.breve++;
    else if (b === 'lancamento') it.lancamento++;
    else it.obras++;
    it.total++;
    mapa.set(k, it);
  }
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total).slice(0, limite);
}
