// Região do visitante: a escolhida no seletor do News (cookie mn_regiao) ou a
// localização aproximada pela internet (a Vercel informa estado e cidade). Padrão: Goiânia.
import { cookies, headers } from 'next/headers';
import { UFS } from './base';

export type RegiaoVisitante = { uf: string; cidade: string | null; nome: string; origem: 'escolha' | 'local' | 'padrao' };

export function regiaoDoVisitante(): RegiaoVisitante {
  const padrao: RegiaoVisitante = { uf: 'GO', cidade: 'Goiânia', nome: 'Goiânia', origem: 'padrao' };
  try {
    const escolha = cookies().get('mnn_regiao')?.value;
    if (escolha && escolha !== 'todas') {
      const [uf, cidade] = decodeURIComponent(escolha).split('|');
      if (UFS[uf?.toUpperCase()]) return { uf: uf.toUpperCase(), cidade: cidade || null, nome: cidade || UFS[uf.toUpperCase()], origem: 'escolha' };
    }
    const h = headers();
    const uf = (h.get('x-vercel-ip-country-region') ?? '').toUpperCase();
    if (h.get('x-vercel-ip-country') === 'BR' && UFS[uf]) {
      const cidade = decodeURIComponent(h.get('x-vercel-ip-city') ?? '') || null;
      return { uf, cidade, nome: cidade ?? UFS[uf], origem: 'local' };
    }
  } catch {
    /* fora de uma requisição */
  }
  return padrao;
}
