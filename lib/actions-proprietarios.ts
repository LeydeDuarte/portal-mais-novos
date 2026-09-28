'use server';

// Painel: cadastro e busca de proprietários (vendedores). Uso interno da equipe.
import { query } from './db';
import { exigirEquipe } from './staff-auth';
import { mapProprietario, proprietariosDoImovel, type Proprietario, type ProprietarioDoImovel } from './proprietarios';

const t = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n) || null;
const dig = (v: unknown, n: number) => String(v ?? '').replace(/\D/g, '').slice(0, n) || null;

export async function buscarProprietarios(q: string): Promise<Proprietario[]> {
  await exigirEquipe();
  const termo = String(q ?? '').trim().slice(0, 80);
  if (termo.length < 2) return [];
  const d = termo.replace(/\D/g, '');
  const like = `%${termo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}%`;
  const rows = await query<Parameters<typeof mapProprietario>[0]>(
    `select o.*, (select count(*) from property_proprietarios pp where pp.proprietario_id = o.id) as imoveis from proprietarios o
      where translate(lower(o.nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like $1
         or ($2 <> '' and (o.documento like $2 || '%' or o.whatsapp like '%' || $2 || '%'))
      order by imoveis desc, o.nome limit 15`,
    [like, d.length >= 4 ? d : '']
  );
  return rows.map(mapProprietario);
}

export type ProprietarioInput = Omit<Proprietario, 'id' | 'imoveis'> & { id?: string };

export async function salvarProprietario(p: ProprietarioInput): Promise<{ ok: true; proprietario: Proprietario } | { ok: false; erro: string }> {
  const eu = await exigirEquipe();
  const nome = t(p.nome, 160);
  if (!nome) return { ok: false, erro: 'Informe o nome do proprietário.' };
  const documento = dig(p.documento, 14);
  // mesmo CPF/CNPJ já cadastrado: usa o existente (não duplica)
  if (!p.id && documento) {
    const ja = await query<Parameters<typeof mapProprietario>[0]>('select * from proprietarios where documento = $1 limit 1', [documento]);
    if (ja[0]) return { ok: true, proprietario: mapProprietario(ja[0]) };
  }
  const vals = [
    p.tipo === 'pj' ? 'pj' : 'pf',
    nome,
    documento,
    dig(p.whatsapp, 13),
    t(p.email, 160),
    dig(p.cep, 8),
    t(p.endereco, 200),
    t(p.bairro, 100),
    t(p.cidade, 100),
    t(p.uf, 2)?.toUpperCase() ?? null,
    p.empresaId && /^[0-9a-f-]{36}$/i.test(p.empresaId) ? p.empresaId : null,
    t(p.observacao, 2000)
  ];
  const r = p.id
    ? await query<Parameters<typeof mapProprietario>[0]>(
        `update proprietarios set tipo=$2, nome=$3, documento=$4, whatsapp=$5, email=$6, cep=$7, endereco=$8, bairro=$9, cidade=$10, uf=$11, empresa_id=$12,
                observacao=$13, updated_at=now() where id = $1::uuid returning *`,
        [p.id, ...vals]
      )
    : await query<Parameters<typeof mapProprietario>[0]>(
        `insert into proprietarios (tipo, nome, documento, whatsapp, email, cep, endereco, bairro, cidade, uf, empresa_id, observacao, criado_por)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
        [...vals, eu.email]
      );
  if (!r[0]) return { ok: false, erro: 'Proprietário não encontrado.' };
  return { ok: true, proprietario: mapProprietario(r[0]) };
}

export async function lerProprietariosDoImovel(propertyId: string): Promise<ProprietarioDoImovel[]> {
  await exigirEquipe();
  return (await proprietariosDoImovel([propertyId])).get(propertyId) ?? [];
}
