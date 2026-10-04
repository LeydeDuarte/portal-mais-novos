'use server';

// Painel → Imóveis → "Anúncios de mercado": anúncios de OUTROS anunciantes (sites de imobiliárias e
// portais) gravados pelo Projeto "Pesquisa de Mercado", para o atendente consultar quando não houver
// imóvel nosso que sirva. Só os que trazem o nome do condomínio. Sites de imobiliárias primeiro.
import { query } from './db';
import { exigirEquipe } from './staff-auth';

export type AnuncioMercado = {
  url: string;
  site: string;
  imobiliaria: boolean;
  anunciante: string | null;
  condominio: string;
  bairro: string | null;
  cidade: string | null;
  tipo: string | null;
  area: number | null;
  quartos: number | null;
  vagas: number | null;
  preco: number;
  ano: number | null;
  atualizadoPortal: string | null; // AAAA-MM-DD (data de atualização mostrada no anúncio)
  vistoEm: string; // AAAA-MM-DD (última vez que a pesquisa viu o anúncio)
};

export type FiltroMercado = { busca?: string; tipo?: string; quartos?: string; vagas?: string; areaMin?: string; areaMax?: string; precoMin?: string; precoMax?: string };

const PORTAIS = /(zapimoveis|vivareal|olx|imovelweb|quintoandar|chavesnamao|62imoveis|61imoveis|dfimoveis|mercadolivre|wimoveis|lugarcerto)/i;
const NOME_SITE: [RegExp, string][] = [
  [/zapimoveis/i, 'ZAP Imóveis'], [/vivareal/i, 'VivaReal'], [/olx/i, 'OLX'], [/imovelweb/i, 'Imovelweb'], [/quintoandar/i, 'QuintoAndar'],
  [/chavesnamao/i, 'Chaves na Mão'], [/62imoveis/i, '62 Imóveis'], [/61imoveis/i, '61 Imóveis'], [/dfimoveis/i, 'DF Imóveis'], [/wimoveis/i, 'Wimóveis']
];
const n = (v?: string) => {
  const t = String(v ?? '').replace(/\./g, '').replace(',', '.').trim();
  return t && Number.isFinite(Number(t)) ? Number(t) : null;
};
const comparavel = (t: string) =>
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(edificio|ed|residencial|condominio)\b\.?/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

export async function listarAnunciosMercado(f: FiltroMercado): Promise<AnuncioMercado[]> {
  await exigirEquipe();
  const params: unknown[] = [];
  const conds = [
    `coalesce(trim(a.condominio), '') <> ''`,
    `coalesce(a.situacao, 'ativo') = 'ativo'`,
    `a.encontrado_em > now() - interval '6 months'`,
    `a.url not ilike '%maisnovosimoveis%'`,
    `a.preco > 0`
  ];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    conds.push(sql.replace('$', `$${params.length}`));
  };
  const b = String(f.busca ?? '').trim();
  if (b) {
    params.push(`%${b.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().slice(0, 60)}%`);
    const k = `$${params.length}`;
    conds.push(
      `(translate(lower(coalesce(a.condominio,'') || ' ' || coalesce(a.bairro,'') || ' ' || coalesce(a.cidade,'')), 'áàâãéêíóôõúç', 'aaaaeeiooouc') like ${k})`
    );
  }
  // listas como no painel: "apartamento,cobertura"; quartos/vagas "2,3" e "4" = 4 ou mais
  const valores = (v?: string) => String(v ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  if (valores(f.tipo).length) add(`a.tipo = any($::text[])`, valores(f.tipo));
  for (const [col, v] of [['a.quartos', f.quartos], ['a.vagas', f.vagas]] as const) {
    const nums = valores(v).map(Number).filter((x) => Number.isFinite(x));
    if (!nums.length) continue;
    params.push(nums);
    conds.push(`(coalesce(${col}, 0) = any($${params.length}::int[]) or (4 = any($${params.length}::int[]) and coalesce(${col}, 0) >= 4))`);
  }
  if (n(f.areaMin)) add(`a.area >= $`, n(f.areaMin));
  if (n(f.areaMax)) add(`a.area <= $`, n(f.areaMax));
  if (n(f.precoMin)) add(`a.preco >= $`, n(f.precoMin));
  if (n(f.precoMax)) add(`a.preco <= $`, n(f.precoMax));
  const r = await query<Record<string, unknown>>(
    `select a.url, a.portal, a.anunciante, a.condominio, a.bairro, a.cidade, a.tipo, a.area, a.quartos, a.vagas, a.preco, a.ano,
            to_char(a.atualizado_portal, 'YYYY-MM-DD') atualizado, to_char(a.encontrado_em, 'YYYY-MM-DD') visto
       from amostras_portais a where ${conds.join(' and ')}
      order by coalesce(a.atualizado_portal, a.encontrado_em::date) desc limit 300`,
    params
  );
  const lista: AnuncioMercado[] = r.map((x) => {
    const url = String(x.url);
    const host = (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, '');
      } catch {
        return String(x.portal ?? '');
      }
    })();
    return {
      url,
      site: NOME_SITE.find(([re]) => re.test(host))?.[1] ?? host,
      imobiliaria: !PORTAIS.test(host),
      anunciante: (x.anunciante as string) ?? null,
      condominio: String(x.condominio),
      bairro: (x.bairro as string) ?? null,
      cidade: (x.cidade as string) ?? null,
      tipo: (x.tipo as string) ?? null,
      area: x.area != null ? Number(x.area) : null,
      quartos: x.quartos != null ? Number(x.quartos) : null,
      vagas: x.vagas != null ? Number(x.vagas) : null,
      preco: Number(x.preco),
      ano: x.ano != null ? Number(x.ano) : null,
      atualizadoPortal: (x.atualizado as string) ?? null,
      vistoEm: String(x.visto)
    };
  });
  // sites de imobiliárias primeiro; o mesmo imóvel em vários sites aparece uma vez (fica o da imobiliária)
  lista.sort((a, b2) => Number(b2.imobiliaria) - Number(a.imobiliaria));
  const vistos: AnuncioMercado[] = [];
  for (const a of lista) {
    const igual = vistos.find(
      (v) =>
        comparavel(v.condominio) === comparavel(a.condominio) &&
        v.area != null && a.area != null && Math.abs(v.area - a.area) / Math.max(v.area, a.area) <= 0.015 &&
        (v.quartos == null || a.quartos == null || v.quartos === a.quartos) &&
        Math.abs(v.preco - a.preco) / Math.max(v.preco, a.preco) <= 0.03
    );
    if (!igual) vistos.push(a);
  }
  return vistos.slice(0, 120);
}
