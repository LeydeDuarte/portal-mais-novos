'use server';

// Links de anúncio PRIVADO presos ao aparelho.
// - A equipe gera um link para o TELEFONE de um cliente (Painel → Imóveis → Enviar link privado).
// - O primeiro aparelho que abrir o link fica "dono" dele (até 1 ou 2 aparelhos, conforme escolhido).
// - Repassado para outra pessoa, o link não abre: ela vê o resumo e pede acesso ao atendimento.
// O aparelho é reconhecido pelo cookie mn_dev (criado no middleware). A ligação ao
// aparelho só acontece quando a página roda no navegador (JavaScript) — assim a
// prévia do WhatsApp, que só lê o HTML, não "gasta" o link.
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { query } from './db';
import { mapPropertyRow, type PropertyRow } from './db-mappers';
import { verifySession, veTudo } from './session';
import { SITE_URL } from './seo';
import type { PropertyDetail } from './property-details';

const DEV_COOKIE = 'mn_dev';

function equipe() {
  const s = verifySession(cookies().get('mn_staff')?.value);
  if (!s) throw new Error('Sessão da equipe expirada — faça login novamente no painel.');
  return s;
}
async function podeMexer(propertyId: string) {
  const s = equipe();
  if (veTudo(s.role)) return s;
  const r = await query<{ corretor_email: string | null }>('select corretor_email from properties where id = $1', [propertyId]);
  if (r[0]?.corretor_email !== s.email) throw new Error('Você só pode enviar links dos imóveis que cadastrou.');
  return s;
}

const soDigitos = (t: string) => t.replace(/\D/g, '');
function formatarTelefone(d: string): string {
  const n = d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return n;
}

export type LinkPrivado = {
  id: string;
  url: string;
  telefone: string;
  nome: string | null;
  criadoEm: string;
  criadoPor: string | null;
  maxAparelhos: number;
  aparelhosUsados: number;
  aberturas: number;
  bloqueios: number;
  ultimoAcesso: string | null;
  revogado: boolean;
};

type Row = {
  id: string;
  property_id: string;
  telefone: string;
  nome: string | null;
  criado_em: Date;
  criado_por: string | null;
  max_aparelhos: number;
  aparelhos: string[];
  aberturas: number;
  bloqueios: number;
  ultimo_acesso: Date | null;
  revogado: boolean;
};

const urlDo = (propertyId: string, id: string) => `${SITE_URL}/imovel/${propertyId}?l=${id}`;
const mapear = (r: Row): LinkPrivado => ({
  id: r.id,
  url: urlDo(r.property_id, r.id),
  telefone: formatarTelefone(r.telefone),
  nome: r.nome,
  criadoEm: new Date(r.criado_em).toISOString(),
  criadoPor: r.criado_por,
  maxAparelhos: r.max_aparelhos,
  aparelhosUsados: Array.isArray(r.aparelhos) ? r.aparelhos.length : 0,
  aberturas: r.aberturas,
  bloqueios: r.bloqueios,
  ultimoAcesso: r.ultimo_acesso ? new Date(r.ultimo_acesso).toISOString() : null,
  revogado: r.revogado
});

export async function criarLinkPrivado(
  propertyId: string,
  dados: { telefone: string; nome?: string; maxAparelhos?: number }
): Promise<{ ok: true; link: LinkPrivado } | { ok: false; erro: string }> {
  const s = await podeMexer(propertyId);
  const tel = soDigitos(dados.telefone);
  if (tel.length < 10) return { ok: false, erro: 'Informe o telefone (com DDD) de quem vai receber o link.' };
  const max = dados.maxAparelhos === 2 ? 2 : 1;
  const id = crypto.randomBytes(12).toString('base64url');
  const rows = await query<Row>(
    `insert into links_privados (id, property_id, telefone, nome, criado_por, max_aparelhos) values ($1, $2, $3, $4, $5, $6) returning *`,
    [id, propertyId, tel, dados.nome?.trim() || null, s.email, max]
  );
  return { ok: true, link: mapear(rows[0]) };
}

export async function listarLinksPrivados(propertyId: string): Promise<LinkPrivado[]> {
  await podeMexer(propertyId);
  const rows = await query<Row>('select * from links_privados where property_id = $1 order by criado_em desc limit 50', [propertyId]);
  return rows.map(mapear);
}

export async function revogarLinkPrivado(linkId: string): Promise<void> {
  const r = await query<{ property_id: string }>('select property_id from links_privados where id = $1', [linkId]);
  if (!r[0]) return;
  await podeMexer(r[0].property_id);
  await query('update links_privados set revogado = true where id = $1', [linkId]);
}

export type AberturaLink =
  | { estado: 'ok'; property: PropertyDetail; marcaDagua: string }
  | { estado: 'ativar' }
  | { estado: 'bloqueado' }
  | { estado: 'invalido' };

/** Chamado pela página do imóvel (no servidor): diz se ESTE aparelho pode ver o anúncio */
export async function verificarLinkPrivado(propertyId: string, linkId: string): Promise<AberturaLink> {
  const rows = await query<Row>('select * from links_privados where id = $1 and property_id = $2', [linkId, propertyId]);
  const l = rows[0];
  if (!l || l.revogado) return { estado: 'invalido' };
  const dev = cookies().get(DEV_COOKIE)?.value;
  const aparelhos = Array.isArray(l.aparelhos) ? l.aparelhos : [];
  if (dev && aparelhos.includes(dev)) {
    const p = await query<PropertyRow>('select * from properties where id = $1', [propertyId]);
    if (!p[0]) return { estado: 'invalido' };
    await query('update links_privados set aberturas = aberturas + 1, ultimo_acesso = now() where id = $1', [linkId]);
    return {
      estado: 'ok',
      property: mapPropertyRow(p[0]),
      marcaDagua: `Mais Novos Imóveis · exclusivo ${l.nome ? `${l.nome} ` : ''}${formatarTelefone(l.telefone)}`
    };
  }
  if (aparelhos.length < l.max_aparelhos) return { estado: 'ativar' };
  await query('update links_privados set bloqueios = bloqueios + 1 where id = $1', [linkId]);
  return { estado: 'bloqueado' };
}

/** Chamado pelo navegador (JavaScript) na primeira abertura: prende o link a este aparelho */
export async function ativarLinkPrivado(propertyId: string, linkId: string): Promise<boolean> {
  const dev = cookies().get(DEV_COOKIE)?.value;
  if (!dev) return false;
  const rows = await query<{ id: string }>(
    `update links_privados set aparelhos = aparelhos || to_jsonb($3::text)
      where id = $1 and property_id = $2 and not revogado
        and not (aparelhos ? $3::text) and jsonb_array_length(aparelhos) < max_aparelhos
      returning id`,
    [linkId, propertyId, dev]
  );
  if (rows.length) return true;
  const ja = await query<{ id: string }>('select id from links_privados where id = $1 and aparelhos ? $2::text', [linkId, dev]);
  return ja.length > 0;
}
