// Lê a origem gravada no navegador (cookie mn_origem) — só no servidor.
import { cookies } from 'next/headers';
import type { OrigemBruta } from './origem-lead';

const t = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined);

export function origemDoNavegador(): OrigemBruta | null {
  try {
    const raw = cookies().get('mn_origem')?.value;
    if (!raw || raw.length > 1200) return null;
    const o = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    const clid = o.clid === 'fb' || o.clid === 'gg' || o.clid === 'tt' ? o.clid : undefined;
    const limpo: OrigemBruta = { s: t(o.s, 60), m: t(o.m, 40), c: t(o.c, 100), t: t(o.t, 100), ref: t(o.ref, 100), clid, em: Number(o.em) || undefined };
    return Object.values(limpo).some((v) => v !== undefined) ? limpo : null;
  } catch {
    return null;
  }
}
