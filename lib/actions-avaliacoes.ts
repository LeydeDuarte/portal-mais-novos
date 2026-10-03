'use server';

// Avaliação de imóveis (ferramenta INTERNA da equipe, Painel → Imóveis e condomínios).
// Amostras, do grátis para o pago:
//   1) nossa base: anúncios do portal e vendidos do histórico (grátis);
//   2) memória de buscas anteriores nos portais, por 90 dias, do condomínio OU da região (grátis);
//   3) anúncios de portais gravados pelo Projeto Claude "Pesquisa de Mercado" (sem custo);
//   4) amostra manual (link + dados digitados).
// Regras de área: prédio = mesmo condomínio + condomínios a até 1 km; condomínio horizontal =
// só o próprio condomínio, casas com a mesma idade (±2 anos); lote/rua = mesmo bairro.
import { query } from './db';
import { exigirEquipe } from './staff-auth';

async function exigirGestorAval() {
  const eu = await exigirEquipe();
  if (!veTudo(eu.role)) throw new Error('Ferramenta só do analista e do administrador.');
  return eu;
}
import { veTudo } from './papeis';
import { SITE_URL } from './seo';
import { GRUPO_TIPO, VALIDADE_PADRAO_MESES, faixaMetragem, raioDe, type AmostraAvaliacao, type ImovelAvaliacao, type ResultadoAvaliacaoInterna } from './avaliacao-calculo';

const RAIO_KM = 1;
const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^(edif[ií]cio|residencial|condom[ií]nio)\s+/, '').trim();
const num = (v: unknown) => (v == null || v === '' ? null : Number(v));
const grupoDe = (tipo: string) => GRUPO_TIPO[tipo] ?? 'vertical';
const tiposDoGrupo = (tipo: string) => Object.entries(GRUPO_TIPO).filter(([, g]) => g === grupoDe(tipo)).map(([t]) => t);

export type CondominioAval = { id: string; nome: string; bairro: string | null; cidade: string | null; horizontal: boolean; ano: number | null; lat: number | null; lng: number | null };

export async function buscarCondominiosAval(texto: string): Promise<CondominioAval[]> {
  await exigirGestorAval();
  const q = String(texto ?? '').trim().slice(0, 80);
  if (q.length < 2) return [];
  const r = await query<Record<string, unknown>>(
    `select id, name, bairro, cidade, tipo, delivery_date, lat, lng from developments
      where unaccent_lower(name) like '%' || unaccent_lower($1) || '%' order by (status = 'publicado') desc, name limit 12`,
    [q]
  ).catch(() =>
    query<Record<string, unknown>>(
      `select id, name, bairro, cidade, tipo, delivery_date, lat, lng from developments where lower(name) like '%' || lower($1) || '%' order by name limit 12`,
      [q]
    )
  );
  return r.map((x) => ({
    id: String(x.id),
    nome: String(x.name),
    bairro: (x.bairro as string) ?? null,
    cidade: (x.cidade as string) ?? null,
    horizontal: x.tipo === 'horizontal',
    ano: x.delivery_date ? new Date(x.delivery_date as string).getFullYear() : null,
    lat: num(x.lat),
    lng: num(x.lng)
  }));
}

/** condomínios do nosso cadastro a até 1 km (inclui o próprio), com a distância */
async function condominiosProximos(developmentId: string, raioKm: number = RAIO_KM): Promise<{ id: string; nome: string; km: number }[]> {
  const r = await query<{ id: string; name: string; km: number | null }>(
    `with c as (select lat, lng from developments where id = $1 and lat is not null)
     select d.id, d.name, 111.2 * sqrt(power(d.lat - c.lat, 2) + power((d.lng - c.lng) * cos(radians(c.lat)), 2)) km
       from developments d, c where d.lat is not null
        and 111.2 * sqrt(power(d.lat - c.lat, 2) + power((d.lng - c.lng) * cos(radians(c.lat)), 2)) <= $2
      order by km limit 4000`,
    [developmentId, raioKm]
  ).catch(() => []);
  return r.map((x) => ({ id: x.id, nome: x.name, km: Number(x.km) || 0 }));
}

/** 1) e 2): amostras da nossa base (anúncios e vendidos) — grátis */
export async function amostrasDaBase(e: ImovelAvaliacao): Promise<AmostraAvaliacao[]> {
  await exigirGestorAval();
  const area = Number(e.area) || 0;
  if (!e.bairro || !e.cidade || !area) return [];
  const tipos = tiposDoGrupo(e.tipo);
  const faixa = faixaMetragem(e);
  // ATENÇÃO: só valores USADOS na consulta (o banco recusa parâmetro sobrando)
  const params: unknown[] = [tipos, faixa.min, faixa.max];
  let onde: string;
  let proximos: { id: string; nome: string; km: number }[] = [];
  if (e.developmentId && e.horizontal) {
    // condomínio horizontal: só o próprio condomínio
    params.push(e.developmentId);
    onde = `x.empreendimento_id = $${params.length}`;
  } else if (e.developmentId) {
    proximos = await condominiosProximos(e.developmentId, raioDe(e));
    const ids = proximos.length ? proximos.map((p) => p.id) : [e.developmentId];
    params.push(ids);
    onde = `x.empreendimento_id = any($${params.length}::text[])`;
  } else {
    params.push(e.bairro, e.cidade);
    onde = `lower(x.bairro) = lower($${params.length - 1}) and lower(x.cidade) = lower($${params.length})`;
  }
  const [anuncios, vendidos] = await Promise.all([
    query<Record<string, unknown>>(
      `select x.id, x.titulo, coalesce(d.name, x.condominio) condominio, x.bairro, x.area, x.quartos, x.vagas, x.price_value preco, x.empreendimento_id, x.visibilidade,
              (select coalesce(nullif(su.nome_publico, ''), su.name) from staff_users su where lower(su.email) = lower(x.corretor_email)) corretor_nome,
              extract(year from coalesce(x.delivery_date, case when coalesce(d.tipo, '') <> 'horizontal' then d.delivery_date end))::int ano, x.slug
         from properties x left join developments d on d.id = x.empreendimento_id
        where x.finalidade = 'venda' and x.vendido_em is null and not coalesce(x.is_tipologia, false) and x.price_value > 0
          and x.area between $2 and $3 and x.tipo_unidade = any($1::text[]) and ${onde}
        limit 60`,
      params
    ).catch((err) => {
      console.error('amostrasDaBase (anúncios):', err);
      throw new Error('Falha ao buscar os anúncios da nossa base. Avise o suporte.');
    }),
    query<Record<string, unknown>>(
      `select 'h' || x.id id, x.titulo, coalesce(d.name, x.condominio) condominio, x.bairro, x.area, x.quartos, x.vagas, coalesce(x.valor_venda, x.price_value) preco,
              x.valor_venda is not null real, x.empreendimento_id,
              (select coalesce(nullif(su.nome_publico, ''), su.name) from staff_users su where lower(su.email) = lower(x.corretor_email)) corretor_nome, extract(year from x.delivery_date)::int ano
         from imoveis_historico x left join developments d on d.id = x.empreendimento_id
        where x.motivo ilike 'vend%' and coalesce(x.valor_venda, x.price_value) > 0 and x.area between $2 and $3
          and x.tipo_unidade = any($1::text[]) and ${onde}
        limit 30`,
      params
    ).catch((err) => {
      console.error('amostrasDaBase (vendidos):', err);
      return [] as Record<string, unknown>[];
    })
  ]);
  const km = (id: unknown) => proximos.find((p) => p.id === id)?.km ?? null;
  const mesmo = (id: unknown, nome: unknown) =>
    (!!e.developmentId && id === e.developmentId) || (!!e.condominio && !!nome && semAcento(String(nome)) === semAcento(e.condominio));
  const lista: AmostraAvaliacao[] = [
    ...anuncios.map((x) => ({
      id: `p-${x.id}`,
      origem: 'nosso' as const,
      titulo: (x.titulo as string) ?? null,
      condominio: (x.condominio as string) ?? null,
      bairro: (x.bairro as string) ?? null,
      area: Number(x.area),
      quartos: num(x.quartos),
      vagas: num(x.vagas),
      ano: num(x.ano),
      preco: Number(x.preco),
      distKm: km(x.empreendimento_id),
      mesmoCondominio: mesmo(x.empreendimento_id, x.condominio),
      // link só de anúncio público (o privado o cliente não consegue abrir)
      url: x.slug && x.visibilidade !== 'privado' ? `${SITE_URL}/imovel/${x.slug}` : null,
      portal: 'maisnovosimoveis.com',
      anunciante: (x.corretor_nome as string) || 'Mais Novos Imóveis',
      usar: true
    })),
    ...vendidos.map((x) => ({
      id: String(x.id),
      origem: (x.real ? 'vendido' : 'nosso') as AmostraAvaliacao['origem'],
      titulo: `${(x.titulo as string) ?? 'Imóvel'}${x.real ? ' (vendido)' : ' (encerrado)'}`,
      condominio: (x.condominio as string) ?? null,
      bairro: (x.bairro as string) ?? null,
      area: Number(x.area),
      quartos: num(x.quartos),
      vagas: num(x.vagas),
      ano: num(x.ano),
      preco: Number(x.preco),
      distKm: km(x.empreendimento_id),
      mesmoCondominio: mesmo(x.empreendimento_id, x.condominio),
      portal: 'maisnovosimoveis.com',
      anunciante: (x.corretor_nome as string) || 'Mais Novos Imóveis',
      usar: true
    }))
  ];
  return filtrarIdade(e, lista);
}

/** A idade é decidida pela margem de idade escolhida na tela (motivoFora em avaliacao-calculo). */
function filtrarIdade(_e: ImovelAvaliacao, l: AmostraAvaliacao[]): AmostraAvaliacao[] {
  return l;
}

/** Anúncio de portal raramente traz o ano: completa pelo ano de entrega do condomínio de mesmo
 *  nome no nosso cadastro (só prédios; casa em condomínio horizontal tem idade própria). */
async function completarAnos(l: AmostraAvaliacao[], cidade: string): Promise<AmostraAvaliacao[]> {
  if (!l.some((a) => !a.ano && a.condominio)) return l;
  const devs = await query<{ name: string; ano: number }>(
    `select name, extract(year from delivery_date)::int ano from developments
      where delivery_date is not null and coalesce(tipo, 'vertical') <> 'horizontal' and lower(coalesce(cidade, '')) = lower($1)`,
    [cidade]
  ).catch(() => []);
  const anos = new Map<string, number>();
  for (const d of devs) anos.set(semAcento(d.name), Number(d.ano));
  return l.map((a) => (!a.ano && a.condominio && anos.has(semAcento(a.condominio)) ? { ...a, ano: anos.get(semAcento(a.condominio)) ?? null } : a));
}

const chaveBusca = (e: ImovelAvaliacao) => (e.developmentId ? `cond:${e.developmentId}:${grupoDe(e.tipo)}` : `reg:${semAcento(e.cidade)}|${semAcento(e.bairro)}|${grupoDe(e.tipo)}`);

/** 3) portais: memória de 45 dias; se não houver (ou se forçado), pesquisa com a IA mais barata */
export async function buscarNosPortais(e: ImovelAvaliacao, forcar = false): Promise<{ amostras: AmostraAvaliacao[]; daMemoria: boolean; custoUsd: number; erro?: string }> {
  const eu = await exigirGestorAval();
  const area = Number(e.area) || 0;
  if (!e.bairro || !e.cidade || !area) return { amostras: [], daMemoria: false, custoUsd: 0, erro: 'Preencha o imóvel antes de buscar.' };
  const chave = chaveBusca(e);
  const proximos = e.developmentId && !e.horizontal ? await condominiosProximos(e.developmentId, raioDe(e)) : [];
  const converter = (x: Record<string, unknown>): AmostraAvaliacao => {
    const nome = (x.condominio as string) ?? null;
    const perto = nome ? proximos.find((p) => semAcento(p.nome) === semAcento(nome)) : undefined;
    return {
      id: `w-${x.url}`,
      origem: 'portal',
      portal: (x.portal as string) ?? null,
      anunciante: (x.anunciante as string) ?? null,
      vistoEm: x.encontrado_em ? new Date(x.encontrado_em as string).toISOString().slice(0, 10) : null,
      codigoRef: (x.codigo_ref as string) ?? null,
      andar: num(x.andar),
      caracteristicas: Array.isArray(x.caracteristicas) ? (x.caracteristicas as string[]) : null,
      url: (x.url as string) ?? null,
      titulo: (x.titulo as string) ?? null,
      condominio: nome,
      bairro: (x.bairro as string) ?? null,
      area: Number(x.area),
      quartos: num(x.quartos),
      vagas: num(x.vagas),
      ano: num(x.ano),
      preco: Number(x.preco),
      distKm: perto?.km ?? null,
      mesmoCondominio: !!e.condominio && !!nome && semAcento(nome) === semAcento(e.condominio),
      usar: true
    };
  };
  const filtrar = (l: AmostraAvaliacao[]) =>
    filtrarIdade(
      e,
      l.filter((a) => a.area >= faixaMetragem(e).min && a.area <= faixaMetragem(e).max && a.preco > 10000 && (!e.horizontal || a.mesmoCondominio))
    );
  // Só lê o que já foi gravado (sem custo): as pesquisas nos portais são feitas pelo
  // Projeto Claude "Pesquisa de Mercado", que grava em amostras_portais e mercado_observacoes.
  void forcar;
  const mem = await query<Record<string, unknown>>(
    `select * from amostras_portais
      where encontrado_em > now() - ($2 || ' months')::interval
        and (chave = $1 or (lower(bairro) = lower($3) and lower(coalesce(cidade, '')) = lower($4) and tipo = any($5::text[])))`,
    [chave, Math.min(24, Math.max(1, Number(e.validadeMeses) || VALIDADE_PADRAO_MESES)), e.bairro, e.cidade, tiposDoGrupo(e.tipo)]
  ).catch(() => []);
  void eu;
  if (!mem.length)
    return {
      amostras: [],
      daMemoria: true,
      custoUsd: 0,
      erro: `Ainda não há anúncios de portais gravados para ${e.condominio ? `o ${e.condominio} ou ` : ''}o ${e.bairro} nos últimos ${Number(e.validadeMeses) || VALIDADE_PADRAO_MESES} meses. Peça no Projeto Claude "Pesquisa de Mercado" e depois clique de novo.`
    };
  // anúncio do nosso próprio site já vem pela nossa base (não entra duas vezes);
  // nos portais, o anunciante fica como o portal mostra (corretor ou imobiliária)
  const lista = mem.map(converter).filter((x) => !/maisnovosimoveis\.com/i.test(x.url ?? ''));
  // o mesmo anunciante com o mesmo imóvel (mesmo condomínio e metragem) em mais de um anúncio:
  // vale o visto mais recentemente (ex.: excluiu e anunciou de novo com outro preço)
  const ultimo = new Map<string, AmostraAvaliacao>();
  const semDono: AmostraAvaliacao[] = [];
  for (const x of lista) {
    if (!x.anunciante) {
      semDono.push(x);
      continue;
    }
    const k = `${semAcento(x.anunciante)}|${semAcento(x.condominio ?? x.bairro ?? '')}|${Math.round(x.area)}`;
    const ja = ultimo.get(k);
    if (!ja || (x.vistoEm ?? '') > (ja.vistoEm ?? '')) ultimo.set(k, x);
  }
  const nossos = [...Array.from(ultimo.values()), ...semDono];
  return { amostras: await completarAnos(filtrar(nossos), e.cidade), daMemoria: true, custoUsd: 0 };
}

// ---------------- histórico do mercado (para sempre) ----------------
type Observacao = { url: string; portal: string | null; anunciante?: string | null; condominio: string | null; bairro: string | null; cidade: string | null; tipo: string | null; area: number; quartos: number | null; vagas: number | null; preco: number; ano: number | null };
/** Cada anúncio de portal vira uma observação POR MÊS (preço pedido daquele mês). Nunca apaga:
 *  é a base do m² por bairro mês a mês no Painel → Mercado. */
async function registrarObservacoes(lista: Observacao[]) {
  for (const o of lista) {
    if (!o.url || !(o.area > 0) || !(o.preco > 0) || !o.bairro) continue;
    await query(
      `insert into mercado_observacoes (url, mes, portal, condominio, bairro, cidade, tipo, area, quartos, vagas, preco, ano, anunciante)
       values ($1, date_trunc('month', now() at time zone 'America/Sao_Paulo')::date, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       on conflict (url, mes) do update set preco = excluded.preco, area = excluded.area, anunciante = coalesce(excluded.anunciante, mercado_observacoes.anunciante), ultima_em = now()`,
      [o.url.slice(0, 600), o.portal, o.condominio, o.bairro, o.cidade, o.tipo, o.area, o.quartos, o.vagas, o.preco, o.ano && o.ano > 1950 ? o.ano : null, o.anunciante ? String(o.anunciante).slice(0, 120) : null]
    ).catch(() => {});
  }
}

// ---------------- salvar / listar / abrir ----------------
export type AvaliacaoInterna = {
  id: string;
  imovel: ImovelAvaliacao;
  amostras: AmostraAvaliacao[];
  resultado: ResultadoAvaliacaoInterna | null;
  contatoId: string | null;
  criadoPor: string | null;
  criadoEm: string;
  /** responsável pela avaliação (assinatura do relatório) */
  responsavel?: { nome: string; creci: string | null } | null;
};
const mapear = (x: Record<string, unknown>): AvaliacaoInterna => ({
  id: String(x.id),
  imovel: x.imovel as ImovelAvaliacao,
  amostras: (x.amostras as AmostraAvaliacao[]) ?? [],
  resultado: (x.resultado as ResultadoAvaliacaoInterna) ?? null,
  contatoId: (x.contato_id as string) ?? null,
  criadoPor: (x.criado_por as string) ?? null,
  criadoEm: new Date(x.criado_em as string).toISOString()
});

export async function salvarAvaliacaoInterna(d: { id?: string; imovel: ImovelAvaliacao; amostras: AmostraAvaliacao[]; resultado: ResultadoAvaliacaoInterna | null; contatoId?: string | null }): Promise<{ id: string }> {
  const eu = await exigirGestorAval();
  if (!d.imovel?.bairro || !(Number(d.imovel?.area) > 0)) throw new Error('Preencha o imóvel avaliado.');
  // amostras sem fotos nem textos de terceiros: só os dados e o link
  const amostras = (d.amostras ?? []).slice(0, 120).map((a) => ({ ...a, titulo: a.titulo?.slice(0, 200) ?? null }));
  // amostras digitadas à mão com link de portal também alimentam o histórico do mercado
  await registrarObservacoes(
    amostras
      .filter((a) => a.origem === 'manual' && a.url && /^https?:\/\//.test(a.url))
      .map((a) => ({
        url: a.url as string,
        portal: a.portal ?? null,
        anunciante: a.anunciante ?? null,
        condominio: a.condominio ?? d.imovel.condominio ?? null,
        bairro: a.bairro ?? d.imovel.bairro,
        cidade: d.imovel.cidade,
        tipo: d.imovel.tipo,
        area: a.area,
        quartos: a.quartos ?? null,
        vagas: a.vagas ?? null,
        preco: a.preco,
        ano: a.ano ?? null
      }))
  );
  if (d.id) {
    const r = await query<{ id: string }>(
      `update avaliacoes set imovel = $2, amostras = $3, resultado = $4, contato_id = $5, atualizado_em = now()
        where id = $1 and ($6 or lower(coalesce(criado_por, '')) = lower($7)) returning id`,
      [d.id, JSON.stringify(d.imovel), JSON.stringify(amostras), d.resultado ? JSON.stringify(d.resultado) : null, d.contatoId ?? null, veTudo(eu.role), eu.email]
    );
    if (!r[0]) throw new Error('Avaliação não encontrada.');
    return { id: r[0].id };
  }
  const r = await query<{ id: string }>(
    `insert into avaliacoes (imovel, amostras, resultado, contato_id, criado_por) values ($1, $2, $3, $4, $5) returning id`,
    [JSON.stringify(d.imovel), JSON.stringify(amostras), d.resultado ? JSON.stringify(d.resultado) : null, d.contatoId ?? null, eu.email]
  );
  return { id: r[0].id };
}

export async function listarAvaliacoesInternas(): Promise<AvaliacaoInterna[]> {
  const eu = await exigirGestorAval();
  const r = veTudo(eu.role)
    ? await query<Record<string, unknown>>(`select * from avaliacoes order by criado_em desc limit 200`)
    : await query<Record<string, unknown>>(`select * from avaliacoes where lower(coalesce(criado_por, '')) = lower($1) order by criado_em desc limit 200`, [eu.email]);
  return r.map(mapear);
}

export async function abrirAvaliacaoInterna(id: string): Promise<AvaliacaoInterna | null> {
  const eu = await exigirGestorAval();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const r = await query<Record<string, unknown>>(
    `select a.*, (select json_build_object('nome', coalesce(nullif(su.nome_publico, ''), su.name), 'creci', su.creci) from staff_users su where lower(su.email) = lower(a.criado_por)) responsavel
       from avaliacoes a where a.id = $1 and ($2 or lower(coalesce(a.criado_por, '')) = lower($3))`,
    [id, veTudo(eu.role), eu.email]
  );
  return r[0] ? { ...mapear(r[0]), responsavel: (r[0].responsavel as { nome: string; creci: string | null }) ?? null } : null;
}

export async function excluirAvaliacaoInterna(id: string): Promise<void> {
  const eu = await exigirGestorAval();
  await query(`delete from avaliacoes where id = $1 and ($2 or lower(coalesce(criado_por, '')) = lower($3))`, [id, veTudo(eu.role), eu.email]);
}
