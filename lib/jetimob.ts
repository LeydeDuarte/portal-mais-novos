// MIGRAÇÃO da Jetimob (API "webservice", versão 6) — a Jetimob vai ser
// desligada; isto traz tudo UMA vez para o portal, que passa a ser a fonte.
// Rodar de novo só acrescenta o que ainda não veio (nunca sobrescreve o que
// foi editado aqui).
// - Condomínios: /condominios  → tabela developments (jetimob_id)
// - Imóveis:     /imoveis/todos → tabela properties (jetimob_id) — TODOS os disponíveis do
//                sistema, inclusive os que não estão marcados para publicar em site
// - Publicados:  /imoveis-ativos → quem NÃO está aqui entra como PRIVADO no site
// - Leads do site → /leads/{PUBLIC_KEY} (CRM da Jetimob)
// As fotos são baixadas da Jetimob e guardadas no nosso R2 aos poucos
// (fila em fotos_pendentes), com o nome do condomínio/imóvel + nome do site.
// As chaves ficam SÓ nas variáveis de ambiente da Vercel.
import { query } from './db';
import { formatTitulo } from './text';
import { AMENIDADES_PADRAO } from './amenidades';
import { AMENIDADE_REGRAS } from './pdf-import/parse';
import { TIPOS, formatarDescricao } from './anuncio-parser';
import { chaveNome, mesmoCondominio, padronizarBairro } from './planilha-condominios';
import { enviarParaR2, r2Configurado } from './r2';
import type { TipoUnidade } from './tipologias';

const BASE = 'https://api.jetimob.com';
const sa = (s: string) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function jetimobConfigurado(): boolean {
  return !!process.env.JETIMOB_WEBSERVICE_KEY;
}

async function jt<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const key = process.env.JETIMOB_WEBSERVICE_KEY;
  if (!key) throw new Error('Chave da Jetimob não configurada (JETIMOB_WEBSERVICE_KEY).');
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  const res = await fetch(`${BASE}/webservice/${key}/${path}${qs ? `?${qs}` : ''}`, { cache: 'no-store', signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`Jetimob respondeu ${res.status} em /${path.split('/')[0]}`);
  return (await res.json()) as T;
}

type Pagina<T> = { data: T[]; page: number; pageSize: number; total: number; totalPages: number };
type Midia = { link?: string; titulo?: string | null };
type Video = { href?: string };

export type JtCondominio = {
  id_condominio: number;
  nome: string;
  endereco_bairro?: string | number | null;
  endereco_cep?: string | null;
  endereco_cidade?: string | number | null;
  endereco_estado?: string | number | null;
  endereco_logradouro?: string | null;
  endereco_numero?: string | null;
  entrega_ano?: string | null;
  entrega_mes?: string | null;
  fechado?: boolean;
  imagens?: Midia[];
  plantas?: Midia[];
  infraestruturas?: string | null;
  lancamento?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  observacoes?: string | null;
  situacao?: string | null;
  videos?: Video[];
  data_update?: string;
};

export type JtImovel = {
  id_imovel: number;
  codigo: string;
  tipo?: string | null;
  subtipo?: string | null;
  contrato?: string | null;
  titulo_anuncio?: string | null;
  observacoes?: string | null;
  area_privativa?: number | null;
  area_util?: number | null;
  area_total?: number | null;
  medida?: string | null;
  dormitorios?: number | null;
  suites?: number | null;
  garagens?: number | null;
  banheiros?: number | null;
  valor_venda?: number | null;
  valor_venda_visivel?: boolean | null;
  valor_locacao?: number | null;
  valor_locacao_visivel?: boolean | null;
  valor_temporada?: number | null;
  endereco_cep?: string | null;
  endereco_logradouro?: string | null;
  endereco_numero?: string | null;
  endereco_bairro?: string | null;
  endereco_cidade?: string | null;
  endereco_estado?: string | null;
  entrega_ano?: string | null;
  entrega_mes?: string | null;
  status?: string | null;
  situacao?: string | null;
  condominio_nome?: string | null;
  condominio_comodidades?: string | null;
  imovel_comodidades?: string | null;
  id_condominio?: number | null;
  imagens?: Midia[];
  plantas?: Midia[];
  videos?: Video[];
  latitude?: number | null;
  longitude?: number | null;
  geoposicionamento_visivel?: number | null;
  data_cadastro?: string | null;
};

// ---------- conversões ----------
const ESTADOS: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO',
  maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE',
  piaui: 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR', 'santa catarina': 'SC',
  'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO'
};
const uf = (e: unknown) => {
  if (typeof e !== 'string' || !e.trim()) return null;
  return e.trim().length === 2 ? e.trim().toUpperCase() : ESTADOS[sa(e)] ?? null;
};
const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const cepDig = (v: unknown) => {
  const d = String(v ?? '').replace(/\D/g, '');
  return d.length === 8 ? d : null;
};
const entregaDe = (ano?: string | null, mes?: string | null) => {
  const a = Number(ano);
  if (!a || a < 1900 || a > 2100) return null;
  const m = Math.min(12, Math.max(1, Number(mes) || 1));
  return `${a}-${String(m).padStart(2, '0')}-01`;
};
const amenidadesDe = (...textos: (string | null | undefined)[]) => {
  const t = sa(textos.filter(Boolean).join(', '));
  if (!t) return [];
  return AMENIDADES_PADRAO.filter((a) => AMENIDADE_REGRAS.find(([n]) => n === a)?.[1].test(t));
};
const videoDe = (vs?: Video[]) => {
  const href = vs?.find((v) => v?.href)?.href;
  if (!href) return null;
  const yt = href.match(/youtube\.com\/embed\/([\w-]{6,})/);
  return yt ? `https://www.youtube.com/watch?v=${yt[1]}` : /^https:\/\//.test(href) ? href : null;
};
const linksDe = (ms?: Midia[]) => (ms ?? []).map((m) => m?.link).filter((l): l is string => typeof l === 'string' && /^https:\/\//.test(l)).slice(0, 40);

export function tipoDoImovel(i: Pick<JtImovel, 'tipo' | 'subtipo'>): TipoUnidade {
  const t = sa(`${i.subtipo ?? ''} ${i.tipo ?? ''}`);
  if (/kitnet|kitinete|conjugado/.test(t)) return 'studio';
  if (/sala|consultorio|escritorio/.test(t)) return 'sala_comercial';
  if (/predio/.test(t)) return 'predio_comercial';
  for (const [tipo, re] of TIPOS) if (re.test(t)) return tipo;
  return /comercial/.test(t) ? 'sala_comercial' : 'apartamento';
}

// Sem data de entrega na Jetimob: usa a do condomínio; senão estima pelo status
// (só para a etiqueta Lançamento/Seminovo/Usado — dá para corrigir no painel).
function entregaEstimada(status?: string | null, cadastro?: string | null): string {
  const s = sa(status ?? '');
  const ano = new Date().getFullYear();
  if (/lancamento|planta|construcao|obra/.test(s)) return `${ano + 2}-12-01`;
  if (/^novo|pronto/.test(s)) return `${ano}-01-01`;
  if (/seminovo/.test(s)) return `${ano - 3}-01-01`;
  const c = cadastro ? new Date(cadastro) : null;
  return c && !isNaN(c.getTime()) && c.getFullYear() < ano - 6 ? `${c.getFullYear() - 1}-01-01` : '2000-01-01';
}

type FilaFoto = { url: string; tipo: 'foto' | 'planta'; i: number };
function filaDe(fotos: string[], plantas: string[]): FilaFoto[] {
  return [...fotos.map((url, i) => ({ url, tipo: 'foto' as const, i })), ...plantas.map((url, i) => ({ url, tipo: 'planta' as const, i }))];
}

// Na Jetimob da Leyde o ano de ENTREGA foi gravado no fim do nome do condomínio,
// depois da vírgula ("Jardins Florença, 1999"). Aqui o nome fica limpo e o ano
// vira a data de entrega (quando a Jetimob não tem entrega_ano preenchido).
export function limparNomeCondo(n: string): string {
  return separarAnoDoNome(n).nome;
}
export function separarAnoDoNome(n: string): { nome: string; ano: number | null } {
  const bruto = String(n ?? '').trim();
  const m = bruto.match(/^(.*?)\s*,\s*((?:19|20)\d{2})\s*$/);
  if (m && m[1].trim()) return { nome: m[1].trim(), ano: Number(m[2]) };
  return { nome: bruto, ano: null };
}
const entregaDoNome = (n?: string | null) => {
  const ano = n ? separarAnoDoNome(n).ano : null;
  return ano && ano <= new Date().getFullYear() + 8 ? `${ano}-01-01` : null;
};

// ---------- Condomínios ----------
export type ResumoPagina = { pagina: number; totalPaginas: number; total: number; criados: number; atualizados: number; vinculados: number; erros: string[] };

type DevExistente = { id: string; name: string; cep: string | null; bairro: string | null; cidade: string | null; jetimob_id: string | null; jetimob_fotos_src: unknown };

export async function sincronizarCondominios(pagina: number, email: string, trocarFotos = false): Promise<ResumoPagina> {
  const r = await jt<Pagina<JtCondominio>>('condominios', { v: 6, page: pagina, pageSize: 100 });
  const res: ResumoPagina = { pagina, totalPaginas: r.totalPages ?? 1, total: r.total ?? 0, criados: 0, atualizados: 0, vinculados: 0, erros: [] };
  if (!r.data?.length) return res;

  const existentes = await query<DevExistente>('select id, name, cep, bairro, cidade, jetimob_id, jetimob_fotos_src from developments');
  const porJt = new Map(existentes.filter((e) => e.jetimob_id).map((e) => [String(e.jetimob_id), e]));
  const porNome = new Map<string, DevExistente[]>();
  for (const e of existentes) porNome.set(chaveNome(e.name), [...(porNome.get(chaveNome(e.name)) ?? []), e]);

  for (const c of r.data) {
    try {
      if (!c?.nome || !c.id_condominio) continue;
      const nome = formatTitulo(limparNomeCondo(c.nome)).slice(0, 160);
      const bairro = typeof c.endereco_bairro === 'string' ? padronizarBairro(c.endereco_bairro) : null;
      const cidade = typeof c.endereco_cidade === 'string' ? formatTitulo(c.endereco_cidade) : null;
      const estado = uf(c.endereco_estado);
      const cep = cepDig(c.endereco_cep);
      const logradouro = [txt(c.endereco_logradouro), txt(c.endereco_numero) ? `nº ${c.endereco_numero}` : null].filter(Boolean).join(', ') || null;
      const entrega = entregaDe(c.entrega_ano, c.entrega_mes) ?? entregaDoNome(c.nome);
      const fotos = linksDe(c.imagens);
      const desc = txt(c.observacoes) ? formatarDescricao(c.observacoes!) : '';
      const reg = {
        name: nome,
        location: [bairro, [cidade, estado].filter(Boolean).join(' — ')].filter(Boolean).join(', '),
        delivery_date: entrega,
        description: desc,
        amenities: amenidadesDe(c.infraestruturas),
        cep,
        logradouro,
        bairro,
        cidade,
        uf: estado,
        lat: typeof c.latitude === 'number' ? c.latitude : null,
        lng: typeof c.longitude === 'number' ? c.longitude : null,
        video_url: videoDe(c.videos),
        tipo: c.fechado === false ? 'vertical' : 'vertical',
        fotos
      };
      let alvo = porJt.get(String(c.id_condominio));
      if (!alvo) {
        alvo = (porNome.get(chaveNome(nome)) ?? []).find((e) => mesmoCondominio({ nome: e.name, cep: e.cep, bairro: e.bairro, cidade: e.cidade }, { nome, cep, bairro, cidade }));
        if (alvo) res.vinculados++;
      }
      const srcAntigo = JSON.stringify(Array.isArray(alvo?.jetimob_fotos_src) ? alvo!.jetimob_fotos_src : []);
      // trocarFotos: baixa tudo de novo (ex.: fotos antigas vieram com marca d'água)
      const fotosMudaram = trocarFotos || JSON.stringify(fotos) !== srcAntigo;
      if (alvo) {
        // Já existe (cadastrado aqui, por planilha ou numa sincronização anterior):
        // liga à Jetimob e completa só o que estiver vazio — nada preenchido à mão é apagado.
        await query(
          `update developments set jetimob_id = $2, jetimob_atualizado_em = now(),
              delivery_date = coalesce(delivery_date, $3::date),
              description = case when length(coalesce(trim(description), '')) < 60 and length($4) > length(coalesce(trim(description), '')) then $4 else description end,
              amenities = case when jsonb_array_length(coalesce(amenities, '[]'::jsonb)) = 0 then $5::jsonb else amenities end,
              cep = coalesce(nullif(cep, ''), $6), logradouro = coalesce(nullif(logradouro, ''), $7), bairro = coalesce(nullif(bairro, ''), $8),
              cidade = coalesce(nullif(cidade, ''), $9), uf = coalesce(nullif(uf, ''), $10), lat = coalesce(lat, $11), lng = coalesce(lng, $12),
              video_url = coalesce(nullif(video_url, ''), $13),
              location = case when coalesce(location, '') = '' then $14 else location end
              ${fotosMudaram && fotos.length ? `, fotos_pendentes = $15::jsonb, jetimob_fotos_src = $16::jsonb, jetimob_fotos_novas = '{}'::jsonb` : ''}
            where id = $1`,
          [
            alvo.id, c.id_condominio, reg.delivery_date, reg.description, JSON.stringify(reg.amenities), reg.cep, reg.logradouro, reg.bairro, reg.cidade,
            reg.uf, reg.lat, reg.lng, reg.video_url, reg.location,
            ...(fotosMudaram && fotos.length ? [JSON.stringify(filaDe(fotos, [])), JSON.stringify(fotos)] : [])
          ]
        );
        res.atualizados++;
      } else {
        const id = `condo-jt${c.id_condominio}`;
        await query(
          `insert into developments (id, corretor_email, name, location, delivery_date, description, tipo, pavimentos, area_terreno, amenities, aceita_temporada,
              hero_height, video_url, photos, tipos_unidade, quartos_opcoes, cep, logradouro, bairro, cidade, uf, status, video_vertical, lat, lng, origem,
              jetimob_id, jetimob_atualizado_em, fotos_pendentes, jetimob_fotos_src)
           values ($1, $2, $3, $4, $5::date, $6, 'vertical', null, null, $7::jsonb, false, 300, $8, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, $9, $10, $11, $12, $13,
              $14, false, $15, $16, 'jetimob', $17, now(), $18::jsonb, $19::jsonb)
           on conflict (id) do nothing`,
          [
            id, email, reg.name, reg.location, reg.delivery_date, reg.description, JSON.stringify(reg.amenities), reg.video_url, reg.cep, reg.logradouro,
            reg.bairro, reg.cidade, reg.uf, reg.delivery_date && reg.bairro && reg.cidade ? 'publicado' : 'rascunho', reg.lat, reg.lng, c.id_condominio,
            JSON.stringify(filaDe(fotos, [])), JSON.stringify(fotos)
          ]
        );
        res.criados++;
        const novo = { id, name: nome, cep, bairro, cidade, jetimob_id: String(c.id_condominio), jetimob_fotos_src: fotos };
        porJt.set(String(c.id_condominio), novo);
        porNome.set(chaveNome(nome), [...(porNome.get(chaveNome(nome)) ?? []), novo]);
      }
    } catch (e) {
      res.erros.push(`${c?.nome ?? '?'}: ${e instanceof Error ? e.message.slice(0, 120) : 'erro'}`);
    }
  }
  return res;
}

// ---------- Imóveis ----------
export async function idsAtivos(): Promise<Set<string>> {
  const r = await jt<{ result?: (number | string)[] }>('imoveis-ativos');
  return new Set((r.result ?? []).map(String));
}

type PropExistente = { id: string; jetimob_fotos_src: unknown; titulo: string | null; description: string; empreendimento_id: string | null };

export async function sincronizarImoveis(
  pagina: number,
  email: string,
  opcoes: { ativos: Set<string>; start?: number; end?: number; sobrescrever?: boolean; trocarFotos?: boolean }
): Promise<ResumoPagina> {
  const r = await jt<Pagina<JtImovel>>('imoveis/todos', { v: 6, page: pagina, pageSize: 50, start: opcoes.start, end: opcoes.end });
  const res: ResumoPagina = { pagina, totalPaginas: r.totalPages ?? 1, total: r.total ?? 0, criados: 0, atualizados: 0, vinculados: 0, erros: [] };
  if (!r.data?.length) return res;

  const ids = r.data.map((i) => i.id_imovel).filter(Boolean);
  const existentes = await query<PropExistente & { jetimob_id: string }>(
    'select id, jetimob_id, jetimob_fotos_src, titulo, description, empreendimento_id from properties where jetimob_id = any($1::bigint[])',
    [ids]
  );
  const porJt = new Map(existentes.map((e) => [String(e.jetimob_id), e]));
  const condIds = Array.from(new Set(r.data.map((i) => i.id_condominio).filter(Boolean))) as number[];
  const condos = condIds.length
    ? await query<{ id: string; jetimob_id: string; name: string; delivery_date: Date | string | null }>(
        'select id, jetimob_id, name, delivery_date from developments where jetimob_id = any($1::bigint[])',
        [condIds]
      )
    : [];
  const condoPorJt = new Map(condos.map((c) => [String(c.jetimob_id), c]));

  for (const i of r.data) {
    try {
      if (!i?.id_imovel) continue;
      const contrato = sa(i.contrato ?? '');
      const venda = /compra|venda/.test(contrato) || !contrato;
      const finalidade: 'venda' | 'aluguel' = venda ? 'venda' : 'aluguel';
      const visivel = venda ? i.valor_venda_visivel !== false : i.valor_locacao_visivel !== false;
      const preco = visivel ? Number(venda ? i.valor_venda : i.valor_locacao) || 0 : 0;
      const fator = sa(i.medida ?? '') === 'ha' ? 10000 : 1;
      const areaBruta = Number(i.area_privativa || i.area_util || i.area_total) || null;
      const area = areaBruta ? Math.round(areaBruta * fator * 100) / 100 : null;
      const condo = i.id_condominio ? condoPorJt.get(String(i.id_condominio)) : undefined;
      const condoData = condo?.delivery_date ? new Date(condo.delivery_date).toISOString().slice(0, 10) : null;
      const entrega = entregaDe(i.entrega_ano, i.entrega_mes) ?? condoData ?? entregaDoNome(i.condominio_nome) ?? entregaEstimada(i.status, i.data_cadastro);
      const bairro = txt(i.endereco_bairro) ? padronizarBairro(i.endereco_bairro!) : null;
      const cidade = txt(i.endereco_cidade) ? formatTitulo(i.endereco_cidade!) : null;
      const estado = uf(i.endereco_estado);
      const fotos = linksDe(i.imagens);
      const plantas = linksDe(i.plantas);
      const src = [...fotos, ...plantas.map((p) => `planta:${p}`)];
      const tipo = tipoDoImovel(i);
      const valores = {
        titulo: txt(i.titulo_anuncio) ? formatTitulo(i.titulo_anuncio!).slice(0, 160) : null,
        tipo_unidade: tipo,
        finalidade,
        delivery_date: entrega,
        price_value: preco,
        price_period: venda ? 'unico' : 'mensal',
        location: [bairro, [cidade, estado].filter(Boolean).join(' — ')].filter(Boolean).join(', ') || cidade || 'Goiânia — GO',
        quartos: i.dormitorios ?? null,
        vagas: i.garagens ?? null,
        banheiros: i.banheiros ?? null,
        area,
        video_url: videoDe(i.videos),
        aceita_temporada: /temporada/.test(contrato),
        description: txt(i.observacoes) ? formatarDescricao(i.observacoes!) : '',
        amenities: amenidadesDe(i.imovel_comodidades, i.condominio_comodidades),
        empreendimento_id: condo?.id ?? null,
        cep: cepDig(i.endereco_cep),
        logradouro: [txt(i.endereco_logradouro), txt(i.endereco_numero) ? `nº ${i.endereco_numero}` : null].filter(Boolean).join(', ') || null,
        bairro,
        cidade,
        uf: estado,
        condominio: condo?.name ?? (txt(i.condominio_nome) ? formatTitulo(limparNomeCondo(i.condominio_nome!)) : null),
        visibilidade: opcoes.ativos.has(String(i.id_imovel)) ? 'publico' : 'privado',
        lat: typeof i.latitude === 'number' ? i.latitude : null,
        lng: typeof i.longitude === 'number' ? i.longitude : null,
        aproximada: i.geoposicionamento_visivel === 2
      };
      const e = porJt.get(String(i.id_imovel));
      const fotosMudaram = !!opcoes.trocarFotos || JSON.stringify(src) !== JSON.stringify(Array.isArray(e?.jetimob_fotos_src) ? e!.jetimob_fotos_src : []);
      const p = [
        valores.titulo, valores.tipo_unidade, valores.finalidade, valores.delivery_date, valores.price_value, valores.price_period, valores.location,
        valores.quartos, valores.vagas, valores.banheiros, valores.area, valores.video_url, valores.aceita_temporada, valores.description,
        JSON.stringify(valores.amenities), valores.empreendimento_id, valores.cep, valores.logradouro, valores.bairro, valores.cidade, valores.uf,
        valores.condominio, valores.visibilidade, valores.lat, valores.lng, valores.aproximada, i.id_imovel, i.codigo ?? null
      ];
      if (e && !opcoes.sobrescrever) {
        // já importado: o portal é a fonte agora — só recoloca as fotos se ainda não vieram
        if (
          (fotosMudaram && src.length && opcoes.trocarFotos) ||
          (fotosMudaram && !(await query<{ n: number }>("select 1 as n from properties where id = $1 and jsonb_array_length(photos) > 0", [e.id])).length)
        ) {
          await query("update properties set fotos_pendentes = $2::jsonb, jetimob_fotos_src = $3::jsonb, jetimob_fotos_novas = '{}'::jsonb where id = $1", [
            e.id,
            JSON.stringify(filaDe(fotos, plantas)),
            JSON.stringify(src)
          ]);
        }
        continue;
      }
      if (e) {
        await query(
          `update properties set titulo = $1, tipo_unidade = $2, finalidade = $3, delivery_date = $4::date, price_value = $5, price_period = $6, location = $7,
              quartos = $8, vagas = $9, banheiros = $10, area = $11, video_url = coalesce($12::text, video_url), video = ($12::text is not null or video),
              aceita_temporada = $13, description = case when $14::text = '' then description else $14::text end, amenities = $15::jsonb,
              empreendimento_id = coalesce($16, empreendimento_id), cep = $17, logradouro = $18, bairro = $19, cidade = $20, uf = $21, condominio = $22,
              visibilidade = $23, lat = $24, lng = $25, localizacao_aproximada = $26, jetimob_id = $27, jetimob_codigo = $28, jetimob_atualizado_em = now()
              ${fotosMudaram ? `, fotos_pendentes = $30::jsonb, jetimob_fotos_src = $31::jsonb, jetimob_fotos_novas = '{}'::jsonb` : ''}
            where id = $29`,
          fotosMudaram ? [...p, e.id, JSON.stringify(filaDe(fotos, plantas)), JSON.stringify(src)] : [...p, e.id]
        );
        res.atualizados++;
      } else {
        const id = `jt-${i.id_imovel}`;
        await query(
          `insert into properties (id, corretor_email, is_tipologia, match_score, titulo, tipo_unidade, finalidade, delivery_date, price_value, price_period, location,
              quartos, vagas, banheiros, area, video_url, video, aceita_temporada, description, amenities, empreendimento_id, photos, cep, logradouro, bairro,
              cidade, uf, condominio, video_vertical, plantas, visibilidade, lat, lng, localizacao_aproximada, jetimob_id, jetimob_codigo, jetimob_atualizado_em,
              fotos_pendentes, jetimob_fotos_src)
           values ($29, $30, false, 50, $1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, $12::text, $12::text is not null, $13, $14, $15::jsonb, $16, '[]'::jsonb, $17, $18,
              $19, $20, $21, $22, false, '[]'::jsonb, $23, $24, $25, $26, $27, $28, now(), $31::jsonb, $32::jsonb)
           on conflict (id) do nothing`,
          [...p, id, email, JSON.stringify(filaDe(fotos, plantas)), JSON.stringify(src)]
        );
        res.criados++;
      }
    } catch (err) {
      res.erros.push(`Imóvel ${i?.codigo ?? i?.id_imovel}: ${err instanceof Error ? err.message.slice(0, 120) : 'erro'}`);
    }
  }
  return res;
}

/** Depois de uma sincronização COMPLETA: o que a Jetimob não devolveu mais sai do ar e vai para o histórico */
export async function arquivarRemovidos(inicioSync: Date): Promise<number> {
  const sumidos = await query<{ id: string }>(
    `select id from properties where jetimob_id is not null and (jetimob_atualizado_em is null or jetimob_atualizado_em < $1)`,
    [inicioSync.toISOString()]
  );
  for (const s of sumidos) {
    await query(
      `insert into imoveis_historico (property_id, motivo, titulo, tipo_unidade, finalidade, price_value, area, quartos, vagas, bairro, cidade, uf, condominio,
          empreendimento_id, delivery_date, visibilidade, corretor_email, anunciado_em, dados)
       select p.id, 'excluido', p.titulo, p.tipo_unidade, p.finalidade, p.price_value, p.area, p.quartos, p.vagas, p.bairro, p.cidade, p.uf, p.condominio,
          p.empreendimento_id, p.delivery_date, p.visibilidade, p.corretor_email, p.created_at, to_jsonb(p) || '{"origem":"saiu da Jetimob"}'::jsonb
         from properties p where p.id = $1`,
      [s.id]
    );
    await query('delete from favorites where property_id = $1', [s.id]).catch(() => {});
    await query('delete from properties where id = $1', [s.id]);
  }
  return sumidos.length;
}

/** Só troca público/privado conforme a lista de publicados da Jetimob (rápido; roda junto com a sincronização diária) */
export async function atualizarVisibilidade(ativos: Set<string>): Promise<number> {
  const rows = await query<{ n: string }>(
    `with a as (select unnest($1::text[]) as jid)
     update properties p set visibilidade = case when exists (select 1 from a where a.jid = p.jetimob_id::text) then 'publico' else 'privado' end
      where p.jetimob_id is not null
        and p.visibilidade <> case when exists (select 1 from a where a.jid = p.jetimob_id::text) then 'publico' else 'privado' end
     returning 1 as n`,
    [Array.from(ativos)]
  );
  return rows.length;
}

// ---------- Fotos: baixa da Jetimob e guarda no R2 (aos poucos) ----------
type Novas = { fotos?: (string | null)[]; plantas?: (string | null)[] };

export async function processarFotos(orcamentoMs = 20000): Promise<{ enviadas: number; restantes: number; erros: string[] }> {
  const erros: string[] = [];
  if (r2Configurado().length) return { enviadas: 0, restantes: 0, erros: ['Armazenamento de fotos (R2) não configurado.'] };
  const fim = Date.now() + orcamentoMs;
  let enviadas = 0;
  for (const tabela of ['developments', 'properties'] as const) {
    const nomeCol = tabela === 'developments' ? 'name' : "coalesce(condominio, '') || ' ' || coalesce(titulo, tipo_unidade) || ' ' || coalesce(bairro, '')";
    const linhas = await query<{ id: string; nome: string; fila: FilaFoto[]; novas: Novas }>(
      `select id, ${nomeCol} as nome, fotos_pendentes as fila, jetimob_fotos_novas as novas from ${tabela}
        where jsonb_array_length(fotos_pendentes) > 0 order by jetimob_atualizado_em desc nulls last limit 30`
    );
    for (const l of linhas) {
      if (Date.now() > fim) break;
      const fila = [...(l.fila ?? [])];
      const novas: Novas = { fotos: [...(l.novas?.fotos ?? [])], plantas: [...(l.novas?.plantas ?? [])] };
      while (fila.length && Date.now() < fim) {
        const item = fila.shift()!;
        try {
          const r = await fetch(item.url, { signal: AbortSignal.timeout(15000) });
          const tipo = (r.headers.get('content-type') ?? '').split(';')[0];
          if (!r.ok || !/^image\/(jpeg|png|webp)$/.test(tipo)) throw new Error(`HTTP ${r.status} ${tipo}`);
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length > 15 * 1024 * 1024) throw new Error('foto maior que 15 MB');
          const url = await enviarParaR2(buf, tipo, item.tipo === 'planta' ? 'plantas' : tabela === 'developments' ? 'empreendimentos' : 'imoveis', `${l.nome}${item.tipo === 'planta' ? ' planta' : ''}`);
          const lista = item.tipo === 'planta' ? novas.plantas! : novas.fotos!;
          lista[item.i] = url;
          enviadas++;
        } catch (e) {
          erros.push(`${l.nome}: ${e instanceof Error ? e.message.slice(0, 80) : 'falha'}`);
        }
      }
      const pronto = fila.length === 0;
      const compact = (xs?: (string | null)[]) => (xs ?? []).filter((x): x is string => !!x);
      if (pronto) {
        // fila terminou: troca as fotos de uma vez (o anúncio nunca fica sem foto no meio do caminho)
        await query(
          tabela === 'properties'
            ? `update properties set photos = $2::jsonb, plantas = $3::jsonb, fotos_pendentes = '[]'::jsonb, jetimob_fotos_novas = '{}'::jsonb where id = $1`
            : `update developments set photos = case when jsonb_array_length($2::jsonb) > 0 then $2::jsonb else photos end, fotos_pendentes = '[]'::jsonb, jetimob_fotos_novas = '{}'::jsonb where id = $1`,
          tabela === 'properties' ? [l.id, JSON.stringify(compact(novas.fotos)), JSON.stringify(compact(novas.plantas))] : [l.id, JSON.stringify(compact(novas.fotos))]
        );
      } else {
        await query(`update ${tabela} set fotos_pendentes = $2::jsonb, jetimob_fotos_novas = $3::jsonb where id = $1`, [l.id, JSON.stringify(fila), JSON.stringify(novas)]);
      }
    }
  }
  const rest = await query<{ n: string }>(
    `select (select coalesce(sum(jsonb_array_length(fotos_pendentes)), 0) from properties) + (select coalesce(sum(jsonb_array_length(fotos_pendentes)), 0) from developments) as n`
  );
  return { enviadas, restantes: Number(rest[0]?.n) || 0, erros: erros.slice(0, 10) };
}

// ---------- Leads do site → CRM da Jetimob ----------
export async function enviarLeadJetimob(l: {
  nome: string;
  email?: string | null;
  telefone?: string | null;
  mensagem?: string | null;
  assunto?: string;
  codigoImovel?: string | null;
  finalidade?: 'venda' | 'aluguel';
  url?: string;
}): Promise<void> {
  const pub = process.env.JETIMOB_PUBLIC_KEY;
  const priv = process.env.JETIMOB_PRIVATE_KEY;
  if (!pub || !priv) return;
  const fd = new FormData();
  fd.append('full_name', l.nome);
  fd.append('email', l.email ?? '');
  fd.append('phone', l.telefone ?? '');
  fd.append('message', l.mensagem ?? '');
  fd.append('subject', l.assunto ?? 'Contato pelo portal Mais Novos Imóveis');
  fd.append('source', 'Portal Mais Novos Imóveis');
  if (l.codigoImovel) fd.append('property_code', l.codigoImovel);
  fd.append('property_contract', l.finalidade === 'aluguel' ? '2' : '1');
  if (l.url) fd.append('url', l.url);
  const r = await fetch(`${BASE}/leads/${pub}`, { method: 'POST', headers: { 'Authorization-Key': priv }, body: fd, signal: AbortSignal.timeout(10000) });
  if (!r.ok) console.error('Lead para a Jetimob falhou', r.status);
}

// ---------- Prévia (tela "Testar conexão") ----------
export async function previaJetimob(): Promise<{ condominios: number; imoveis: number; ativos: number; exemplo?: Record<string, unknown> }> {
  const [c, i, a] = await Promise.all([
    jt<Pagina<JtCondominio>>('condominios', { v: 6, page: 1, pageSize: 1 }),
    jt<Pagina<JtImovel>>('imoveis/todos', { v: 6, page: 1, pageSize: 1 }),
    idsAtivos()
  ]);
  const x = i.data?.[0];
  return {
    condominios: c.total ?? 0,
    imoveis: i.total ?? 0,
    ativos: a.size,
    exemplo: x
      ? {
          codigo: x.codigo,
          tipo: `${x.tipo ?? ''} / ${x.subtipo ?? ''} → ${tipoDoImovel(x)}`,
          contrato: x.contrato,
          valor: x.valor_venda ?? x.valor_locacao,
          area: x.area_privativa ?? x.area_util ?? x.area_total,
          quartos: x.dormitorios,
          bairro: x.endereco_bairro,
          cidade: x.endereco_cidade,
          condominio: x.condominio_nome,
          fotos: (x.imagens ?? []).length,
          plantas: (x.plantas ?? []).length,
          publicado: a.has(String(x.id_imovel)) ? 'sim' : 'não (entra como privado)'
        }
      : undefined
  };
}

// ---------- Contatos (leads) da Jetimob → Painel → Interessados ----------
type JtLead = { id?: number; full_name?: string; emails?: string[]; phones?: string[]; message?: string; subject?: string };

export async function importarLeadsJetimob(): Promise<{ importados: number; jaExistiam: number; total: number }> {
  const pub = process.env.JETIMOB_PUBLIC_KEY;
  const priv = process.env.JETIMOB_PRIVATE_KEY;
  if (!pub || !priv) throw new Error('Chaves pública/privada da Jetimob não configuradas.');
  const r = await fetch(`${BASE}/leads/${pub}`, { headers: { 'Authorization-Key': priv }, cache: 'no-store', signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`Jetimob respondeu ${r.status} em /leads`);
  const json = (await r.json()) as JtLead[] | { data?: JtLead[] };
  const leads = Array.isArray(json) ? json : json.data ?? [];
  let importados = 0;
  let jaExistiam = 0;
  for (const l of leads) {
    const nome = (l.full_name ?? '').trim().slice(0, 120);
    const email = (l.emails?.[0] ?? '').trim().toLowerCase().slice(0, 160) || null;
    const tel = (l.phones?.[0] ?? '').replace(/[^\d+]/g, '').slice(0, 20) || null;
    if (!nome || (!email && !tel)) continue;
    const dup = await query<{ id: string }>(
      "select id from interest_leads where condominio = 'Jetimob (importado)' and ((email is not null and email = $1) or (telefone is not null and telefone = $2)) limit 1",
      [email, tel]
    );
    if (dup[0]) {
      jaExistiam++;
      continue;
    }
    // aceita_contato = false: são contatos antigos do CRM — não recebem e-mails automáticos
    await query(
      `insert into interest_leads (development_id, condominio, nome, email, telefone, finalidade, mensagem, aceita_contato)
       values (null, 'Jetimob (importado)', $1, $2, $3, 'venda', $4, false)`,
      [nome, email, tel, [l.subject, l.message].filter(Boolean).join(' — ').slice(0, 1000) || null]
    );
    importados++;
  }
  return { importados, jaExistiam, total: leads.length };
}
