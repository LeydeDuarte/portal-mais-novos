'use server';

// Painel → Imóveis: lista completa para a equipe (com dados internos), ações do
// card e o link "compartilhar com corretor". Nada daqui aparece no site.
import { query } from './db';
import { exigirEquipe } from './staff-auth';
import { veTudo, type StaffSessionPayload } from './session';
import { assinar } from './session';
import { proprietariosDoImovel } from './proprietarios';
import { SITE_URL } from './seo';

export type ImovelPainel = {
  id: string;
  slug: string | null;
  titulo: string | null;
  tipo: string;
  finalidade: string;
  visibilidade: 'publico' | 'privado';
  vendidoEm: string | null;
  isTipologia: boolean;
  condominio: string | null;
  developmentId: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  area: number | null;
  areaLote: number | null;
  areaTotal: number | null;
  descricao: string;
  destaque: boolean;
  destaqueTamanho: 2 | 3;
  temVideo: boolean;
  /** null = não informado no cadastro */
  aceitaTemporada: boolean | null;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  preco: number | null;
  valorCondominio: number | null;
  iptuMensal: number | null;
  complemento: string | null;
  unidade: string | null;
  quadra: string | null;
  lote: string | null;
  obsInterna: string | null;
  capa: string | null;
  fotos: string[];
  fotosInternas: string[];
  visualizacoes: number;
  salvamentos: number;
  compartilhamentos: number;
  corretorEmail: string | null;
  codigo: string | null;
  /** construtoras/incorporadoras do condomínio (para a busca) */
  construtoras: string | null;
  criadoEm: string;
  proprietarios: { id: string; nome: string; whatsapp: string | null; documento: string | null; email: string | null; principal: boolean }[];
};

type Row = Record<string, unknown>;
const n = (v: unknown) => (v == null ? null : Number(v));
const arr = (v: unknown) => (Array.isArray(v) ? (v.filter((x) => typeof x === 'string') as string[]) : []);

function mapear(r: Row): ImovelPainel {
  const fotos = arr(r.photos);
  return {
    id: String(r.id),
    slug: (r.slug as string) ?? null,
    titulo: (r.titulo as string) ?? null,
    tipo: String(r.tipo_unidade ?? ''),
    finalidade: String(r.finalidade ?? 'venda'),
    visibilidade: r.visibilidade === 'privado' ? 'privado' : 'publico',
    vendidoEm: r.vendido_em ? new Date(r.vendido_em as string).toISOString() : null,
    isTipologia: !!r.is_tipologia,
    condominio: (r.condo_nome as string) ?? (r.condominio as string) ?? null,
    developmentId: (r.empreendimento_id as string) ?? null,
    bairro: (r.bairro as string) ?? null,
    cidade: (r.cidade as string) ?? null,
    uf: (r.uf as string) ?? null,
    area: n(r.area),
    areaLote: n(r.area_lote),
    areaTotal: n(r.area_total),
    descricao: String(r.description ?? ''),
    destaque: !!r.destaque,
    destaqueTamanho: r.destaque_tamanho === 3 ? 3 : 2,
    temVideo: !!r.video && !!r.video_url,
    aceitaTemporada: r.aceita_temporada == null ? null : !!r.aceita_temporada,
    quartos: n(r.quartos),
    banheiros: n(r.banheiros),
    vagas: n(r.vagas),
    preco: n(r.price_value),
    valorCondominio: n(r.valor_condominio),
    iptuMensal: n(r.iptu_mensal),
    complemento: (r.complemento as string) ?? null,
    unidade: (r.unidade as string) ?? null,
    quadra: (r.quadra as string) ?? null,
    lote: (r.lote as string) ?? null,
    obsInterna: (r.obs_interna as string) ?? null,
    capa: (r.capa_mini as string) || fotos[0] || arr(r.photos_internas)[0] || null,
    fotos,
    fotosInternas: arr(r.photos_internas),
    visualizacoes: Number(r.visualizacoes) || 0,
    salvamentos: Number(r.salvamentos) || 0,
    compartilhamentos: Number(r.compartilhamentos) || 0,
    corretorEmail: (r.corretor_email as string) ?? null,
    codigo: (r.jetimob_codigo as string) ?? null,
    construtoras: (r.construtoras as string) ?? null,
    criadoEm: new Date(r.created_at as string).toISOString(),
    proprietarios: []
  };
}

const SELECT = `select p.*, d.name as condo_nome, (select count(*) from favorites f where f.property_id = p.id) as salvamentos,
                  (select string_agg(distinct coalesce(nullif(e.nome_perfil, ''), nullif(e.nome_fantasia, ''), e.razao_social), ' ')
                     from development_empresas de join empresas e on e.id = de.empresa_id where de.development_id = p.empreendimento_id) as construtoras
                  from properties p left join developments d on d.id = p.empreendimento_id`;

/** Todos os imóveis que a pessoa pode ver (corretor: só os dele). Filtros ficam na tela. */
export async function listarImoveisPainel(): Promise<ImovelPainel[]> {
  const eu = await exigirEquipe();
  const rows = await query<Row>(
    `${SELECT} where not p.is_tipologia ${veTudo(eu.role) ? '' : 'and lower(p.corretor_email) = lower($1)'} order by p.created_at desc limit 3000`,
    veTudo(eu.role) ? [] : [eu.email]
  );
  const lista = rows.map(mapear);
  const donos = await proprietariosDoImovel(lista.map((i) => i.id));
  for (const i of lista)
    i.proprietarios = (donos.get(i.id) ?? []).map((o) => ({ id: o.id, nome: o.nome, whatsapp: o.whatsapp, documento: o.documento, email: o.email, principal: o.principal }));
  return lista;
}

async function podeEditar(id: string): Promise<StaffSessionPayload> {
  const eu = await exigirEquipe();
  if (veTudo(eu.role)) return eu;
  const r = await query<{ corretor_email: string | null }>('select corretor_email from properties where id = $1', [id]);
  if ((r[0]?.corretor_email ?? '').toLowerCase() !== eu.email.toLowerCase()) throw new Error('Sem permissão para este imóvel.');
  return eu;
}

export async function lerImovelPainel(id: string): Promise<ImovelPainel | null> {
  await podeEditar(id);
  const r = await query<Row>(`${SELECT} where p.id = $1`, [id]);
  if (!r[0]) return null;
  const i = mapear(r[0]);
  const donos = await proprietariosDoImovel([id]);
  i.proprietarios = (donos.get(id) ?? []).map((o) => ({ id: o.id, nome: o.nome, whatsapp: o.whatsapp, documento: o.documento, email: o.email, principal: o.principal }));
  return i;
}

/** Privar / tornar público */
export async function mudarVisibilidade(id: string, vis: 'publico' | 'privado'): Promise<void> {
  await podeEditar(id);
  await query('update properties set visibilidade = $2 where id = $1', [id, vis === 'privado' ? 'privado' : 'publico']);
}

/** Esconde uma foto do anúncio público (fica só no painel) ou mostra de novo */
export async function alternarFotoPublica(id: string, url: string, publica: boolean): Promise<{ fotos: string[]; fotosInternas: string[] }> {
  await podeEditar(id);
  const r = await query<{ photos: unknown; photos_internas: unknown }>('select photos, photos_internas from properties where id = $1', [id]);
  if (!r[0]) throw new Error('Imóvel não encontrado.');
  let fotos = arr(r[0].photos);
  let internas = arr(r[0].photos_internas);
  if (publica && internas.includes(url)) {
    internas = internas.filter((u) => u !== url);
    fotos = [...fotos, url];
  } else if (!publica && fotos.includes(url)) {
    fotos = fotos.filter((u) => u !== url);
    internas = [...internas, url];
  }
  await query('update properties set photos = $2::jsonb, photos_internas = $3::jsonb where id = $1', [id, JSON.stringify(fotos), JSON.stringify(internas)]);
  return { fotos, fotosInternas: internas };
}

/**
 * Link para outro corretor: só um resumo com as fotos públicas e as características,
 * SEM nossos contatos, sem endereço e com a marca d'água do corretor que compartilhou.
 * Anúncio privado não pode ser compartilhado assim.
 */
export async function linkParaCorretor(id: string): Promise<{ ok: true; url: string } | { ok: false; erro: string }> {
  const eu = await exigirEquipe();
  const r = await query<{ visibilidade: string; vendido_em: string | null }>('select visibilidade, vendido_em from properties where id = $1', [id]);
  if (!r[0]) return { ok: false, erro: 'Imóvel não encontrado.' };
  if (r[0].visibilidade === 'privado') return { ok: false, erro: 'Anúncio privado não pode ser compartilhado com outros corretores.' };
  const token = assinar({ i: id, e: eu.email, t: Date.now() });
  await query('update properties set compartilhamentos = compartilhamentos + 1 where id = $1', [id]).catch(() => {});
  return { ok: true, url: `${SITE_URL}/c/${encodeURIComponent(token)}` };
}
