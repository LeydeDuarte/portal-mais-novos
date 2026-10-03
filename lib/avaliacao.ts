'use server';

// Avaliação de imóvel pelo MÉTODO COMPARATIVO DIRETO DE DADOS DE MERCADO (ABNT NBR 14653-2):
// 1) amostras: anúncios do mesmo tipo, na mesma cidade, priorizando o mesmo bairro e a
//    vizinhança (até 3 km), com área entre metade e o dobro da do imóvel avaliado;
// 2) homogeneização: cada preço por m² é ajustado ao imóvel avaliado por fatores
//    (oferta, área, quartos, vagas e idade);
// 3) saneamento: descarta amostras muito fora da mediana (±35%);
// 4) média ponderada pela semelhança (distância, mesmo bairro, área parecida) e intervalo
//    de confiança de 80% (t de Student). É uma estimativa estatística, não um laudo.
import { query } from './db';
import { cookies } from 'next/headers';
import { origemDoNavegador } from './origem-servidor';
import { getCliente } from './cliente-auth';
import { exigirEquipe } from './staff-auth';
// grupos de tipo (mesma divisão usada nos similares)
const GRUPO_TIPO: Record<string, string> = {
  studio: 'vertical', flat: 'vertical', loft: 'vertical', apartamento: 'vertical', apartamento_garden: 'vertical',
  apartamento_duplex: 'vertical', apartamento_triplex: 'vertical', cobertura: 'vertical', cobertura_duplex: 'vertical', penthouse: 'vertical',
  casa: 'casa', casa_condominio: 'casa', sobrado: 'casa',
  chacara_sitio_fazenda: 'terra', terreno_lote: 'terra',
  sala_comercial: 'comercial', loja_ponto_comercial: 'comercial', galpao: 'comercial', predio_comercial: 'comercial'
};

export type EntradaAvaliacao = { cidade: string; bairro: string; tipo: string; area: number; quartos?: number | null; vagas?: number | null; ano?: number | null; condominio?: string | null };
export type Amostra = { titulo: string; bairro: string; area: number; preco: number; m2: number; m2Homog: number; distKm: number | null; slug: string | null; peso: number; publico: boolean; condominio?: string | null; quartos?: number | null; vagas?: number | null; ano?: number | null; mesmoCondominio?: boolean };
export type ResultadoAvaliacao =
  | { ok: false; erro: string }
  | {
      ok: true;
      valor: number;
      minimo: number;
      maximo: number;
      m2: number;
      n: number;
      descartadas: number;
      grau: 'III' | 'II' | 'I' | 'Fora da norma';
      amplitudePct: number;
      amostras: Amostra[];
    };

const semAcentoMin = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^(edif[ií]cio|residencial|condom[ií]nio)\s+/, '').trim();

// t de Student bicaudal 80% por graus de liberdade (n-1)
const T80: Record<number, number> = { 1: 3.078, 2: 1.886, 3: 1.638, 4: 1.533, 5: 1.476, 6: 1.44, 7: 1.415, 8: 1.397, 9: 1.383, 10: 1.372, 12: 1.356, 15: 1.341, 20: 1.325, 30: 1.31 };
const t80 = (gl: number) => {
  const ks = Object.keys(T80).map(Number).sort((a, b) => a - b);
  for (const k of ks) if (gl <= k) return T80[k];
  return 1.282;
};

export async function avaliarImovel(e: EntradaAvaliacao): Promise<ResultadoAvaliacao> {
  const cliente = await getCliente().catch(() => null);
  if (!cliente) return { ok: false, erro: 'Entre com a sua conta para ver a avaliação.' };
  const area = Number(e.area);
  const registrar = (resumo: string) =>
    query(
      `insert into interest_leads (nome, email, condominio, mensagem, finalidade, area_min, quartos, aceita_contato, visitante, origem_web)
       values ($1, $2, 'Avaliação de imóvel', $3, 'venda', $4, $5, true, $6, $7::jsonb)`,
      [cliente.nome || cliente.email, cliente.email, `Avaliação: ${e.tipo} de ${area} m² no ${e.bairro} (${e.cidade}). ${resumo}`, area, e.quartos ? Math.round(e.quartos) : null, cookies().get('mn_vid')?.value?.slice(0, 64) ?? null, JSON.stringify(origemDoNavegador())]
    ).catch(() => {});
  return calcularAvaliacao({ ...e, condominio: null }, registrar);
}

/** Avaliação feita pela equipe no CRM (ficha do cliente): mesmo cálculo, sem login de
 *  cliente e sem criar lead; considera o condomínio informado. */
export async function avaliarParaEquipe(e: EntradaAvaliacao): Promise<ResultadoAvaliacao> {
  await exigirEquipe();
  const r = await calcularAvaliacao(e, async () => {});
  if (!r.ok && /Recebemos o seu pedido/.test(r.erro)) {
    return { ok: false, erro: r.erro.replace(/ Recebemos o seu pedido.*$/, ' Tente ampliar a área ou conferir o bairro e o tipo.') };
  }
  return r;
}

async function calcularAvaliacao(e: EntradaAvaliacao, registrar: (resumo: string) => Promise<unknown>): Promise<ResultadoAvaliacao> {
  const area = Number(e.area);
  if (!e.cidade?.trim() || !e.bairro?.trim()) return { ok: false, erro: 'Escolha o bairro na lista.' };
  if (!(area >= 15 && area <= 5000)) return { ok: false, erro: 'Informe a área privativa em m² (entre 15 e 5.000).' };
  const grupo = GRUPO_TIPO[e.tipo] ?? 'vertical';
  const tipos = Object.entries(GRUPO_TIPO).filter(([, g]) => g === grupo).map(([t]) => t);

  // centro do bairro avaliado (média das coordenadas dos condomínios do bairro)
  const c = await query<{ lat: string | null; lng: string | null }>(
    `select avg(lat) lat, avg(lng) lng from developments where lat is not null and lower(bairro) = lower($1) and lower(cidade) = lower($2)`,
    [e.bairro.trim(), e.cidade.trim()]
  ).catch(() => []);
  const lat = c[0]?.lat != null ? Number(c[0].lat) : null;
  const lng = c[0]?.lng != null ? Number(c[0].lng) : null;
  const dist =
    lat != null && lng != null
      ? `111.2 * sqrt(power(coalesce(p.lat, d.lat, bc.lat) - ${lat}, 2) + power((coalesce(p.lng, d.lng, bc.lng) - ${lng}) * cos(radians(${lat})), 2))`
      : 'null::float';
  const rows = await query<{ titulo: string | null; bairro: string | null; area: string; price_value: string; quartos: number | null; vagas: number | null; delivery_date: Date | string | null; slug: string | null; dist: number | null; mesmo: boolean; visibilidade: string; condominio: string | null }>(
    `select * from (
       select p.titulo, p.bairro, p.area, p.price_value, p.quartos, p.vagas, coalesce(p.delivery_date, d.delivery_date) delivery_date, p.slug, p.visibilidade, coalesce(d.name, p.condominio) condominio,
              ${dist} as dist, lower(coalesce(p.bairro, '')) = lower($3) as mesmo
         from properties p
         left join developments d on d.id = p.empreendimento_id
         left join lateral (select avg(x.lat) lat, avg(x.lng) lng from developments x where x.lat is not null and lower(x.bairro) = lower(p.bairro) and lower(x.cidade) = lower(p.cidade)) bc on true
        where p.visibilidade in ('publico', 'privado') and not p.is_tipologia and p.finalidade = 'venda' and p.vendido_em is null
          and p.price_value > 0 and p.area between $4 * 0.5 and $4 * 2 and p.tipo_unidade = any($1::text[]) and lower(p.cidade) = lower($2)) q
      where q.mesmo or (q.dist is not null and q.dist <= 3)
      order by q.mesmo desc, q.dist nulls last limit 40`,
    [tipos, e.cidade.trim(), e.bairro.trim(), area]
  ).catch(() => []);
  if (rows.length < 3) {
    await registrar('Sem amostras suficientes: enviar avaliação por e-mail.');
    return { ok: false, erro: 'Ainda não temos anúncios suficientes parecidos com o seu nessa região para uma estimativa confiável. Recebemos o seu pedido e vamos te enviar a avaliação por e-mail.' };
  }

  const anoAval = e.ano && e.ano > 1950 ? e.ano : null;
  const brutas: Amostra[] = rows.map((r) => {
    const a = Number(r.area);
    const p = Number(r.price_value);
    const m2 = p / a;
    const fOferta = 0.9; // anúncio é preço pedido: desconto usual de negociação
    const fArea = Math.pow(a / area, 0.125); // imóvel menor tem m² mais caro
    const fQuartos = e.quartos && r.quartos ? 1 + 0.03 * (e.quartos - r.quartos) : 1;
    const fVagas = e.vagas != null && r.vagas != null ? 1 + 0.04 * (e.vagas - r.vagas) : 1;
    const anoC = r.delivery_date ? new Date(r.delivery_date).getFullYear() : null;
    const fIdade = anoAval && anoC ? Math.min(1.2, Math.max(0.8, 1 + 0.01 * (anoAval - anoC))) : 1;
    const m2Homog = m2 * fOferta * fArea * fQuartos * fVagas * fIdade;
    const d = r.dist != null ? Number(r.dist) : null;
    // mesmo condomínio do imóvel avaliado pesa mais (informado na avaliação pela equipe)
    const mesmoCondominio = !!e.condominio && !!r.condominio && semAcentoMin(r.condominio) === semAcentoMin(e.condominio);
    const peso = (mesmoCondominio ? 2 : 1) * (r.mesmo ? 1.5 : 1) * (1 / (1 + (d ?? 1.5))) * (1 / (1 + Math.abs(a - area) / area));
    return {
      titulo: r.titulo || 'Imóvel',
      bairro: r.bairro || '',
      area: a,
      preco: p,
      m2,
      m2Homog,
      distKm: d,
      slug: r.slug,
      peso,
      publico: r.visibilidade === 'publico',
      condominio: r.condominio,
      quartos: r.quartos,
      vagas: r.vagas,
      ano: anoC,
      mesmoCondominio
    };
  });
  // saneamento: descarta o que estiver a mais de 35% da mediana homogeneizada
  const ord = [...brutas].map((x) => x.m2Homog).sort((a, b) => a - b);
  const mediana = ord[Math.floor(ord.length / 2)];
  const amostras = brutas.filter((x) => x.m2Homog >= mediana * 0.65 && x.m2Homog <= mediana * 1.35);
  if (amostras.length < 3) {
    await registrar('Amostras dispersas: enviar avaliação por e-mail.');
    return { ok: false, erro: 'As amostras da região variam demais para uma estimativa segura. Recebemos o seu pedido e vamos te enviar a avaliação por e-mail.' };
  }

  const somaP = amostras.reduce((s, x) => s + x.peso, 0);
  const media = amostras.reduce((s, x) => s + x.m2Homog * x.peso, 0) / somaP;
  const n = amostras.length;
  const desvio = Math.sqrt(amostras.reduce((s, x) => s + Math.pow(x.m2Homog - media, 2), 0) / Math.max(1, n - 1));
  const meio = t80(n - 1) * (desvio / Math.sqrt(n));
  const valor = Math.round((media * area) / 1000) * 1000;
  const minimo = Math.round(((media - meio) * area) / 1000) * 1000;
  const maximo = Math.round(((media + meio) * area) / 1000) * 1000;
  const amplitudePct = Math.round(((maximo - minimo) / valor) * 1000) / 10;
  await registrar(`Estimativa: R$ ${valor.toLocaleString('pt-BR')} (faixa R$ ${minimo.toLocaleString('pt-BR')} a R$ ${maximo.toLocaleString('pt-BR')}).`);
  const grau = amplitudePct <= 30 ? 'III' : amplitudePct <= 40 ? 'II' : amplitudePct <= 50 ? 'I' : 'Fora da norma';
  return {
    ok: true,
    valor,
    minimo,
    maximo,
    m2: Math.round(media),
    n,
    descartadas: brutas.length - n,
    grau,
    amplitudePct,
    amostras: amostras.filter((x) => x.publico).sort((a, b) => b.peso - a.peso).slice(0, 8).map((x) => ({ ...x, preco: Math.round(x.preco) }))
  };
}
