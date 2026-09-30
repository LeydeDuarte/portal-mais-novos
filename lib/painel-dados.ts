'use server';

// Painel de dados do Início (admin e analista): acessos, visitantes, contatos e cliques
// do portal inteiro, a partir da tabela "eventos" (gravada pelo próprio site) e dos
// contatos (interest_leads). Visitas da equipe logada e de robôs não entram.
import { query } from './db';
import { exigirEquipe } from './staff-auth';

export type Periodo = 'hoje' | '7d' | 'mes' | 'mes-passado' | '30d';
export type LinhaTop = { nome: string; sub?: string | null; url?: string | null; n: number; whatsapp?: number; contatos?: number };
export type DadosPainel = {
  periodo: { de: string; ate: string };
  acessos: number;
  visitantes: number;
  novos: number;
  contatosWhatsapp: number;
  contatosFormulario: number;
  cliquesWhatsapp: number;
  cliquesFundadora: number;
  cliquesBanner: number;
  cliquesCanal: number;
  cliquesAnuncie: number;
  leiturasNews: number;
  porDia: { dia: string; acessos: number; visitantes: number; whatsapp: number }[];
  paginas: LinhaTop[];
  imoveis: LinhaTop[];
  condominios: LinhaTop[];
  noticias: LinhaTop[];
  banners: LinhaTop[];
  origens: LinhaTop[];
};

function intervalo(p: Periodo): [string, string] {
  // horário de Brasília
  const hoje = `(now() at time zone 'America/Sao_Paulo')::date`;
  switch (p) {
    case 'hoje':
      return [`${hoje}`, `${hoje} + 1`];
    case '7d':
      return [`${hoje} - 6`, `${hoje} + 1`];
    case '30d':
      return [`${hoje} - 29`, `${hoje} + 1`];
    case 'mes-passado':
      return [`date_trunc('month', ${hoje} - interval '1 month')::date`, `date_trunc('month', ${hoje})::date`];
    default:
      return [`date_trunc('month', ${hoje})::date`, `${hoje} + 1`];
  }
}

const n = (v: unknown) => Number(v ?? 0) || 0;

export async function dadosDoPainel(periodo: Periodo = 'mes'): Promise<DadosPainel | null> {
  const eu = await exigirEquipe();
  if (eu.role !== 'admin') return null; // só o administrador principal
  const [de, ate] = intervalo(periodo);
  // eventos no período (em horário de Brasília)
  const EV = `(created_at at time zone 'America/Sao_Paulo')::date >= ${de} and (created_at at time zone 'America/Sao_Paulo')::date < ${ate}`;
  const ultimo = `regexp_replace(pagina, '^.*/', '')`;

  const [tot, leads, dias, paginas, imoveis, condos, noticias, banners, origens, datas] = await Promise.all([
    query<Record<string, string>>(
      `select count(*) filter (where tipo = 'visita') acessos,
              count(distinct visitante) filter (where tipo = 'visita') visitantes,
              count(*) filter (where tipo = 'visita' and novo) novos,
              count(*) filter (where tipo = 'whatsapp') whatsapp,
              count(*) filter (where tipo = 'fundadora') fundadora,
              count(*) filter (where tipo = 'banner') banner,
              count(*) filter (where tipo = 'canal') canal,
              count(*) filter (where tipo = 'anuncie') anuncie,
              count(*) filter (where tipo = 'visita' and pagina ~ '^/news/[^/]+/[^/]+$' and pagina !~ '^/news/(regiao|previa)/') news
         from eventos where ${EV}`
    ),
    query<Record<string, string>>(
      `select count(*) filter (where mensagem like 'Contato pelo WhatsApp%') whatsapp,
              count(*) filter (where mensagem is null or mensagem not like 'Contato pelo WhatsApp%') formulario
         from interest_leads where (created_at at time zone 'America/Sao_Paulo')::date >= ${de} and (created_at at time zone 'America/Sao_Paulo')::date < ${ate}`
    ),
    query<Record<string, string>>(
      `select to_char((created_at at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD') dia,
              count(*) filter (where tipo = 'visita') acessos, count(distinct visitante) filter (where tipo = 'visita') visitantes,
              count(*) filter (where tipo = 'whatsapp') whatsapp
         from eventos where ${EV} group by 1 order by 1`
    ),
    query<Record<string, string>>(`select pagina, count(*) n from eventos where ${EV} and tipo = 'visita' group by 1 order by 2 desc limit 10`),
    query<Record<string, string>>(
      `with v as (select ${ultimo} slug, pagina, count(*) n from eventos where ${EV} and tipo = 'visita' and pagina like '/imovel/%' group by 1, 2),
            w as (select ${ultimo} slug, count(*) n from eventos where ${EV} and tipo = 'whatsapp' and pagina like '/imovel/%' group by 1)
       select coalesce(p.titulo, initcap(replace(p.tipo_unidade, '_', ' '))) nome, coalesce(p.condominio, p.bairro) sub, min(v.pagina) url,
              sum(v.n) n, coalesce(max(w.n), 0) whatsapp
         from v join properties p on p.slug = v.slug or p.id = v.slug left join w on w.slug = v.slug
        group by p.id, p.titulo, p.tipo_unidade, p.condominio, p.bairro order by n desc limit 10`
    ),
    query<Record<string, string>>(
      `with v as (select ${ultimo} slug, pagina, count(*) n from eventos where ${EV} and tipo = 'visita' and pagina like '/empreendimento/%' group by 1, 2),
            w as (select ${ultimo} slug, count(*) n from eventos where ${EV} and tipo = 'whatsapp' and pagina like '/empreendimento/%' group by 1),
            l as (select development_id, count(*) n from interest_leads
                   where (created_at at time zone 'America/Sao_Paulo')::date >= ${de} and (created_at at time zone 'America/Sao_Paulo')::date < ${ate} group by 1)
       select d.name nome, d.bairro sub, min(v.pagina) url, sum(v.n) n, coalesce(max(w.n), 0) whatsapp, coalesce(max(l.n), 0) contatos
         from v join developments d on d.slug = v.slug or d.id = v.slug left join w on w.slug = v.slug left join l on l.development_id = d.id
        group by d.id, d.name, d.bairro order by n desc limit 10`
    ),
    query<Record<string, string>>(
      `select nt.titulo nome, nt.topico sub, e.pagina url, count(*) n from eventos e join noticias nt on nt.slug = regexp_replace(e.pagina, '^.*/', '')
        where ${EV.replace(/created_at/g, 'e.created_at')} and e.tipo = 'visita' and e.pagina like '/news/%' group by nt.titulo, nt.topico, e.pagina order by n desc limit 10`
    ),
    query<Record<string, string>>(
      `with c as (select ref, pagina, count(*) n from eventos where ${EV} and tipo = 'banner' group by 1, 2)
       select coalesce(b.titulo, 'Banner') nome, b.posicao, sum(c.n) n,
              (array_agg(c.pagina order by c.n desc))[1] url
         from c join banners b on b.id = c.ref group by b.id, b.titulo, b.posicao order by n desc limit 10`
    ),
    query<Record<string, string>>(
      `select coalesce(origem, 'Direto ou sem origem') nome, count(*) n from eventos where ${EV} and tipo = 'visita' group by 1 order by 2 desc limit 8`
    ),
    query<Record<string, string>>(`select to_char(${de}, 'YYYY-MM-DD') de, to_char(${ate} - 1, 'YYYY-MM-DD') ate`)
  ]);
  const t = tot[0] ?? {};
  return {
    periodo: { de: datas[0]?.de ?? '', ate: datas[0]?.ate ?? '' },
    acessos: n(t.acessos),
    visitantes: n(t.visitantes),
    novos: n(t.novos),
    contatosWhatsapp: n(leads[0]?.whatsapp),
    contatosFormulario: n(leads[0]?.formulario),
    cliquesWhatsapp: n(t.whatsapp),
    cliquesFundadora: n(t.fundadora),
    cliquesBanner: n(t.banner),
    cliquesCanal: n(t.canal),
    cliquesAnuncie: n(t.anuncie),
    leiturasNews: n(t.news),
    porDia: dias.map((d) => ({ dia: d.dia, acessos: n(d.acessos), visitantes: n(d.visitantes), whatsapp: n(d.whatsapp) })),
    paginas: paginas.map((p) => ({ nome: p.pagina, url: p.pagina, n: n(p.n) })),
    imoveis: imoveis.map((p) => ({ nome: p.nome, sub: p.sub, url: p.url, n: n(p.n), whatsapp: n(p.whatsapp) })),
    condominios: condos.map((p) => ({ nome: p.nome, sub: p.sub, url: p.url, n: n(p.n), whatsapp: n(p.whatsapp), contatos: n(p.contatos) })),
    noticias: noticias.map((p) => ({ nome: p.nome, sub: p.sub, url: p.url, n: n(p.n) })),
    banners: banners.map((p) => ({ nome: p.nome, sub: p.url ? `mais clicado em ${p.url}` : null, url: p.url, n: n(p.n) })),
    origens: origens.map((p) => ({ nome: p.nome, n: n(p.n) }))
  };
}
