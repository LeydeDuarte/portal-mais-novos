// Importação de imagens em massa (Painel → Importar imagens): uma pasta por empreendimento.
// O navegador reduz cada imagem (e recorta as páginas dos PDFs); aqui a IA classifica
// (foto, planta ou descarte), lê a metragem das plantas, o portal guarda no R2, liga a
// planta à tipologia de mesma área e, no fim da pasta, ordena as fotos e escolhe a capa.
import sharp from 'sharp';
import { query } from './db';
import { enviarParaR2 } from './r2';
import { prepararFoto } from './fotos-fila';
import { miniaturaDe } from './miniaturas';
import { registrarUsoIA } from './custos';

export type Classificacao = {
  tipo: 'foto' | 'planta' | 'descartar';
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
{"tipo":"foto|planta|descartar","categoria":"fachada|externa|lazer|comum|decorado|vista|implantacao|outro","qualidade":1-5,"metragem":número ou null,"quartos":número ou null,"suites":número ou null,"nomeTipologia":"texto ou null","legenda":"até 8 palavras em português"}
Regras:
- planta: desenho técnico visto de cima, com cômodos (planta humanizada também). Leia a metragem PRIVATIVA escrita na imagem (ex.: "145,32 m²" → 145.32). Leia quartos, suítes e o nome da tipologia ("Tipo A", "Final 01") se estiverem escritos. Não invente: se não estiver legível, null.
- foto: fachada (prédio ou casas visto de fora, inteiro), externa (portaria, acesso, jardim), lazer (piscina, academia, salão, quadra, playground, gourmet), comum (hall, lobby, coworking), decorado (interior de unidade), vista, implantacao (vista aérea ilustrada do terreno).
- descartar: logotipo, mapa de localização, tabela de preços, página só de texto, capa de book só com título, ficha técnica, imagem muito pequena ou com marca d'água de imobiliária ou portal.
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
    tipo: o.tipo === 'planta' || o.tipo === 'descartar' ? o.tipo : 'foto',
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

export type ResultadoArquivo = { situacao: 'foto' | 'planta' | 'planta_sem_par' | 'descartada' | 'repetida'; detalhe?: string };

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
    await reg('planta_sem_par', url, null);
    return { situacao: 'planta_sem_par', detalhe: c.metragem ? `${c.metragem} m² sem tipologia` : 'metragem não legível' };
  }
  await reg('foto', url, null);
  return { situacao: 'foto', detalhe: c.categoria };
}

const ORDEM_CAT: Record<string, number> = { fachada: 0, externa: 1, implantacao: 2, lazer: 3, comum: 4, vista: 5, decorado: 6, outro: 7 };

/** Fim da pasta: fotos importadas em ordem (capa = melhor fachada), junto das que já existiam */
export async function finalizarPasta(devId: string, maxFotos = 40): Promise<{ fotos: number; capa: string | null }> {
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
  await miniaturaDe('developments', devId).catch(() => {});
  return { fotos: fotos.length, capa: fotos[0] ?? null };
}
