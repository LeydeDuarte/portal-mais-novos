'use server';

// Painel → Importar imagens em massa: casar pastas com condomínios, criar rascunhos e fechar cada pasta.
import { randomBytes } from 'crypto';
import { query } from './db';
import { exigirGestor } from './staff-auth';
import { finalizarPasta } from './importar-massa';

const DE = 'áàâãäéèêëíìîïóòôõöúùûüçñ';
const PARA = 'aaaaaeeeeiiiiooooouuuucn';
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(condominio|edificio|residencial|residence|ed|cond|res)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const normSql = (c: string) =>
  `trim(regexp_replace(regexp_replace(translate(lower(${c}), '${DE}', '${PARA}'), '\\m(condominio|edificio|residencial|residence)\\M', ' ', 'g'), '[^a-z0-9]+', ' ', 'g'))`;

export type Candidato = { id: string; nome: string; bairro: string | null; cidade: string | null; status: string; fotos: number };
export type Casamento = { pasta: string; confianca: 'exato' | 'provavel' | 'nenhum'; escolhido: Candidato | null; opcoes: Candidato[] };

/** "Autêntico Residencial - Jardim Goiás" → nome + bairro; procura o condomínio */
export async function casarPastas(pastas: string[]): Promise<Casamento[]> {
  await exigirGestor();
  const out: Casamento[] = [];
  for (const pasta of pastas.slice(0, 2000)) {
    const [nomeBruto, bairroBruto] = pasta.split(/\s+-\s+/);
    const n = norm(nomeBruto ?? pasta);
    const b = bairroBruto ? norm(bairroBruto) : '';
    const palavras = n.split(' ').filter((w) => w.length > 1).slice(0, 6);
    if (!palavras.length) {
      out.push({ pasta, confianca: 'nenhum', escolhido: null, opcoes: [] });
      continue;
    }
    const conds = palavras.map((_, i) => `${normSql('d.name')} like $${i + 1}`).join(' and ');
    const rows = await query<{ id: string; name: string; bairro: string | null; cidade: string | null; status: string; fotos: number; nn: string; nb: string }>(
      `select d.id, d.name, d.bairro, d.cidade, d.status, jsonb_array_length(coalesce(d.photos, '[]'::jsonb)) as fotos,
              ${normSql('d.name')} as nn, ${normSql("coalesce(d.bairro, '')")} as nb
         from developments d where ${conds} order by length(d.name) limit 8`,
      palavras.map((w) => `%${w}%`)
    );
    const cand = rows.map((r) => ({ id: r.id, nome: r.name, bairro: r.bairro, cidade: r.cidade, status: r.status, fotos: Number(r.fotos) || 0, nn: r.nn, nb: r.nb }));
    const exatos = cand.filter((c) => c.nn === n && (!b || c.nb === b));
    const mesmoNome = cand.filter((c) => c.nn === n);
    const escolhido = exatos.length === 1 ? exatos[0] : mesmoNome.length === 1 ? mesmoNome[0] : null;
    const limpa = ({ nn, nb, ...c }: (typeof cand)[number]) => (void nn, void nb, c);
    out.push({
      pasta,
      confianca: escolhido ? (exatos.length === 1 ? 'exato' : 'provavel') : cand.length ? 'provavel' : 'nenhum',
      escolhido: escolhido ? limpa(escolhido) : cand.length === 1 ? limpa(cand[0]) : null,
      opcoes: cand.slice(0, 5).map(limpa)
    });
  }
  return out;
}

/** Pasta sem condomínio: cria como rascunho (o projeto de cadastro completa depois) */
export async function criarRascunhoDaPasta(pasta: string): Promise<Candidato> {
  const s = await exigirGestor();
  const [nomeBruto, bairroBruto] = pasta.split(/\s+-\s+/);
  const nome = (nomeBruto ?? pasta).trim().slice(0, 120);
  const id = `condo-${norm(nome).replace(/\s+/g, '-').slice(0, 40)}-${randomBytes(3).toString('hex')}`;
  await query(
    `insert into developments (id, name, bairro, cidade, uf, tipo, status, corretor_email, origem)
     values ($1, $2, $3, 'Goiânia', 'GO', 'vertical', 'rascunho', $4, 'importacao-imagens')`,
    [id, nome, bairroBruto?.trim().slice(0, 80) || null, s.email]
  );
  return { id, nome, bairro: bairroBruto?.trim() || null, cidade: 'Goiânia', status: 'rascunho', fotos: 0 };
}

export async function fecharPasta(devId: string): Promise<{ fotos: number; capa: string | null; descricao: boolean }> {
  await exigirGestor();
  return finalizarPasta(devId);
}

export type Pendencia = { id: string; nome: string; arquivo: string | null; detalhe: string; url: string | null };

/** O que ficou para conferir: plantas sem tipologia */
export async function pendenciasImportacao(): Promise<Pendencia[]> {
  await exigirGestor();
  const r = await query<{ id: string; nome: string; arquivo: string | null; metragem: string | null; url: string | null }>(
    `select d.id, d.name as nome, i.arquivo, i.metragem, i.url from imagens_importadas i join developments d on d.id = i.development_id
      where i.situacao = 'planta_sem_par' order by i.criado_em desc limit 300`
  );
  return r.map((x) => ({ id: x.id, nome: x.nome, arquivo: x.arquivo, url: x.url, detalhe: x.metragem ? `planta de ${Number(x.metragem)} m² sem tipologia` : 'planta sem metragem legível' }));
}
