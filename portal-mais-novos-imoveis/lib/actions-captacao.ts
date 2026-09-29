'use server';

// "Venda seu imóvel": o proprietário deixa as características básicas e o contato;
// a equipe liga de volta. Painel → Quero vender.
import { query } from './db';
import { exigirEquipe } from './staff-auth';
import { dentroDoLimite, registrarUso, ipDoVisitante } from './limites';
import { TIPO_UNIDADE_LABEL } from './tipologias';
import { enviarEmail, emailConfigurado, emailLayout, escapeHtml } from './email';

export type CaptacaoInput = {
  nome: string;
  telefone: string;
  email?: string;
  cep?: string;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  condominio?: string;
  tipoUnidade?: string;
  quartos?: number | null;
  area?: number | null;
  valorPretendido?: number | null;
  finalidade?: 'venda' | 'aluguel' | 'venda_aluguel';
  observacoes?: string;
  aceite: boolean;
  site?: string; // armadilha para robôs (campo invisível): se vier preenchido, ignora
};

const t = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n) || null;
const num = (v: unknown, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < max ? n : null;
};

export async function registrarCaptacao(d: CaptacaoInput): Promise<{ ok: boolean; erro?: string }> {
  if (d.site) return { ok: true };
  const nome = t(d.nome, 100);
  const telefone = String(d.telefone ?? '').replace(/\D/g, '').slice(0, 13);
  if (!nome || nome.length < 2) return { ok: false, erro: 'Informe seu nome.' };
  if (telefone.length < 10) return { ok: false, erro: 'Informe um telefone com DDD.' };
  if (!d.aceite) return { ok: false, erro: 'Para continuar, autorize o contato da nossa equipe.' };
  const email = t(d.email, 160);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: 'E-mail inválido.' };
  const ip = ipDoVisitante();
  if (!(await dentroDoLimite(`captacao:${ip}`, 6, 60))) return { ok: false, erro: 'Muitos envios seguidos. Tente de novo mais tarde ou fale pelo WhatsApp.' };
  await registrarUso(`captacao:${ip}`);

  const tipo = d.tipoUnidade && d.tipoUnidade in TIPO_UNIDADE_LABEL ? d.tipoUnidade : null;
  const finalidade = ['venda', 'aluguel', 'venda_aluguel'].includes(String(d.finalidade)) ? d.finalidade : 'venda';
  await query(
    `insert into captacoes (nome, telefone, email, cep, logradouro, bairro, cidade, uf, condominio, tipo_unidade, quartos, area, valor_pretendido, finalidade, observacoes, ip)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [
      nome,
      telefone,
      email,
      String(d.cep ?? '').replace(/\D/g, '').slice(0, 8) || null,
      t(d.logradouro, 200),
      t(d.bairro, 100),
      t(d.cidade, 100),
      t(d.uf, 2)?.toUpperCase() ?? null,
      t(d.condominio, 120),
      tipo,
      num(d.quartos, 30),
      num(d.area, 1_000_000),
      num(d.valorPretendido, 10_000_000_000),
      finalidade,
      t(d.observacoes, 1500),
      ip
    ]
  );

  const equipe = process.env.EMAIL_EQUIPE;
  if (equipe && emailConfigurado()) {
    await enviarEmail(
      equipe.split(',').map((e) => e.trim()),
      `Quero vender: ${nome}`,
      emailLayout(
        'Novo proprietário querendo vender',
        `<p><strong>${escapeHtml(nome)}</strong> · ${escapeHtml(telefone)}${email ? ` · ${escapeHtml(email)}` : ''}</p>
         <p>${escapeHtml([tipo ? TIPO_UNIDADE_LABEL[tipo as keyof typeof TIPO_UNIDADE_LABEL] : null, d.condominio, d.bairro, d.cidade].filter(Boolean).join(' · '))}</p>
         <p>Veja no painel: Quero vender.</p>`
      )
    ).catch(() => false);
  }
  return { ok: true };
}

export type Captacao = {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  condominio: string | null;
  tipoUnidade: string | null;
  quartos: number | null;
  area: number | null;
  valorPretendido: number | null;
  finalidade: string;
  observacoes: string | null;
  status: 'novo' | 'contatado' | 'captado' | 'descartado';
  criadoEm: string;
};

export async function listarCaptacoes(): Promise<Captacao[]> {
  await exigirEquipe();
  const rows = await query<Record<string, unknown>>('select * from captacoes order by created_at desc limit 500');
  return rows.map((r) => ({
    id: String(r.id),
    nome: String(r.nome),
    telefone: String(r.telefone),
    email: (r.email as string) ?? null,
    cep: (r.cep as string) ?? null,
    logradouro: (r.logradouro as string) ?? null,
    bairro: (r.bairro as string) ?? null,
    cidade: (r.cidade as string) ?? null,
    uf: (r.uf as string) ?? null,
    condominio: (r.condominio as string) ?? null,
    tipoUnidade: (r.tipo_unidade as string) ?? null,
    quartos: r.quartos != null ? Number(r.quartos) : null,
    area: r.area != null ? Number(r.area) : null,
    valorPretendido: r.valor_pretendido != null ? Number(r.valor_pretendido) : null,
    finalidade: String(r.finalidade),
    observacoes: (r.observacoes as string) ?? null,
    status: r.status as Captacao['status'],
    criadoEm: new Date(r.created_at as string).toISOString()
  }));
}

export async function mudarStatusCaptacao(id: string, status: Captacao['status']): Promise<void> {
  await exigirEquipe();
  if (!['novo', 'contatado', 'captado', 'descartado'].includes(status)) return;
  await query('update captacoes set status = $2 where id = $1::uuid', [id, status]);
}
