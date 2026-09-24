// Perfil de interesse do visitante (para ordenar o feed) — lido no servidor.
// O cookie mn_perfil é escrito pelo navegador (lib/perfil-cliente.ts) a partir do
// que a pessoa busca e abre; só guarda preferências (tipos, bairros, faixa de
// preço), nada pessoal. Qualquer valor estranho é descartado.
import { cookies } from 'next/headers';
import { TIPO_UNIDADE_LABEL } from './tipologias';

export type PerfilFeed = { seed: string; tipos: string[]; bairros: string[]; precoMin: number | null; precoMax: number | null };

export function lerPerfilFeed(): PerfilFeed {
  const jar = cookies();
  const sessao = (jar.get('mn_sessao')?.value || jar.get('mn_dev')?.value || '').replace(/[^\w-]/g, '').slice(0, 40);
  const seed = sessao || new Date().toISOString().slice(0, 10);
  const vazio: PerfilFeed = { seed, tipos: [], bairros: [], precoMin: null, precoMax: null };
  const raw = jar.get('mn_perfil')?.value;
  if (!raw || raw.length > 1500) return vazio;
  try {
    const p = JSON.parse(Buffer.from(decodeURIComponent(raw), 'base64url').toString('utf8')) as { t?: unknown; b?: unknown; p?: unknown };
    const tipos = (Array.isArray(p.t) ? p.t : []).filter((t): t is string => typeof t === 'string' && t in TIPO_UNIDADE_LABEL).slice(0, 4);
    const bairros = (Array.isArray(p.b) ? p.b : []).filter((b): b is string => typeof b === 'string' && b.length <= 60).slice(0, 4);
    const faixa = Array.isArray(p.p) ? p.p.map(Number) : [];
    const ok = faixa.length === 2 && faixa.every((n) => Number.isFinite(n) && n > 0 && n < 1e10) && faixa[0] <= faixa[1];
    return { seed, tipos, bairros, precoMin: ok ? faixa[0] : null, precoMax: ok ? faixa[1] : null };
  } catch {
    return vazio;
  }
}
