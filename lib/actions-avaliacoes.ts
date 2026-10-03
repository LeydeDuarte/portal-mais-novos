'use server';

// Avaliação de imóveis (ferramenta INTERNA da equipe, Painel → Imóveis e condomínios).
// Amostras, do grátis para o pago:
//   1) nossa base: anúncios do portal e vendidos do histórico (grátis);
//   2) memória de buscas anteriores nos portais, por 90 dias, do condomínio OU da região (grátis);
//   3) busca nos portais pela IA mais barata (Haiku), no máximo 3 pesquisas, só quando pedida;
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
import { registrarUsoIA } from './custos';
import { GRUPO_TIPO, type AmostraAvaliacao, type ImovelAvaliacao, type ResultadoAvaliacaoInterna } from './avaliacao-calculo';

const RAIO_KM = 1;
const MEMORIA_DIAS = 90; // um imóvel leva em média uns 90 dias para vender
const MODELO_BUSCA = process.env.ANTHROPIC_MODEL_BUSCA || 'claude-haiku-4-5-20251001';
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
async function condominiosProximos(developmentId: string): Promise<{ id: string; nome: string; km: number }[]> {
  const r = await query<{ id: string; name: string; km: number | null }>(
    `with c as (select lat, lng from developments where id = $1 and lat is not null)
     select d.id, d.name, 111.2 * sqrt(power(d.lat - c.lat, 2) + power((d.lng - c.lng) * cos(radians(c.lat)), 2)) km
       from developments d, c where d.lat is not null
        and 111.2 * sqrt(power(d.lat - c.lat, 2) + power((d.lng - c.lng) * cos(radians(c.lat)), 2)) <= $2
      order by km limit 600`,
    [developmentId, RAIO_KM]
  ).catch(() => []);
  return r.map((x) => ({ id: x.id, nome: x.name, km: Number(x.km) || 0 }));
}

/** 1) e 2): amostras da nossa base (anúncios e vendidos) — grátis */
export async function amostrasDaBase(e: ImovelAvaliacao): Promise<AmostraAvaliacao[]> {
  await exigirGestorAval();
  const area = Number(e.area) || 0;
  if (!e.bairro || !e.cidade || !area) return [];
  const tipos = tiposDoGrupo(e.tipo);
  const params: unknown[] = [tipos, area];
  let onde: string;
  let proximos: { id: string; nome: string; km: number }[] = [];
  if (e.developmentId && e.horizontal) {
    // condomínio horizontal: só o próprio condomínio
    params.push(e.developmentId);
    onde = `x.empreendimento_id = $${params.length}`;
  } else if (e.developmentId) {
    proximos = await condominiosProximos(e.developmentId);
    const ids = proximos.length ? proximos.map((p) => p.id) : [e.developmentId];
    params.push(ids);
    onde = `x.empreendimento_id = any($${params.length}::text[])`;
  } else {
    params.push(e.bairro, e.cidade);
    onde = `lower(x.bairro) = lower($${params.length - 1}) and lower(x.cidade) = lower($${params.length})`;
  }
  const [anuncios, vendidos] = await Promise.all([
    query<Record<string, unknown>>(
      `select x.id, x.titulo, coalesce(d.name, x.condominio) condominio, x.bairro, x.area, x.quartos, x.vagas, x.price_value preco, x.empreendimento_id,
              extract(year from coalesce(x.delivery_date, case when coalesce(d.tipo, '') <> 'horizontal' then d.delivery_date end))::int ano, x.slug
         from properties x left join developments d on d.id = x.empreendimento_id
        where x.finalidade = 'venda' and x.vendido_em is null and not coalesce(x.is_tipologia, false) and x.price_value > 0
          and x.area between $2 * 0.5 and $2 * 2 and x.tipo_unidade = any($1::text[]) and ${onde}
        limit 60`,
      params
    ).catch(() => []),
    query<Record<string, unknown>>(
      `select 'h' || x.id id, x.titulo, coalesce(d.name, x.condominio) condominio, x.bairro, x.area, x.quartos, x.vagas, coalesce(x.valor_venda, x.price_value) preco,
              x.valor_venda is not null real, x.empreendimento_id, extract(year from x.delivery_date)::int ano
         from imoveis_historico x left join developments d on d.id = x.empreendimento_id
        where x.motivo ilike 'vend%' and coalesce(x.valor_venda, x.price_value) > 0 and x.area between $2 * 0.5 and $2 * 2
          and x.tipo_unidade = any($1::text[]) and ${onde}
        limit 30`,
      params
    ).catch(() => [])
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
      url: x.slug ? `/imovel/${x.slug}` : null,
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
      usar: true
    }))
  ];
  return filtrarIdade(e, lista);
}

/** condomínio horizontal: só casas com a mesma idade (±2 anos) */
function filtrarIdade(e: ImovelAvaliacao, l: AmostraAvaliacao[]): AmostraAvaliacao[] {
  if (!e.horizontal || !e.ano) return l;
  return l.filter((a) => !a.ano || Math.abs(a.ano - (e.ano as number)) <= 2);
}

const chaveBusca = (e: ImovelAvaliacao) => (e.developmentId ? `cond:${e.developmentId}:${grupoDe(e.tipo)}` : `reg:${semAcento(e.cidade)}|${semAcento(e.bairro)}|${grupoDe(e.tipo)}`);

/** 3) portais: memória de 45 dias; se não houver (ou se forçado), pesquisa com a IA mais barata */
export async function buscarNosPortais(e: ImovelAvaliacao, forcar = false): Promise<{ amostras: AmostraAvaliacao[]; daMemoria: boolean; custoUsd: number; erro?: string }> {
  const eu = await exigirGestorAval();
  const area = Number(e.area) || 0;
  if (!e.bairro || !e.cidade || !area) return { amostras: [], daMemoria: false, custoUsd: 0, erro: 'Preencha o imóvel antes de buscar.' };
  const chave = chaveBusca(e);
  const proximos = e.developmentId && !e.horizontal ? await condominiosProximos(e.developmentId) : [];
  const converter = (x: Record<string, unknown>): AmostraAvaliacao => {
    const nome = (x.condominio as string) ?? null;
    const perto = nome ? proximos.find((p) => semAcento(p.nome) === semAcento(nome)) : undefined;
    return {
      id: `w-${x.url}`,
      origem: 'portal',
      portal: (x.portal as string) ?? null,
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
      l.filter((a) => a.area >= area * 0.5 && a.area <= area * 2 && a.preco > 10000 && (!e.horizontal || a.mesmoCondominio))
    );
  if (!forcar) {
    const mem = await query<Record<string, unknown>>(
      `select * from amostras_portais
        where encontrado_em > now() - ($2 || ' days')::interval
          and (chave = $1 or (lower(bairro) = lower($3) and lower(coalesce(cidade, '')) = lower($4) and tipo = any($5::text[])))`,
      [chave, MEMORIA_DIAS, e.bairro, e.cidade, tiposDoGrupo(e.tipo)]
    ).catch(() => []);
    if (mem.length) return { amostras: filtrar(mem.map(converter)), daMemoria: true, custoUsd: 0 };
  }
  const chaveApi = process.env.ANTHROPIC_API_KEY;
  if (!chaveApi) return { amostras: [], daMemoria: false, custoUsd: 0, erro: 'A IA não está configurada (ANTHROPIC_API_KEY).' };

  const tipoTxt = e.tipo.replace(/_/g, ' ');
  const alvo = e.condominio
    ? e.horizontal
      ? `casas à venda dentro do condomínio "${e.condominio}" (${e.bairro}, ${e.cidade})`
      : `${tipoTxt} à venda no condomínio "${e.condominio}" ou em prédios vizinhos (${proximos.slice(1, 6).map((p) => p.nome).join(', ') || e.bairro}), ${e.bairro}, ${e.cidade}`
    : `${tipoTxt} à venda no bairro ${e.bairro}, ${e.cidade}`;
  const instrucao = `Você pesquisa anúncios de imóveis à venda em portais brasileiros (ZAP, VivaReal, OLX, QuintoAndar, Imovelweb, Chaves na Mão e sites de imobiliárias).
Procure: ${alvo}, com área perto de ${area} m²${e.quartos ? `, ${e.quartos} quartos` : ''}${e.vagas != null ? `, ${e.vagas} vagas` : ''}.
Responda SOMENTE com um array JSON, sem texto antes ou depois. Cada item: {"portal": "", "url": "", "titulo": "", "condominio": "", "bairro": "", "area": 0, "quartos": 0, "vagas": 0, "preco": 0, "ano": 0}.
Regras: só anúncios de VENDA com preço e área claramente informados no resultado; não invente nem estime números; use null no que não souber; url do anúncio (não da busca); no máximo 15 itens; não repita o mesmo imóvel.`;
  let j: { content?: { type: string; text?: string }[]; usage?: Record<string, unknown>; error?: { message?: string } };
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': chaveApi, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(90000),
      body: JSON.stringify({
        model: MODELO_BUSCA,
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3, user_location: { type: 'approximate', city: e.cidade, region: 'Goiás', country: 'BR' } }],
        messages: [{ role: 'user', content: instrucao }]
      })
    });
    j = await r.json().catch(() => ({}));
    if (!r.ok) return { amostras: [], daMemoria: false, custoUsd: 0, erro: j.error?.message ?? `IA: HTTP ${r.status}` };
  } catch (err) {
    return { amostras: [], daMemoria: false, custoUsd: 0, erro: err instanceof Error ? err.message : 'A busca não respondeu.' };
  }
  await registrarUsoIA(MODELO_BUSCA, j.usage as Parameters<typeof registrarUsoIA>[1], null);
  const u = (j.usage ?? {}) as { input_tokens?: number; output_tokens?: number; server_tool_use?: { web_search_requests?: number } };
  const custoUsd = ((u.input_tokens ?? 0) * 1 + (u.output_tokens ?? 0) * 5) / 1_000_000 + (u.server_tool_use?.web_search_requests ?? 0) * 0.01;
  const texto = (j.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
  const m = texto.match(/\[[\s\S]*\]/);
  let itens: Record<string, unknown>[] = [];
  try {
    itens = m ? (JSON.parse(m[0]) as Record<string, unknown>[]) : [];
  } catch {
    itens = [];
  }
  const vistos = new Set<string>();
  const validos = itens.filter((x) => {
    const url = typeof x.url === 'string' && /^https?:\/\//.test(x.url) ? x.url : '';
    if (!url || vistos.has(url)) return false;
    vistos.add(url);
    return Number(x.area) > 0 && Number(x.preco) > 0;
  });
  for (const x of validos) {
    await query(
      `insert into amostras_portais (url, chave, portal, titulo, condominio, bairro, cidade, tipo, area, quartos, vagas, preco, ano, encontrado_em)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())
       on conflict (url) do update set chave = excluded.chave, preco = excluded.preco, area = excluded.area, encontrado_em = now()`,
      [
        String(x.url).slice(0, 600),
        chave,
        String(x.portal ?? '').slice(0, 60) || null,
        String(x.titulo ?? '').slice(0, 200) || null,
        String(x.condominio ?? '').slice(0, 160) || null,
        String(x.bairro ?? '').slice(0, 100) || null,
        e.cidade,
        e.tipo,
        Number(x.area),
        num(x.quartos),
        num(x.vagas),
        Number(x.preco),
        num(x.ano) && Number(x.ano) > 1950 ? Number(x.ano) : null
      ]
    ).catch(() => {});
  }
  await registrarObservacoes(
    validos.map((x) => ({
      url: String(x.url),
      portal: (x.portal as string) ?? null,
      condominio: (x.condominio as string) ?? null,
      bairro: (x.bairro as string) || e.bairro,
      cidade: e.cidade,
      tipo: e.tipo,
      area: Number(x.area),
      quartos: num(x.quartos),
      vagas: num(x.vagas),
      preco: Number(x.preco),
      ano: num(x.ano)
    }))
  );
  void eu;
  return { amostras: filtrar(validos.map(converter)), daMemoria: false, custoUsd, erro: validos.length ? undefined : 'A busca não encontrou anúncios com preço e área informados.' };
}

// ---------------- histórico do mercado (para sempre) ----------------
type Observacao = { url: string; portal: string | null; condominio: string | null; bairro: string | null; cidade: string | null; tipo: string | null; area: number; quartos: number | null; vagas: number | null; preco: number; ano: number | null };
/** Cada anúncio de portal vira uma observação POR MÊS (preço pedido daquele mês). Nunca apaga:
 *  é a base do m² por bairro mês a mês no Painel → Mercado. */
async function registrarObservacoes(lista: Observacao[]) {
  for (const o of lista) {
    if (!o.url || !(o.area > 0) || !(o.preco > 0) || !o.bairro) continue;
    await query(
      `insert into mercado_observacoes (url, mes, portal, condominio, bairro, cidade, tipo, area, quartos, vagas, preco, ano)
       values ($1, date_trunc('month', now() at time zone 'America/Sao_Paulo')::date, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (url, mes) do update set preco = excluded.preco, area = excluded.area, ultima_em = now()`,
      [o.url.slice(0, 600), o.portal, o.condominio, o.bairro, o.cidade, o.tipo, o.area, o.quartos, o.vagas, o.preco, o.ano && o.ano > 1950 ? o.ano : null]
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
  const r = await query<Record<string, unknown>>(`select * from avaliacoes where id = $1 and ($2 or lower(coalesce(criado_por, '')) = lower($3))`, [id, veTudo(eu.role), eu.email]);
  return r[0] ? mapear(r[0]) : null;
}

export async function excluirAvaliacaoInterna(id: string): Promise<void> {
  const eu = await exigirGestorAval();
  await query(`delete from avaliacoes where id = $1 and ($2 or lower(coalesce(criado_por, '')) = lower($3))`, [id, veTudo(eu.role), eu.email]);
}
