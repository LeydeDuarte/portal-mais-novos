'use server';

import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { query } from './db';
import { mapPropertyRow, mapDevelopmentRow, type PropertyRow, type DevelopmentRow } from './db-mappers';
import { signSession, verifySession, type StaffSessionPayload } from './session';
import type { PropertyDetail, Development } from './property-details';
import type { FilterState } from './filters';
import type { TipoUnidade } from './tipologias';

const PAGE_SIZE = 12;
const STAFF_COOKIE = 'mn_staff';

// ---------------- Feed (Comprar) — leitura paginada e filtrada ----------------
// Paginação por offset por enquanto — funciona bem no tamanho atual do
// catálogo. Trocar por paginação por cursor (created_at + id) antes do
// catálogo chegar a dezenas de milhares de linhas, conforme já registrado
// no documento de arquitetura ("Performance em escala").
export async function getFeedPage(page: number, filters: FilterState): Promise<{ items: PropertyDetail[]; hasMore: boolean }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const add = (clause: string, value: unknown) => {
    params.push(value);
    conditions.push(clause.replace('?', `$${params.length}`));
  };

  if (filters.finalidade !== 'todas') add('finalidade = ?', filters.finalidade);
  if (filters.tipoUnidade !== 'todas') add('tipo_unidade = ?', filters.tipoUnidade);
  if (filters.precoMax !== 'todas') add('price_value <= ?', filters.precoMax);
  if (filters.quartosMin !== 'todas') add('quartos >= ?', filters.quartosMin);
  if (filters.vagasMin !== 'todas') add('vagas >= ?', filters.vagasMin);
  if (filters.aceitaTemporada === 'sim') conditions.push('aceita_temporada = true');
  if (filters.situacao === 'lancamento') conditions.push('delivery_date > now()');
  if (filters.situacao === 'seminovo') conditions.push("delivery_date <= now() and delivery_date > now() - interval '5 years'");
  if (filters.situacao === 'usado') conditions.push("delivery_date <= now() - interval '5 years'");

  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  params.push(PAGE_SIZE + 1, page * PAGE_SIZE);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const rows = await query<PropertyRow>(
    `select * from properties ${where} order by created_at desc, id desc limit $${limitIdx} offset $${offsetIdx}`,
    params
  );

  const hasMore = rows.length > PAGE_SIZE;
  return { items: rows.slice(0, PAGE_SIZE).map(mapPropertyRow), hasMore };
}

export async function getPropertyById(id: string): Promise<PropertyDetail | null> {
  const rows = await query<PropertyRow>('select * from properties where id = $1', [id]);
  return rows[0] ? mapPropertyRow(rows[0]) : null;
}

export async function getDevelopmentById(id: string): Promise<Development | null> {
  const devRows = await query<DevelopmentRow>('select * from developments where id = $1', [id]);
  if (!devRows[0]) return null;
  const unitRows = await query<PropertyRow>(
    'select * from properties where empreendimento_id = $1 order by area asc nulls last',
    [id]
  );
  return mapDevelopmentRow(devRows[0], unitRows.map(mapPropertyRow));
}

export async function getAllDevelopments(): Promise<Development[]> {
  const devRows = await query<DevelopmentRow>('select * from developments order by delivery_date asc');
  const results: Development[] = [];
  for (const dev of devRows) {
    const unitRows = await query<PropertyRow>('select * from properties where empreendimento_id = $1', [dev.id]);
    results.push(mapDevelopmentRow(dev, unitRows.map(mapPropertyRow)));
  }
  return results;
}

export async function getPropertiesByCorretor(email: string, isAdmin: boolean): Promise<PropertyDetail[]> {
  const rows = isAdmin
    ? await query<PropertyRow>('select * from properties where corretor_email is not null order by created_at desc')
    : await query<PropertyRow>('select * from properties where corretor_email = $1 order by created_at desc', [email]);
  return rows.map(mapPropertyRow);
}

export async function getAllPropertyIds(): Promise<string[]> {
  const rows = await query<{ id: string }>('select id from properties');
  return rows.map((r) => r.id);
}

export async function getAllDevelopmentIds(): Promise<string[]> {
  const rows = await query<{ id: string }>('select id from developments');
  return rows.map((r) => r.id);
}

// ---------------- Cadastro (painel) — escrita ----------------
export type CreatePropertyInput = {
  id: string;
  titulo?: string;
  tipoUnidade: TipoUnidade;
  finalidade: 'venda' | 'aluguel';
  deliveryDate: string; // "AAAA-MM"
  priceValue: number;
  pricePeriod: 'unico' | 'mensal';
  location: string;
  quartos?: number;
  vagas?: number;
  banheiros?: number;
  escaninhos?: number;
  area?: number;
  video: boolean;
  videoUrl?: string;
  aceitaTemporada: boolean;
  description: string;
  amenities: string[];
  empreendimentoId?: string;
  corretorEmail: string;
};

export async function createProperty(input: CreatePropertyInput): Promise<void> {
  await query(
    `insert into properties
      (id, titulo, tipo_unidade, finalidade, delivery_date, price_value, price_period, location, quartos, vagas, banheiros, escaninhos, area, video, video_url, aceita_temporada, match_score, description, amenities, empreendimento_id, corretor_email)
     values ($1,$2,$3,$4,$5::date,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,50,$17,$18::jsonb,$19,$20)`,
    [
      input.id,
      input.titulo ?? null,
      input.tipoUnidade,
      input.finalidade,
      `${input.deliveryDate}-01`,
      input.priceValue,
      input.pricePeriod,
      input.location,
      input.quartos ?? null,
      input.vagas ?? null,
      input.banheiros ?? null,
      input.escaninhos ?? null,
      input.area ?? null,
      input.video,
      input.videoUrl ?? null,
      input.aceitaTemporada,
      input.description,
      JSON.stringify(input.amenities),
      input.empreendimentoId ?? null,
      input.corretorEmail
    ]
  );
}

export type CreateDevelopmentInput = {
  id: string;
  name: string;
  location: string;
  deliveryDate: string;
  description: string;
  tipo: 'vertical' | 'horizontal';
  pavimentos?: number;
  areaTerreno?: string;
  amenities: string[];
  aceitaTemporada: boolean;
  videoUrl?: string;
  corretorEmail: string;
  heroHeight?: number;
};

export async function createDevelopment(input: CreateDevelopmentInput): Promise<void> {
  await query(
    `insert into developments
      (id, name, location, delivery_date, description, tipo, pavimentos, area_terreno, amenities, aceita_temporada, hero_height, video_url, corretor_email)
     values ($1,$2,$3,$4::date,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13)`,
    [
      input.id,
      input.name,
      input.location,
      `${input.deliveryDate}-01`,
      input.description,
      input.tipo,
      input.pavimentos ?? null,
      input.areaTerreno ?? null,
      JSON.stringify(input.amenities),
      input.aceitaTemporada,
      input.heroHeight ?? 300,
      input.videoUrl ?? null,
      input.corretorEmail
    ]
  );
}

export async function deleteProperty(id: string): Promise<void> {
  await query('delete from properties where id = $1', [id]);
}

// ---------------- Login da equipe ----------------
export async function staffLogin(email: string, password: string): Promise<StaffSessionPayload | null> {
  const rows = await query<{ email: string; name: string; role: 'admin' | 'corretor'; password_hash: string }>(
    'select email, name, role, password_hash from staff_users where email = $1',
    [email]
  );
  const user = rows[0];
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  const payload: StaffSessionPayload = { email: user.email, name: user.name, role: user.role };
  cookies().set(STAFF_COOKIE, signSession(payload), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });
  return payload;
}

export async function staffLogout(): Promise<void> {
  cookies().delete(STAFF_COOKIE);
}

export async function getStaffSession(): Promise<StaffSessionPayload | null> {
  return verifySession(cookies().get(STAFF_COOKIE)?.value);
}
