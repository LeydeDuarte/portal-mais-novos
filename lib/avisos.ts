// Alertas "Avise-me" (módulo do servidor; NÃO é 'use server', então nada daqui
// vira endpoint público). Mesma ferramenta para a página do condomínio, a página
// do anúncio e, depois, o mapa: todos gravam em interest_leads (com alcance) e
// todos são atendidos por gerarAvisos().
//
// Quando um anúncio público é cadastrado ou editado, gerarAvisos() procura quem
// pediu aviso daquele condomínio ou de até 500 m / 2 km ao redor (distância real),
// respeitando finalidade e valor. Cada combinação vira uma linha em
// avisos_pendentes (uma só por pessoa + anúncio, nunca repete), que aparece no
// painel em "Para avisar" com o WhatsApp pronto. Se o e-mail estiver configurado,
// o aviso também sai por e-mail e a linha já fica como avisada.
import { query } from './db';
import { mapPropertyRow, type PropertyRow } from './db-mappers';
import { enviarEmail, emailConfigurado, emailLayout, escapeHtml } from './email';
import { TIPO_UNIDADE_LABEL } from './tipologias';
import { formatTitulo } from './text';
import { SITE_URL } from './seo';
import { urlImovel } from './urls';

const DE = 'áàâãäéèêëíìîïóòôõöúùûüç';
const PARA = 'aaaaaeeeeiiiiooooouuuuc';
const norm = (sql: string) => `translate(lower(trim(${sql})), '${DE}', '${PARA}')`;

export const distanciaTexto = (m: number) => (m < 1000 ? `${Math.max(100, Math.round(m / 100) * 100)} m` : `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`);

type Combina = {
  id: string;
  nome: string;
  email: string | null;
  unsubscribe_token: string | null;
  valor_max: string | null;
  condominio: string;
  mesmo: boolean;
  metros: number | null;
};

/**
 * Gera os avisos de um anúncio. `email: false` só registra (usado ao procurar
 * combinações antigas, para não disparar e-mails de anúncios já antigos).
 * Devolve quantos avisos novos foram criados.
 */
export async function gerarAvisos(propertyId: string, opcoes: { email: boolean } = { email: true }): Promise<number> {
  const props = await query<PropertyRow & { lat?: number | null; lng?: number | null }>(
    `select * from properties where id = $1 and not is_tipologia and coalesce(visibilidade, 'publico') = 'publico' and vendido_em is null`,
    [propertyId]
  );
  const p = props[0];
  if (!p) return 0;
  const dev = p.empreendimento_id
    ? (await query<{ name: string; lat: number | null; lng: number | null }>('select name, lat, lng from developments where id = $1', [p.empreendimento_id]))[0]
    : undefined;
  const nomeCondo = dev?.name ?? p.condominio ?? null;
  const lat = p.lat ?? dev?.lat ?? null;
  const lng = p.lng ?? dev?.lng ?? null;
  if (!nomeCondo && !p.empreendimento_id && lat == null) return 0;

  const dist = `(6371000 * 2 * asin(sqrt(power(sin(radians(l.lat - $4) / 2), 2) + cos(radians($4)) * cos(radians(l.lat)) * power(sin(radians(l.lng - $5) / 2), 2))))`;
  const mesmo = `(($2::text is not null and l.development_id = $2) or ($3::text is not null and ${norm('l.condominio')} = ${norm('$3::text')}))`;
  const leads = await query<Combina>(
    `select l.id, l.nome, l.email, l.unsubscribe_token, l.valor_max, l.condominio, ${mesmo} as mesmo,
            case when l.lat is not null and $4::float8 is not null then ${dist} end as metros
       from interest_leads l
      where l.aceita_contato and l.descadastrado_em is null and l.finalidade = $1
        and coalesce(l.status, 'novo') <> 'descartado'
        and (l.property_id is null or l.property_id <> $6)
        -- quartos: mesma regra do filtro do feed (4 = 4 ou mais; 0 = sem quartos); vazio = qualquer
        and (l.quartos_opcoes is null or cardinality(l.quartos_opcoes) = 0
             or coalesce($7::int, 0) = any(l.quartos_opcoes)
             or (4 = any(l.quartos_opcoes) and coalesce($7::int, 0) >= 4))
        and (l.quartos is null or l.quartos_opcoes is not null or coalesce($7::int, 0) >= l.quartos)
        and (${mesmo} or (l.raio > 0 and l.lat is not null and $4::float8 is not null and ${dist} <= l.raio))`,
    [p.finalidade, p.empreendimento_id, nomeCondo, lat, lng, propertyId, p.quartos ?? null]
  );
  const preco = Number(p.price_value);
  const validos = leads.filter((l) => !(l.valor_max && preco > Number(l.valor_max) * 1.35)); // bem acima do que a pessoa quer investir
  if (!validos.length) return 0;

  // grava as combinações novas (as que já existiam não repetem)
  const novos = await query<{ lead_id: string }>(
    `insert into avisos_pendentes (lead_id, property_id, metros, mesmo_condominio)
     select x.lead_id::uuid, $1, x.metros, x.mesmo
       from jsonb_to_recordset($2::jsonb) as x(lead_id text, metros int, mesmo boolean)
     on conflict (lead_id, property_id) do nothing
     returning lead_id::text`,
    [propertyId, JSON.stringify(validos.map((l) => ({ lead_id: l.id, metros: l.metros == null ? null : Math.round(l.metros), mesmo: !!l.mesmo })))]
  );
  if (!novos.length || !opcoes.email || !emailConfigurado()) return novos.length;

  // e-mail para quem deixou e-mail (só nas combinações novas)
  const ids = new Set(novos.map((n) => n.lead_id));
  const imovel = mapPropertyRow(p);
  const titulo = imovel.titulo || `${TIPO_UNIDADE_LABEL[imovel.tipoUnidade]} em ${imovel.location}`;
  const link = `${SITE_URL}${urlImovel(p)}`;
  for (const l of validos) {
    if (!ids.has(l.id) || !l.email) continue;
    const perto = !l.mesmo && l.metros != null;
    const d = perto ? distanciaTexto(l.metros!) : '';
    const ok = await enviarEmail(
      l.email,
      perto ? `Novo imóvel a ${d} do ${formatTitulo(l.condominio)}` : `Novo imóvel no ${formatTitulo(nomeCondo ?? '')}`,
      emailLayout(
        perto ? `Surgiu um imóvel perto do ${escapeHtml(formatTitulo(l.condominio))}` : `Surgiu um imóvel no ${escapeHtml(formatTitulo(nomeCondo ?? ''))}`,
        `<p style="font-size:15px">Olá, ${escapeHtml(l.nome.split(' ')[0])}! Você pediu para ser avisado(a)${perto ? `, e este fica a cerca de ${d}` : ''}:</p>
         <p style="font-size:16px"><strong>${escapeHtml(titulo)}</strong><br>${escapeHtml(imovel.price)} · ${escapeHtml(imovel.beds)} · ${escapeHtml(imovel.area)}</p>
         <p><a href="${link}" style="display:inline-block;background:#14161a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold">Ver o imóvel</a></p>
         ${l.unsubscribe_token ? `<p style="font-size:11px;color:#9aa0a8;margin-top:20px">Não quer mais receber estes avisos? <a href="${SITE_URL}/api/interesse/cancelar?t=${l.unsubscribe_token}" style="color:#9aa0a8">Cancelar avisos</a></p>` : ''}`
      )
    );
    if (ok) {
      await query(`update avisos_pendentes set avisado_em = now(), canal = 'email' where lead_id = $1::uuid and property_id = $2`, [l.id, propertyId]);
      await query('update interest_leads set ultimo_aviso_em = now() where id = $1::uuid', [l.id]);
    }
  }
  return novos.length;
}
