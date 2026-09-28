'use server';

// Painel → Empresas (construtoras e incorporadoras) e o campo "Concepção" do
// empreendimento. Qualquer pessoa da equipe consulta e cadastra pelo CNPJ (os dados
// vêm da Receita); admin e analista editam o nome fantasia e o histórico.
import { query } from './db';
import { exigirEquipe, exigirGestor } from './staff-auth';
import { consultarReceita, concepcaoDe, empresaPorNome, mapEmpresa, type EmpresaRow } from './empresas';
import { cnpjValido, type ConcepcaoItem, type Empresa } from './empresas-tipos';

export async function buscarEmpresas(q: string): Promise<Empresa[]> {
  await exigirEquipe();
  const t = String(q ?? '').trim().slice(0, 80);
  const dig = t.replace(/\D/g, '');
  const norm = (c: string) => `translate(lower(coalesce(${c}, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')`;
  const like = `%${t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}%`;
  const rows = await query<EmpresaRow>(
    `select e.*, (select count(*) from development_empresas de where de.empresa_id = e.id) as total from empresas e
      where $1 = '' or ${norm('e.razao_social')} like $2 or ${norm('e.nome_fantasia')} like $2 or ${norm('e.nome_perfil')} like $2 or ($3 <> '' and e.cnpj like $3 || '%')
      order by total desc, coalesce(e.nome_perfil, e.nome_fantasia, e.razao_social) limit 30`,
    [t, like, dig.length >= 4 ? dig : '']
  );
  return rows.map(mapEmpresa);
}

/** Consulta o CNPJ na Receita e cadastra (ou atualiza) a empresa. Devolve a empresa do banco. */
export async function cadastrarPorCnpj(cnpj: string): Promise<{ ok: true; empresa: Empresa; nova: boolean } | { ok: false; erro: string }> {
  const eu = await exigirEquipe();
  const d = String(cnpj ?? '').replace(/\D/g, '');
  if (!cnpjValido(d)) return { ok: false, erro: 'CNPJ inválido. Confira os 14 números.' };
  const existente = await query<EmpresaRow>('select * from empresas where cnpj = $1', [d]);
  if (existente[0]) return { ok: true, empresa: mapEmpresa(existente[0]), nova: false };
  let dados;
  try {
    dados = await consultarReceita(d);
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'A consulta à Receita falhou.' };
  }
  if (!dados) return { ok: false, erro: 'CNPJ não encontrado na Receita Federal.' };
  const r = await query<EmpresaRow>(
    `insert into empresas (cnpj, razao_social, nome_fantasia, situacao, data_situacao, data_inicio, municipio, uf, atividade, receita, receita_atualizada_em, criado_por,
                           situacao_especial, data_situacao_especial)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),$11,$12,$13)
     on conflict (cnpj) do update set updated_at = now() returning *`,
    [d, dados.razaoSocial, dados.nomeFantasia, dados.situacao, dados.dataSituacao, dados.dataInicio, dados.municipio, dados.uf, dados.atividade, JSON.stringify(dados.bruto), eu.email, dados.situacaoEspecial, dados.dataSituacaoEspecial]
  );
  return { ok: true, empresa: mapEmpresa(r[0]), nova: true };
}

/** Busca de novo na Receita (situação cadastral pode ter mudado) */
export async function atualizarPelaReceita(id: string): Promise<{ ok: boolean; erro?: string; empresa?: Empresa }> {
  await exigirEquipe();
  const e = await query<EmpresaRow>('select * from empresas where id = $1::uuid', [id]);
  if (!e[0]) return { ok: false, erro: 'Empresa não encontrada.' };
  if (!e[0].cnpj) return { ok: false, erro: 'Esta empresa ainda não tem CNPJ. Informe o CNPJ primeiro.' };
  let dados;
  try {
    dados = await consultarReceita(e[0].cnpj);
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : 'A consulta à Receita falhou.' };
  }
  if (!dados) return { ok: false, erro: 'CNPJ não encontrado na Receita Federal.' };
  const r = await query<EmpresaRow>(
    `update empresas set razao_social=$2, situacao=$3, data_situacao=$4, data_inicio=$5, municipio=$6, uf=$7, atividade=$8, receita=$9,
            nome_fantasia = coalesce(nome_fantasia, $10), situacao_especial = $11, data_situacao_especial = $12, receita_atualizada_em = now(), updated_at = now()
      where id = $1::uuid returning *`,
    [id, dados.razaoSocial, dados.situacao, dados.dataSituacao, dados.dataInicio, dados.municipio, dados.uf, dados.atividade, JSON.stringify(dados.bruto), dados.nomeFantasia, dados.situacaoEspecial, dados.dataSituacaoEspecial]
  );
  return { ok: true, empresa: mapEmpresa(r[0]) };
}

export async function salvarEmpresa(
  id: string,
  d: { nomePerfil: string; historico: string; anoFundacao?: number | null; grupoPrincipalId?: string | null }
): Promise<{ ok: boolean; erro?: string }> {
  await exigirGestor();
  const ano = d.anoFundacao ? Math.round(Number(d.anoFundacao)) : null;
  if (ano && (ano < 1850 || ano > new Date().getFullYear())) return { ok: false, erro: 'Ano de fundação inválido.' };
  let grupo = d.grupoPrincipalId && /^[0-9a-f-]{36}$/i.test(d.grupoPrincipalId) ? d.grupoPrincipalId : null;
  if (grupo === id) grupo = null;
  if (grupo) {
    // a principal não pode estar dentro de outro grupo (evita "grupo de grupo")
    const g = await query<{ grupo_principal_id: string | null }>('select grupo_principal_id from empresas where id = $1::uuid', [grupo]);
    if (!g[0]) return { ok: false, erro: 'Empresa principal não encontrada.' };
    if (g[0].grupo_principal_id) grupo = g[0].grupo_principal_id === id ? null : g[0].grupo_principal_id;
    // esta empresa deixa de ser principal: as que estavam no grupo dela passam para o novo
    if (grupo) await query('update empresas set grupo_principal_id = $2::uuid where grupo_principal_id = $1::uuid', [id, grupo]);
  }
  await query('update empresas set nome_perfil = $2, historico = $3, ano_fundacao = $4, grupo_principal_id = $5, slug = case when $6 then null else slug end, updated_at = now() where id = $1::uuid', [
    id,
    String(d.nomePerfil ?? '').trim().slice(0, 120) || null,
    String(d.historico ?? '').trim().slice(0, 3000) || null,
    ano,
    grupo,
    false
  ]);
  return { ok: true };
}

export async function excluirEmpresa(id: string): Promise<{ ok: boolean; erro?: string }> {
  await exigirGestor();
  const n = await query<{ n: string }>('select count(*) as n from development_empresas where empresa_id = $1::uuid', [id]);
  if (Number(n[0]?.n) > 0) return { ok: false, erro: 'Esta empresa está na Concepção de empreendimentos. Tire dos empreendimentos antes de apagar.' };
  await query('delete from empresas where id = $1::uuid', [id]);
  return { ok: true };
}

export async function lerConcepcao(developmentId: string): Promise<ConcepcaoItem[]> {
  await exigirEquipe();
  return concepcaoDe(developmentId);
}

/** Cadastra só com o nome (sem CNPJ) — o CNPJ é completado depois. Se já existe com esse nome, usa a existente. */
export async function cadastrarPorNome(nome: string): Promise<{ ok: true; empresa: Empresa } | { ok: false; erro: string }> {
  const eu = await exigirEquipe();
  if (String(nome ?? '').trim().length < 2) return { ok: false, erro: 'Informe o nome da empresa.' };
  const e = await empresaPorNome(String(nome), eu.email);
  return e ? { ok: true, empresa: e } : { ok: false, erro: 'Nome muito curto.' };
}

/**
 * Completa o CNPJ de uma empresa cadastrada só pelo nome: busca na Receita e grava.
 * Se esse CNPJ já estiver cadastrado em outra empresa, junta as duas (os empreendimentos
 * passam para a que já tinha o CNPJ) para não ficar duplicada.
 */
export async function definirCnpj(id: string, cnpj: string): Promise<{ ok: true; empresa: Empresa; juntou: boolean } | { ok: false; erro: string }> {
  await exigirEquipe();
  const d = String(cnpj ?? '').replace(/\D/g, '');
  if (!cnpjValido(d)) return { ok: false, erro: 'CNPJ inválido. Confira os 14 números.' };
  const atual = await query<EmpresaRow>('select * from empresas where id = $1::uuid', [id]);
  if (!atual[0]) return { ok: false, erro: 'Empresa não encontrada.' };
  const outra = await query<EmpresaRow>('select * from empresas where cnpj = $1 and id <> $2::uuid', [d, id]);
  if (outra[0]) {
    await query(
      `insert into development_empresas (development_id, empresa_id, papel, ordem)
         select development_id, $2::uuid, papel, ordem from development_empresas where empresa_id = $1::uuid
       on conflict (development_id, empresa_id) do nothing`,
      [id, outra[0].id]
    );
    await query(
      `update empresas set historico = coalesce(historico, (select historico from empresas where id = $1::uuid)), updated_at = now() where id = $2::uuid`,
      [id, outra[0].id]
    );
    await query('delete from empresas where id = $1::uuid', [id]);
    const r = await query<EmpresaRow>('select * from empresas where id = $1::uuid', [outra[0].id]);
    return { ok: true, empresa: mapEmpresa(r[0]), juntou: true };
  }
  let dados;
  try {
    dados = await consultarReceita(d);
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : 'A consulta à Receita falhou.' };
  }
  if (!dados) return { ok: false, erro: 'CNPJ não encontrado na Receita Federal.' };
  // o nome que a equipe já usava (ex.: veio do PDF) continua como nome fantasia
  const r = await query<EmpresaRow>(
    `update empresas set cnpj = $2, razao_social = $3, nome_fantasia = coalesce(nullif(nome_fantasia, ''), $4), situacao = $5, data_situacao = $6,
            data_inicio = $7, municipio = $8, uf = $9, atividade = $10, receita = $11, situacao_especial = $12, data_situacao_especial = $13,
            receita_atualizada_em = now(), updated_at = now()
      where id = $1::uuid returning *`,
    [id, d, dados.razaoSocial, dados.nomeFantasia, dados.situacao, dados.dataSituacao, dados.dataInicio, dados.municipio, dados.uf, dados.atividade, JSON.stringify(dados.bruto), dados.situacaoEspecial, dados.dataSituacaoEspecial]
  );
  return { ok: true, empresa: mapEmpresa(r[0]), juntou: false };
}

/** Quantas empresas têm CNPJ mas ainda não têm os dados da Receita (vieram da planilha) */
export async function contarPendentesReceita(): Promise<number> {
  await exigirEquipe();
  const r = await query<{ n: string }>('select count(*) as n from empresas where cnpj is not null and receita_atualizada_em is null');
  return Number(r[0]?.n) || 0;
}

/** Busca na Receita um pequeno lote de pendentes (a tela chama várias vezes até zerar) */
export async function completarPendentesReceita(limite = 4): Promise<{ feitos: number; falhas: string[]; restantes: number }> {
  await exigirEquipe();
  const lote = await query<EmpresaRow>(
    'select * from empresas where cnpj is not null and receita_atualizada_em is null order by created_at limit $1',
    [Math.min(10, Math.max(1, limite))]
  );
  let feitos = 0;
  const falhas: string[] = [];
  for (const e of lote) {
    try {
      const dados = await consultarReceita(e.cnpj!);
      if (!dados) {
        falhas.push(`${e.nome_fantasia ?? e.razao_social}: CNPJ não encontrado na Receita`);
        // marca como consultado para não travar a fila; fica sem situação
        await query('update empresas set receita_atualizada_em = now() where id = $1', [e.id]);
        continue;
      }
      await query(
        `update empresas set razao_social = $2, nome_fantasia = coalesce(nullif(nome_fantasia, ''), $3), situacao = $4, data_situacao = $5, data_inicio = $6,
                municipio = $7, uf = $8, atividade = $9, receita = $10, situacao_especial = $11, data_situacao_especial = $12, receita_atualizada_em = now(), updated_at = now()
          where id = $1`,
        [e.id, dados.razaoSocial, dados.nomeFantasia, dados.situacao, dados.dataSituacao, dados.dataInicio, dados.municipio, dados.uf, dados.atividade, JSON.stringify(dados.bruto), dados.situacaoEspecial, dados.dataSituacaoEspecial]
      );
      feitos++;
    } catch {
      falhas.push(`${e.nome_fantasia ?? e.razao_social}: a Receita não respondeu (tente de novo depois)`);
      break; // provavelmente limite de consultas: para e deixa para a próxima rodada
    }
  }
  const r = await query<{ n: string }>('select count(*) as n from empresas where cnpj is not null and receita_atualizada_em is null');
  return { feitos, falhas, restantes: Number(r[0]?.n) || 0 };
}
