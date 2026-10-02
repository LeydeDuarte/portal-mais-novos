// CRM (módulo do servidor; NÃO é 'use server', nada aqui vira endpoint).
//
// Contato = uma pessoa só, juntando tudo o que entra pelo portal: WhatsApp dos
// anúncios, formulários, Avise-me, avaliador, propostas, Jetimob (interest_leads) e
// "Venda seu imóvel" (captacoes). A chave é o telefone (só números, com 55) e, sem
// telefone, o e-mail. Cada entrada vira uma atividade na linha do tempo e, se a pessoa
// ainda não tem negócio aberto naquele funil, um negócio na etapa "novo".
//
// Jornada: as visitas do portal são anônimas (cookie mn_vid). Quando a pessoa entra em
// contato, o mn_vid daquele navegador fica no contato, e o histórico passa a aparecer
// na ficha (inclusive o de antes do contato). Só de quem virou contato.
import { query } from './db';
import { classificarOrigem, type OrigemBruta } from './origem-lead';
import { ETAPAS, FUNIS, etapaValida, type Funil, type Nota, type PassoJornada, type ResumoPortal } from './crm-tipos';
export { ETAPAS, FUNIS, etapaValida };
export type { Funil, Nota, PassoJornada, ResumoPortal };

/** telefone só com números e com o 55 do Brasil (null se não parecer telefone) */
export function normTel(t: string | null | undefined): string | null {
  let d = String(t ?? '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length >= 12 && d.length <= 13 ? d : null;
}

// palavras que indicam corretor (no nome ou na mensagem)
const SINAIS_CORRETOR: [RegExp, string][] = [
  [/\bcorretor(a)?\b/i, 'escreveu "corretor"'],
  [/\bcreci\b/i, 'citou CRECI'],
  [/\bimobili[aá]ria\b/i, 'citou imobiliária'],
  [/\bparceria\b/i, 'pediu parceria'],
  [/\bcomiss[aã]o\b/i, 'perguntou da comissão'],
  [/tenho (um )?cliente/i, 'disse que tem cliente'],
  [/\bexclusividade\b/i, 'perguntou de exclusividade'],
  [/(n[uú]mero|n[º°]) da unidade/i, 'pediu o número da unidade'],
  [/(nome|contato) do propriet[aá]rio/i, 'pediu o proprietário'],
  [/\bbroker\b/i, 'escreveu "broker"']
];
export function motivoCorretor(...textos: (string | null | undefined)[]): string | null {
  const t = textos.filter(Boolean).join(' ');
  const achados = SINAIS_CORRETOR.filter(([r]) => r.test(t)).map(([, m]) => m);
  return achados.length ? achados.slice(0, 3).join(', ') : null;
}

type Lead = {
  id: string; nome: string; email: string | null; telefone: string | null; condominio: string | null; mensagem: string | null;
  development_id: string | null; property_id: string | null; finalidade: string | null; valor_max: string | null; quartos: number | null;
  quartos_opcoes: number[] | null; grupo: string | null; raio: number | null; bairro_ref: string | null; cidade_ref: string | null;
  visitante: string | null; sou_corretor: boolean; created_at: string | Date; p_corretor: string | null; p_preco: string | null; p_titulo: string | null;
  origem_web: OrigemBruta | null;
};

function origemDoLead(l: Lead): { origem: string; funil: Funil; etapa: string; texto: string } {
  const m = l.mensagem ?? '';
  if (l.sou_corretor) return { origem: 'corretor', funil: 'parceiros', etapa: 'novo', texto: m || 'Disse que é corretor(a)' };
  if (/^Contato pelo WhatsApp/i.test(m)) return { origem: 'whatsapp', funil: l.finalidade === 'aluguel' ? 'alugar' : 'comprar', etapa: 'novo', texto: m };
  if (l.condominio === 'Avaliação de imóvel' || /^Avaliação:/i.test(m)) return { origem: 'avaliador', funil: 'vender', etapa: 'novo', texto: m };
  if (/^Proposta/i.test(m)) return { origem: 'proposta', funil: 'comprar', etapa: 'proposta', texto: m };
  if (l.condominio === 'Jetimob (importado)') return { origem: 'jetimob', funil: 'comprar', etapa: 'novo', texto: m || 'Contato importado da Jetimob' };
  if (l.grupo || (l.raio ?? 0) !== 0 || (l.quartos_opcoes?.length ?? 0) > 0)
    return { origem: 'avise-me', funil: l.finalidade === 'aluguel' ? 'alugar' : 'comprar', etapa: 'novo', texto: `Pediu aviso: ${l.condominio ?? ''}${m ? ` · ${m}` : ''}` };
  if (/mais valor|cr[eé]dito|financiamento|home equity/i.test(`${l.condominio} ${m}`)) return { origem: 'formulario', funil: 'credito', etapa: 'novo', texto: m || 'Pediu crédito' };
  return { origem: 'formulario', funil: l.finalidade === 'aluguel' ? 'alugar' : 'comprar', etapa: 'novo', texto: m || `Interesse em ${l.condominio ?? 'imóvel'}` };
}

/** acha (pelo telefone ou e-mail) ou cria o contato; devolve o id */
type CanalLead = { canal: string; pago: boolean; campanha: string | null };
async function acharOuCriar(c: { nome: string; telefone: string | null; email: string | null; origem: string; corretor: string | null; visitante: string | null; quando: Date; tipo: string; possivel: string | null; prefs: Record<string, unknown>; canal: CanalLead }): Promise<string> {
  // mesma pessoa: mesmo telefone, mesmo e-mail ou (sem os dois) o mesmo navegador
  const achado = await query<{ id: string }>(
    `select id from crm_contatos
      where ($1::text is not null and telefone = $1) or ($2::text is not null and lower(email) = lower($2))
         or ($1::text is null and $2::text is null and $3::text is not null and $3 = any(visitantes))
      order by (telefone = $1) desc nulls last limit 1`,
    [c.telefone, c.email, c.visitante]
  );
  if (achado[0]) {
    await query(
      `update crm_contatos set
          telefone = coalesce(telefone, $2), email = coalesce(email, $3),
          corretor_email = coalesce(corretor_email, $4),
          visitantes = case when $5::text is not null and not ($5 = any(visitantes)) then array_append(visitantes, $5) else visitantes end,
          tipo = case when $7 = 'corretor' then 'corretor' else tipo end,
          possivel_corretor = coalesce(possivel_corretor, $8),
          preferencias = preferencias || $9::jsonb,
          -- a primeira fonte fica (quem trouxe a pessoa); "Direto" é trocado por uma fonte conhecida
          canal = case when canal is null or canal = 'Direto' then $10 else canal end,
          canal_pago = case when canal is null or canal = 'Direto' then $11 else canal_pago end,
          campanha = coalesce(campanha, $12),
          ultimo_contato_em = greatest(coalesce(ultimo_contato_em, $6), $6), atualizado_em = now()
        where id = $1`,
      [achado[0].id, c.telefone, c.email, c.corretor, c.visitante, c.quando, c.tipo, c.possivel, JSON.stringify(c.prefs), c.canal.canal, c.canal.pago, c.canal.campanha]
    );
    return achado[0].id;
  }
  const r = await query<{ id: string }>(
    // entradas antigas (mais de 3 dias, ex.: importadas da Jetimob) não entram como "esperando resposta"
    `insert into crm_contatos (nome, telefone, email, tipo, possivel_corretor, corretor_email, origem, visitantes, criado_em, ultimo_contato_em, preferencias, ultima_resposta_em, canal, canal_pago, campanha)
     values ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9, $9, $10::jsonb, case when $9::timestamptz < now() - interval '3 days' then $9::timestamptz end, $11, $12, $13) returning id`,
    [c.nome, c.telefone, c.email, c.tipo, c.possivel, c.corretor, c.origem, c.visitante ? [c.visitante] : [], c.quando, JSON.stringify(c.prefs), c.canal.canal, c.canal.pago, c.canal.campanha]
  );
  return r[0].id;
}

async function abrirNegocio(contatoId: string, funil: Funil, etapa: string, n: { titulo: string | null; valor: number | null; property_id: string | null; development_id: string | null; corretor: string | null; quando: Date }) {
  const aberto = await query<{ id: string; etapa: string }>(
    `select id, etapa from crm_negocios where contato_id = $1 and funil = $2 and etapa not in ('ganho', 'perdido') limit 1`,
    [contatoId, funil]
  );
  if (aberto[0]) {
    // proposta feita: o negócio avança sozinho para a etapa da proposta
    if (etapa === 'proposta' && ['novo', 'atendimento', 'visita'].includes(aberto[0].etapa))
      await query(`update crm_negocios set etapa = 'proposta', etapa_desde = now() where id = $1`, [aberto[0].id]);
    return;
  }
  await query(
    `insert into crm_negocios (contato_id, funil, etapa, titulo, valor, property_id, development_id, corretor_email, criado_em, etapa_desde)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
    [contatoId, funil, etapa, n.titulo, n.valor, n.property_id, n.development_id, n.corretor, n.quando]
  );
}

/** Traz para o CRM as entradas do site que ainda não viraram contato (rápido quando não há nada novo) */
export async function sincronizarCRM(limite = 300): Promise<number> {
  const leads = await query<Lead>(
    `select l.*, p.corretor_email as p_corretor, p.price_value as p_preco, coalesce(d.name, p.titulo) as p_titulo
       from interest_leads l
       left join properties p on p.id = l.property_id
       left join developments d on d.id = coalesce(l.development_id, p.empreendimento_id)
      where l.contato_id is null
      order by l.created_at asc
      limit $1`,
    [limite]
  );
  let n = 0;
  for (const l of leads) {
    const o = origemDoLead(l);
    const tel = normTel(l.telefone);
    const email = l.email?.trim().toLowerCase() || null;
    if (!tel && !email && !l.visitante) {
      await query(`update interest_leads set contato_id = '00000000-0000-0000-0000-000000000000' where id = $1`, [l.id]);
      continue;
    }
    // WhatsApp de um anúncio: acha o anúncio pelo link da mensagem (e o corretor dele)
    if (!l.property_id && /\/imovel\//.test(l.mensagem ?? '')) {
      const slug = (l.mensagem ?? '').match(/\/imovel\/[^\s)]*\/([\w-]+)\)?/)?.[1];
      if (slug) {
        const p = (await query<{ id: string; corretor_email: string | null; price_value: string | null; titulo: string | null }>(`select id, corretor_email, price_value, titulo from properties where slug = $1 or id = $1 limit 1`, [slug]))[0];
        if (p) {
          l.property_id = p.id;
          l.p_corretor = p.corretor_email;
          l.p_preco = p.price_value;
          l.p_titulo = l.p_titulo ?? p.titulo;
        }
      }
    }
    const quando = new Date(l.created_at);
    const possivel = l.sou_corretor ? null : motivoCorretor(l.nome, l.mensagem);
    const prefs: Record<string, unknown> = {};
    if (l.valor_max) prefs.valorMax = Number(l.valor_max);
    if (l.quartos_opcoes?.length) prefs.quartos = l.quartos_opcoes;
    else if (l.quartos) prefs.quartos = [l.quartos];
    if (l.grupo) prefs.grupo = l.grupo;
    if (l.bairro_ref) prefs.bairros = [l.bairro_ref];
    if (l.raio) prefs.alcance = { raio: l.raio, ref: l.condominio };
    const id = await acharOuCriar({
      nome: l.nome,
      telefone: tel,
      email,
      origem: o.origem,
      corretor: l.p_corretor,
      visitante: l.visitante,
      quando,
      tipo: l.sou_corretor ? 'corretor' : 'cliente',
      possivel,
      prefs,
      canal:
        o.origem === 'jetimob'
          ? { canal: 'Jetimob (importado)', pago: false, campanha: null }
          : o.origem === 'proposta' && !l.origem_web
            ? { canal: 'Cadastrado pela equipe', pago: false, campanha: null }
            : classificarOrigem(l.origem_web)
    });
    await query(`insert into crm_atividades (contato_id, tipo, texto, dados, criado_em) values ($1, 'entrada', $2, $3::jsonb, $4)`, [
      id,
      o.texto.slice(0, 1500),
      JSON.stringify({ origem: o.origem, lead: l.id, condominio: l.condominio, property_id: l.property_id, development_id: l.development_id }),
      quando
    ]);
    if (o.origem === 'avaliador') await query(`insert into crm_atividades (contato_id, tipo, texto, criado_em) values ($1, 'simulacao', $2, $3)`, [id, o.texto.slice(0, 1500), quando]);
    await abrirNegocio(id, l.sou_corretor ? 'parceiros' : o.funil, o.etapa, {
      titulo: (l.p_titulo || l.condominio || null)?.slice(0, 160) ?? null,
      valor: l.p_preco ? Number(l.p_preco) : l.valor_max ? Number(l.valor_max) : null,
      property_id: l.property_id,
      development_id: l.development_id,
      corretor: l.p_corretor,
      quando
    });
    await query(`update interest_leads set contato_id = $2 where id = $1`, [l.id, id]);
    n++;
  }
  // "Venda seu imóvel"
  const cap = await query<{ id: string; nome: string; telefone: string | null; email: string | null; condominio: string | null; bairro: string | null; cidade: string | null; tipo_unidade: string | null; area: string | null; valor_pretendido: string | null; observacoes: string | null; visitante: string | null; created_at: string | Date; origem_web: OrigemBruta | null }>(
    `select * from captacoes where contato_id is null order by created_at asc limit $1`,
    [limite]
  );
  for (const c of cap) {
    const tel = normTel(c.telefone);
    const email = c.email?.trim().toLowerCase() || null;
    if (!tel && !email) {
      await query(`update captacoes set contato_id = '00000000-0000-0000-0000-000000000000' where id = $1`, [c.id]);
      continue;
    }
    const quando = new Date(c.created_at);
    const id = await acharOuCriar({ nome: c.nome, telefone: tel, email, origem: 'vender', corretor: null, visitante: c.visitante, quando, tipo: 'cliente', possivel: motivoCorretor(c.nome, c.observacoes), prefs: {}, canal: classificarOrigem(c.origem_web) });
    const texto = `Quer vender: ${[c.tipo_unidade?.replace(/_/g, ' '), c.area ? `${c.area} m²` : null, c.condominio, c.bairro, c.cidade].filter(Boolean).join(' · ')}${c.valor_pretendido ? ` · pede R$ ${Number(c.valor_pretendido).toLocaleString('pt-BR')}` : ''}`;
    await query(`insert into crm_atividades (contato_id, tipo, texto, criado_em) values ($1, 'entrada', $2, $3)`, [id, texto, quando]);
    await abrirNegocio(id, 'vender', 'novo', { titulo: c.condominio || c.bairro || 'Imóvel para vender', valor: c.valor_pretendido ? Number(c.valor_pretendido) : null, property_id: null, development_id: null, corretor: null, quando });
    await query(`update captacoes set contato_id = $2 where id = $1`, [c.id, id]);
    n++;
  }
  return n;
}

// ---------------- Jornada e nota ----------------
const tituloDaPagina = (p: string) => {
  if (p === '/' || !p) return 'Feed de imóveis';
  if (p.startsWith('/mapa')) return 'Mapa';
  if (p.startsWith('/avaliar')) return 'Avaliador de imóvel';
  if (p.startsWith('/lancamentos')) return 'Lançamentos e condomínios';
  if (p.startsWith('/news')) return `News · ${p.split('/').slice(2).join(' / ').replace(/-/g, ' ') || 'capa'}`;
  const ult = p.split('/').filter(Boolean).pop() ?? p;
  const nome = ult.replace(/-[a-z0-9]{6,}$/i, '').replace(/-/g, ' ');
  const tipo = p.startsWith('/empreendimento') ? 'Condomínio' : p.startsWith('/imovel') ? 'Anúncio' : 'Página';
  return `${tipo} · ${nome.charAt(0).toUpperCase()}${nome.slice(1)}`;
};

export async function jornada(visitantes: string[], limite = 60): Promise<{ passos: PassoJornada[]; resumo: Omit<ResumoPortal, 'simulacoes' | 'propostas'> }> {
  const vazio = { passos: [], resumo: { paginas: 0, segundos: 0, condominios: 0, imoveis: 0, voltas: 0, desde: null } };
  if (!visitantes.length) return vazio;
  const ev = await query<{ tipo: string; pagina: string | null; valor: number | null; created_at: string | Date }>(
    `select tipo, pagina, valor, created_at from eventos
      where visitante = any($1::text[]) and tipo in ('visita', 'tempo', 'sol', 'avaliar', 'compartilhar', 'whatsapp')
      order by created_at asc limit 3000`,
    [visitantes]
  );
  if (!ev.length) return vazio;
  const tempo = new Map<string, number>();
  const visitas = new Map<string, number>();
  for (const e of ev) {
    const p = e.pagina ?? '/';
    if (e.tipo === 'tempo') tempo.set(p, (tempo.get(p) ?? 0) + (e.valor ?? 0));
    if (e.tipo === 'visita') visitas.set(p, (visitas.get(p) ?? 0) + 1);
  }
  const passos: PassoJornada[] = [];
  for (const e of ev) {
    if (e.tipo === 'tempo') continue;
    const p = e.pagina ?? '/';
    const ultimo = passos[passos.length - 1];
    if (e.tipo === 'visita' && ultimo && ultimo.pagina === p && ultimo.tipo === 'visita') continue;
    passos.push({
      quando: new Date(e.created_at).toISOString(),
      pagina: p,
      titulo: e.tipo === 'visita' ? tituloDaPagina(p) : e.tipo === 'sol' ? `Abriu a posição do sol · ${tituloDaPagina(p)}` : e.tipo === 'whatsapp' ? `Clicou no WhatsApp · ${tituloDaPagina(p)}` : e.tipo === 'avaliar' ? 'Abriu o avaliador' : `Compartilhou · ${tituloDaPagina(p)}`,
      segundos: e.tipo === 'visita' ? tempo.get(p) ?? 0 : 0,
      tipo: e.tipo
    });
  }
  const paginas = Array.from(visitas.keys());
  return {
    passos: passos.slice(-limite).reverse(),
    resumo: {
      paginas: paginas.length,
      segundos: Array.from(tempo.values()).reduce((a, b) => a + b, 0),
      condominios: paginas.filter((p) => p.startsWith('/empreendimento')).length,
      imoveis: paginas.filter((p) => p.startsWith('/imovel')).length,
      voltas: Array.from(visitas.values()).filter((v) => v >= 3).length,
      desde: new Date(ev[0].created_at).toISOString()
    }
  };
}


/** Nota de 0 a 100 (intenção + encaixe), com esfriamento a cada 14 dias */
export function calcularNota(x: {
  etapa?: string | null;
  propostas: number;
  simulacoes: number;
  resumo: Pick<ResumoPortal, 'voltas' | 'segundos' | 'condominios' | 'imoveis'>;
  ultimoContato: Date | null;
  ultimaAtividadePortal: Date | null;
  temPreferencias: boolean;
}): Nota {
  const motivos: string[] = [];
  let n = 0;
  const add = (p: number, m: string) => {
    n += p;
    motivos.push(m);
  };
  if (x.etapa === 'visita') add(25, 'visita marcada');
  if (x.propostas > 0 || x.etapa === 'proposta' || x.etapa === 'negociacao') add(30, 'fez proposta');
  if (x.simulacoes > 0) add(15, x.simulacoes > 1 ? `${x.simulacoes} simulações` : 'fez simulação');
  if (x.resumo.voltas > 0) add(10, `voltou 3+ vezes a ${x.resumo.voltas} página${x.resumo.voltas > 1 ? 's' : ''}`);
  if (x.resumo.segundos >= 300) add(5, `${Math.round(x.resumo.segundos / 60)} min no portal`);
  if (x.resumo.condominios + x.resumo.imoveis >= 3) add(5, `viu ${x.resumo.condominios + x.resumo.imoveis} imóveis e condomínios`);
  if (x.temPreferencias) add(10, 'disse o que procura');
  // esfria: metade a cada 14 dias desde o último sinal
  const ultimo = Math.max(x.ultimoContato?.getTime() ?? 0, x.ultimaAtividadePortal?.getTime() ?? 0);
  if (ultimo) {
    const dias = (Date.now() - ultimo) / 86400000;
    if (dias > 3) motivos.push(`sem sinal há ${Math.round(dias)} dias`);
    n = n * Math.pow(0.5, dias / 14);
  }
  const valor = Math.max(0, Math.min(100, Math.round(n)));
  return { valor, faixa: valor >= 60 ? 'quente' : valor >= 30 ? 'morno' : 'frio', motivos };
}

// ---------------- Entrada pelo WhatsApp (API) ----------------
/** Acha ou cria o contato de quem escreveu no WhatsApp da empresa (e abre um negócio se não houver) */
export async function contatoDoWhatsapp(d: {
  telefone: string;
  nome: string;
  texto: string;
  anuncio?: { headline?: string; source_url?: string; source_type?: string } | null;
}): Promise<{ id: string; novo: boolean }> {
  const tel = normTel(d.telefone);
  const ja = tel ? (await query<{ id: string }>(`select id from crm_contatos where telefone = $1`, [tel]))[0] : undefined;
  const canal = d.anuncio
    ? { canal: /instagram/i.test(d.anuncio.source_url ?? '') ? 'Instagram' : 'Facebook', pago: true, campanha: d.anuncio.headline?.slice(0, 80) ?? null }
    : { canal: 'WhatsApp da empresa', pago: false, campanha: null };
  const id = await acharOuCriar({
    nome: d.nome || 'Contato do WhatsApp',
    telefone: tel,
    email: null,
    origem: 'whatsapp',
    corretor: null,
    visitante: null,
    quando: new Date(),
    tipo: 'cliente',
    possivel: motivoCorretor(d.nome, d.texto),
    prefs: {},
    canal
  });
  if (!ja) {
    await query(`insert into crm_atividades (contato_id, tipo, texto) values ($1, 'entrada', $2)`, [
      id,
      d.anuncio ? `Escreveu no WhatsApp pelo anúncio${d.anuncio.headline ? ` "${d.anuncio.headline}"` : ''}` : 'Escreveu no WhatsApp da empresa'
    ]);
    await abrirNegocio(id, 'comprar', 'novo', { titulo: d.anuncio?.headline ?? null, valor: null, property_id: null, development_id: null, corretor: null, quando: new Date() });
  }
  return { id, novo: !ja };
}
