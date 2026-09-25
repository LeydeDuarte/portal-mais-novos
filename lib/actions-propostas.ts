'use server';

// Propostas de compra — ferramenta INTERNA da equipe (nada disso é público).
// - Qualquer pessoa da equipe cria propostas para um anúncio, uma tipologia ou um
//   condomínio/empreendimento (várias propostas no mesmo imóvel, sem limite).
// - Corretor vê e edita só as propostas que ELE fez; admin e analista veem todas.
// - Documentos do comprador (RG/CNH, comprovante) são lidos só no navegador para
//   preencher os campos e NÃO são enviados nem guardados.
// - O vendedor (proprietário ou construtora/incorporadora) pode ficar guardado no
//   anúncio ou no condomínio: as próximas propostas já saem preenchidas.
import { query } from './db';
import { exigirEquipe } from './staff-auth';
import { veTudo } from './papeis';
import { cpfValido } from './leitura-documentos-servidor';

export type Pessoa = {
  nome: string;
  documento?: string; // CPF ou CNPJ
  rg?: string;
  nascimento?: string; // AAAA-MM-DD
  estadoCivil?: string;
  profissao?: string;
  telefone?: string;
  email?: string;
  cep?: string;
  endereco?: string; // rua + número/complemento
  bairro?: string;
  cidade?: string;
  uf?: string;
  representante?: string; // empresa: quem assina (nome e cargo)
};
export type Corretor = { nome: string; creci?: string; email?: string };

export type AlvoProposta = {
  tipo: 'imovel' | 'tipologia' | 'condominio';
  id: string; // properties.id ou developments.id
  developmentId: string | null;
  titulo: string; // descrição do imóvel que vai no documento
  valorAnunciado: number | null;
  vendedor: Pessoa | null; // vendedor guardado (do imóvel ou, se não tiver, do condomínio)
  vendedorOrigem: 'imovel' | 'condominio' | null;
};

export type Proposta = {
  id: string;
  numero: number;
  propertyId: string | null;
  developmentId: string | null;
  imovelTexto: string | null;
  unidade: string | null;
  comprador: Pessoa;
  vendedor: Pessoa | null;
  corretor: Corretor | null;
  valor: number;
  formas: string[];
  entrada: number | null;
  condicoes: string | null;
  validadeDias: number;
  status: 'nova' | 'em_analise' | 'enviada_proprietario' | 'aceita' | 'recusada' | 'arquivada';
  criadoPor: string | null;
  criadoEm: string;
};

// ---------------- helpers ----------------
const t = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const soDig = (v: unknown, n: number) => String(v ?? '').replace(/\D/g, '').slice(0, n);
function limparPessoa(p: Partial<Pessoa> | null | undefined): Pessoa | null {
  if (!p || !t(p.nome, 160)) return null;
  const out: Pessoa = { nome: t(p.nome, 160) };
  const campos: [keyof Pessoa, number][] = [
    ['documento', 20],
    ['rg', 30],
    ['estadoCivil', 20],
    ['profissao', 80],
    ['email', 160],
    ['endereco', 200],
    ['bairro', 100],
    ['cidade', 100],
    ['representante', 160]
  ];
  for (const [k, n] of campos) {
    const v = t(p[k], n);
    if (v) (out as Record<string, string>)[k] = v;
  }
  const tel = soDig(p.telefone, 13);
  if (tel) out.telefone = tel;
  const cep = soDig(p.cep, 8);
  if (cep) out.cep = cep;
  const uf = t(p.uf, 2).toUpperCase();
  if (uf) out.uf = uf;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(p.nascimento ?? ''))) out.nascimento = String(p.nascimento);
  return out;
}
const pessoaDoBanco = (v: unknown): Pessoa | null => (v && typeof v === 'object' && (v as Pessoa).nome ? (v as Pessoa) : null);

async function podeVer(): Promise<{ cond: string; params: unknown[]; email: string; nome: string; gestor: boolean }> {
  const eu = await exigirEquipe();
  if (veTudo(eu.role)) return { cond: 'true', params: [], email: eu.email, nome: eu.name, gestor: true };
  return { cond: "lower(coalesce(p.criado_por, '')) = lower($1)", params: [eu.email], email: eu.email, nome: eu.name, gestor: false };
}

// ---------------- escolher o imóvel ----------------
export type OpcaoAlvo = { tipo: AlvoProposta['tipo']; id: string; titulo: string; detalhe: string };

/** Busca por nome do condomínio, título, bairro ou código (Jetimob) */
export async function buscarAlvos(q: string): Promise<OpcaoAlvo[]> {
  await exigirEquipe();
  const termo = t(q, 80);
  if (termo.length < 2) return [];
  const like = `%${termo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}%`;
  const n = (c: string) => `translate(lower(coalesce(${c}, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')`;
  const [condos, imoveis] = await Promise.all([
    query<{ id: string; name: string; bairro: string | null; cidade: string | null }>(
      `select id, name, bairro, cidade from developments where ${n('name')} like $1 order by (status = 'publicado') desc, name limit 8`,
      [like]
    ),
    query<{ id: string; titulo: string | null; condominio: string | null; bairro: string | null; codigo: string | null; is_tipologia: boolean; area: string | null; price: string | null; privado: boolean }>(
      `select p.id, p.titulo, coalesce(d.name, p.condominio) as condominio, p.bairro, p.jetimob_codigo as codigo, p.is_tipologia, p.area::text,
              p.price, p.visibilidade = 'privado' as privado
         from properties p left join developments d on d.id = p.empreendimento_id
        where p.vendido_em is null
          and (${n('p.titulo')} like $1 or ${n('d.name')} like $1 or ${n('p.condominio')} like $1 or ${n('p.bairro')} like $1 or p.jetimob_codigo = $2 or p.id = $2)
        order by p.is_tipologia, p.created_at desc limit 20`,
      [like, termo]
    )
  ]);
  return [
    ...condos.map((c) => ({ tipo: 'condominio' as const, id: c.id, titulo: c.name, detalhe: `Condomínio · ${[c.bairro, c.cidade].filter(Boolean).join(', ')}` })),
    ...imoveis.map((i) => ({
      tipo: (i.is_tipologia ? 'tipologia' : 'imovel') as AlvoProposta['tipo'],
      id: i.id,
      titulo: i.titulo || `${i.area ?? ''} m²`,
      detalhe: [i.is_tipologia ? 'Tipologia' : i.privado ? 'Anúncio privado' : 'Anúncio', i.condominio, i.bairro, i.codigo ? `cód. ${i.codigo}` : null, i.price].filter(Boolean).join(' · ')
    }))
  ];
}

export async function carregarAlvo(tipo: AlvoProposta['tipo'], id: string): Promise<AlvoProposta | null> {
  await exigirEquipe();
  if (tipo === 'condominio') {
    const r = await query<{ id: string; name: string; logradouro: string | null; bairro: string | null; cidade: string | null; uf: string | null; vendedor: unknown }>(
      'select id, name, logradouro, bairro, cidade, uf, vendedor from developments where id = $1',
      [id]
    );
    const d = r[0];
    if (!d) return null;
    const v = pessoaDoBanco(d.vendedor);
    return {
      tipo,
      id: d.id,
      developmentId: d.id,
      titulo: [`Unidade no Condomínio ${d.name}`, d.logradouro, d.bairro, [d.cidade, d.uf].filter(Boolean).join('/')].filter(Boolean).join(', '),
      valorAnunciado: null,
      vendedor: v,
      vendedorOrigem: v ? 'condominio' : null
    };
  }
  const r = await query<{
    id: string;
    titulo: string | null;
    area: string | null;
    quartos: number | null;
    price_value: string | null;
    logradouro: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    condominio: string | null;
    dname: string | null;
    empreendimento_id: string | null;
    vendedor: unknown;
    dvendedor: unknown;
    is_tipologia: boolean;
  }>(
    `select p.id, p.titulo, p.area::text, p.quartos, p.price_value::text, p.logradouro, p.bairro, p.cidade, p.uf, p.condominio, d.name as dname,
            p.empreendimento_id, p.vendedor, d.vendedor as dvendedor, p.is_tipologia
       from properties p left join developments d on d.id = p.empreendimento_id where p.id = $1`,
    [id]
  );
  const p = r[0];
  if (!p) return null;
  const vImovel = pessoaDoBanco(p.vendedor);
  const vCondo = pessoaDoBanco(p.dvendedor);
  const condo = p.dname || p.condominio;
  const desc = [
    p.titulo || [p.quartos ? `${p.quartos} quartos` : null, p.area ? `${Number(p.area).toLocaleString('pt-BR')} m²` : null].filter(Boolean).join(', '),
    condo ? `Condomínio ${condo}` : null,
    p.logradouro,
    p.bairro,
    [p.cidade, p.uf].filter(Boolean).join('/')
  ]
    .filter(Boolean)
    .join(', ');
  return {
    tipo: p.is_tipologia ? 'tipologia' : 'imovel',
    id: p.id,
    developmentId: p.empreendimento_id,
    titulo: desc,
    valorAnunciado: p.price_value ? Number(p.price_value) : null,
    vendedor: vImovel ?? vCondo,
    vendedorOrigem: vImovel ? 'imovel' : vCondo ? 'condominio' : null
  };
}

/** Dados do corretor logado (nome, CRECI guardado) para preencher a proposta */
export async function meuCorretor(): Promise<Corretor> {
  const eu = await exigirEquipe();
  const r = await query<{ creci: string | null }>('select creci from staff_users where lower(email) = lower($1)', [eu.email]).catch(() => []);
  return { nome: eu.name, email: eu.email, creci: r[0]?.creci ?? undefined };
}

// ---------------- salvar ----------------
export type PropostaInput = {
  id?: string;
  alvo: { tipo: AlvoProposta['tipo']; id: string } | null;
  imovelTexto: string;
  unidade?: string;
  comprador: Pessoa;
  vendedor: Pessoa | null;
  corretor: Corretor;
  valor: number;
  formas: string[];
  entrada?: number | null;
  condicoes?: string;
  validadeDias: number;
  guardarVendedor?: 'imovel' | 'condominio' | null; // guarda o vendedor como padrão
};

const FORMAS = ['a_vista', 'financiamento', 'fgts', 'consorcio', 'permuta', 'parcelamento_direto', 'outro'];

export async function salvarProposta(d: PropostaInput): Promise<{ ok: boolean; id?: string; erro?: string }> {
  const eu = await podeVer();
  const comprador = limparPessoa(d.comprador);
  if (!comprador) return { ok: false, erro: 'Informe o nome do comprador (proponente).' };
  const doc = soDig(comprador.documento, 14);
  if (doc.length === 11 && !cpfValido(doc)) return { ok: false, erro: 'O CPF do comprador não confere. Verifique os números.' };
  const valor = Math.round(Number(d.valor) || 0);
  if (valor < 1000) return { ok: false, erro: 'Informe o valor da proposta.' };
  const formas = (d.formas ?? []).filter((f) => FORMAS.includes(f));
  if (!formas.length) return { ok: false, erro: 'Escolha a forma de pagamento.' };
  const imovelTexto = t(d.imovelTexto, 400);
  if (!imovelTexto) return { ok: false, erro: 'Descreva o imóvel da proposta.' };
  const vendedor = limparPessoa(d.vendedor);
  const corretor: Corretor = { nome: t(d.corretor?.nome, 120) || eu.nome, creci: t(d.corretor?.creci, 30) || undefined, email: eu.email };

  let propertyId: string | null = null;
  let developmentId: string | null = null;
  if (d.alvo) {
    const alvo = await carregarAlvo(d.alvo.tipo, d.alvo.id);
    if (alvo) {
      propertyId = alvo.tipo === 'condominio' ? null : alvo.id;
      developmentId = alvo.developmentId;
    }
  }

  const vals = [
    propertyId,
    developmentId,
    imovelTexto,
    t(d.unidade, 120) || null,
    comprador.nome,
    doc || null,
    comprador.rg ?? null,
    comprador.nascimento ?? null,
    comprador.estadoCivil ?? null,
    comprador.profissao ?? null,
    comprador.email ?? null,
    comprador.telefone ?? null,
    comprador.cep ?? null,
    comprador.endereco ?? null,
    comprador.bairro ?? null,
    comprador.cidade ?? null,
    comprador.uf ?? null,
    valor,
    JSON.stringify(formas),
    d.entrada && d.entrada > 0 ? Math.round(d.entrada) : null,
    t(d.condicoes, 3000) || null,
    Math.min(60, Math.max(1, Math.round(Number(d.validadeDias) || 5))),
    vendedor ? JSON.stringify(vendedor) : null,
    JSON.stringify(corretor)
  ];

  let id = d.id;
  if (id) {
    const r = await query<{ id: string }>(
      `update propostas p set property_id=$${eu.params.length + 2}, development_id=$${eu.params.length + 3}, imovel_texto=$${eu.params.length + 4},
              unidade=$${eu.params.length + 5}, nome=$${eu.params.length + 6}, cpf=$${eu.params.length + 7}, rg=$${eu.params.length + 8},
              nascimento=$${eu.params.length + 9}, estado_civil=$${eu.params.length + 10}, profissao=$${eu.params.length + 11}, email=$${eu.params.length + 12},
              telefone=$${eu.params.length + 13}, cep=$${eu.params.length + 14}, endereco=$${eu.params.length + 15}, bairro=$${eu.params.length + 16},
              cidade=$${eu.params.length + 17}, uf=$${eu.params.length + 18}, valor_proposta=$${eu.params.length + 19}, formas_pagamento=$${eu.params.length + 20},
              valor_entrada=$${eu.params.length + 21}, condicoes=$${eu.params.length + 22}, validade_dias=$${eu.params.length + 23},
              vendedor=$${eu.params.length + 24}, corretor=$${eu.params.length + 25}, updated_at=now()
        where p.id = $${eu.params.length + 1}::uuid and ${eu.cond} returning p.id`,
      [...eu.params, id, ...vals]
    );
    if (!r[0]) return { ok: false, erro: 'Proposta não encontrada ou sem permissão para editar.' };
  } else {
    const r = await query<{ id: string }>(
      `insert into propostas (property_id, development_id, imovel_texto, unidade, nome, cpf, rg, nascimento, estado_civil, profissao, email, telefone,
                              cep, endereco, bairro, cidade, uf, valor_proposta, formas_pagamento, valor_entrada, condicoes, validade_dias, vendedor, corretor, criado_por)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) returning id`,
      [...vals, eu.email]
    );
    id = r[0].id;
  }

  // guarda o CRECI do corretor para as próximas propostas
  if (corretor.creci) await query('update staff_users set creci = $2 where lower(email) = lower($1)', [eu.email, corretor.creci]).catch(() => {});
  // guarda o vendedor como padrão do imóvel/condomínio (proprietário ou construtora)
  if (vendedor && d.guardarVendedor === 'imovel' && propertyId) {
    await query('update properties set vendedor = $2 where id = $1', [propertyId, JSON.stringify(vendedor)]);
  } else if (vendedor && d.guardarVendedor === 'condominio' && developmentId) {
    await query('update developments set vendedor = $2 where id = $1', [developmentId, JSON.stringify(vendedor)]);
  }
  return { ok: true, id };
}

// ---------------- listar / abrir ----------------
type Row = Record<string, unknown>;
const mapear = (r: Row): Proposta => ({
  id: String(r.id),
  numero: Number(r.numero) || 0,
  propertyId: (r.property_id as string) ?? null,
  developmentId: (r.development_id as string) ?? null,
  imovelTexto: (r.imovel_texto as string) ?? null,
  unidade: (r.unidade as string) ?? null,
  comprador: {
    nome: String(r.nome),
    documento: (r.cpf as string) ?? undefined,
    rg: (r.rg as string) ?? undefined,
    nascimento: r.nascimento ? new Date(r.nascimento as string).toISOString().slice(0, 10) : undefined,
    estadoCivil: (r.estado_civil as string) ?? undefined,
    profissao: (r.profissao as string) ?? undefined,
    email: (r.email as string) ?? undefined,
    telefone: (r.telefone as string) ?? undefined,
    cep: (r.cep as string) ?? undefined,
    endereco: (r.endereco as string) ?? undefined,
    bairro: (r.bairro as string) ?? undefined,
    cidade: (r.cidade as string) ?? undefined,
    uf: (r.uf as string) ?? undefined
  },
  vendedor: pessoaDoBanco(r.vendedor),
  corretor: r.corretor && typeof r.corretor === 'object' ? (r.corretor as Corretor) : null,
  valor: Number(r.valor_proposta),
  formas: Array.isArray(r.formas_pagamento) ? (r.formas_pagamento as string[]) : [],
  entrada: r.valor_entrada != null ? Number(r.valor_entrada) : null,
  condicoes: (r.condicoes as string) ?? null,
  validadeDias: Number(r.validade_dias) || 5,
  status: r.status as Proposta['status'],
  criadoPor: (r.criado_por as string) ?? null,
  criadoEm: new Date(r.created_at as string).toISOString()
});

export async function listarPropostas(filtro?: { propertyId?: string; developmentId?: string }): Promise<Proposta[]> {
  const f = await podeVer();
  const params = [...f.params];
  let extra = '';
  if (filtro?.propertyId) {
    params.push(filtro.propertyId);
    extra += ` and p.property_id = $${params.length}`;
  }
  if (filtro?.developmentId) {
    params.push(filtro.developmentId);
    extra += ` and p.development_id = $${params.length}`;
  }
  const rows = await query<Row>(`select p.* from propostas p where ${f.cond}${extra} order by p.created_at desc limit 500`, params);
  return rows.map(mapear);
}

export async function getProposta(id: string): Promise<Proposta | null> {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return null;
  const f = await podeVer();
  const rows = await query<Row>(`select p.* from propostas p where p.id = $${f.params.length + 1}::uuid and ${f.cond}`, [...f.params, id]);
  return rows[0] ? mapear(rows[0]) : null;
}

export async function mudarStatusProposta(id: string, status: Proposta['status']): Promise<void> {
  const f = await podeVer();
  if (!['nova', 'em_analise', 'enviada_proprietario', 'aceita', 'recusada', 'arquivada'].includes(status)) return;
  await query(`update propostas p set status = $${f.params.length + 2}, updated_at = now() where p.id = $${f.params.length + 1}::uuid and ${f.cond}`, [
    ...f.params,
    id,
    status
  ]);
}

export async function excluirProposta(id: string): Promise<void> {
  const f = await podeVer();
  await query(`delete from propostas p where p.id = $${f.params.length + 1}::uuid and ${f.cond}`, [...f.params, id]);
}
