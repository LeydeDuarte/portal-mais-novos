// Fila de imagens de condomínios e tipologias (fotos e plantas).
// Quem cadastra (o projeto do Claude pelo banco, ou alguém da equipe) só põe o LINK da imagem
// na tabela imagens_fila; o portal baixa, reduz, guarda no R2 com nome bom para o Google e
// liga ao condomínio (fotos) ou à tipologia (plantas). Aceita link direto de imagem, link de
// arquivo do Google Drive (compartilhado como "qualquer pessoa com o link") e do Dropbox.
import { query } from './db';
import { prepararFoto, MAX_ORIGEM_BYTES } from './fotos-fila';
import { enviarParaR2, r2Configurado } from './r2';
import { miniaturaDe } from './miniaturas';

type Item = {
  id: string;
  development_id: string | null;
  property_id: string | null;
  tipo: 'foto' | 'planta';
  url: string;
  legenda: string | null;
  capa: boolean;
  tentativas: number;
};

/** Link de compartilhamento → link que baixa o arquivo */
export function linkDeDownload(u: string): string {
  const drive = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/);
  if (drive) return `https://drive.usercontent.google.com/download?id=${drive[1]}&export=download&confirm=t`;
  if (/^https:\/\/(www\.)?dropbox\.com\//.test(u)) {
    const x = new URL(u);
    x.searchParams.set('dl', '1');
    return x.toString();
  }
  return u;
}

async function baixar(url: string): Promise<{ buf: Buffer; tipo: string }> {
  const r = await fetch(linkDeDownload(url), {
    redirect: 'follow',
    signal: AbortSignal.timeout(45000),
    headers: { 'user-agent': 'Mozilla/5.0 (MaisNovosImoveis; cadastro de imagens)' }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const tipo = r.headers.get('content-type') ?? '';
  if (tipo.includes('text/html')) throw new Error('o link abriu uma página, não uma imagem (no Drive, compartilhe como "qualquer pessoa com o link")');
  const tam = Number(r.headers.get('content-length') ?? 0);
  if (tam > MAX_ORIGEM_BYTES) throw new Error('arquivo maior que 150 MB');
  return { buf: Buffer.from(await r.arrayBuffer()), tipo };
}

/** Processa a fila por até `orcamentoMs` (uma chamada da Vercel tem 60 s). */
export async function processarFilaImagens(orcamentoMs = 45000): Promise<{ feitas: number; erros: number; restantes: number }> {
  if (r2Configurado().length) return { feitas: 0, erros: 0, restantes: 0 };
  const inicio = Date.now();
  let feitas = 0;
  let erros = 0;
  const tocados = new Set<string>();
  while (Date.now() - inicio < orcamentoMs) {
    const lote = await query<Item>(
      `update imagens_fila set tentativas = tentativas + 1
        where id in (select id from imagens_fila where status = 'pendente' and tentativas < 3 order by capa desc, ordem, id limit 5 for update skip locked)
        returning id, development_id, property_id, tipo, url, legenda, capa, tentativas`
    );
    if (!lote.length) break;
    for (const it of lote) {
      try {
        // nome do arquivo: nome do condomínio (SEO de imagem)
        const nome = await query<{ nome: string }>(
          it.property_id
            ? `select coalesce(d.name, p.condominio, p.titulo, 'imovel') as nome from properties p left join developments d on d.id = p.empreendimento_id where p.id = $1`
            : `select name as nome from developments where id = $1`,
          [it.property_id ?? it.development_id]
        );
        if (!nome[0]) throw new Error('condomínio ou tipologia não encontrado');
        const ehPlanta = it.tipo === 'planta';
        if (ehPlanta && !it.property_id) throw new Error('planta precisa da tipologia (property_id)');
        const { buf, tipo } = await baixar(it.url);
        const pronta = await prepararFoto(buf, tipo, ehPlanta);
        const url = await enviarParaR2(pronta.buf, pronta.tipo, ehPlanta ? 'plantas' : 'empreendimentos', `${nome[0].nome}${ehPlanta ? ' planta' : ''}`);
        if (ehPlanta) {
          await query(`update properties set plantas = coalesce(plantas, '[]'::jsonb) || to_jsonb($2::text) where id = $1`, [it.property_id, url]);
        } else {
          const tabela = it.property_id ? 'properties' : 'developments';
          const id = it.property_id ?? it.development_id!;
          await query(
            it.capa
              ? `update ${tabela} set photos = to_jsonb(array[$2::text]) || coalesce(photos, '[]'::jsonb) where id = $1`
              : `update ${tabela} set photos = coalesce(photos, '[]'::jsonb) || to_jsonb($2::text) where id = $1`,
            [id, url]
          );
          tocados.add(`${tabela}:${id}`);
        }
        await query(`update imagens_fila set status = 'ok', resultado = $2, erro = null, processado_em = now() where id = $1`, [it.id, url]);
        feitas++;
      } catch (e) {
        const msg = e instanceof Error ? e.message.slice(0, 300) : 'falha';
        await query(`update imagens_fila set status = case when tentativas >= 3 then 'erro' else 'pendente' end, erro = $2, processado_em = now() where id = $1`, [it.id, msg]);
        erros++;
      }
    }
  }
  // miniatura da capa (feed) dos condomínios que ganharam foto
  for (const t of Array.from(tocados)) {
    const [tabela, id] = t.split(':') as ['properties' | 'developments', string];
    await miniaturaDe(tabela, id).catch(() => {});
  }
  const r = await query<{ n: string }>(`select count(*) as n from imagens_fila where status = 'pendente'`);
  return { feitas, erros, restantes: Number(r[0]?.n) || 0 };
}
