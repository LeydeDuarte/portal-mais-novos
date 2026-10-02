'use server';

// Painel → Para avisar: combinações entre pedidos de aviso e anúncios publicados.
import { query } from './db';
import { exigirEquipe } from './staff-auth';
import { gerarAvisos } from './avisos';
import { urlImovel } from './urls';
import { TIPO_UNIDADE_LABEL, type TipoUnidade } from './tipologias';

export type AvisoPendente = {
  id: string;
  criadoEm: string;
  metros: number | null;
  mesmoCondominio: boolean;
  pessoa: {
    nome: string;
    telefone: string | null;
    email: string | null;
    condominio: string;
    temCondominio: boolean;
    raio: number;
    quartos: number[];
    grupo: string | null;
    bairro: string | null;
    cidade: string | null;
    areaMin: number | null;
    areaMax: number | null;
  };
  imovel: { id: string; titulo: string; preco: number | null; detalhes: string; bairro: string | null; condominio: string | null; url: string };
};

export async function listAvisos(): Promise<AvisoPendente[]> {
  await exigirEquipe();
  const rows = await query<Record<string, unknown>>(
    `select a.id, a.criado_em, a.metros, a.mesmo_condominio,
            l.nome, l.telefone, l.email, l.condominio as l_condominio, l.raio, l.quartos_opcoes,
            l.grupo, l.bairro_ref, l.cidade_ref, l.area_min, l.area_max, l.development_id as l_dev,
            p.id as p_id, p.slug, p.uf, p.cidade, p.bairro, p.finalidade, p.titulo, p.tipo_unidade, p.price_value, p.quartos, p.area,
            coalesce(d.name, p.condominio) as p_condominio
       from avisos_pendentes a
       join interest_leads l on l.id = a.lead_id
       join properties p on p.id = a.property_id
       left join developments d on d.id = p.empreendimento_id
      where a.avisado_em is null and a.descartado_em is null
        and l.descadastrado_em is null
        and p.vendido_em is null and coalesce(p.visibilidade, 'publico') = 'publico'
      order by a.criado_em desc
      limit 300`
  );
  return rows.map((r) => {
    const tipo = TIPO_UNIDADE_LABEL[r.tipo_unidade as TipoUnidade] ?? 'Imóvel';
    const detalhes = [tipo, r.quartos ? `${r.quartos} qto${Number(r.quartos) > 1 ? 's' : ''}` : '', r.area ? `${Math.round(Number(r.area))} m²` : ''].filter(Boolean).join(' · ');
    return {
      id: String(r.id),
      criadoEm: new Date(r.criado_em as string).toISOString(),
      metros: r.metros == null ? null : Number(r.metros),
      mesmoCondominio: !!r.mesmo_condominio,
      pessoa: { nome: String(r.nome), telefone: (r.telefone as string) ?? null, email: (r.email as string) ?? null, condominio: String(r.l_condominio ?? ''),
        temCondominio: !!r.l_dev,
        raio: Number(r.raio) || 0,
        quartos: Array.isArray(r.quartos_opcoes) ? (r.quartos_opcoes as number[]).map(Number) : [],
        grupo: (r.grupo as string) ?? null,
        bairro: (r.bairro_ref as string) ?? null,
        cidade: (r.cidade_ref as string) ?? null,
        areaMin: r.area_min == null ? null : Number(r.area_min),
        areaMax: r.area_max == null ? null : Number(r.area_max)
      },
      imovel: {
        id: String(r.p_id),
        titulo: String(r.titulo || tipo),
        preco: r.price_value == null ? null : Number(r.price_value),
        detalhes,
        bairro: (r.bairro as string) ?? null,
        condominio: (r.p_condominio as string) ?? null,
        url: urlImovel({ id: String(r.p_id), slug: r.slug as string | null, uf: r.uf as string | null, cidade: r.cidade as string | null, bairro: r.bairro as string | null, finalidade: r.finalidade as string | null })
      }
    };
  });
}

/** Marca como avisado (pelo WhatsApp, por quem clicou) ou descarta */
export async function marcarAviso(id: string, acao: 'avisado' | 'descartado'): Promise<void> {
  const staff = await exigirEquipe();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  if (acao === 'avisado') await query(`update avisos_pendentes set avisado_em = now(), avisado_por = $2, canal = 'whatsapp' where id = $1::uuid`, [id, staff.email]);
  else await query(`update avisos_pendentes set descartado_em = now(), avisado_por = $2 where id = $1::uuid`, [id, staff.email]);
}

/**
 * Procura combinações com os anúncios publicados nos últimos 30 dias (útil depois
 * de importar anúncios ou para quem acabou de pedir aviso). Não dispara e-mail.
 */
export async function procurarAvisosRecentes(): Promise<{ anuncios: number; novos: number }> {
  await exigirEquipe();
  const ids = await query<{ id: string }>(
    `select id from properties
      where not is_tipologia and coalesce(visibilidade, 'publico') = 'publico' and vendido_em is null
        and created_at > now() - interval '30 days'
      order by created_at desc limit 400`
  );
  let novos = 0;
  for (const { id } of ids) novos += await gerarAvisos(id, { email: false }).catch(() => 0);
  return { anuncios: ids.length, novos };
}
