// Importação de imagens em massa (Painel → Importar imagens): uma pasta por empreendimento.
// O navegador reduz cada imagem (e recorta as páginas dos PDFs); aqui a IA classifica
// (foto, planta ou descarte), lê a metragem das plantas, o portal guarda no R2, liga a
// planta à tipologia de mesma área e, no fim da pasta, ordena as fotos e escolhe a capa.
import sharp from 'sharp';
import { query } from './db';
import { apagarVariosDoR2, enviarParaR2 } from './r2';
import { prepararFoto } from './fotos-fila';
import { miniaturaDe } from './miniaturas';
import { registrarUsoIA } from './custos';
import { ehUsadoOuAntigo, limparUmCondominio } from './limpeza-usados';

export type Classificacao = {
  tipo: 'foto' | 'planta' | 'tabela' | 'ficha' | 'info' | 'descartar';
  categoria: 'fachada' | 'externa' | 'lazer' | 'comum' | 'decorado' | 'vista' | 'implantacao' | 'outro';
  qualidade: number; // 1 a 5
  metragem: number | null;
  quartos: number | null;
  suites: number | null;
  nomeTipologia: string | null;
  legenda: string;
};

const MODELO = process.env.ANTHROPIC_MODEL_VISAO || 'claude-haiku-4-5-20251001';

const INSTRUCAO = `Você classifica imagens do material de vendas de empreendimentos imobiliários (Brasil).
Responda SÓ com um JSON, sem texto antes ou depois:
{"tipo":"foto|planta|tabela|ficha|info|descartar","categoria":"fachada|externa|lazer|comum|decorado|vista|implantacao|outro","qualidade":1-5,"metragem":número ou null,"quartos":número ou null,"suites":número ou null,"nomeTipologia":"texto ou null","legenda":"até 8 palavras em português"}
Regras:
- planta: desenho técnico visto de cima, com cômodos (planta humanizada também). Leia a metragem PRIVATIVA escrita na imagem (ex.: "145,32 m²" → 145.32). Leia quartos, suítes e o nome da tipologia ("Tipo A", "Final 01") se estiverem escritos. Não invente: se não estiver legível, null.
- foto: fachada (prédio ou casas visto de fora, inteiro), externa (portaria, acesso, jardim), lazer (piscina, academia, salão, quadra, playground, gourmet), comum (hall, lobby, coworking), decorado (interior de unidade), vista, implantacao (vista aérea ilustrada do terreno).
- tabela: tabela de vendas ou de preços com unidades, metragens e valores.
- ficha: ficha técnica ou página com dados do empreendimento (endereço, entrega, número de pavimentos ou unidades, lista de lazer, tipologias).
- info: página com informações úteis sobre o empreendimento em texto (conceito do projeto, localização e pontos próximos, arquitetura, paisagismo, decoração, assinaturas e parceiros, diferenciais, tecnologia, segurança, sustentabilidade, acabamentos). Mapa com lista de pontos próximos também é info.
- descartar: logotipo, capa de book só com título, página de texto sem informação concreta (só frases de efeito), aviso legal, imagem muito pequena ou com marca d'água de imobiliária ou portal.
- qualidade: 5 = imagem de capa de revista; 1 = ruim, cortada ou borrada.`;

/** Pede à IA a classificação (imagem reduzida a 768 px para gastar pouco) */
export async function classificar(img: Buffer): Promise<Classificacao> {
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) throw new Error('ANTHROPIC_API_KEY não configurada');
  const mini = await sharp(img, { failOn: 'none' }).resize(768, 768, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': chave, 'anthropic-version': '2023-06-01' },
    signal: AbortSignal.timeout(40000),
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 300,
      system: INSTRUCAO,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: mini.toString('base64') } },
            { type: 'text', text: 'Classifique esta imagem.' }
          ]
        }
      ]
    })
  });
  const j = (await r.json().catch(() => ({}))) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
    error?: { message?: string };
  };
  if (!r.ok) throw new Error(j.error?.message ?? `IA: HTTP ${r.status}`);
  await registrarUsoIA(MODELO, j.usage, null);
  const txt = (j.content ?? []).map((c) => c.text ?? '').join('');
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('IA sem resposta válida');
  const o = JSON.parse(m[0]) as Partial<Classificacao>;
  const num = (v: unknown) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : null);
  return {
    tipo: o.tipo === 'planta' || o.tipo === 'descartar' || o.tipo === 'tabela' || o.tipo === 'ficha' || o.tipo === 'info' ? o.tipo : 'foto',
    categoria: (['fachada', 'externa', 'lazer', 'comum', 'decorado', 'vista', 'implantacao'] as const).includes(o.categoria as never)
      ? (o.categoria as Classificacao['categoria'])
      : 'outro',
    qualidade: Math.min(5, Math.max(1, Math.round(Number(o.qualidade) || 3))),
    metragem: num(o.metragem),
    quartos: num(o.quartos),
    suites: num(o.suites),
    nomeTipologia: typeof o.nomeTipologia === 'string' ? o.nomeTipologia.slice(0, 60) : null,
    legenda: String(o.legenda ?? '').slice(0, 80)
  };
}

export type ResultadoArquivo = { situacao: 'foto' | 'planta' | 'planta_sem_par' | 'tabela' | 'ficha' | 'info' | 'descartada' | 'repetida'; detalhe?: string };

/** Um arquivo (já reduzido no navegador): classifica, guarda e liga ao empreendimento */
export async function importarArquivo(devId: string, hash: string, arquivo: string, buf: Buffer, tipoMime: string): Promise<ResultadoArquivo> {
  const ja = await query<{ situacao: string }>('select situacao from imagens_importadas where hash = $1', [hash]);
  if (ja[0]) return { situacao: 'repetida' };
  const dev = await query<{ name: string }>('select name from developments where id = $1', [devId]);
  if (!dev[0]) throw new Error('empreendimento não encontrado');
  const c = await classificar(buf);
  const reg = (situacao: string, url: string | null, propertyId: string | null) =>
    query(
      `insert into imagens_importadas (hash, development_id, arquivo, tipo, categoria, qualidade, metragem, quartos, suites, nome_tipologia, legenda, url, property_id, situacao)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) on conflict (hash) do nothing`,
      [hash, devId, arquivo.slice(0, 300), c.tipo, c.categoria, c.qualidade, c.metragem, c.quartos, c.suites, c.nomeTipologia, c.legenda, url, propertyId, situacao]
    );
  if (c.tipo === 'descartar') {
    await reg('descartada', null, null);
    return { situacao: 'descartada', detalhe: c.legenda };
  }
  // tabela de vendas, ficha técnica e páginas de informação: completam o cadastro (a imagem não é guardada)
  if (c.tipo === 'tabela' || c.tipo === 'ficha' || c.tipo === 'info') {
    const dados =
      c.tipo === 'tabela' ? await lerComIA<Tabela>(buf, PEDIDO_TABELA) : c.tipo === 'ficha' ? await lerComIA<Ficha>(buf, PEDIDO_FICHA) : await lerComIA<Info>(buf, PEDIDO_INFO);
    const resumo =
      c.tipo === 'tabela'
        ? await aplicarTabela(devId, dados as Tabela)
        : c.tipo === 'ficha'
          ? await aplicarFicha(devId, dados as Ficha)
          : await aplicarFicha(devId, { lazer: (dados as Info).lazer ?? [] }).then(() => `${((dados as Info).fatos ?? []).length} informações guardadas`);
    await reg(c.tipo, null, null);
    await query('update imagens_importadas set dados = $2::jsonb where hash = $1', [hash, JSON.stringify(dados)]);
    return { situacao: c.tipo, detalhe: resumo };
  }
  // usado ou antigo: só a fachada e as plantas (o resto nem é guardado)
  if (c.tipo === 'foto' && c.categoria !== 'fachada' && (await ehUsadoOuAntigo(devId))) {
    await reg('descartada', null, null);
    return { situacao: 'descartada', detalhe: 'usado: só fachada e plantas' };
  }
  const ehPlanta = c.tipo === 'planta';
  const pronta = await prepararFoto(buf, tipoMime, ehPlanta);
  const nomeArq = ehPlanta ? `${dev[0].name} planta${c.metragem ? ` ${Math.round(c.metragem)} m2` : ''}` : `${dev[0].name} ${c.categoria}`;
  const url = await enviarParaR2(pronta.buf, pronta.tipo, ehPlanta ? 'plantas' : 'empreendimentos', nomeArq);
  if (ehPlanta) {
    // tipologia de mesma área (até 1,5 m² de diferença)
    const tip = c.metragem
      ? await query<{ id: string }>(
          `select id from properties where empreendimento_id = $1 and is_tipologia and abs(area - $2) <= 1.5 order by abs(area - $2) limit 1`,
          [devId, c.metragem]
        )
      : [];
    if (tip[0]) {
      await query(`update properties set plantas = coalesce(plantas, '[]'::jsonb) || to_jsonb($2::text) where id = $1`, [tip[0].id, url]);
      await reg('planta', url, tip[0].id);
      return { situacao: 'planta', detalhe: c.metragem ? `${c.metragem} m²` : undefined };
    }
    if (c.metragem) {
      // sem tipologia dessa área: cria a partir da planta (metragem, quartos e suítes lidos no desenho)
      const t = await tipologiaDaArea(devId, c.metragem, { quartos: c.quartos, suites: c.suites });
      await query(`update properties set plantas = coalesce(plantas, '[]'::jsonb) || to_jsonb($2::text) where id = $1`, [t.id, url]);
      await reg('planta', url, t.id);
      return { situacao: 'planta', detalhe: `${c.metragem} m²${t.criada ? ' (tipologia criada)' : ''}` };
    }
    await reg('planta_sem_par', url, null);
    return { situacao: 'planta_sem_par', detalhe: 'metragem não legível' };
  }
  await reg('foto', url, null);
  return { situacao: 'foto', detalhe: c.categoria };
}

const ORDEM_CAT: Record<string, number> = { fachada: 0, externa: 1, implantacao: 2, lazer: 3, comum: 4, vista: 5, decorado: 6, outro: 7 };

/** Fim da pasta: fotos importadas em ordem (capa = melhor fachada), junto das que já existiam */
export async function finalizarPasta(devId: string, maxFotos = 40): Promise<{ fotos: number; capa: string | null; descricao: boolean }> {
  const descricao = await gerarDescricao(devId).catch(() => false);
  const r = await organizarFotos(devId, maxFotos);
  return { ...r, descricao };
}

async function organizarFotos(devId: string, maxFotos: number): Promise<{ fotos: number; capa: string | null }> {
  const novas = await query<{ url: string; categoria: string; qualidade: number }>(
    `select url, categoria, qualidade from imagens_importadas where development_id = $1 and situacao = 'foto' and url is not null`,
    [devId]
  );
  const dev = await query<{ photos: string[] | null }>('select photos from developments where id = $1', [devId]);
  const existentes = (dev[0]?.photos ?? []).filter((u) => !novas.some((n) => n.url === u));
  const ordenadas = novas
    .sort((a, b) => (ORDEM_CAT[a.categoria] ?? 9) - (ORDEM_CAT[b.categoria] ?? 9) || b.qualidade - a.qualidade)
    .map((n) => n.url);
  // capa: a foto que já era capa continua, a menos que não houvesse nenhuma
  const fotos = (existentes.length ? [...existentes, ...ordenadas] : ordenadas).slice(0, maxFotos);
  await query(`update developments set photos = $2::jsonb where id = $1`, [devId, JSON.stringify(fotos)]);
  // usado ou antigo: fica só a melhor fachada
  if (await ehUsadoOuAntigo(devId)) {
    await limparUmCondominio(devId).catch(() => 0);
    const f = await query<{ photos: string[] | null }>('select photos from developments where id = $1', [devId]);
    return { fotos: f[0]?.photos?.length ?? 0, capa: f[0]?.photos?.[0] ?? null };
  }
  await miniaturaDe('developments', devId).catch(() => {});
  return { fotos: fotos.length, capa: fotos[0] ?? null };
}

// ---------------- completar o cadastro a partir das imagens ----------------
const MODELO_LEITURA = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const TIPOS_OK = ['studio', 'flat', 'loft', 'apartamento', 'apartamento_garden', 'apartamento_duplex', 'apartamento_triplex', 'cobertura', 'cobertura_duplex', 'penthouse', 'casa', 'casa_condominio', 'sobrado', 'terreno_lote', 'sala_comercial', 'loja_ponto_comercial'];
const LAZER_OK = ['Piscina', 'Academia', 'Salão de festas', 'Playground', 'Portaria 24h', 'Segurança 24h', 'Bicicletário', 'Quadra poliesportiva', 'Espaço pet', 'Espaço gourmet', 'Churrasqueira', 'Coworking', 'Rooftop', 'Sauna', 'Salão de jogos', 'Área verde', 'Elevador', 'Vaga coberta'];

async function lerComIA<T>(img: Buffer, instrucao: string): Promise<T> {
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) throw new Error('ANTHROPIC_API_KEY não configurada');
  const grande = await sharp(img, { failOn: 'none' }).resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': chave, 'anthropic-version': '2023-06-01' },
    signal: AbortSignal.timeout(55000),
    body: JSON.stringify({
      model: MODELO_LEITURA,
      max_tokens: 2500,
      system: `${instrucao}\nResponda SÓ com o JSON pedido. Não invente: o que não estiver legível na imagem fica null ou fora da lista.`,
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: grande.toString('base64') } }, { type: 'text', text: 'Leia esta imagem.' }] }]
    })
  });
  const j = (await r.json().catch(() => ({}))) as { content?: { text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number }; error?: { message?: string } };
  if (!r.ok) throw new Error(j.error?.message ?? `IA: HTTP ${r.status}`);
  await registrarUsoIA(MODELO_LEITURA, j.usage, null);
  const m = (j.content ?? []).map((c) => c.text ?? '').join('').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('IA sem resposta válida');
  return JSON.parse(m[0]) as T;
}

type Linha = { area?: number | null; quartos?: number | null; suites?: number | null; vagas?: number | null; preco?: number | null; tipo?: string | null };
type Tabela = { entrega?: string | null; linhas?: Linha[] };
type Ficha = { entrega?: string | null; pavimentos?: number | null; lazer?: string[]; tipos?: string[]; quartos?: number[]; fatos?: string[] };
type Info = { fatos?: string[]; lazer?: string[]; assinaturas?: string[]; pontosProximos?: string[] };

const n = (v: unknown) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : null);
const mesAno = (s?: string | null) => (s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s) ? `${s}-01` : null);

type Dev = { id: string; name: string; bairro: string | null; cidade: string | null; uf: string | null; cep: string | null; tipo: string; delivery_date: string | null; amenities: string[] | null; tipos_unidade: string[] | null; corretor_email: string | null };

async function lerDev(devId: string): Promise<Dev | null> {
  const r = await query<Dev>(
    `select id, name, bairro, cidade, uf, cep, tipo, to_char(delivery_date, 'YYYY-MM-DD') as delivery_date, amenities, tipos_unidade, corretor_email from developments where id = $1`,
    [devId]
  );
  return r[0] ?? null;
}

const NOME_TIPO: Record<string, string> = { apartamento: 'Apartamento', cobertura: 'Cobertura', cobertura_duplex: 'Cobertura duplex', apartamento_duplex: 'Apartamento duplex', apartamento_garden: 'Apartamento garden', casa_condominio: 'Casa', sobrado: 'Sobrado', terreno_lote: 'Lote', studio: 'Studio', flat: 'Flat', loft: 'Loft', penthouse: 'Penthouse', casa: 'Casa', sala_comercial: 'Sala comercial', loja_ponto_comercial: 'Loja' };

/** Acha a tipologia de mesma área (±1,5 m²) ou cria uma nova. Devolve o id. */
export async function tipologiaDaArea(devId: string, area: number, info: { quartos?: number | null; suites?: number | null; vagas?: number | null; preco?: number | null; tipo?: string | null }): Promise<{ id: string; criada: boolean }> {
  const ja = await query<{ id: string }>(
    `select id from properties where empreendimento_id = $1 and is_tipologia and abs(area - $2) <= 1.5 order by abs(area - $2) limit 1`,
    [devId, area]
  );
  if (ja[0]) {
    // completa só o que está vazio; preço: o menor ("a partir de")
    // preço: o da tabela oficial substitui o estimado pelos portais; entre tabelas, fica o menor ("a partir de")
    await query(
      `update properties set quartos = coalesce(quartos, $2), vagas = coalesce(vagas, $3),
              price_value = case when $4::numeric > 0 and (price_value = 0 or coalesce(preco_origem, '') <> 'tabela' or $4::numeric < price_value) then $4::numeric else price_value end,
              preco_origem = case when $4::numeric > 0 then 'tabela' else preco_origem end
        where id = $1`,
      [ja[0].id, info.quartos ?? null, info.vagas ?? null, info.preco ?? 0]
    );
    return { id: ja[0].id, criada: false };
  }
  const d = await lerDev(devId);
  if (!d) throw new Error('empreendimento não encontrado');
  const tipo = info.tipo && TIPOS_OK.includes(info.tipo) ? info.tipo : d.tipos_unidade?.[0] && TIPOS_OK.includes(d.tipos_unidade[0]) ? d.tipos_unidade[0] : d.tipo === 'horizontal' ? 'casa_condominio' : 'apartamento';
  const local = [d.bairro, d.cidade ? `${d.cidade}/${d.uf ?? 'GO'}` : null].filter(Boolean).join(', ');
  const q = info.quartos ? `${info.quartos} ${info.quartos === 1 ? 'quarto' : 'quartos'}${info.suites ? `, sendo ${info.suites} ${info.suites === 1 ? 'suíte' : 'suítes'}` : ''}` : '';
  const desc = `${NOME_TIPO[tipo] ?? 'Unidade'}${q ? ` de ${q}` : ''}, ${String(Math.round(area * 100) / 100).replace('.', ',')} m² no ${d.name}${local ? `, ${local}` : ''}.`;
  const id = `${devId}-tip-${Math.round(area * 10)}`;
  await query(
    `insert into properties (id, is_tipologia, empreendimento_id, tipo_unidade, area, quartos, vagas, price_value, finalidade, price_period, visibilidade,
        delivery_date, bairro, cidade, uf, cep, condominio, location, description, amenities, corretor_email)
     values ($1, true, $2, $3, $4, $5, $6, $7, 'venda', 'unico', 'publico', $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17)
     on conflict (id) do nothing`,
    [id, devId, tipo, area, info.quartos ?? null, info.vagas ?? null, info.preco ?? 0, d.delivery_date, d.bairro, d.cidade, d.uf ?? 'GO', d.cep, d.name, local || d.name, desc, JSON.stringify(d.amenities ?? []), d.corretor_email ?? 'admin@maisnovos.com']
  );
  if (info.preco) await query(`update properties set preco_origem = 'tabela' where id = $1`, [id]);
  await query(
    `update developments set tipos_unidade = (select jsonb_agg(distinct x) from jsonb_array_elements_text(coalesce(tipos_unidade, '[]'::jsonb) || to_jsonb(array[$2::text])) x),
            quartos_opcoes = case when $3::int is null then quartos_opcoes else (select jsonb_agg(distinct x::int order by x::int) from jsonb_array_elements_text(coalesce(quartos_opcoes, '[]'::jsonb) || to_jsonb(array[$3::int])) x) end
      where id = $1`,
    [devId, tipo, info.quartos ?? null]
  );
  return { id, criada: true };
}

/** Tabela de vendas: agrupa por metragem e cria/atualiza as tipologias (preço "a partir de") */
async function aplicarTabela(devId: string, t: Tabela): Promise<string> {
  const linhas = (t.linhas ?? []).filter((l) => n(l.area));
  const grupos: { area: number; linhas: Linha[] }[] = [];
  for (const l of linhas.sort((a, b) => (a.area ?? 0) - (b.area ?? 0))) {
    const g = grupos.find((x) => Math.abs(x.area - (l.area as number)) <= 1.5);
    if (g) g.linhas.push(l);
    else grupos.push({ area: l.area as number, linhas: [l] });
  }
  let criadas = 0;
  for (const g of grupos) {
    const precos = g.linhas.map((l) => n(l.preco)).filter((v): v is number => !!v && v > 10000);
    const moda = (k: keyof Linha) => g.linhas.map((l) => n(l[k] as number)).find((v) => v) ?? null;
    const r = await tipologiaDaArea(devId, g.area, {
      quartos: moda('quartos'),
      suites: moda('suites'),
      vagas: moda('vagas'),
      preco: precos.length ? Math.min(...precos) : null,
      tipo: g.linhas.map((l) => l.tipo).find((x) => x) ?? null
    });
    if (r.criada) criadas++;
  }
  const entrega = mesAno(t.entrega);
  if (entrega) await query(`update developments set delivery_date = coalesce(delivery_date, $2::date) where id = $1`, [devId, entrega]);
  return `${grupos.length} metragens (${criadas} tipologias novas)`;
}

/** Ficha técnica: completa só o que está vazio (e soma o lazer da lista fechada) */
async function aplicarFicha(devId: string, f: Ficha): Promise<string> {
  const lazer = (f.lazer ?? []).filter((x) => LAZER_OK.includes(x));
  const tipos = (f.tipos ?? []).filter((x) => TIPOS_OK.includes(x));
  const quartos = (f.quartos ?? []).filter((x) => Number.isInteger(x) && x > 0 && x < 10);
  await query(
    `update developments set
        delivery_date = coalesce(delivery_date, $2::date),
        pavimentos = coalesce(pavimentos, $3::int),
        amenities = (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements_text(coalesce(amenities, '[]'::jsonb) || $4::jsonb) x),
        tipos_unidade = case when jsonb_array_length(coalesce(tipos_unidade, '[]'::jsonb)) = 0 then $5::jsonb else tipos_unidade end,
        quartos_opcoes = case when jsonb_array_length(coalesce(quartos_opcoes, '[]'::jsonb)) = 0 then $6::jsonb else quartos_opcoes end
      where id = $1`,
    [devId, mesAno(f.entrega), n(f.pavimentos), JSON.stringify(lazer), JSON.stringify(tipos), JSON.stringify(quartos)]
  );
  return [lazer.length ? `${lazer.length} itens de lazer` : null, f.entrega ? `entrega ${f.entrega}` : null, f.pavimentos ? `${f.pavimentos} pavimentos` : null].filter(Boolean).join(', ') || 'sem dados novos';
}

const PEDIDO_TABELA = `Esta é a tabela de vendas de um empreendimento imobiliário brasileiro. Extraia:
{"entrega":"AAAA-MM ou null","linhas":[{"area":área privativa em m² (número),"quartos":n ou null,"suites":n ou null,"vagas":n ou null,"preco":valor total da unidade em reais (número, sem sinal nem parcelas) ou null,"tipo":"apartamento|cobertura|cobertura_duplex|apartamento_duplex|apartamento_garden|casa_condominio|sobrado|terreno_lote|studio|flat|loft|sala_comercial|loja_ponto_comercial ou null"}]}
Uma linha por unidade (ou por tipologia, se a tabela for por tipologia). Unidade vendida ou bloqueada: inclua sem preço.`;

const PEDIDO_FICHA = `Esta é uma página de ficha técnica ou de dados de um empreendimento imobiliário brasileiro. Extraia:
{"entrega":"AAAA-MM ou null","pavimentos":número de pavimentos ou null,"lazer":[itens desta lista que aparecem: ${LAZER_OK.join(', ')}],"tipos":[tipos desta lista: ${TIPOS_OK.join(', ')}],"quartos":[números de quartos das plantas, ex.: [2,3]],"fatos":["outros dados concretos da página, uma frase curta cada (ex.: 'Torre única com 24 pavimentos', 'Terreno de 5.000 m²', '4 unidades por andar')"]}`;

const PEDIDO_INFO = `Esta é uma página do material de vendas de um empreendimento imobiliário brasileiro. Extraia só fatos concretos (nada de frases de efeito):
{"fatos":["uma frase curta por fato: conceito do projeto, diferenciais das plantas, tecnologia, segurança, sustentabilidade, acabamentos, áreas comuns que não estão na lista de lazer"],"lazer":[itens desta lista que aparecem: ${LAZER_OK.join(', ')}],"assinaturas":["Arquitetura: nome", "Paisagismo: nome", "Decoração: nome", "Construtora: nome", "Incorporadora: nome"],"pontosProximos":["lugar (distância ou tempo, se informado)"]}`;

/** Planilha (Excel/CSV) da tabela de vendas, já convertida em texto pelo navegador */
export async function importarPlanilha(devId: string, hash: string, arquivo: string, texto: string): Promise<ResultadoArquivo> {
  const ja = await query<{ situacao: string }>('select situacao from imagens_importadas where hash = $1', [hash]);
  if (ja[0]) return { situacao: 'repetida' };
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) throw new Error('ANTHROPIC_API_KEY não configurada');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': chave, 'anthropic-version': '2023-06-01' },
    signal: AbortSignal.timeout(55000),
    body: JSON.stringify({
      model: MODELO_LEITURA,
      max_tokens: 4000,
      system: `Você lê planilhas de empreendimentos imobiliários brasileiros. Se for uma tabela de vendas ou de preços, responda SÓ com o JSON pedido. Se não for (ex.: lista de clientes, controle interno), responda {"linhas":[]}. Não invente.\n${PEDIDO_TABELA.replace('Esta é a tabela de vendas de um empreendimento imobiliário brasileiro. ', '')}`,
      messages: [{ role: 'user', content: `Arquivo: ${arquivo}\n\n${texto.slice(0, 60000)}` }]
    })
  });
  const j = (await r.json().catch(() => ({}))) as { content?: { text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number }; error?: { message?: string } };
  if (!r.ok) throw new Error(j.error?.message ?? `IA: HTTP ${r.status}`);
  await registrarUsoIA(MODELO_LEITURA, j.usage, null);
  const m = (j.content ?? []).map((c) => c.text ?? '').join('').match(/\{[\s\S]*\}/);
  const dados = (m ? JSON.parse(m[0]) : { linhas: [] }) as Tabela;
  if (!dados.linhas?.length) {
    await query(`insert into imagens_importadas (hash, development_id, arquivo, tipo, situacao) values ($1,$2,$3,'planilha','descartada') on conflict do nothing`, [hash, devId, arquivo.slice(0, 300)]);
    return { situacao: 'descartada', detalhe: 'planilha sem tabela de vendas' };
  }
  const resumo = await aplicarTabela(devId, dados);
  await query(
    `insert into imagens_importadas (hash, development_id, arquivo, tipo, situacao, dados) values ($1,$2,$3,'tabela','tabela',$4::jsonb) on conflict do nothing`,
    [hash, devId, arquivo.slice(0, 300), JSON.stringify(dados)]
  );
  return { situacao: 'tabela', detalhe: resumo };
}

// ---------------- descrição de venda gerada com o material lido ----------------
const REGRAS_DESCRICAO = `Você escreve a descrição de venda da página de um empreendimento no portal Mais Novos Imóveis (Goiânia), de Leyde Duarte.
É texto de página de venda, NÃO é notícia: nada de tom jornalístico, datas de acontecimentos ou "nesta semana". Deve continuar verdadeiro enquanto o empreendimento existir.
REGRA DE OURO: use SOMENTE os fatos fornecidos. Não invente nada (distâncias, nomes, materiais, itens de lazer, números). Se um assunto não tem fato, não escreva a seção.
Tom: elegante, seguro e aspiracional, luxo silencioso. Benefício antes da característica. Frases curtas, voz ativa, segunda pessoa quando couber.
Proibido: travessão (—), superlativos vazios ("o melhor", "único", "imperdível"), promessa de valorização, preços ou condições de pagamento (mudam todo mês), clichês ("more bem", "seu sonho realizado", "venha conferir").
Formato: parágrafos separados por linha em branco, subtítulos com "## ", listas com "- ". Sem título principal (o site já mostra o nome).
Estrutura (pule seções sem fatos):
1. Abertura (2 parágrafos curtos, sem subtítulo). A PRIMEIRA FRASE traz: nome + tipo de imóvel + bairro + Goiânia (ou a cidade) + fase (lançamento, em obras ou pronto para morar).
2. "## Localização no <bairro>": só pontos próximos fornecidos.
3. "## Plantas e metragens": cada tipologia (área, quartos, suítes, vagas) e para quem ela é.
4. "## Lazer e áreas comuns": frase de abertura e lista.
5. "## Tecnologia, segurança e sustentabilidade": só se houver fatos.
6. "## Quem assina": incorporadora, construtora, arquitetura, paisagismo, decoração (os nomes fornecidos).
7. "## Entrega": previsão (mês e ano) ou pronto para morar.
8. Fechamento: convite para pedir a tabela atualizada, consultar as unidades disponíveis e simular o financiamento com a Mais Novos Imóveis.
SEO natural: nome do empreendimento na primeira frase e mais 2 ou 3 vezes; bairro, tipo, quartos, metragens.
Responda só com o texto da descrição.`;

/** Escreve a descrição com tudo o que a importação leu (só se o condomínio estiver sem descrição) */
export async function gerarDescricao(devId: string): Promise<boolean> {
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) return false;
  const d = await query<{ name: string; bairro: string | null; cidade: string | null; tipo: string; entrega: string | null; amenities: string[] | null; pavimentos: number | null; description: string | null; fase: string | null }>(
    `select name, bairro, cidade, tipo, to_char(delivery_date, 'YYYY-MM') as entrega, amenities, pavimentos, description,
            case when delivery_date is null then null
                 when delivery_date > now() then 'lancamento'
                 when delivery_date > now() - interval '60 months' then 'novo'
                 when delivery_date > now() - interval '180 months' then 'seminovo' else 'usado' end as fase
       from developments where id = $1`,
    [devId]
  );
  const dev = d[0];
  if (!dev || (dev.description ?? '').trim().length >= 400) return false;
  const [tips, lidos, emp, legendas] = await Promise.all([
    query<{ area: number; quartos: number | null; vagas: number | null; tipo_unidade: string; description: string }>(
      `select area, quartos, vagas, tipo_unidade, description from properties where empreendimento_id = $1 and is_tipologia order by area`,
      [devId]
    ),
    query<{ dados: Record<string, unknown> }>(`select dados from imagens_importadas where development_id = $1 and dados is not null and tipo in ('ficha', 'info')`, [devId]),
    query<{ nome: string; ordem: number }>(
      `select coalesce(e.nome_perfil, e.razao_social) as nome, de.ordem from development_empresas de join empresas e on e.id = de.empresa_id where de.development_id = $1 order by de.ordem`,
      [devId]
    ).catch(() => []),
    query<{ legenda: string }>(`select legenda from imagens_importadas where development_id = $1 and situacao = 'foto' and legenda is not null`, [devId])
  ]);
  const fatos = lidos.flatMap((l) => [...((l.dados.fatos as string[]) ?? []), ...((l.dados.assinaturas as string[]) ?? [])]);
  const pontos = lidos.flatMap((l) => (l.dados.pontosProximos as string[]) ?? []);
  if (!tips.length && !fatos.length && !(dev.amenities ?? []).length) return false; // sem material suficiente
  const usado = dev.fase === 'seminovo' || dev.fase === 'usado';
  const material = {
    nome: dev.name,
    bairro: dev.bairro,
    cidade: dev.cidade ?? 'Goiânia',
    tipo: dev.tipo === 'horizontal' ? 'condomínio horizontal (casas ou lotes)' : 'edifício (vertical)',
    fase: dev.fase ?? 'sem data de entrega',
    entrega: dev.entrega,
    pavimentos: dev.pavimentos,
    incorporadoras: emp.map((e) => e.nome),
    tipologias: tips.map((t) => t.description),
    lazer: dev.amenities ?? [],
    pontosProximos: Array.from(new Set(pontos)).slice(0, 15),
    fatos: Array.from(new Set(fatos)).slice(0, 60),
    imagensDoMaterial: Array.from(new Set(legendas.map((l) => l.legenda))).slice(0, 30)
  };
  const tamanho = usado ? 'Escreva entre 150 e 300 palavras, objetivo, sem linguagem de lançamento.' : 'Escreva no mínimo 400 palavras (ideal 500 a 800).';
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': chave, 'anthropic-version': '2023-06-01' },
    signal: AbortSignal.timeout(58000),
    body: JSON.stringify({
      model: MODELO_LEITURA,
      max_tokens: 3000,
      system: `${REGRAS_DESCRICAO}\n${tamanho}`,
      messages: [{ role: 'user', content: `Material do empreendimento (JSON):\n${JSON.stringify(material)}` }]
    })
  });
  const j = (await r.json().catch(() => ({}))) as { content?: { text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } };
  if (!r.ok) return false;
  await registrarUsoIA(MODELO_LEITURA, j.usage, null);
  const texto = (j.content ?? []).map((c) => c.text ?? '').join('').replace(/\u2014/g, ',').trim();
  if (texto.length < 300) return false;
  await query(`update developments set description = $2, descricao_gerada_em = now() where id = $1 and coalesce(length(trim(description)), 0) < 400`, [devId, texto]);
  return true;
}

export { aplicarTabela, aplicarFicha, PEDIDO_TABELA, PEDIDO_FICHA, lerComIA, type Tabela, type Ficha };

/** Desfaz tudo o que a importação em massa fez num condomínio: fotos, plantas, tipologias
 *  criadas por ela, descrição gerada, registros e os arquivos no R2. */
export async function desfazerImportacao(devId: string): Promise<{ arquivos: number; tipologias: number }> {
  const urls = (await query<{ url: string }>(`select url from imagens_importadas where development_id = $1 and url is not null`, [devId])).map((r) => r.url);
  const inicio = await query<{ t: string | null }>(`select min(criado_em) as t from imagens_importadas where development_id = $1`, [devId]);
  await query(
    `update developments set photos = coalesce((select jsonb_agg(u) from jsonb_array_elements_text(coalesce(photos, '[]'::jsonb)) u where u <> all($2::text[])), '[]'::jsonb) where id = $1`,
    [devId, urls]
  );
  const tips = await query<{ id: string }>(
    `delete from properties where empreendimento_id = $1 and is_tipologia and id ~ ('^' || $1 || '-tip-[0-9]+$') and created_at >= coalesce($2::timestamptz, now()) returning id`,
    [devId, inicio[0]?.t ?? null]
  );
  await query(
    `update properties set plantas = coalesce((select jsonb_agg(u) from jsonb_array_elements_text(coalesce(plantas, '[]'::jsonb)) u where u <> all($2::text[])), '[]'::jsonb)
      where empreendimento_id = $1 and is_tipologia`,
    [devId, urls]
  );
  await query(`update developments set description = '', descricao_gerada_em = null where id = $1 and descricao_gerada_em is not null`, [devId]);
  await query(`delete from imagens_importadas where development_id = $1`, [devId]);
  const n = await apagarVariosDoR2(urls).catch(() => 0);
  await miniaturaDe('developments', devId).catch(() => {});
  return { arquivos: n, tipologias: tips.length };
}
