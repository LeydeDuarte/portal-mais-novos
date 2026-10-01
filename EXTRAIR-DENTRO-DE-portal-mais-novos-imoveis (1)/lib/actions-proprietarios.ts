'use server';

// Painel: cadastro de proprietários (vendedores). Uso interno da equipe; nada
// disso vai para páginas públicas.
// Quem vê o quê: admin e analista veem e editam todos; o corretor vê e edita os
// que ele cadastrou e os que estão ligados a imóveis dele.
import { query } from './db';
import { exigirEquipe } from './staff-auth';
import { veTudo } from './papeis';
import { mapProprietario, proprietariosDoImovel, type Conjuge, type Proprietario, type ProprietarioDoImovel } from './proprietarios';
import type { StaffSessionPayload } from './session';

type Row = Parameters<typeof mapProprietario>[0];
const t = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n) || null;
const dig = (v: unknown, n: number) => String(v ?? '').replace(/\D/g, '').slice(0, n) || null;
const data = (v: unknown) => {
  const s = String(v ?? '').trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return br ? `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}` : null;
};
const semAcento = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// condição SQL: proprietários que esta pessoa da equipe pode ver
const visiveis = (eu: StaffSessionPayload, n: number) =>
  veTudo(eu.role)
    ? { sql: 'true', params: [] as unknown[] }
    : {
        sql: `(lower(o.criado_por) = lower($${n}) or exists (select 1 from property_proprietarios pp join properties p on p.id = pp.property_id
                where pp.proprietario_id = o.id and lower(p.corretor_email) = lower($${n})))`,
        params: [eu.email] as unknown[]
      };

async function podeMexer(id: string): Promise<StaffSessionPayload> {
  const eu = await exigirEquipe();
  if (veTudo(eu.role)) return eu;
  const v = visiveis(eu, 2);
  const r = await query(`select 1 from proprietarios o where o.id = $1::uuid and ${v.sql}`, [id, ...v.params]);
  if (!r.length) throw new Error('Sem permissão para este proprietário.');
  return eu;
}

// ---------------- busca (seletor dentro do imóvel) ----------------
export async function buscarProprietarios(q: string): Promise<Proprietario[]> {
  const eu = await exigirEquipe();
  const termo = String(q ?? '').trim().slice(0, 80);
  if (termo.length < 2) return [];
  const d = termo.replace(/\D/g, '');
  const v = visiveis(eu, 3);
  const rows = await query<Row>(
    `select o.*, (select count(*) from property_proprietarios pp where pp.proprietario_id = o.id) as imoveis from proprietarios o
      where (translate(lower(o.nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like $1
         or ($2 <> '' and (o.documento like $2 || '%' or o.whatsapp like '%' || $2 || '%'))) and ${v.sql}
      order by imoveis desc, o.nome limit 15`,
    [`%${semAcento(termo)}%`, d.length >= 4 ? d : '', ...v.params]
  );
  return rows.map(mapProprietario);
}

// ---------------- lista da tela Proprietários ----------------
export async function listarProprietarios(): Promise<Proprietario[]> {
  const eu = await exigirEquipe();
  const v = visiveis(eu, 1);
  const rows = await query<Row>(
    `select o.*, (select count(*) from property_proprietarios pp where pp.proprietario_id = o.id) as imoveis
       from proprietarios o where ${v.sql} order by o.nome limit 5000`,
    v.params
  );
  return rows.map(mapProprietario);
}

export type ImovelDoProprietario = { id: string; titulo: string; condominio: string | null; bairro: string | null; preco: number | null; principal: boolean };

export async function lerProprietario(id: string): Promise<{ proprietario: Proprietario; imoveis: ImovelDoProprietario[] } | null> {
  await podeMexer(id);
  const r = await query<Row>('select o.* from proprietarios o where o.id = $1::uuid', [id]);
  if (!r[0]) return null;
  const im = await query<{ id: string; titulo: string | null; tipo_unidade: string; condominio: string | null; dname: string | null; bairro: string | null; price_value: string | null; principal: boolean; area: string | null }>(
    `select p.id, p.titulo, p.tipo_unidade, p.condominio, d.name as dname, p.bairro, p.price_value, p.area, pp.principal
       from property_proprietarios pp join properties p on p.id = pp.property_id left join developments d on d.id = p.empreendimento_id
      where pp.proprietario_id = $1::uuid order by p.created_at desc`,
    [id]
  );
  return {
    proprietario: mapProprietario(r[0]),
    imoveis: im.map((i) => ({
      id: i.id,
      titulo: i.titulo || [i.tipo_unidade?.replace(/_/g, ' '), i.area ? `${Math.round(Number(i.area))} m²` : null].filter(Boolean).join(', '),
      condominio: i.dname || i.condominio,
      bairro: i.bairro,
      preco: i.price_value ? Number(i.price_value) : null,
      principal: !!i.principal
    }))
  };
}

// ---------------- salvar (novo ou edição) ----------------
export type ProprietarioInput = Pick<Proprietario, 'tipo' | 'nome'> & Partial<Omit<Proprietario, 'id' | 'imoveis' | 'tipo' | 'nome'>> & { id?: string };

const limparConjuge = (c?: Conjuge | null): Conjuge | null => {
  const nome = t(c?.nome, 160);
  if (!nome) return null;
  return {
    nome,
    documento: dig(c?.documento, 11),
    rg: t(c?.rg, 30),
    nascimento: data(c?.nascimento),
    profissao: t(c?.profissao, 80),
    nacionalidade: t(c?.nacionalidade, 40),
    telefone: dig(c?.telefone, 13),
    email: t(c?.email, 160)
  };
};

export async function salvarProprietario(p: ProprietarioInput): Promise<{ ok: true; proprietario: Proprietario } | { ok: false; erro: string }> {
  const eu = p.id ? await podeMexer(p.id) : await exigirEquipe();
  const nome = t(p.nome, 160);
  if (!nome) return { ok: false, erro: 'Informe o nome do proprietário.' };
  const documento = dig(p.documento, 14);
  // mesmo CPF/CNPJ já cadastrado: usa o existente (não duplica)
  if (documento) {
    const ja = await query<Row>('select * from proprietarios where documento = $1 and ($2::uuid is null or id <> $2::uuid) limit 1', [documento, p.id ?? null]);
    if (ja[0]) {
      if (!p.id) return { ok: true, proprietario: mapProprietario(ja[0]) };
      return { ok: false, erro: `Este ${documento.length > 11 ? 'CNPJ' : 'CPF'} já é de outro proprietário cadastrado (${ja[0].nome}).` };
    }
  }
  const vals = [
    p.tipo === 'pj' ? 'pj' : 'pf',
    nome,
    documento,
    dig(p.whatsapp, 13),
    t(p.email, 160)?.toLowerCase() ?? null,
    dig(p.cep, 8),
    t(p.endereco, 200),
    t(p.bairro, 100),
    t(p.cidade, 100),
    t(p.uf, 2)?.toUpperCase() ?? null,
    p.empresaId && /^[0-9a-f-]{36}$/i.test(p.empresaId) ? p.empresaId : null,
    t(p.observacao, 2000),
    t(p.rg, 30),
    data(p.nascimento),
    t(p.estadoCivil, 40),
    t(p.regimeBens, 60),
    t(p.profissao, 80),
    t(p.nacionalidade, 40),
    t(p.representante, 200),
    JSON.stringify(limparConjuge(p.conjuge))
  ];
  const r = p.id
    ? await query<Row>(
        `update proprietarios set tipo=$2, nome=$3, documento=$4, whatsapp=$5, email=$6, cep=$7, endereco=$8, bairro=$9, cidade=$10, uf=$11, empresa_id=$12,
                observacao=$13, rg=$14, nascimento=$15, estado_civil=$16, regime_bens=$17, profissao=$18, nacionalidade=$19, representante=$20,
                conjuge=$21::jsonb, updated_at=now() where id = $1::uuid returning *`,
        [p.id, ...vals]
      )
    : await query<Row>(
        `insert into proprietarios (tipo, nome, documento, whatsapp, email, cep, endereco, bairro, cidade, uf, empresa_id, observacao,
                                    rg, nascimento, estado_civil, regime_bens, profissao, nacionalidade, representante, conjuge, criado_por)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21) returning *`,
        [...vals, eu.email]
      );
  if (!r[0]) return { ok: false, erro: 'Proprietário não encontrado.' };
  return { ok: true, proprietario: mapProprietario(r[0]) };
}

// ---------------- excluir ----------------
/** Exclui o proprietário. Os imóveis continuam no ar; só perdem o vínculo com ele. */
export async function excluirProprietario(id: string): Promise<{ ok: boolean; erro?: string }> {
  const eu = await podeMexer(id);
  if (!veTudo(eu.role)) {
    // corretor só exclui se nenhum imóvel de outro corretor depender desse cadastro
    const outros = await query(
      `select 1 from property_proprietarios pp join properties p on p.id = pp.property_id
        where pp.proprietario_id = $1::uuid and lower(coalesce(p.corretor_email, '')) <> lower($2) limit 1`,
      [id, eu.email]
    );
    if (outros.length) return { ok: false, erro: 'Este proprietário também está em imóveis de outros corretores. Peça a um administrador para excluir.' };
  }
  await query('delete from property_proprietarios where proprietario_id = $1::uuid', [id]);
  await query('delete from proprietarios where id = $1::uuid', [id]);
  return { ok: true };
}

// ---------------- vincular imóveis ----------------
/** Liga vários imóveis já cadastrados a este proprietário (sem tirar os outros donos do imóvel). */
export async function vincularImoveis(proprietarioId: string, propertyIds: string[]): Promise<{ ok: true; vinculados: number } | { ok: false; erro: string }> {
  const eu = await podeMexer(proprietarioId);
  const ids = Array.from(new Set((Array.isArray(propertyIds) ? propertyIds : []).filter((x) => typeof x === 'string' && x.length <= 80))).slice(0, 500);
  if (!ids.length) return { ok: true, vinculados: 0 };
  // corretor só vincula imóveis dele
  const permitidos = await query<{ id: string; tem_dono: boolean }>(
    `select p.id, exists (select 1 from property_proprietarios x where x.property_id = p.id) as tem_dono
       from properties p where p.id = any($1::text[]) and not p.is_tipologia ${veTudo(eu.role) ? '' : 'and lower(p.corretor_email) = lower($2)'}`,
    veTudo(eu.role) ? [ids] : [ids, eu.email]
  );
  let n = 0;
  for (const p of permitidos) {
    const r = await query(
      `insert into property_proprietarios (property_id, proprietario_id, principal, ordem)
       values ($1, $2::uuid, $3, coalesce((select max(ordem) + 1 from property_proprietarios where property_id = $1), 0))
       on conflict do nothing returning 1`,
      [p.id, proprietarioId, !p.tem_dono]
    ).catch(() => []);
    n += r.length;
  }
  return { ok: true, vinculados: n };
}

export async function desvincularImovel(proprietarioId: string, propertyId: string): Promise<void> {
  const eu = await podeMexer(proprietarioId);
  if (!veTudo(eu.role)) {
    const r = await query<{ corretor_email: string | null }>('select corretor_email from properties where id = $1', [propertyId]);
    if ((r[0]?.corretor_email ?? '').toLowerCase() !== eu.email.toLowerCase()) throw new Error('Sem permissão para este imóvel.');
  }
  await query('delete from property_proprietarios where proprietario_id = $1::uuid and property_id = $2', [proprietarioId, propertyId]);
  // se tirou o principal, o próximo vira principal
  await query(
    `update property_proprietarios set principal = true where property_id = $1 and proprietario_id =
       (select proprietario_id from property_proprietarios where property_id = $1 order by ordem limit 1)
       and not exists (select 1 from property_proprietarios where property_id = $1 and principal)`,
    [propertyId]
  );
}

// ---------------- importar planilha ----------------
export type ProprietarioPlanilhaLinha = { nome: string; documento?: string; telefone?: string; email?: string };

/**
 * Cadastra os proprietários de uma planilha (nome obrigatório; CPF, telefone e e-mail se tiver).
 * Não duplica: mesmo CPF/CNPJ, ou mesmo nome com mesmo telefone, completa só o que estiver vazio.
 */
export async function importarProprietariosPlanilha(
  linhas: ProprietarioPlanilhaLinha[]
): Promise<{ criados: number; completados: number; iguais: number; ignorados: number }> {
  const eu = await exigirEquipe();
  const res = { criados: 0, completados: 0, iguais: 0, ignorados: 0 };
  for (const l of (Array.isArray(linhas) ? linhas : []).slice(0, 5000)) {
    const nome = t(l?.nome, 160);
    if (!nome) {
      res.ignorados++;
      continue;
    }
    // Excel guarda CPF/CNPJ como número e perde os zeros da frente: devolve os zeros
    let doc = dig(l.documento, 14);
    if (doc && doc.length >= 8 && doc.length <= 10) doc = doc.padStart(11, '0');
    else if (doc && doc.length >= 12 && doc.length <= 13) doc = doc.padStart(14, '0');
    else if (doc && doc.length < 8) doc = null;
    const tel = dig(l.telefone, 13);
    const email = t(l.email, 160)?.toLowerCase() ?? null;
    const ja = await query<{ id: string; documento: string | null; whatsapp: string | null; email: string | null }>(
      `select id, documento, whatsapp, email from proprietarios
        where ($1::text is not null and documento = $1)
           or ($1::text is null and $2::text is not null and whatsapp = $2 and translate(lower(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = $3)
        limit 1`,
      [doc, tel, semAcento(nome)]
    );
    if (ja[0]) {
      const falta = (!ja[0].documento && doc) || (!ja[0].whatsapp && tel) || (!ja[0].email && email);
      if (falta) {
        await query(
          'update proprietarios set documento = coalesce(documento, $2), whatsapp = coalesce(whatsapp, $3), email = coalesce(email, $4), updated_at = now() where id = $1::uuid',
          [ja[0].id, doc, tel, email]
        );
        res.completados++;
      } else res.iguais++;
      continue;
    }
    await query('insert into proprietarios (tipo, nome, documento, whatsapp, email, criado_por) values ($1, $2, $3, $4, $5, $6)', [
      doc && doc.length > 11 ? 'pj' : 'pf',
      nome,
      doc,
      tel,
      email,
      eu.email
    ]);
    res.criados++;
  }
  return res;
}

// ---------------- dados do imóvel ----------------
export async function lerProprietariosDoImovel(propertyId: string): Promise<ProprietarioDoImovel[]> {
  await exigirEquipe();
  return (await proprietariosDoImovel([propertyId])).get(propertyId) ?? [];
}
