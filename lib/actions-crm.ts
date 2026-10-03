'use server';

// CRM do painel. Permissões: corretor vê e mexe só nos contatos dele; analista e
// admin veem todos, transferem e distribuem. Toda tela chama sincronizarCRM() antes,
// para as entradas novas do site já aparecerem.
import { query } from './db';
import { exigirEquipe } from './staff-auth';
import { veTudo } from './session';
import { ETAPAS, FUNIS, calcularNota, etapaValida, jornada, normTel, sincronizarCRM, type Funil, type Nota, type PassoJornada, type ResumoPortal } from './crm';
import { CANAIS_MANUAIS } from './crm-tipos';

type Staff = Awaited<ReturnType<typeof exigirEquipe>>;
const escopo = (s: Staff, col = 'c.corretor_email') => (veTudo(s.role) ? { sql: 'true', params: [] as unknown[] } : { sql: `lower(coalesce(${col}, '')) = lower($X)`, params: [s.email] });
function comEscopo(s: Staff, sql: string, params: unknown[], col = 'c.corretor_email') {
  const e = escopo(s, col);
  if (!e.params.length) return { sql: sql.replace('{ESCOPO}', 'true'), params };
  return { sql: sql.replace('{ESCOPO}', e.sql.replace('$X', `$${params.length + 1}`)), params: [...params, ...e.params] };
}
async function podeVerContato(s: Staff, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Contato inválido.');
  if (veTudo(s.role)) return;
  const r = await query<{ ok: boolean }>(`select lower(coalesce(corretor_email, '')) = lower($2) as ok from crm_contatos where id = $1`, [id, s.email]);
  if (!r[0]?.ok) throw new Error('Este contato é de outro corretor.');
}
async function respondeu(contatoId: string) {
  await query(`update crm_contatos set ultima_resposta_em = now(), atualizado_em = now() where id = $1`, [contatoId]);
}

export type CardContato = {
  id: string;
  nome: string;
  telefone: string | null;
  tipo: string;
  possivelCorretor: string | null;
  origem: string | null;
  corretor: string | null;
  esperandoDesde: string | null;
  ultimaEntrada: string | null;
  canal: { nome: string | null; pago: boolean; campanha: string | null };
};

// ---------------- Hoje ----------------
export type Hoje = {
  responder: CardContato[];
  tarefas: { id: string; titulo: string; tipo: string; venceEm: string | null; contatoId: string | null; contato: string | null; atrasada: boolean }[];
  numeros: { esperando: number; maisAntigoMin: number | null; tarefas: number; atrasadas: number; visitas: number; semDono: number };
};

export async function crmHoje(): Promise<Hoje> {
  const s = await exigirEquipe();
  await sincronizarCRM().catch(() => 0);
  const r1 = comEscopo(
    s,
    `select c.id, c.nome, c.telefone, c.tipo, c.possivel_corretor, c.origem, c.corretor_email, c.ultimo_contato_em, c.canal, c.canal_pago, c.campanha,
            coalesce((select texto from crm_mensagens m where m.contato_id = c.id and m.direcao = 'entrada' order by m.criado_em desc limit 1),
                     (select texto from crm_atividades a where a.contato_id = c.id and a.tipo = 'entrada' order by a.criado_em desc limit 1)) as ultima
       from crm_contatos c
      where c.ultimo_contato_em is not null and (c.ultima_resposta_em is null or c.ultima_resposta_em < c.ultimo_contato_em)
        and {ESCOPO}
      order by c.ultimo_contato_em asc limit 50`,
    []
  );
  const resp = await query<Record<string, unknown>>(r1.sql, r1.params);
  const r2 = comEscopo(
    s,
    `select t.id, t.titulo, t.tipo, t.vence_em, t.contato_id, c.nome from crm_tarefas t left join crm_contatos c on c.id = t.contato_id
      where t.feita_em is null and (t.vence_em is null or t.vence_em < date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '1 day 3 hours')
        and {ESCOPO}
      order by t.vence_em asc nulls last limit 40`,
    [],
    't.corretor_email'
  );
  const tar = await query<Record<string, unknown>>(r2.sql, r2.params);
  const semDono = veTudo(s.role) ? Number((await query<{ n: string }>(`select count(*) n from crm_contatos where corretor_email is null`))[0]?.n) || 0 : 0;
  const agora = Date.now();
  const responder: CardContato[] = resp.map((r) => ({
    id: String(r.id),
    nome: String(r.nome),
    telefone: (r.telefone as string) ?? null,
    tipo: String(r.tipo),
    possivelCorretor: (r.possivel_corretor as string) ?? null,
    origem: (r.origem as string) ?? null,
    corretor: (r.corretor_email as string) ?? null,
    esperandoDesde: r.ultimo_contato_em ? new Date(r.ultimo_contato_em as string).toISOString() : null,
    ultimaEntrada: (r.ultima as string) ?? null,
    canal: { nome: (r.canal as string) ?? null, pago: !!r.canal_pago, campanha: (r.campanha as string) ?? null },
  }));
  const tarefas = tar.map((t) => ({
    id: String(t.id),
    titulo: String(t.titulo),
    tipo: String(t.tipo),
    venceEm: t.vence_em ? new Date(t.vence_em as string).toISOString() : null,
    contatoId: (t.contato_id as string) ?? null,
    contato: (t.nome as string) ?? null,
    atrasada: !!t.vence_em && new Date(t.vence_em as string).getTime() < agora
  }));
  const maisAntigo = responder[0]?.esperandoDesde ? Math.round((agora - new Date(responder[0].esperandoDesde).getTime()) / 60000) : null;
  return {
    responder,
    tarefas,
    numeros: {
      esperando: responder.length,
      maisAntigoMin: maisAntigo,
      tarefas: tarefas.length,
      atrasadas: tarefas.filter((t) => t.atrasada).length,
      visitas: tarefas.filter((t) => t.tipo === 'visita').length,
      semDono
    }
  };
}

// ---------------- Funil ----------------
export type CardNegocio = {
  id: string;
  contatoId: string;
  nome: string;
  titulo: string | null;
  valor: number | null;
  etapa: string;
  origem: string | null;
  canal: { nome: string | null; pago: boolean; campanha: string | null };
  corretor: string | null;
  diasNaEtapa: number;
  proximaTarefa: { titulo: string; venceEm: string | null; atrasada: boolean } | null;
  stats: { paginas: number; condominios: number; simulacoes: number; propostas: number };
  nota: Nota;
};

async function statsDe(contatos: { id: string; visitantes: string[]; telefone: string | null; email: string | null }[]) {
  const ids = contatos.map((c) => c.id);
  const vis = Array.from(new Set(contatos.flatMap((c) => c.visitantes)));
  const [ev, sim, prop] = await Promise.all([
    vis.length
      ? query<{ visitante: string; paginas: string; condos: string; segundos: string; voltas: string; ultimo: string }>(
          `select visitante, count(distinct pagina) filter (where tipo = 'visita') paginas,
                  count(distinct pagina) filter (where tipo = 'visita' and pagina like '/empreendimento%') condos,
                  coalesce(sum(valor) filter (where tipo = 'tempo'), 0) segundos,
                  (select count(*) from (select pagina from eventos e2 where e2.visitante = e.visitante and e2.tipo = 'visita' group by pagina having count(*) >= 3) x) voltas,
                  max(created_at) ultimo
             from eventos e where visitante = any($1::text[]) group by visitante`,
          [vis]
        )
      : Promise.resolve([]),
    ids.length ? query<{ contato_id: string; n: string }>(`select contato_id, count(*) n from crm_atividades where contato_id = any($1::uuid[]) and tipo = 'simulacao' group by 1`, [ids]) : Promise.resolve([]),
    ids.length
      ? query<{ contato_id: string; n: string }>(
          `select c.id contato_id, count(p.*) n from crm_contatos c join propostas p on p.contato_id = c.id or (c.telefone is not null and regexp_replace(coalesce(p.telefone, ''), '\\D', '', 'g') in (c.telefone, substr(c.telefone, 3))) or (c.email is not null and lower(p.email) = lower(c.email))
            where c.id = any($1::uuid[]) group by 1`,
          [ids]
        )
      : Promise.resolve([])
  ]);
  const porVis = new Map(ev.map((e) => [e.visitante, e]));
  const simM = new Map(sim.map((x) => [x.contato_id, Number(x.n)]));
  const propM = new Map(prop.map((x) => [x.contato_id, Number(x.n)]));
  const out = new Map<string, { paginas: number; condominios: number; segundos: number; voltas: number; ultimo: Date | null; simulacoes: number; propostas: number }>();
  for (const c of contatos) {
    const st = { paginas: 0, condominios: 0, segundos: 0, voltas: 0, ultimo: null as Date | null, simulacoes: simM.get(c.id) ?? 0, propostas: propM.get(c.id) ?? 0 };
    for (const v of c.visitantes) {
      const e = porVis.get(v);
      if (!e) continue;
      st.paginas += Number(e.paginas);
      st.condominios += Number(e.condos);
      st.segundos += Number(e.segundos);
      st.voltas += Number(e.voltas);
      const u = new Date(e.ultimo);
      if (!st.ultimo || u > st.ultimo) st.ultimo = u;
    }
    out.set(c.id, st);
  }
  return out;
}

export async function crmFunil(funil: Funil, corretor?: string): Promise<{ etapas: { id: string; nome: string }[]; cards: CardNegocio[]; corretores: { email: string; nome: string }[]; podeVerTodos: boolean }> {
  const s = await exigirEquipe();
  await sincronizarCRM().catch(() => 0);
  const f = (FUNIS.find((x) => x.id === funil)?.id ?? 'comprar') as Funil;
  const params: unknown[] = [f];
  let filtroCorretor = '';
  if (corretor && veTudo(s.role)) {
    params.push(corretor);
    filtroCorretor = ` and lower(coalesce(n.corretor_email, c.corretor_email, '')) = lower($${params.length})`;
  }
  const r = comEscopo(
    s,
    `select n.id, n.contato_id, n.titulo, n.valor, n.etapa, n.etapa_desde, coalesce(n.corretor_email, c.corretor_email) corretor, c.nome, c.origem, c.visitantes, c.telefone, c.email,
            c.ultimo_contato_em, c.preferencias, c.canal, c.canal_pago, c.campanha,
            (select json_build_object('titulo', t.titulo, 'vence', t.vence_em) from crm_tarefas t where t.negocio_id = n.id and t.feita_em is null order by t.vence_em asc nulls last limit 1) prox
       from crm_negocios n join crm_contatos c on c.id = n.contato_id
      where n.funil = $1 and n.etapa not in ('ganho', 'perdido') and {ESCOPO}${filtroCorretor}
      order by n.etapa_desde asc limit 400`,
    params
  );
  const rows = await query<Record<string, unknown>>(r.sql, r.params);
  const st = await statsDe(rows.map((x) => ({ id: String(x.contato_id), visitantes: (x.visitantes as string[]) ?? [], telefone: (x.telefone as string) ?? null, email: (x.email as string) ?? null })));
  const agora = Date.now();
  const cards: CardNegocio[] = rows.map((x) => {
    const e = st.get(String(x.contato_id))!;
    const prox = x.prox as { titulo: string; vence: string | null } | null;
    const prefs = (x.preferencias as Record<string, unknown>) ?? {};
    return {
      id: String(x.id),
      contatoId: String(x.contato_id),
      nome: String(x.nome),
      titulo: (x.titulo as string) ?? null,
      valor: x.valor == null ? null : Number(x.valor),
      etapa: String(x.etapa),
      origem: (x.origem as string) ?? null,
      canal: { nome: (x.canal as string) ?? null, pago: !!x.canal_pago, campanha: (x.campanha as string) ?? null },
      corretor: (x.corretor as string) ?? null,
      diasNaEtapa: Math.floor((agora - new Date(x.etapa_desde as string).getTime()) / 86400000),
      proximaTarefa: prox ? { titulo: prox.titulo, venceEm: prox.vence, atrasada: !!prox.vence && new Date(prox.vence).getTime() < agora } : null,
      stats: { paginas: e.paginas, condominios: e.condominios, simulacoes: e.simulacoes, propostas: e.propostas },
      nota: calcularNota({
        etapa: String(x.etapa),
        propostas: e.propostas,
        simulacoes: e.simulacoes,
        resumo: { voltas: e.voltas, segundos: e.segundos, condominios: e.condominios, imoveis: Math.max(0, e.paginas - e.condominios) },
        ultimoContato: x.ultimo_contato_em ? new Date(x.ultimo_contato_em as string) : null,
        ultimaAtividadePortal: e.ultimo,
        temPreferencias: Object.keys(prefs).length > 0
      })
    };
  });
  const corretores = veTudo(s.role)
    ? (await query<{ email: string; nome: string }>(`select email, coalesce(nullif(nome_publico, ''), name) nome from staff_users order by 2`)).map((c) => ({ email: c.email, nome: c.nome }))
    : [];
  return { etapas: ETAPAS[f], cards, corretores, podeVerTodos: veTudo(s.role) };
}

export async function moverNegocio(id: string, etapa: string, motivo?: string): Promise<void> {
  const s = await exigirEquipe();
  const n = (await query<{ contato_id: string; funil: string; etapa: string }>(`select contato_id, funil, etapa from crm_negocios where id = $1`, [id]))[0];
  if (!n) throw new Error('Negócio não encontrado.');
  await podeVerContato(s, n.contato_id);
  if (!etapaValida(n.funil, etapa)) throw new Error('Etapa inválida.');
  if (n.etapa === etapa) return;
  await query(`update crm_negocios set etapa = $2, etapa_desde = now(), fechado_em = case when $2 in ('ganho', 'perdido') then now() else null end, motivo = coalesce($3, motivo) where id = $1`, [id, etapa, motivo?.slice(0, 300) ?? null]);
  const nome = etapa === 'ganho' ? 'Ganho' : etapa === 'perdido' ? 'Perdido' : ETAPAS[n.funil as Funil]?.find((e) => e.id === etapa)?.nome ?? etapa;
  await query(`insert into crm_atividades (contato_id, tipo, texto, autor_email) values ($1, 'sistema', $2, $3)`, [n.contato_id, `Negócio movido para ${nome}${motivo ? `: ${motivo}` : ''}`, s.email]);
  await respondeu(n.contato_id);
}

// ---------------- Contatos ----------------
export async function crmContatos(busca: string, tipo: string): Promise<(CardContato & { criadoEm: string })[]> {
  const s = await exigirEquipe();
  await sincronizarCRM().catch(() => 0);
  const params: unknown[] = [];
  const conds: string[] = ['{ESCOPO}'];
  const t = String(busca ?? '').trim().slice(0, 80);
  if (t) {
    params.push(`%${t.toLowerCase()}%`);
    params.push(`%${t.replace(/\D/g, '') || '§'}%`);
    conds.push(`(lower(c.nome) like $1 or lower(coalesce(c.email, '')) like $1 or coalesce(c.telefone, '') like $2)`);
  }
  if (tipo === 'corretor') conds.push(`c.tipo = 'corretor'`);
  else if (tipo === 'possivel') conds.push(`c.tipo = 'cliente' and c.possivel_corretor is not null`);
  else if (tipo === 'cliente') conds.push(`c.tipo = 'cliente'`);
  const r = comEscopo(s, `select c.* from crm_contatos c where ${conds.join(' and ')} order by coalesce(c.ultimo_contato_em, c.criado_em) desc limit 300`, params);
  const rows = await query<Record<string, unknown>>(r.sql, r.params);
  return rows.map((r) => ({
    id: String(r.id),
    nome: String(r.nome),
    telefone: (r.telefone as string) ?? null,
    tipo: String(r.tipo),
    possivelCorretor: (r.possivel_corretor as string) ?? null,
    origem: (r.origem as string) ?? null,
    corretor: (r.corretor_email as string) ?? null,
    esperandoDesde: null,
    ultimaEntrada: null,
    canal: { nome: (r.canal as string) ?? null, pago: !!r.canal_pago, campanha: (r.campanha as string) ?? null },
    criadoEm: new Date(r.criado_em as string).toISOString()
  }));
}

export type FichaContato = {
  contato: {
    id: string; nome: string; telefone: string | null; email: string | null; tipo: string; possivelCorretor: string | null; origem: string | null;
    corretor: string | null; preferencias: Record<string, unknown>; criadoEm: string; iaAtiva: boolean;
    canal: { nome: string | null; pago: boolean; campanha: string | null };
  };
  negocios: { id: string; funil: string; etapa: string; titulo: string | null; valor: number | null; criadoEm: string }[];
  atividades: { id: string; tipo: string; texto: string | null; autor: string | null; quando: string }[];
  tarefas: { id: string; titulo: string; tipo: string; venceEm: string | null; feita: boolean }[];
  portal: ResumoPortal;
  caminho: PassoJornada[];
  nota: Nota;
  corretores: { email: string; nome: string }[];
  podeTransferir: boolean;
  etapas: Record<string, { id: string; nome: string }[]>;
  envios: Envio[];
  propostas: { id: string; numero: number | null; imovel: string | null; valor: number | null; status: string | null; criadaEm: string }[];
};

export async function crmContato(id: string): Promise<FichaContato> {
  const s = await exigirEquipe();
  await podeVerContato(s, id);
  const c = (await query<Record<string, unknown>>(`select * from crm_contatos where id = $1`, [id]))[0];
  if (!c) throw new Error('Contato não encontrado.');
  const [neg, atv, tar, env, props] = await Promise.all([
    query<Record<string, unknown>>(`select * from crm_negocios where contato_id = $1 order by (etapa in ('ganho', 'perdido')), criado_em desc`, [id]),
    query<Record<string, unknown>>(`select * from crm_atividades where contato_id = $1 order by criado_em desc limit 200`, [id]),
    query<Record<string, unknown>>(`select * from crm_tarefas where contato_id = $1 order by feita_em nulls first, vence_em asc nulls last limit 50`, [id]),
    query<Record<string, unknown>>(`select * from crm_envios where contato_id = $1 order by enviado_em desc limit 100`, [id]),
    query<Record<string, unknown>>(
      `select p.id, p.numero, p.imovel_texto, p.valor_proposta, p.status, p.created_at from propostas p, crm_contatos c
        where c.id = $1 and (p.contato_id = c.id
           or (c.telefone is not null and regexp_replace(coalesce(p.telefone, ''), '\\D', '', 'g') in (c.telefone, substr(c.telefone, 3)))
           or (c.email is not null and lower(p.email) = lower(c.email)))
        order by p.created_at desc limit 50`,
      [id]
    )
  ]);
  const visitantes = (c.visitantes as string[]) ?? [];
  const [j, st] = await Promise.all([jornada(visitantes), statsDe([{ id, visitantes, telefone: (c.telefone as string) ?? null, email: (c.email as string) ?? null }])]);
  const e = st.get(id)!;
  const aberto = neg.find((n) => !['ganho', 'perdido'].includes(String(n.etapa)));
  const prefs = (c.preferencias as Record<string, unknown>) ?? {};
  return {
    contato: {
      id,
      nome: String(c.nome),
      telefone: (c.telefone as string) ?? null,
      email: (c.email as string) ?? null,
      tipo: String(c.tipo),
      possivelCorretor: (c.possivel_corretor as string) ?? null,
      origem: (c.origem as string) ?? null,
      corretor: (c.corretor_email as string) ?? null,
      preferencias: prefs,
      criadoEm: new Date(c.criado_em as string).toISOString(),
      iaAtiva: !!c.ia_ativa,
      canal: { nome: (c.canal as string) ?? null, pago: !!c.canal_pago, campanha: (c.campanha as string) ?? null }
    },
    negocios: neg.map((n) => ({ id: String(n.id), funil: String(n.funil), etapa: String(n.etapa), titulo: (n.titulo as string) ?? null, valor: n.valor == null ? null : Number(n.valor), criadoEm: new Date(n.criado_em as string).toISOString() })),
    atividades: atv.map((a) => ({ id: String(a.id), tipo: String(a.tipo), texto: (a.texto as string) ?? null, autor: (a.autor_email as string) ?? null, quando: new Date(a.criado_em as string).toISOString() })),
    tarefas: tar.map((t) => ({ id: String(t.id), titulo: String(t.titulo), tipo: String(t.tipo), venceEm: t.vence_em ? new Date(t.vence_em as string).toISOString() : null, feita: !!t.feita_em })),
    portal: { ...j.resumo, simulacoes: e.simulacoes, propostas: e.propostas },
    caminho: j.passos,
    nota: calcularNota({
      etapa: aberto ? String(aberto.etapa) : null,
      propostas: e.propostas,
      simulacoes: e.simulacoes,
      resumo: j.resumo,
      ultimoContato: c.ultimo_contato_em ? new Date(c.ultimo_contato_em as string) : null,
      ultimaAtividadePortal: e.ultimo,
      temPreferencias: Object.keys(prefs).length > 0
    }),
    corretores: veTudo(s.role) ? await query<{ email: string; nome: string }>(`select email, coalesce(nullif(nome_publico, ''), name) nome from staff_users order by 2`) : [],
    podeTransferir: veTudo(s.role),
    etapas: ETAPAS,
    envios: env.map((e) => ({
      id: String(e.id),
      codigo: String(e.codigo),
      tipo: String(e.tipo),
      refId: String(e.ref_id),
      titulo: (e.titulo as string) ?? null,
      sub: (e.sub as string) ?? null,
      preco: e.preco == null ? null : Number(e.preco),
      capa: (e.capa as string) ?? null,
      privado: !!e.privado,
      destino: String(e.destino),
      enviadoEm: new Date(e.enviado_em as string).toISOString(),
      enviadoPor: (e.enviado_por as string) ?? null,
      aberturas: Number(e.aberturas) || 0,
      primeiroAberto: e.primeiro_aberto_em ? new Date(e.primeiro_aberto_em as string).toISOString() : null,
      ultimoAberto: e.ultimo_aberto_em ? new Date(e.ultimo_aberto_em as string).toISOString() : null
    })),
    propostas: props.map((p) => ({
      id: String(p.id),
      numero: p.numero == null ? null : Number(p.numero),
      imovel: (p.imovel_texto as string) ?? null,
      valor: p.valor_proposta == null ? null : Number(p.valor_proposta),
      status: (p.status as string) ?? null,
      criadaEm: new Date(p.created_at as string).toISOString()
    }))
  };
}

/** Nota interna, ou registro de contato feito (WhatsApp / ligação / visita) */
export async function registrarAtividade(contatoId: string, tipo: 'nota' | 'whatsapp' | 'ligacao' | 'visita', texto: string): Promise<void> {
  const s = await exigirEquipe();
  await podeVerContato(s, contatoId);
  if (!['nota', 'whatsapp', 'ligacao', 'visita'].includes(tipo)) throw new Error('Tipo inválido.');
  const t = String(texto ?? '').trim().slice(0, 4000);
  if (!t && tipo === 'nota') throw new Error('Escreva a nota.');
  await query(`insert into crm_atividades (contato_id, tipo, texto, autor_email) values ($1, $2, $3, $4)`, [contatoId, tipo, t || null, s.email]);
  if (tipo !== 'nota') await respondeu(contatoId);
  // primeiro atendimento: o negócio "novo" passa para "em atendimento"
  if (tipo !== 'nota') await query(`update crm_negocios set etapa = 'atendimento', etapa_desde = now() where contato_id = $1 and etapa = 'novo' and funil in ('comprar', 'vender', 'alugar')`, [contatoId]);
}

export async function marcarRespondido(contatoId: string): Promise<void> {
  const s = await exigirEquipe();
  await podeVerContato(s, contatoId);
  await respondeu(contatoId);
}

export async function salvarTarefa(contatoId: string, titulo: string, tipo: 'tarefa' | 'visita' | 'ligacao', venceEm: string | null): Promise<void> {
  const s = await exigirEquipe();
  await podeVerContato(s, contatoId);
  const t = String(titulo ?? '').trim().slice(0, 200);
  if (!t) throw new Error('Escreva a tarefa.');
  const quando = venceEm ? new Date(venceEm) : null;
  const neg = (await query<{ id: string }>(`select id from crm_negocios where contato_id = $1 and etapa not in ('ganho', 'perdido') order by criado_em desc limit 1`, [contatoId]))[0];
  const dono = (await query<{ corretor_email: string | null }>(`select corretor_email from crm_contatos where id = $1`, [contatoId]))[0]?.corretor_email ?? s.email;
  await query(`insert into crm_tarefas (contato_id, negocio_id, titulo, tipo, vence_em, corretor_email) values ($1, $2, $3, $4, $5, $6)`, [
    contatoId,
    neg?.id ?? null,
    t,
    ['tarefa', 'visita', 'ligacao'].includes(tipo) ? tipo : 'tarefa',
    quando && !Number.isNaN(quando.getTime()) ? quando : null,
    dono
  ]);
  if (tipo === 'visita' && neg) await query(`update crm_negocios set etapa = 'visita', etapa_desde = now() where id = $1 and etapa in ('novo', 'atendimento')`, [neg.id]);
}

export async function concluirTarefa(id: string): Promise<void> {
  const s = await exigirEquipe();
  const t = (await query<{ contato_id: string | null; titulo: string }>(`select contato_id, titulo from crm_tarefas where id = $1`, [id]))[0];
  if (!t) return;
  if (t.contato_id) await podeVerContato(s, t.contato_id);
  await query(`update crm_tarefas set feita_em = now() where id = $1`, [id]);
  if (t.contato_id) await query(`insert into crm_atividades (contato_id, tipo, texto, autor_email) values ($1, 'sistema', $2, $3)`, [t.contato_id, `Tarefa concluída: ${t.titulo}`, s.email]);
}

/** Transferir / atribuir (analista e admin) */
export async function atribuirContato(contatoId: string, corretorEmail: string): Promise<void> {
  const s = await exigirEquipe();
  if (!veTudo(s.role)) throw new Error('Só analista e admin distribuem contatos.');
  const ok = (await query<{ email: string }>(`select email from staff_users where lower(email) = lower($1)`, [corretorEmail]))[0];
  if (!ok) throw new Error('Corretor não encontrado.');
  await query(`update crm_contatos set corretor_email = $2, atualizado_em = now() where id = $1`, [contatoId, ok.email]);
  await query(`update crm_negocios set corretor_email = $2 where contato_id = $1 and etapa not in ('ganho', 'perdido')`, [contatoId, ok.email]);
  await query(`update crm_tarefas set corretor_email = $2 where contato_id = $1 and feita_em is null`, [contatoId, ok.email]);
  await query(`insert into crm_atividades (contato_id, tipo, texto, autor_email) values ($1, 'sistema', $2, $3)`, [contatoId, `Contato passado para ${ok.email}`, s.email]);
}

/** Marca como corretor (vai para o funil de parceiros) ou volta para cliente */
export async function marcarTipo(contatoId: string, tipo: 'cliente' | 'corretor'): Promise<void> {
  const s = await exigirEquipe();
  await podeVerContato(s, contatoId);
  await query(`update crm_contatos set tipo = $2, possivel_corretor = case when $2 = 'cliente' then null else possivel_corretor end, atualizado_em = now() where id = $1`, [contatoId, tipo]);
  if (tipo === 'corretor') {
    const tem = await query(`select 1 from crm_negocios where contato_id = $1 and funil = 'parceiros' and etapa not in ('ganho', 'perdido')`, [contatoId]);
    if (!tem.length) await query(`insert into crm_negocios (contato_id, funil, etapa, titulo, corretor_email) select id, 'parceiros', 'novo', 'Parceria', corretor_email from crm_contatos where id = $1`, [contatoId]);
    await query(`update crm_negocios set etapa = 'perdido', motivo = 'É corretor', fechado_em = now() where contato_id = $1 and funil <> 'parceiros' and etapa = 'novo'`, [contatoId]);
  }
  await query(`insert into crm_atividades (contato_id, tipo, texto, autor_email) values ($1, 'sistema', $2, $3)`, [contatoId, tipo === 'corretor' ? 'Marcado como corretor de imóveis' : 'Marcado como cliente', s.email]);
}

export async function salvarPreferencias(contatoId: string, p: { quartos?: number[]; valorMax?: number | null; bairros?: string[]; observacao?: string }): Promise<void> {
  const s = await exigirEquipe();
  await podeVerContato(s, contatoId);
  const limpo = {
    quartos: (p.quartos ?? []).filter((q) => Number.isInteger(q) && q >= 0 && q <= 4),
    valorMax: p.valorMax && p.valorMax > 0 ? Math.round(p.valorMax) : null,
    bairros: (p.bairros ?? []).map((b) => String(b).trim().slice(0, 60)).filter(Boolean).slice(0, 8),
    observacao: String(p.observacao ?? '').slice(0, 500)
  };
  await query(`update crm_contatos set preferencias = preferencias || $2::jsonb, atualizado_em = now() where id = $1`, [contatoId, JSON.stringify(limpo)]);
}

/** Novo contato cadastrado à mão (ligação, indicação, plantão) */
export async function novoContato(d: { nome: string; telefone: string; email?: string; funil: Funil; titulo?: string; observacao?: string; canal?: string }): Promise<{ id: string }> {
  const s = await exigirEquipe();
  const nome = String(d.nome ?? '').trim().slice(0, 120);
  const tel = normTel(d.telefone);
  const email = String(d.email ?? '').trim().toLowerCase().slice(0, 160) || null;
  if (nome.length < 2) throw new Error('Informe o nome.');
  if (!tel && !email) throw new Error('Informe telefone ou e-mail.');
  const ja = await query<{ id: string }>(`select id from crm_contatos where ($1::text is not null and telefone = $1) or ($2::text is not null and lower(email) = $2) limit 1`, [tel, email]);
  if (ja[0]) {
    await podeVerContato(s, ja[0].id).catch(() => {
      throw new Error('Este contato já existe e é de outro corretor. Peça a transferência à analista.');
    });
    return { id: ja[0].id };
  }
  const r = await query<{ id: string }>(
    `insert into crm_contatos (nome, telefone, email, corretor_email, origem, ultimo_contato_em, ultima_resposta_em, canal) values ($1, $2, $3, $4, 'manual', now(), now(), $5) returning id`,
    [nome, tel, email, s.email, CANAIS_MANUAIS.includes(String(d.canal)) ? d.canal : 'Outro']
  );
  const id = r[0].id;
  const f = (FUNIS.find((x) => x.id === d.funil)?.id ?? 'comprar') as Funil;
  await query(`insert into crm_negocios (contato_id, funil, etapa, titulo, corretor_email) values ($1, $2, 'atendimento', $3, $4)`, [id, f, d.titulo?.slice(0, 160) || null, s.email]);
  await query(`insert into crm_atividades (contato_id, tipo, texto, autor_email) values ($1, 'entrada', $2, $3)`, [id, d.observacao?.slice(0, 1500) || 'Cadastrado no CRM', s.email]);
  return { id };
}

// ---------------- Equipe (analista e admin) ----------------
export async function crmEquipe(): Promise<{
  semDono: CardContato[];
  carteira: { email: string; nome: string; papel: string; ativos: number; semResposta: number; respostaMin: number | null; visitas: number; propostas: number }[];
}> {
  const s = await exigirEquipe();
  if (!veTudo(s.role)) throw new Error('Só analista e admin.');
  await sincronizarCRM().catch(() => 0);
  const sem = await query<Record<string, unknown>>(
    `select c.*, (select texto from crm_atividades a where a.contato_id = c.id and a.tipo = 'entrada' order by a.criado_em desc limit 1) ultima
       from crm_contatos c where c.corretor_email is null order by c.ultimo_contato_em asc nulls last limit 100`
  );
  const cart = await query<Record<string, unknown>>(
    `select u.email, coalesce(nullif(u.nome_publico, ''), u.name) nome, u.role,
            (select count(*) from crm_contatos c where lower(c.corretor_email) = lower(u.email)) ativos,
            (select count(*) from crm_contatos c where lower(c.corretor_email) = lower(u.email) and c.ultimo_contato_em is not null and (c.ultima_resposta_em is null or c.ultima_resposta_em < c.ultimo_contato_em)) sem_resposta,
            (select avg(extract(epoch from (c.ultima_resposta_em - c.ultimo_contato_em)) / 60) from crm_contatos c where lower(c.corretor_email) = lower(u.email) and c.ultima_resposta_em >= c.ultimo_contato_em and c.ultimo_contato_em > now() - interval '30 days') resposta,
            (select count(*) from crm_tarefas t where lower(t.corretor_email) = lower(u.email) and t.tipo = 'visita' and t.criado_em > now() - interval '30 days') visitas,
            (select count(*) from propostas p where lower(p.corretor_email) = lower(u.email) and p.created_at > now() - interval '30 days') propostas
       from staff_users u order by 3, 2`
  );
  return {
    semDono: sem.map((r) => ({
      id: String(r.id),
      nome: String(r.nome),
      telefone: (r.telefone as string) ?? null,
      tipo: String(r.tipo),
      possivelCorretor: (r.possivel_corretor as string) ?? null,
      origem: (r.origem as string) ?? null,
      corretor: null,
      esperandoDesde: r.ultimo_contato_em ? new Date(r.ultimo_contato_em as string).toISOString() : null,
      ultimaEntrada: (r.ultima as string) ?? null,
      canal: { nome: (r.canal as string) ?? null, pago: !!r.canal_pago, campanha: (r.campanha as string) ?? null },
    })),
    carteira: cart.map((r) => ({
      email: String(r.email),
      nome: String(r.nome),
      papel: String(r.role),
      ativos: Number(r.ativos) || 0,
      semResposta: Number(r.sem_resposta) || 0,
      respostaMin: r.resposta == null ? null : Math.round(Number(r.resposta)),
      visitas: Number(r.visitas) || 0,
      propostas: Number(r.propostas) || 0
    }))
  };
}

// ---------------- Imóveis enviados (links rastreados) ----------------
export type OpcaoEnvio = { tipo: 'imovel' | 'condominio'; id: string; titulo: string; sub: string; preco: number | null; capa: string | null; privado: boolean; url: string; motivo?: string };

/** Busca imóveis e condomínios para enviar; sem texto, sugere pelo que a pessoa procura */
export async function opcoesParaEnviar(contatoId: string, texto: string): Promise<OpcaoEnvio[]> {
  const s = await exigirEquipe();
  await podeVerContato(s, contatoId);
  const { urlImovel, urlCondominio } = await import('./urls');
  const t = String(texto ?? '').trim().slice(0, 80);
  const c = (await query<{ preferencias: Record<string, unknown> }>(`select preferencias from crm_contatos where id = $1`, [contatoId]))[0];
  const prefs = (c?.preferencias ?? {}) as { quartos?: number[]; valorMax?: number; bairros?: string[] };
  const DE = 'áàâãäéèêëíìîïóòôõöúùûüç';
  const PARA = 'aaaaaeeeeiiiiooooouuuuc';
  const norm = (x: string) => `translate(lower(${x}), '${DE}', '${PARA}')`;
  const params: unknown[] = [];
  const conds = [`not p.is_tipologia`, `p.vendido_em is null`];
  let ordem = 'p.destaque desc, p.created_at desc';
  if (t) {
    params.push(`%${t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}%`);
    conds.push(`${norm("concat_ws(' ', p.titulo, p.condominio, p.bairro, p.cidade, p.jetimob_codigo, p.id)")} like $${params.length}`);
  } else {
    if (prefs.quartos?.length) {
      params.push(prefs.quartos);
      conds.push(`(coalesce(p.quartos, 0) = any($${params.length}::int[]) or (4 = any($${params.length}::int[]) and p.quartos >= 4))`);
    }
    if (prefs.valorMax) {
      params.push(prefs.valorMax * 1.1);
      conds.push(`p.price_value <= $${params.length}`);
    }
    if (prefs.bairros?.length) {
      params.push(prefs.bairros.map((b) => b.toLowerCase()));
      ordem = `(lower(p.bairro) = any($${params.length}::text[])) desc, ${ordem}`;
    }
  }
  const imoveis = await query<Record<string, unknown>>(
    `select p.id, p.slug, p.titulo, p.condominio, p.bairro, p.cidade, p.uf, p.finalidade, p.price_value, p.quartos, p.area, p.visibilidade,
            coalesce(p.capa_mini, p.photos->>0) capa, d.name d_nome
       from properties p left join developments d on d.id = p.empreendimento_id
      where ${conds.join(' and ')} order by ${ordem} limit 24`,
    params
  );
  const out: OpcaoEnvio[] = imoveis.map((r) => ({
    tipo: 'imovel',
    id: String(r.id),
    titulo: String(r.d_nome || r.condominio || r.titulo || 'Imóvel'),
    sub: [r.quartos ? `${r.quartos} qtos` : null, r.area ? `${Math.round(Number(r.area))} m²` : null, r.bairro].filter(Boolean).join(' · '),
    preco: r.price_value == null ? null : Number(r.price_value),
    capa: (r.capa as string) ?? null,
    privado: r.visibilidade === 'privado',
    url: urlImovel({ id: String(r.id), slug: r.slug as string, uf: r.uf as string, cidade: r.cidade as string, bairro: r.bairro as string, finalidade: r.finalidade as string })
  }));
  if (t) {
    const condos = await query<Record<string, unknown>>(
      `select d.id, d.slug, d.name, d.bairro, d.cidade, d.uf, coalesce(d.capa_mini, d.photos->>0) capa,
              (select min(x.price_value) from properties x where x.empreendimento_id = d.id and x.price_value > 0 and x.vendido_em is null) preco
         from developments d where d.status = 'publicado' and ${norm('d.name')} like $1 order by d.delivery_date desc nulls last limit 8`,
      [params[0]]
    );
    for (const r of condos)
      out.push({
        tipo: 'condominio',
        id: String(r.id),
        titulo: String(r.name),
        sub: ['Condomínio', r.bairro].filter(Boolean).join(' · '),
        preco: r.preco == null ? null : Number(r.preco),
        capa: (r.capa as string) ?? null,
        privado: false,
        url: urlCondominio({ id: String(r.id), slug: r.slug as string, uf: r.uf as string, cidade: r.cidade as string, bairro: r.bairro as string })
      });
  }
  return out;
}

export type Envio = {
  id: string; codigo: string; tipo: string; refId: string; titulo: string | null; sub: string | null; preco: number | null; capa: string | null; privado: boolean;
  destino: string; enviadoEm: string; enviadoPor: string | null; aberturas: number; primeiroAberto: string | null; ultimoAberto: string | null;
};

/** Gera um link rastreado para cada imóvel escolhido e devolve a mensagem pronta para o WhatsApp */
export async function enviarImoveis(contatoId: string, itens: { tipo: 'imovel' | 'condominio'; id: string }[]): Promise<{ mensagem: string; enviados: number; avisos: string[] }> {
  const s = await exigirEquipe();
  await podeVerContato(s, contatoId);
  const { SITE_URL } = await import('./seo');
  const { criarLinkPrivado } = await import('./links-privados');
  const c = (await query<{ nome: string; telefone: string | null }>(`select nome, telefone from crm_contatos where id = $1`, [contatoId]))[0];
  const lista = (itens ?? []).filter((i) => (i.tipo === 'imovel' || i.tipo === 'condominio') && /^[\w-]{1,80}$/.test(i.id)).slice(0, 12);
  const todas = await opcoesPorId(lista);
  const linhas: string[] = [];
  const avisos: string[] = [];
  const brl = (n: number | null) => (n ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '');
  for (const o of todas) {
    let destino = `${SITE_URL}${o.url}`;
    // privado: link privado preso ao celular da pessoa (sem telefone, não dá para enviar)
    if (o.privado) {
      if (!c.telefone) {
        avisos.push(`${o.titulo}: é privado e o contato não tem telefone. Cadastre o WhatsApp dele para enviar.`);
        continue;
      }
      const r = await criarLinkPrivado(o.id, { telefone: c.telefone.replace(/^55/, ''), nome: c.nome }).catch((e) => ({ ok: false as const, erro: String(e?.message ?? e) }));
      if (!r.ok) {
        avisos.push(`${o.titulo}: ${r.erro}`);
        continue;
      }
      destino = r.link.url;
    }
    const codigo = (await import('crypto')).randomBytes(6).toString('base64url');
    await query(
      `insert into crm_envios (codigo, contato_id, tipo, ref_id, titulo, sub, preco, capa, destino, privado, enviado_por) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [codigo, contatoId, o.tipo, o.id, o.titulo, o.sub, o.preco, o.capa, destino, o.privado, s.email]
    );
    linhas.push(`*${o.titulo}*${o.preco ? ` · ${brl(o.preco)}` : ''}${o.sub ? `\n${o.sub}` : ''}\n${SITE_URL}/r/${codigo}`);
  }
  if (linhas.length) {
    await query(`insert into crm_atividades (contato_id, tipo, texto, autor_email) values ($1, 'envio', $2, $3)`, [
      contatoId,
      `Enviou ${linhas.length} imóve${linhas.length > 1 ? 'is' : 'l'}: ${todas.filter((o) => !avisos.some((a) => a.startsWith(o.titulo))).map((o) => o.titulo).join(', ')}`,
      s.email
    ]);
    await respondeu(contatoId);
    await query(`update crm_negocios set etapa = 'atendimento', etapa_desde = now() where contato_id = $1 and etapa = 'novo' and funil in ('comprar', 'alugar')`, [contatoId]);
  }
  const primeiro = c.nome.split(' ')[0];
  const mensagem = linhas.length ? `Olá, ${primeiro}! Separei ${linhas.length > 1 ? 'estes imóveis' : 'este imóvel'} para você:\n\n${linhas.join('\n\n')}\n\nQual te chamou mais atenção?` : '';
  return { mensagem, enviados: linhas.length, avisos };
}

async function opcoesPorId(itens: { tipo: 'imovel' | 'condominio'; id: string }[]): Promise<OpcaoEnvio[]> {
  const { urlImovel, urlCondominio } = await import('./urls');
  const ims = itens.filter((i) => i.tipo === 'imovel').map((i) => i.id);
  const cos = itens.filter((i) => i.tipo === 'condominio').map((i) => i.id);
  const [a, b] = await Promise.all([
    ims.length
      ? query<Record<string, unknown>>(
          `select p.id, p.slug, p.titulo, p.condominio, p.bairro, p.cidade, p.uf, p.finalidade, p.price_value, p.quartos, p.area, p.visibilidade, coalesce(p.capa_mini, p.photos->>0) capa, d.name d_nome
             from properties p left join developments d on d.id = p.empreendimento_id where p.id = any($1::text[])`,
          [ims]
        )
      : Promise.resolve([]),
    cos.length
      ? query<Record<string, unknown>>(
          `select d.id, d.slug, d.name, d.bairro, d.cidade, d.uf, coalesce(d.capa_mini, d.photos->>0) capa,
                  (select min(x.price_value) from properties x where x.empreendimento_id = d.id and x.price_value > 0 and x.vendido_em is null) preco
             from developments d where d.id = any($1::text[])`,
          [cos]
        )
      : Promise.resolve([])
  ]);
  return [
    ...a.map((r) => ({
      tipo: 'imovel' as const,
      id: String(r.id),
      titulo: String(r.d_nome || r.condominio || r.titulo || 'Imóvel'),
      sub: [r.quartos ? `${r.quartos} qtos` : null, r.area ? `${Math.round(Number(r.area))} m²` : null, r.bairro].filter(Boolean).join(' · '),
      preco: r.price_value == null ? null : Number(r.price_value),
      capa: (r.capa as string) ?? null,
      privado: r.visibilidade === 'privado',
      url: urlImovel({ id: String(r.id), slug: r.slug as string, uf: r.uf as string, cidade: r.cidade as string, bairro: r.bairro as string, finalidade: r.finalidade as string })
    })),
    ...b.map((r) => ({
      tipo: 'condominio' as const,
      id: String(r.id),
      titulo: String(r.name),
      sub: ['Condomínio', r.bairro].filter(Boolean).join(' · '),
      preco: r.preco == null ? null : Number(r.preco),
      capa: (r.capa as string) ?? null,
      privado: false,
      url: urlCondominio({ id: String(r.id), slug: r.slug as string, uf: r.uf as string, cidade: r.cidade as string, bairro: r.bairro as string })
    }))
  ];
}

/** Dados básicos para abrir uma proposta já com o comprador preenchido */
export async function contatoParaProposta(id: string): Promise<{ nome: string; telefone: string | null; email: string | null } | null> {
  const s = await exigirEquipe();
  await podeVerContato(s, id);
  const c = (await query<{ nome: string; telefone: string | null; email: string | null }>(`select nome, telefone, email from crm_contatos where id = $1`, [id]))[0];
  if (!c) return null;
  const t = c.telefone?.replace(/^55/, '') ?? null;
  return { nome: c.nome, telefone: t ? `(${t.slice(0, 2)}) ${t.slice(2, t.length - 4)}-${t.slice(-4)}` : null, email: c.email };
}

// ---------------- WhatsApp pela API e IA ----------------
export type MensagemWa = { id: string; direcao: string; autor: string; texto: string | null; status: string | null; quando: string };

export async function conversaWhatsapp(contatoId: string): Promise<{ mensagens: MensagemWa[]; api: boolean; iaLigada: boolean; iaAtiva: boolean }> {
  const s = await exigirEquipe();
  await podeVerContato(s, contatoId);
  const { whatsappConfigurado } = await import('./whatsapp');
  const { lerConfigIA } = await import('./crm-config');
  const [ms, cfg, c] = await Promise.all([
    query<Record<string, unknown>>(`select * from crm_mensagens where contato_id = $1 order by criado_em asc limit 300`, [contatoId]),
    lerConfigIA(),
    query<{ ia_ativa: boolean }>(`select ia_ativa from crm_contatos where id = $1`, [contatoId])
  ]);
  return {
    mensagens: ms.map((m) => ({
      id: String(m.id),
      direcao: String(m.direcao),
      autor: String(m.autor),
      texto: (m.texto as string) ?? null,
      status: (m.status as string) ?? null,
      quando: new Date(m.criado_em as string).toISOString()
    })),
    api: whatsappConfigurado(),
    iaLigada: cfg.ligada && !!process.env.ANTHROPIC_API_KEY,
    iaAtiva: !!c[0]?.ia_ativa
  };
}

/** O corretor responde pelo próprio CRM (pela API). A IA fica pausada neste contato. */
export async function enviarMensagemWhatsapp(contatoId: string, texto: string): Promise<{ ok: boolean; erro?: string }> {
  const s = await exigirEquipe();
  await podeVerContato(s, contatoId);
  const t = String(texto ?? '').trim().slice(0, 4000);
  if (!t) return { ok: false, erro: 'Escreva a mensagem.' };
  const c = (await query<{ telefone: string | null }>(`select telefone from crm_contatos where id = $1`, [contatoId]))[0];
  if (!c?.telefone) return { ok: false, erro: 'Contato sem WhatsApp.' };
  const { enviarTextoWhatsapp } = await import('./whatsapp');
  const r = await enviarTextoWhatsapp(c.telefone, t);
  if (!r.ok) return { ok: false, erro: r.erro };
  await query(`insert into crm_mensagens (contato_id, direcao, autor, texto, wa_id, status) values ($1, 'saida', $2, $3, $4, 'enviada')`, [contatoId, s.email, t, r.id]);
  await query(`update crm_contatos set ia_ativa = false where id = $1`, [contatoId]);
  await respondeu(contatoId);
  await query(`update crm_negocios set etapa = 'atendimento', etapa_desde = now() where contato_id = $1 and etapa = 'novo' and funil in ('comprar', 'vender', 'alugar')`, [contatoId]);
  return { ok: true };
}

export async function ligarIaNoContato(contatoId: string, ativa: boolean): Promise<void> {
  const s = await exigirEquipe();
  await podeVerContato(s, contatoId);
  await query(`update crm_contatos set ia_ativa = $2 where id = $1`, [contatoId, !!ativa]);
  await query(`insert into crm_atividades (contato_id, tipo, texto, autor_email) values ($1, 'sistema', $2, $3)`, [contatoId, ativa ? 'IA ligada para este contato' : 'IA pausada para este contato', s.email]);
}

export async function lerConfiguracaoIA() {
  const s = await exigirEquipe();
  if (s.role !== 'admin') throw new Error('Só o admin configura a IA.');
  const { lerConfigIA } = await import('./crm-config');
  const { whatsappConfigurado } = await import('./whatsapp');
  return {
    config: await lerConfigIA(),
    status: {
      whatsapp: whatsappConfigurado(),
      assinatura: !!process.env.WHATSAPP_APP_SECRET,
      verificacao: !!process.env.WHATSAPP_VERIFY_TOKEN,
      ia: !!process.env.ANTHROPIC_API_KEY,
      modelo: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'
    }
  };
}

export async function salvarConfiguracaoIA(c: import('./crm-config').ConfigIA): Promise<void> {
  const s = await exigirEquipe();
  if (s.role !== 'admin') throw new Error('Só o admin configura a IA.');
  const { gravarConfigIA, CONFIG_PADRAO } = await import('./crm-config');
  const num = (v: unknown, min: number, max: number, padrao: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min && n <= max ? n : padrao;
  };
  const taxas: Record<string, number> = {};
  for (const [b, t] of Object.entries(c.taxasBancos ?? {})) {
    const n = Number(t);
    if (b.trim() && Number.isFinite(n) && n > 0 && n < 40) taxas[b.trim().slice(0, 40)] = n;
  }
  await gravarConfigIA({
    ligada: !!c.ligada,
    modoTeste: c.modoTeste !== false,
    numerosTeste: (c.numerosTeste ?? []).map((n) => normTel(n)).filter((n): n is string => !!n).slice(0, 20),
    nomeAssistente: String(c.nomeAssistente || CONFIG_PADRAO.nomeAssistente).slice(0, 60),
    taxaMediaAa: c.taxaMediaAa ? num(c.taxaMediaAa, 1, 40, 0) || null : null,
    entradaPct: num(c.entradaPct, 5, 90, 20),
    prazoMeses: num(c.prazoMeses, 12, 480, 420),
    taxasBancos: taxas,
    bancos: String(c.bancos || CONFIG_PADRAO.bancos).slice(0, 200),
    instrucoesExtras: String(c.instrucoesExtras ?? '').slice(0, 3000)
  });
}

// ---------------- Panorama (Início do painel) ----------------
export type Panorama = {
  esperando: number;
  tarefas: number;
  atrasadas: number;
  visitas: number;
  semDono: number;
  negociosAbertos: number;
  novos7d: number;
  ganhosMes: number;
  valorGanhoMes: number;
  porEtapa: { etapa: string; n: number }[];
  todaEquipe: boolean;
};

/** Visão geral do CRM no nível de cada pessoa: admin e analista veem a equipe toda; corretor, só os dele. */
export async function crmPanorama(): Promise<Panorama> {
  const s = await exigirEquipe();
  const hoje = await crmHoje();
  const neg = comEscopo(
    s,
    `select count(*) filter (where n.etapa not in ('ganho', 'perdido')) abertos,
            count(*) filter (where n.etapa = 'ganho' and coalesce(n.etapa_desde, n.criado_em) >= date_trunc('month', now() at time zone 'America/Sao_Paulo')) ganhos,
            coalesce(sum(n.valor) filter (where n.etapa = 'ganho' and coalesce(n.etapa_desde, n.criado_em) >= date_trunc('month', now() at time zone 'America/Sao_Paulo')), 0) valor
       from crm_negocios n where {ESCOPO}`,
    [],
    'n.corretor_email'
  );
  const etapas = comEscopo(
    s,
    `select n.etapa, count(*) n from crm_negocios n where n.etapa not in ('ganho', 'perdido') and {ESCOPO} group by 1 order by 2 desc limit 6`,
    [],
    'n.corretor_email'
  );
  const novos = comEscopo(s, `select count(*) n from crm_contatos c where c.criado_em > now() - interval '7 days' and {ESCOPO}`, []);
  const [a, b, c] = await Promise.all([
    query<Record<string, string>>(neg.sql, neg.params),
    query<Record<string, string>>(etapas.sql, etapas.params),
    query<Record<string, string>>(novos.sql, novos.params)
  ]);
  return {
    ...hoje.numeros,
    negociosAbertos: Number(a[0]?.abertos) || 0,
    ganhosMes: Number(a[0]?.ganhos) || 0,
    valorGanhoMes: Number(a[0]?.valor) || 0,
    novos7d: Number(c[0]?.n) || 0,
    porEtapa: b.map((x) => ({ etapa: x.etapa, n: Number(x.n) || 0 })),
    todaEquipe: veTudo(s.role)
  };
}
