// IA de atendimento do WhatsApp (módulo do servidor).
// Recebe a conversa do contato, responde com os dados do portal (nunca inventa) e usa
// ferramentas: simular financiamento, buscar e enviar imóveis (link rastreado), guardar
// o que a pessoa procura, marcar corretor e passar para a equipe.
// Precisa de ANTHROPIC_API_KEY na Vercel (modelo: ANTHROPIC_MODEL, padrão claude-sonnet-5-5).
import crypto from 'crypto';
import { query } from './db';
import { lerConfigIA, type ConfigIA } from './crm-config';
import { simular, textoSimulacao } from './simulacao';
import { enviarTextoWhatsapp } from './whatsapp';
import { urlImovel, urlCondominio } from './urls';
import { SITE_URL } from './seo';
import { normTel } from './crm';

type Msg = { direcao: string; autor: string; texto: string | null; criado_em: string };
type Bloco = { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } | { type: 'tool_result'; tool_use_id: string; content: string };
type Mensagem = { role: 'user' | 'assistant'; content: string | Bloco[] };

const brl = (n: number | null | undefined) => (n ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'não informado');

const FERRAMENTAS = [
  {
    name: 'simular_financiamento',
    description:
      'Calcula a simulação de financiamento (SAC e Price) com os parâmetros da Mais Novos. Use para mandar a simulação média dos bancos já na primeira resposta sobre um imóvel, e a simulação com a taxa de balcão de um banco quando o cliente disser onde tem conta.',
    input_schema: {
      type: 'object',
      properties: {
        valor_imovel: { type: 'number', description: 'Valor do imóvel em reais' },
        entrada_percentual: { type: 'number', description: 'Entrada em % (padrão da configuração, normalmente 20)' },
        prazo_meses: { type: 'number', description: 'Prazo em meses (padrão 420)' },
        banco: { type: 'string', description: 'Nome do banco, quando o cliente informar onde tem conta' }
      },
      required: ['valor_imovel']
    }
  },
  {
    name: 'buscar_imoveis',
    description: 'Busca imóveis à venda no portal (só públicos) e devolve até 5 com link curto rastreado para enviar ao cliente. Use quando ele pedir outras opções.',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Nome de condomínio, bairro ou tipo' },
        quartos: { type: 'number' },
        valor_max: { type: 'number' },
        bairro: { type: 'string' }
      }
    }
  },
  {
    name: 'guardar_preferencias',
    description: 'Guarda na ficha o que o cliente procura e o que ele informou (banco, FGTS, quartos, valor, bairros).',
    input_schema: {
      type: 'object',
      properties: {
        quartos: { type: 'array', items: { type: 'number' } },
        valor_max: { type: 'number' },
        bairros: { type: 'array', items: { type: 'string' } },
        banco: { type: 'string' },
        usa_fgts: { type: 'boolean' },
        observacao: { type: 'string' }
      }
    }
  },
  {
    name: 'marcar_como_corretor',
    description: 'Marca o contato como corretor de imóveis (quando ele disser que é corretor, pedir parceria ou comissão).',
    input_schema: { type: 'object', properties: { motivo: { type: 'string' } }, required: ['motivo'] }
  },
  {
    name: 'passar_para_atendente',
    description:
      'Passa a conversa para a equipe e pausa a IA neste contato. Use quando o cliente pedir visita, proposta, negociar valor, quiser seguir com a análise de crédito, pedir para falar com uma pessoa, reclamar, ou perguntar algo que você não sabe.',
    input_schema: { type: 'object', properties: { motivo: { type: 'string' } }, required: ['motivo'] }
  }
];

function instrucoes(cfg: ConfigIA, contexto: string): string {
  return `Você é ${cfg.nomeAssistente}, a assistente virtual da Mais Novos Imóveis (Goiânia), da corretora Leyde Duarte (CRECI-GO C17586), atendendo pelo WhatsApp.

Como responder:
- Português do Brasil, simpática e direta, mensagens curtas como no WhatsApp. Sem títulos, sem listas longas; use *negrito* com moderação.
- Chame a pessoa pelo primeiro nome.
- Use SÓ as informações do contexto abaixo e das ferramentas. Nunca invente preço, metragem, disponibilidade, endereço, prazo ou condição. O que não souber, diga que vai confirmar com a equipe e use passar_para_atendente.
- Nunca informe endereço exato, número da unidade, andar ou nome/contato do proprietário. Imóvel privado: não descreva além do resumo e não mande link (a equipe envia o link privado).
- Não peça CPF, RG nem documentos.

Primeira resposta sobre um imóvel (roteiro):
1. Confirme que está disponível (se estiver no contexto) e dê as características principais.
2. Já mande a simulação média dos bancos com simular_financiamento (entrada de ${cfg.entradaPct}% e ${cfg.prazoMeses} meses), sem perguntar antes.
3. Diga que a Mais Novos também cuida da aprovação do financiamento junto com o registro, que é credenciada pelos bancos ${cfg.bancos}, e pergunte se a pessoa já é correntista de algum deles.
4. Quando ela disser o banco, use simular_financiamento com o banco (taxa de balcão) e explique que a taxa pode ficar menor depois que a Mais Valor analisa o perfil. Se ela quiser seguir com a análise, use passar_para_atendente.
Sempre que mostrar números de simulação, deixe claro que são informativos, sem seguros e tarifas, e sujeitos a análise de crédito.

Corretores: se a pessoa disser que é corretor, pedir parceria, comissão, exclusividade, número da unidade ou proprietário, use marcar_como_corretor, explique que parcerias são tratadas direto com a Leyde e use passar_para_atendente. Na dúvida, pergunte com naturalidade se está procurando para ela ou atendendo um cliente.

Passe para a equipe (passar_para_atendente) quando: pedir visita, proposta, negociação de valor, análise de crédito, falar com uma pessoa, reclamação, assunto jurídico ou algo fora do contexto. Ao passar, avise a pessoa que a Leyde ou a equipe vai continuar o atendimento por aqui em breve.

Guarde o que a pessoa informar (quartos, valor, bairros, banco, FGTS) com guardar_preferencias.
${cfg.instrucoesExtras ? `\nInstruções da Leyde:\n${cfg.instrucoesExtras}\n` : ''}
Contexto (dados do portal):
${contexto}`;
}

/** imóvel e condomínio de interesse do contato (pelo que entrou no CRM) */
async function contextoDoContato(contatoId: string): Promise<{ texto: string; valorImovel: number | null }> {
  const c = (await query<Record<string, unknown>>(`select * from crm_contatos where id = $1`, [contatoId]))[0];
  const alvo = (
    await query<{ property_id: string | null; development_id: string | null }>(
      `select coalesce(n.property_id, a.dados->>'property_id') property_id, coalesce(n.development_id, a.dados->>'development_id') development_id
         from crm_contatos c
         left join lateral (select property_id, development_id from crm_negocios where contato_id = c.id and etapa not in ('ganho', 'perdido') order by criado_em desc limit 1) n on true
         left join lateral (select dados from crm_atividades where contato_id = c.id and tipo = 'entrada' and dados is not null order by criado_em desc limit 1) a on true
        where c.id = $1`,
      [contatoId]
    )
  )[0];
  const linhas: string[] = [`Contato: ${c?.nome ?? 'sem nome'}${c?.tipo === 'corretor' ? ' (corretor de imóveis)' : ''}`, `O que procura (ficha): ${JSON.stringify(c?.preferencias ?? {})}`];
  let valorImovel: number | null = null;
  if (alvo?.property_id) {
    const p = (
      await query<Record<string, unknown>>(
        `select p.*, d.name d_nome, d.delivery_date d_entrega from properties p left join developments d on d.id = p.empreendimento_id where p.id = $1`,
        [alvo.property_id]
      )
    )[0];
    if (p) {
      valorImovel = p.price_value == null ? null : Number(p.price_value);
      const privado = p.visibilidade === 'privado';
      linhas.push(
        `Imóvel de interesse: ${privado ? '(PRIVADO: não mandar link nem detalhes além destes)' : ''}`,
        `- ${String(p.tipo_unidade ?? '').replace(/_/g, ' ')} ${p.d_nome || p.condominio ? `no ${p.d_nome || p.condominio}` : ''}, ${p.bairro ?? ''} ${p.cidade ?? ''}`,
        `- Preço: ${brl(valorImovel)}${p.vendido_em ? ' (JÁ VENDIDO: ofereça opções parecidas)' : ' (disponível)'}`,
        `- ${p.quartos ?? '?'} quartos, ${p.banheiros ?? '?'} banheiros, ${p.vagas ?? '?'} vagas, ${p.area ? `${Math.round(Number(p.area))} m²` : 'área não informada'}`,
        p.valor_condominio ? `- Condomínio: ${brl(Number(p.valor_condominio))}/mês` : '',
        p.iptu_mensal ? `- IPTU: ${brl(Number(p.iptu_mensal))}/mês` : '',
        p.description ? `- Descrição: ${String(p.description).replace(/\s+/g, ' ').slice(0, 900)}` : '',
        privado ? '' : `- Link: ${SITE_URL}${urlImovel({ id: String(p.id), slug: p.slug as string, uf: p.uf as string, cidade: p.cidade as string, bairro: p.bairro as string, finalidade: p.finalidade as string })}`
      );
    }
  } else if (alvo?.development_id) {
    const d = (
      await query<Record<string, unknown>>(
        `select d.*, (select min(price_value) from properties x where x.empreendimento_id = d.id and x.price_value > 0 and x.vendido_em is null and x.visibilidade = 'publico') preco
           from developments d where d.id = $1`,
        [alvo.development_id]
      )
    )[0];
    if (d) {
      valorImovel = d.preco == null ? null : Number(d.preco);
      linhas.push(
        `Condomínio de interesse: ${d.name}, ${d.bairro ?? ''} ${d.cidade ?? ''}`,
        `- Entrega: ${d.delivery_date ? new Date(d.delivery_date as string).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'não informada'}`,
        `- Unidades anunciadas a partir de: ${brl(valorImovel)}`,
        `- Link: ${SITE_URL}${urlCondominio({ id: String(d.id), slug: d.slug as string, uf: d.uf as string, cidade: d.cidade as string, bairro: d.bairro as string })}`
      );
    }
  } else linhas.push('Imóvel de interesse: não identificado (pergunte o que a pessoa procura).');
  return { texto: linhas.filter(Boolean).join('\n'), valorImovel };
}

async function executar(contatoId: string, cfg: ConfigIA, nome: string, input: Record<string, unknown>): Promise<string> {
  if (nome === 'simular_financiamento') {
    const valor = Number(input.valor_imovel);
    if (!(valor > 10000)) return 'Valor do imóvel inválido.';
    const banco = typeof input.banco === 'string' ? input.banco.trim() : '';
    const chave = banco ? Object.keys(cfg.taxasBancos).find((b) => b.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === banco.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')) : undefined;
    const taxa = chave ? cfg.taxasBancos[chave] : cfg.taxaMediaAa;
    if (!taxa) return banco ? `Não há taxa de balcão cadastrada para ${banco}. Diga que a equipe vai mandar a simulação desse banco e use passar_para_atendente.` : 'A taxa média ainda não foi configurada. Diga que a equipe vai enviar a simulação.';
    const s = simular(valor, Number(input.entrada_percentual) || cfg.entradaPct, Number(input.prazo_meses) || cfg.prazoMeses, taxa);
    const txt = textoSimulacao(s, chave);
    await query(`insert into crm_atividades (contato_id, tipo, texto, autor_email) values ($1, 'simulacao', $2, 'ia')`, [contatoId, `Simulação de financiamento (IA)\n${txt}`]);
    return txt;
  }
  if (nome === 'buscar_imoveis') {
    const params: unknown[] = [];
    const conds = [`p.visibilidade = 'publico'`, `not p.is_tipologia`, `p.vendido_em is null`, `p.finalidade = 'venda'`];
    if (input.texto) {
      params.push(`%${String(input.texto).toLowerCase().slice(0, 60)}%`);
      conds.push(`lower(concat_ws(' ', p.titulo, p.condominio, p.bairro, p.tipo_unidade)) like $${params.length}`);
    }
    if (input.bairro) {
      params.push(`%${String(input.bairro).toLowerCase().slice(0, 60)}%`);
      conds.push(`lower(p.bairro) like $${params.length}`);
    }
    if (input.quartos) {
      params.push(Number(input.quartos));
      conds.push(`p.quartos >= $${params.length}`);
    }
    if (input.valor_max) {
      params.push(Number(input.valor_max) * 1.1);
      conds.push(`p.price_value <= $${params.length}`);
    }
    const rows = await query<Record<string, unknown>>(
      `select p.id, p.slug, p.titulo, p.condominio, p.bairro, p.cidade, p.uf, p.finalidade, p.price_value, p.quartos, p.area, coalesce(p.capa_mini, p.photos->>0) capa, d.name d_nome
         from properties p left join developments d on d.id = p.empreendimento_id where ${conds.join(' and ')} order by p.destaque desc, p.created_at desc limit 5`,
      params
    );
    if (!rows.length) return 'Nenhum imóvel encontrado com esses critérios.';
    const linhas: string[] = [];
    for (const r of rows) {
      const codigo = crypto.randomBytes(6).toString('base64url');
      const titulo = String(r.d_nome || r.condominio || r.titulo || 'Imóvel');
      const sub = [r.quartos ? `${r.quartos} qtos` : null, r.area ? `${Math.round(Number(r.area))} m²` : null, r.bairro].filter(Boolean).join(' · ');
      const destino = `${SITE_URL}${urlImovel({ id: String(r.id), slug: r.slug as string, uf: r.uf as string, cidade: r.cidade as string, bairro: r.bairro as string, finalidade: r.finalidade as string })}`;
      await query(
        `insert into crm_envios (codigo, contato_id, tipo, ref_id, titulo, sub, preco, capa, destino, enviado_por) values ($1, $2, 'imovel', $3, $4, $5, $6, $7, $8, 'ia')`,
        [codigo, contatoId, r.id, titulo, sub, r.price_value, r.capa, destino]
      );
      linhas.push(`${titulo} · ${brl(r.price_value == null ? null : Number(r.price_value))} · ${sub} · ${SITE_URL}/r/${codigo}`);
    }
    await query(`insert into crm_atividades (contato_id, tipo, texto, autor_email) values ($1, 'envio', $2, 'ia')`, [contatoId, `A IA enviou ${rows.length} imóveis`]);
    return linhas.join('\n');
  }
  if (nome === 'guardar_preferencias') {
    const p: Record<string, unknown> = {};
    if (Array.isArray(input.quartos)) p.quartos = (input.quartos as unknown[]).map(Number).filter((q) => q >= 0 && q <= 6);
    if (input.valor_max) p.valorMax = Number(input.valor_max);
    if (Array.isArray(input.bairros)) p.bairros = (input.bairros as unknown[]).map(String).slice(0, 6);
    if (input.banco) p.banco = String(input.banco).slice(0, 40);
    if (typeof input.usa_fgts === 'boolean') p.fgts = input.usa_fgts;
    if (input.observacao) p.observacao = String(input.observacao).slice(0, 300);
    await query(`update crm_contatos set preferencias = preferencias || $2::jsonb where id = $1`, [contatoId, JSON.stringify(p)]);
    return 'Guardado na ficha.';
  }
  if (nome === 'marcar_como_corretor') {
    await query(`update crm_contatos set tipo = 'corretor', possivel_corretor = $2 where id = $1`, [contatoId, String(input.motivo ?? '').slice(0, 200)]);
    const tem = await query(`select 1 from crm_negocios where contato_id = $1 and funil = 'parceiros' and etapa not in ('ganho', 'perdido')`, [contatoId]);
    if (!tem.length) await query(`insert into crm_negocios (contato_id, funil, etapa, titulo) values ($1, 'parceiros', 'novo', 'Parceria')`, [contatoId]);
    await query(`insert into crm_atividades (contato_id, tipo, texto, autor_email) values ($1, 'sistema', $2, 'ia')`, [contatoId, `A IA marcou como corretor: ${input.motivo ?? ''}`]);
    return 'Marcado como corretor.';
  }
  if (nome === 'passar_para_atendente') {
    // pausa a IA neste contato e coloca em "Responder agora"
    await query(`update crm_contatos set ia_ativa = false, ultima_resposta_em = null, ultimo_contato_em = now() where id = $1`, [contatoId]);
    await query(`insert into crm_atividades (contato_id, tipo, texto, autor_email) values ($1, 'sistema', $2, 'ia')`, [contatoId, `A IA passou a conversa para a equipe: ${input.motivo ?? ''}`]);
    return 'Conversa passada para a equipe. Avise o cliente que a equipe continua por aqui em breve.';
  }
  return 'Ferramenta desconhecida.';
}

/** A IA responde à última mensagem do contato (se a IA estiver ligada para ele). */
export async function responderComIA(contatoId: string): Promise<void> {
  const cfg = await lerConfigIA();
  if (!cfg.ligada || !process.env.ANTHROPIC_API_KEY) return;
  const c = (await query<{ telefone: string | null; ia_ativa: boolean }>(`select telefone, ia_ativa from crm_contatos where id = $1`, [contatoId]))[0];
  if (!c?.telefone || !c.ia_ativa) return;
  if (cfg.modoTeste && !cfg.numerosTeste.map((n) => normTel(n)).includes(c.telefone)) return;

  const hist = await query<Msg>(`select direcao, autor, texto, criado_em from crm_mensagens where contato_id = $1 order by criado_em desc limit 24`, [contatoId]);
  const mensagens: Mensagem[] = [];
  for (const m of hist.reverse()) {
    const role = m.direcao === 'entrada' ? 'user' : 'assistant';
    const texto = (m.texto ?? '').trim() || '[mensagem sem texto]';
    const ult = mensagens[mensagens.length - 1];
    if (ult && ult.role === role && typeof ult.content === 'string') ult.content += `\n${texto}`;
    else mensagens.push({ role, content: texto });
  }
  while (mensagens.length && mensagens[0].role !== 'user') mensagens.shift();
  if (!mensagens.length || mensagens[mensagens.length - 1].role !== 'user') return;

  const ctx = await contextoDoContato(contatoId);
  const system = instrucoes(cfg, ctx.texto);
  let resposta = '';
  for (let volta = 0; volta < 5; volta++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 900, system, tools: FERRAMENTAS, messages: mensagens }),
      signal: AbortSignal.timeout(40000)
    });
    const j = (await r.json().catch(() => ({}))) as { content?: Bloco[]; stop_reason?: string; error?: { message?: string } };
    if (!r.ok || !j.content) {
      await query(`insert into crm_atividades (contato_id, tipo, texto) values ($1, 'sistema', $2)`, [contatoId, `A IA não conseguiu responder: ${j.error?.message ?? r.status}`]);
      return;
    }
    const textos = j.content.filter((b): b is { type: 'text'; text: string } => b.type === 'text').map((b) => b.text);
    if (j.stop_reason !== 'tool_use') {
      resposta = textos.join('\n').trim();
      break;
    }
    mensagens.push({ role: 'assistant', content: j.content });
    const resultados: Bloco[] = [];
    for (const b of j.content) {
      if (b.type !== 'tool_use') continue;
      const out = await executar(contatoId, cfg, b.name, b.input ?? {}).catch((e) => `Erro: ${e instanceof Error ? e.message : e}`);
      resultados.push({ type: 'tool_result', tool_use_id: b.id, content: out });
    }
    mensagens.push({ role: 'user', content: resultados });
  }
  if (!resposta) return;
  const env = await enviarTextoWhatsapp(c.telefone, resposta);
  await query(`insert into crm_mensagens (contato_id, direcao, autor, texto, wa_id, status) values ($1, 'saida', 'ia', $2, $3, $4)`, [
    contatoId,
    resposta,
    env.ok ? env.id : null,
    env.ok ? 'enviada' : `erro: ${env.erro}`
  ]);
  if (env.ok) await query(`update crm_contatos set ultima_resposta_em = now() where id = $1 and ia_ativa`, [contatoId]);
}
