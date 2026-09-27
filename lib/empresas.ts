// Leitura de empresas no banco + consulta à Receita (módulo só do servidor).
// Fonte dos dados do CNPJ: Minha Receita (minhareceita.org, código aberto, dados
// públicos da Receita Federal). Se ela não responder, tenta a BrasilAPI (mesmo formato).
import { query } from './db';
import type { ConcepcaoItem, Empresa, EmpresaNaConcepcao, PapelEmpresa } from './empresas-tipos';

export type EmpresaRow = {
  id: string;
  cnpj: string | null;
  razao_social: string;
  nome_fantasia: string | null;
  slug: string;
  situacao: string | null;
  data_situacao: Date | string | null;
  data_inicio: Date | string | null;
  municipio: string | null;
  uf: string | null;
  atividade: string | null;
  historico: string | null;
  receita_atualizada_em: Date | string | null;
  total?: string | number | null;
};
const dia = (v: Date | string | null) => (v ? new Date(v).toISOString().slice(0, 10) : null);
export const mapEmpresa = (r: EmpresaRow): Empresa => ({
  id: r.id,
  cnpj: r.cnpj,
  razaoSocial: r.razao_social,
  nomeFantasia: r.nome_fantasia,
  slug: r.slug,
  situacao: r.situacao,
  dataSituacao: dia(r.data_situacao),
  dataInicio: dia(r.data_inicio),
  municipio: r.municipio,
  uf: r.uf,
  atividade: r.atividade,
  historico: r.historico,
  receitaAtualizadaEm: r.receita_atualizada_em ? new Date(r.receita_atualizada_em).toISOString() : null,
  totalEmpreendimentos: r.total != null ? Number(r.total) : undefined
});

export type DadosReceita = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  situacao: string | null;
  dataSituacao: string | null;
  dataInicio: string | null;
  municipio: string | null;
  uf: string | null;
  atividade: string | null;
  bruto: Record<string, unknown>;
};

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const data = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
/** Nome em caixa alta da Receita → "Construtora Exemplo Ltda" */
export function nomeBonito(s: string | null): string | null {
  if (!s) return null;
  const minusculas = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  const siglas = new Set(['LTDA', 'S/A', 'SA', 'S.A.', 'EIRELI', 'ME', 'EPP', 'SPE', 'SCP']);
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (siglas.has(w.toUpperCase()) ? w.toUpperCase() : i > 0 && minusculas.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export async function consultarReceita(cnpj: string): Promise<DadosReceita | null> {
  const d = cnpj.replace(/\D/g, '');
  const fontes = [`https://minhareceita.org/${d}`, `https://brasilapi.com.br/api/cnpj/v1/${d}`];
  for (const url of fontes) {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (r.status === 404) return null;
      if (!r.ok) continue;
      const j = (await r.json()) as Record<string, unknown>;
      if (!texto(j.razao_social)) continue;
      return {
        cnpj: d,
        razaoSocial: nomeBonito(texto(j.razao_social))!,
        nomeFantasia: nomeBonito(texto(j.nome_fantasia)),
        situacao: texto(j.descricao_situacao_cadastral)?.toUpperCase() ?? (typeof j.situacao_cadastral === 'string' ? j.situacao_cadastral.toUpperCase() : null),
        dataSituacao: data(j.data_situacao_cadastral),
        dataInicio: data(j.data_inicio_atividade),
        municipio: nomeBonito(texto(j.municipio)),
        uf: texto(j.uf)?.toUpperCase() ?? null,
        atividade: texto(j.cnae_fiscal_descricao),
        bruto: j
      };
    } catch {
      // tenta a próxima fonte
    }
  }
  throw new Error('A consulta à Receita não respondeu agora. Tente de novo em instantes.');
}

/** Empresas da Concepção de um empreendimento (ordem de cadastro) */
export async function concepcaoDe(developmentId: string): Promise<ConcepcaoItem[]> {
  const rows = await query<EmpresaRow & { papel: PapelEmpresa }>(
    `select e.*, de.papel from development_empresas de join empresas e on e.id = de.empresa_id
      where de.development_id = $1 order by de.ordem, e.razao_social`,
    [developmentId]
  ).catch(() => []);
  return rows.map((r) => ({ empresa: mapEmpresa(r), papel: r.papel }));
}

const PAPEIS: PapelEmpresa[] = ['construtora', 'incorporadora', 'construtora_incorporadora'];

/** Grava a Concepção (substitui a lista). Quem chama já conferiu a permissão. */
export async function gravarConcepcao(developmentId: string, itens: EmpresaNaConcepcao[]): Promise<void> {
  const vistos = new Set<string>();
  const limpos = itens.filter((i) => /^[0-9a-f-]{36}$/i.test(i.empresaId) && !vistos.has(i.empresaId) && vistos.add(i.empresaId));
  await query('delete from development_empresas where development_id = $1', [developmentId]);
  for (const [ordem, i] of limpos.entries()) {
    await query('insert into development_empresas (development_id, empresa_id, papel, ordem) values ($1, $2::uuid, $3, $4)', [
      developmentId,
      i.empresaId,
      PAPEIS.includes(i.papel) ? i.papel : 'construtora_incorporadora',
      ordem
    ]);
  }
}

const normNome = (c: string) => `regexp_replace(translate(lower(coalesce(${c}, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '\\m(ltda|s/?a|eireli|me|epp|construtora|incorporadora|engenharia|empreendimentos|imobiliarios?|construcoes|incorporacoes|participacoes|urbanismo|spe|e|de|da|do)\\M|[^a-z0-9]', '', 'g')`;
export const chaveNomeEmpresa = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(ltda|s\/?a|eireli|me|epp|construtora|incorporadora|engenharia|empreendimentos|imobiliarios?|construcoes|incorporacoes|participacoes|urbanismo|spe|e|de|da|do)\b|[^a-z0-9]/g, '');

/** Acha a empresa pelo nome (ignora "Construtora", "Ltda", acentos…) ou cadastra só com o nome, sem CNPJ. */
export async function empresaPorNome(nome: string, criadoPor?: string): Promise<Empresa | null> {
  const limpo = nome.replace(/\s+/g, ' ').trim().slice(0, 120);
  const chave = chaveNomeEmpresa(limpo);
  if (chave.length < 2) return null;
  const achou = await query<EmpresaRow>(
    `select * from empresas e where ${normNome('e.nome_fantasia')} = $1 or ${normNome('e.razao_social')} = $1 order by (e.cnpj is not null) desc limit 1`,
    [chave]
  );
  if (achou[0]) return mapEmpresa(achou[0]);
  const r = await query<EmpresaRow>('insert into empresas (razao_social, nome_fantasia, criado_por) values ($1, $1, $2) returning *', [limpo, criadoPor ?? null]);
  return mapEmpresa(r[0]);
}

/**
 * Empresa para a importação por planilha, SEM consultar a Receita (seria lento com
 * centenas de linhas): pelo CNPJ se tiver, senão pelo nome. Empresa nova com CNPJ fica
 * "pendente" (sem dados da Receita) até o botão "Buscar dados na Receita" do painel.
 */
export async function resolverEmpresaImport(e: { nome?: string; cnpj?: string }, criadoPor: string, cache: Map<string, string | null>): Promise<string | null> {
  const cnpj = (e.cnpj ?? '').replace(/\D/g, '');
  const nome = (e.nome ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const k = cnpj ? `c:${cnpj}` : `n:${chaveNomeEmpresa(nome)}`;
  if (cache.has(k)) return cache.get(k)!;
  let id: string | null = null;
  if (cnpj.length === 14) {
    const porCnpj = await query<{ id: string }>('select id from empresas where cnpj = $1', [cnpj]);
    if (porCnpj[0]) id = porCnpj[0].id;
    else {
      // mesma empresa cadastrada antes só pelo nome: ganha o CNPJ
      const chave = nome ? chaveNomeEmpresa(nome) : '';
      const semCnpj =
        chave.length >= 2
          ? await query<{ id: string }>(
              `select id from empresas e where e.cnpj is null and (${normNome('e.nome_fantasia')} = $1 or ${normNome('e.razao_social')} = $1) limit 1`,
              [chave]
            )
          : [];
      if (semCnpj[0]) {
        await query('update empresas set cnpj = $2, updated_at = now() where id = $1', [semCnpj[0].id, cnpj]);
        id = semCnpj[0].id;
      } else {
        const r = await query<{ id: string }>(
          'insert into empresas (cnpj, razao_social, nome_fantasia, criado_por) values ($1, $2, $3, $4) on conflict (cnpj) do update set updated_at = now() returning id',
          [cnpj, nome || `CNPJ ${cnpj}`, nome || null, criadoPor]
        );
        id = r[0].id;
      }
    }
  } else if (nome) {
    id = (await empresaPorNome(nome, criadoPor))?.id ?? null;
  }
  cache.set(k, id);
  return id;
}

/** Liga empresas a empreendimentos (em lote), sem tirar as que já estavam */
export async function acrescentarConcepcao(itens: { developmentId: string; empresaId: string; papel: PapelEmpresa }[]): Promise<void> {
  const unicos = Array.from(new Map(itens.map((it) => [`${it.developmentId}|${it.empresaId}`, it])).values());
  if (!unicos.length) return;
  const linhas = unicos.map((it, i) => ({ d: it.developmentId, e: it.empresaId, p: PAPEIS.includes(it.papel) ? it.papel : 'construtora_incorporadora', o: 100 + (i % 10) }));
  await query(
    `insert into development_empresas (development_id, empresa_id, papel, ordem)
       select r.d, r.e::uuid, r.p, r.o from jsonb_to_recordset($1::jsonb) as r(d text, e text, p text, o int)
     on conflict (development_id, empresa_id) do update
       set papel = case when development_empresas.papel <> excluded.papel then 'construtora_incorporadora' else development_empresas.papel end`,
    [JSON.stringify(linhas)]
  );
}
