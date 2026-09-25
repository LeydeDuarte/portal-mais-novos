'use server';

import crypto from 'crypto';
import { cookies } from 'next/headers';
import { query } from './db';
import { verificarAssinado, veTudo } from './session';
import { exigirEquipe } from './staff-auth';
import type { MarketReference } from './market-mock';
import type { TipoUnidade } from './tipologias';

// Favoritos e leads de captação — antes ficavam no localStorage do navegador,
// agora ficam no Neon (tabelas `favorites` e `market_leads`).

const VISITOR_COOKIE = 'mn_visitor';
const STAFF_COOKIE = 'mn_staff';

// ---------------- Favoritos ----------------
// Enquanto não existe login de cliente com Google, o favorito fica ligado a
// um identificador anônimo do visitante (cookie httpOnly de 1 ano), gravado
// na coluna `user_email` com o prefixo "visitor:". Quando o login com Google
// entrar, basta trocar esse identificador pelo e-mail da pessoa (um UPDATE
// de "visitor:xxx" para o e-mail) e os favoritos vão junto.
function getVisitorKey(createIfMissing: boolean): string | null {
  const jar = cookies();
  // Cliente logado com Google: favoritos ficam no e-mail dele
  const cliente = verificarAssinado<{ email: string }>(jar.get('mn_cliente')?.value);
  if (cliente?.email) return cliente.email;
  let id = jar.get(VISITOR_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    if (!createIfMissing) return null;
    id = crypto.randomUUID();
    jar.set(VISITOR_COOKIE, id, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365
    });
  }
  return `visitor:${id}`;
}

export async function getMyFavorites(): Promise<string[]> {
  const key = getVisitorKey(false);
  if (!key) return [];
  const rows = await query<{ property_id: string }>(
    'select property_id from favorites where user_email = $1 order by created_at desc',
    [key]
  );
  return rows.map((r) => r.property_id);
}

export async function setFavorite(propertyId: string, favorite: boolean): Promise<void> {
  const key = getVisitorKey(true)!;
  if (favorite) {
    // "where exists" evita erro de chave estrangeira se o imóvel já foi excluído
    await query(
      `insert into favorites (user_email, property_id)
       select $1, $2 where exists (select 1 from properties where id = $2)
       on conflict do nothing`,
      [key, propertyId]
    );
  } else {
    await query('delete from favorites where user_email = $1 and property_id = $2', [key, propertyId]);
  }
}

// Migração única: favoritos que a pessoa já tinha salvos no navegador sobem
// para o banco na primeira visita depois desta atualização.
export async function importFavorites(propertyIds: string[]): Promise<void> {
  const ids = (Array.isArray(propertyIds) ? propertyIds : []).filter((id) => typeof id === 'string' && id.length <= 80).slice(0, 200);
  if (!ids.length) return;
  const key = getVisitorKey(true)!;
  await query(
    `insert into favorites (user_email, property_id)
     select $1, p.id from properties p where p.id = any($2::text[])
     on conflict do nothing`,
    [key, ids]
  );
}

// ---------------- Leads de captação (painel de monitoramento) ----------------
export type MarketLeadStatus = 'novo' | 'contatado' | 'descartado';

export type MarketLead = MarketReference & {
  leadId: string;
  corretorEmail: string | null;
  criadoEm: string;
  status: MarketLeadStatus;
};

type MarketLeadRow = {
  id: string;
  ref_id: string | null;
  cidade: string;
  bairro: string;
  tipo_unidade: string;
  preco_aproximado: string;
  area_aproximada: string;
  quartos: string | null;
  fonte: string;
  observacao: string | null;
  corretor_email: string | null;
  status: MarketLeadStatus;
  created_at: string | Date;
};

function mapLead(row: MarketLeadRow): MarketLead {
  return {
    id: row.ref_id ?? row.id,
    cidade: row.cidade,
    bairro: row.bairro,
    tipoUnidade: row.tipo_unidade as TipoUnidade,
    precoAproximado: row.preco_aproximado,
    areaAproximada: row.area_aproximada,
    quartos: row.quartos ?? '-',
    fonte: row.fonte,
    observacao: row.observacao ?? '',
    leadId: row.id,
    corretorEmail: row.corretor_email,
    criadoEm: new Date(row.created_at).toISOString(),
    status: row.status
  };
}

const requireStaff = exigirEquipe;

const STATUSES: MarketLeadStatus[] = ['novo', 'contatado', 'descartado'];

// Admin vê os leads de toda a equipe; corretor vê só os seus.
export async function getMarketLeads(): Promise<MarketLead[]> {
  const staff = await requireStaff();
  const rows =
    veTudo(staff.role)
      ? await query<MarketLeadRow>('select * from market_leads order by created_at desc')
      : await query<MarketLeadRow>('select * from market_leads where corretor_email = $1 order by created_at desc', [staff.email]);
  return rows.map(mapLead);
}

// Lista de referências que já viraram lead para QUALQUER corretor — evita que
// dois corretores da equipe tentem captar o mesmo imóvel.
export async function getTakenReferenceIds(): Promise<string[]> {
  await requireStaff();
  const rows = await query<{ ref_id: string }>('select ref_id from market_leads where ref_id is not null');
  return rows.map((r) => r.ref_id);
}

export async function addMarketLead(ref: MarketReference): Promise<MarketLead | null> {
  const staff = await requireStaff(); // e-mail do corretor vem da sessão, nunca do navegador
  const rows = await query<MarketLeadRow>(
    `insert into market_leads
      (ref_id, cidade, bairro, tipo_unidade, preco_aproximado, area_aproximada, quartos, fonte, observacao, corretor_email)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict (ref_id) do nothing
     returning *`,
    [
      ref.id,
      ref.cidade,
      ref.bairro,
      ref.tipoUnidade,
      ref.precoAproximado,
      ref.areaAproximada,
      ref.quartos === '-' ? null : ref.quartos,
      ref.fonte,
      ref.observacao || null,
      staff.email
    ]
  );
  return rows[0] ? mapLead(rows[0]) : null;
}

export async function updateMarketLeadStatus(leadId: string, status: MarketLeadStatus): Promise<void> {
  const staff = await requireStaff();
  if (!STATUSES.includes(status)) throw new Error('Status inválido.');
  if (veTudo(staff.role)) {
    await query('update market_leads set status = $1 where id = $2::uuid', [status, leadId]);
  } else {
    await query('update market_leads set status = $1 where id = $2::uuid and corretor_email = $3', [status, leadId, staff.email]);
  }
}

// Imóveis favoritados (só os que continuam publicados)
export async function getMyFavoriteProperties(): Promise<import('./property-details').PropertyDetail[]> {
  const key = getVisitorKey(false);
  if (!key) return [];
  const { mapPropertyRow } = await import('./db-mappers');
  const rows = await query<import('./db-mappers').PropertyRow>(
    `select p.* from favorites f join properties p on p.id = f.property_id
      where f.user_email = $1 and p.visibilidade = 'publico' order by f.created_at desc`,
    [key]
  );
  return rows.map(mapPropertyRow);
}
