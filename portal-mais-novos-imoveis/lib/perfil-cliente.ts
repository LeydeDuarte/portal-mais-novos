// Aprende o perfil do visitante NO NAVEGADOR (o que ele filtra e o que abre) e
// grava um resumo no cookie mn_perfil, que o servidor usa para ordenar o feed.
type Contagem = { t: Record<string, number>; b: Record<string, number>; precos: number[] };
const CHAVE = 'mn_perfil_contagem';

function ler(): Contagem {
  try {
    const c = JSON.parse(localStorage.getItem(CHAVE) || '{}');
    return { t: c.t ?? {}, b: c.b ?? {}, precos: Array.isArray(c.precos) ? c.precos : [] };
  } catch {
    return { t: {}, b: {}, precos: [] };
  }
}

const top = (m: Record<string, number>, n: number) =>
  Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);

export function aprenderPerfil(sinal: { tipos?: string[]; bairros?: string[]; preco?: number | null; peso?: number }) {
  try {
    const c = ler();
    const peso = sinal.peso ?? 1;
    for (const t of sinal.tipos ?? []) c.t[t] = (c.t[t] ?? 0) + peso;
    for (const b of sinal.bairros ?? []) if (b) c.b[b] = (c.b[b] ?? 0) + peso;
    if (sinal.preco && sinal.preco > 0) c.precos = [...c.precos, sinal.preco].slice(-12);
    // esquece aos poucos (o que a pessoa buscava há muito tempo pesa menos)
    for (const m of [c.t, c.b]) for (const k of Object.keys(m)) if ((m[k] *= 0.97) < 0.2) delete m[k];
    localStorage.setItem(CHAVE, JSON.stringify(c));
    const ord = [...c.precos].sort((a, b) => a - b);
    const med = ord.length ? ord[Math.floor(ord.length / 2)] : 0;
    const resumo = { t: top(c.t, 3), b: top(c.b, 3), p: med ? [Math.round(med * 0.7), Math.round(med * 1.3)] : [] };
    const valor = btoa(unescape(encodeURIComponent(JSON.stringify(resumo)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    document.cookie = `mn_perfil=${valor}; path=/; max-age=31536000; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`;
  } catch {
    // sem armazenamento: o feed segue só aleatório
  }
}
