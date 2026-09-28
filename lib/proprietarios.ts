// Proprietários (vendedores) dos imóveis — cadastro único, reaproveitado em vários
// imóveis e nas propostas. Só do servidor; dados nunca vão para páginas públicas.
import { query } from './db';

export type Proprietario = {
  id: string;
  tipo: 'pf' | 'pj';
  nome: string;
  documento: string | null;
  whatsapp: string | null;
  email: string | null;
  cep: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  empresaId: string | null;
  observacao: string | null;
  imoveis?: number;
};
export type ProprietarioDoImovel = Proprietario & { principal: boolean };

type Row = {
  id: string;
  tipo: string;
  nome: string;
  documento: string | null;
  whatsapp: string | null;
  email: string | null;
  cep: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  empresa_id: string | null;
  observacao: string | null;
  imoveis?: string | number | null;
  principal?: boolean;
};
export const mapProprietario = (r: Row): Proprietario => ({
  id: r.id,
  tipo: r.tipo === 'pj' ? 'pj' : 'pf',
  nome: r.nome,
  documento: r.documento,
  whatsapp: r.whatsapp,
  email: r.email,
  cep: r.cep,
  endereco: r.endereco,
  bairro: r.bairro,
  cidade: r.cidade,
  uf: r.uf,
  empresaId: r.empresa_id,
  observacao: r.observacao,
  imoveis: r.imoveis != null ? Number(r.imoveis) : undefined
});

export async function proprietariosDoImovel(propertyIds: string[]): Promise<Map<string, ProprietarioDoImovel[]>> {
  const m = new Map<string, ProprietarioDoImovel[]>();
  if (!propertyIds.length) return m;
  const rows = await query<Row & { property_id: string }>(
    `select pp.property_id, pp.principal, o.* from property_proprietarios pp join proprietarios o on o.id = pp.proprietario_id
      where pp.property_id = any($1::text[]) order by pp.principal desc, pp.ordem, o.nome`,
    [propertyIds]
  ).catch(() => []);
  for (const r of rows) {
    const l = m.get(r.property_id) ?? [];
    l.push({ ...mapProprietario(r), principal: !!r.principal });
    m.set(r.property_id, l);
  }
  return m;
}

/** Substitui a lista de proprietários do imóvel (quem chama já conferiu a permissão) */
export async function gravarProprietariosDoImovel(propertyId: string, itens: { proprietarioId: string; principal: boolean }[]): Promise<void> {
  const vistos = new Set<string>();
  const limpos = itens.filter((i) => /^[0-9a-f-]{36}$/i.test(i.proprietarioId) && !vistos.has(i.proprietarioId) && vistos.add(i.proprietarioId));
  if (limpos.length && !limpos.some((i) => i.principal)) limpos[0].principal = true;
  await query('delete from property_proprietarios where property_id = $1', [propertyId]);
  for (const [ordem, i] of limpos.entries()) {
    await query('insert into property_proprietarios (property_id, proprietario_id, principal, ordem) values ($1, $2::uuid, $3, $4)', [
      propertyId,
      i.proprietarioId,
      !!i.principal,
      ordem
    ]);
  }
}
