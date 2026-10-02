'use server';

// Painel de dados do Início (admin e analista): acessos, visitantes, contatos e cliques
// do portal inteiro, a partir da tabela "eventos" (gravada pelo próprio site) e dos
// contatos (interest_leads). Visitas da equipe logada e de robôs não entram.
import { query } from './db';
import { exigirEquipe } from './staff-auth';

export type Periodo = 'hoje' | '7d' | 'mes' | 'mes-passado' | '30d' | 'personalizado';
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
  cliquesAvaliar: number;
  cliquesSol: number;
  cliquesVender: number;
  leiturasNews: number;
  favoritos: number;
  compartilhamentos: number;
  tempoMedio: number | null; // segundos por página
  imoveisFavoritados: LinhaTop[];
  condominiosFavoritados: LinhaTop[];
  imoveisCompartilhados: LinhaTop[];
  condominiosCompartilhados: LinhaTop[];
  paginasTempo: LinhaTop[]; // n = segundos médios, contatos = quantas medições
  incorporadoras: LinhaTop[]; // n = visitas ao perfil, whatsapp = visitas aos empreendimentos dela
  porDia: { dia: string; acessos: number; visitantes: number; whatsapp: number }[];
  paginas: LinhaTop[];
  imoveis: LinhaTop[];
  condominios: LinhaTop[];
  noticias: LinhaTop[];
  banners: LinhaTop[];
  origens: LinhaTop[];
};

const DATA = /^\d{4}-\d{2}-\d{2}$/;
function intervalo(p: Periodo, de?: string, ate?: string): [string, string] {
  // personalizado: datas conferidas (AAAA-MM-DD), com o último dia incluído
  if (p === 'personalizado' && de && ate && DATA.test(de) && DATA.test(ate) && !Number.isNaN(Date.parse(de)) && !Number.isNaN(Date.parse(ate))) {
    const [a, b] = de <= ate ? [de, ate] : [ate, de];
    return [`'${a}'::date`, `'${b}'::date + 1`];
  }
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

export async function dadosDoPainel(periodo: Periodo = 'mes', de?: string, ate?: string): Promise<DadosPainel | null> {
  const eu = await exigirEquipe();
  if (eu.role !== 'admin') return null; // só o administrador principal
  const [deSql, ateSql] = intervalo(periodo, de, ate);
  // eventos no período (em horário de Brasília)
  const EV = `(created_at at time zone 'America/Sao_Paulo')::date >= ${deSql} and (created_at at time zone 'America/Sao_Paulo')::date < ${ateSql}`;
  const ultimo = `regexp_replace(pagina, '^.*/', '')`;

  // nome legível de uma página (condomínio, imóvel ou notícia pelo fim do endereço)
  const nomePagina = (col: string) => `coalesce(
      (select d.name from developments d where ${col} like '/empreendimento/%' and d.slug = regexp_replace(${col}, '^.*/', '') limit 1),
      (select coalesce(pp.titulo, pp.condominio) from properties pp where ${col} like '/imovel/%' and pp.slug = regexp_replace(${col}, '^.*/', '') limit 1),
      (select nt.titulo from noticias nt where ${col} like '/news/%' and nt.slug = regexp_replace(${col}, '^.*/', '') limit 1),
      (select coalesce(nullif(em.nome_perfil, ''), nullif(em.nome_fantasia, ''), em.razao_social) from empresas em where ${col} like '/empresa/%' and em.slug = regexp_replace(${col}, '^.*/', '') limit 1),
      case when ${col} = '/' then 'Página inicial (feed)' else ${col} end)`;
  const rankRef = (tipo: string, tabela: 'properties' | 'developments') =>
    tabela === 'properties'
      ? `select coalesce(x.titulo, initcap(replace(x.tipo_unidade, '_', ' '))) nome, coalesce(x.condominio, x.bairro) sub, x.slug, count(*) n
           from eventos e join properties x on x.id = e.ref where ${EV.replace(/created_at/g, 'e.created_at')} and e.tipo = '${tipo}'
          group by x.id, x.titulo, x.tipo_unidade, x.condominio, x.bairro, x.slug order by n desc limit 10`
      : `select x.name nome, x.bairro sub, x.slug, count(*) n
           from eventos e join developments x on x.id = e.ref where ${EV.replace(/created_at/g, 'e.created_at')} and e.tipo = '${tipo}'
          group by x.id, x.name, x.bairro, x.slug order by n desc limit 10`;
  const [favI, favC, comI, comC, tempo, tempoPag, incorp] = await Promise.all([
    query<Record<string, string>>(rankRef('favorito', 'properties')),
    query<Record<string, string>>(rankRef('favorito', 'developments')),
    query<Record<string, string>>(rankRef('compartilhar', 'properties')),
    query<Record<string, string>>(rankRef('compartilhar', 'developments')),
    query<Record<string, string>>(`select round(avg(valor)) media from eventos where ${EV} and tipo = 'tempo'`),
    query<Record<string, string>>(
      `select pagina, ${nomePagina('pagina')} nome, round(avg(valor)) media, count(*) vezes from eventos
        where ${EV} and tipo = 'tempo' group by pagina having count(*) >= 3 order by avg(valor) desc limit 10`
    ),
    // perfis de incorporadora: visitas ao perfil e visitas aos empreendimentos dela no período
    query<Record<string, string>>(
      `with perfil as (select regexp_replace(pagina, '^.*/', '') slug, count(*) n from eventos where ${EV} and tipo = 'visita' and pagina like '/empresa/%' group by 1),
            emp as (select de.empresa_id, count(*) n from eventos e
                      join developments d on d.slug = regexp_replace(e.pagina, '^.*/', '') join development_empresas de on de.development_id = d.id
                     where ${EV.replace(/created_at/g, 'e.created_at')} and e.tipo = 'visita' and e.pagina like '/empreendimento/%' group by 1)
       select coalesce(nullif(em.nome_perfil, ''), nullif(em.nome_fantasia, ''), em.razao_social) nome, em.slug, coalesce(pf.n, 0) n, coalesce(emp.n, 0) empreend
         from empresas em left join perfil pf on pf.slug = em.slug left join emp on emp.empresa_id = em.id
        where pf.n is not null or emp.n is not null order by coalesce(pf.n, 0) desc, coalesce(emp.n, 0) desc limit 10`
    )
  ]);

  const [tot, leads, dias, paginas, imoveis, condos, noticias, banners, origens, datas] = await Promise.all([
    query<Record<string, string>>(
      `select count(*) filter (where tipo = 'visita') acessos,
              count(distinct visitante) filter (where tipo = 'visita') visitantes,
              count(*) filter (where tipo = 'visita' and novo) novos,
              count(*) filter (where tipo = 'whatsapp') whatsapp,
              count(*) filter (where tipo in ('fundadora', 'instagram')) fundadora,
              count(*) filter (where tipo = 'banner') banner,
              count(*) filter (where tipo = 'canal') canal,
              count(*) filter (where tipo = 'anuncie') anuncie,
              count(*) filter (where tipo = 'avaliar') avaliar,
              count(*) filter (where tipo = 'sol') sol,
              count(*) filter (where tipo = 'vender') vender,
              count(*) filter (where tipo = 'favorito') favoritos,
              count(*) filter (where tipo = 'compartilhar') compartilhar,
              count(*) filter (where tipo = 'visita' and pagina ~ '^/news/[^/]+/[^/]+$' and pagina !~ '^/news/(regiao|previa)/') news
         from eventos where ${EV}`
    ),
    query<Record<string, string>>(
      `select count(*) filter (where mensagem like 'Contato pelo WhatsApp%') whatsapp,
              count(*) filter (where mensagem is null or mensagem not like 'Contato pelo WhatsApp%') formulario
         from interest_leads where (created_at at time zone 'America/Sao_Paulo')::date >= ${deSql} and (created_at at time zone 'America/Sao_Paulo')::date < ${ateSql}`
    ),
    query<Record<string, string>>(
      `select to_char((created_at at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD') dia,
              count(*) filter (where tipo = 'visita') acessos, count(distinct visitante) filter (where tipo = 'visita') visitantes,
              count(*) filter (where tipo = 'whatsapp') whatsapp
         from eventos where ${EV} group by 1 order by 1`
    ),
    query<Record<string, string>>(`select pagina, ${nomePagina('pagina')} nome, count(*) n from eventos where ${EV} and tipo = 'visita' group by 1 order by 3 desc limit 10`),
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
                   where (created_at at time zone 'America/Sao_Paulo')::date >= ${deSql} and (created_at at time zone 'America/Sao_Paulo')::date < ${ateSql} group by 1)
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
    query<Record<string, string>>(`select to_char(${deSql}, 'YYYY-MM-DD') de, to_char(${ateSql} - 1, 'YYYY-MM-DD') ate`)
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
    cliquesAvaliar: n(t.avaliar),
    cliquesSol: n(t.sol),
    cliquesVender: n(t.vender),
    leiturasNews: n(t.news),
    favoritos: n(t.favoritos),
    compartilhamentos: n(t.compartilhar),
    tempoMedio: tempo[0]?.media ? n(tempo[0].media) : null,
    imoveisFavoritados: favI.map((x) => ({ nome: x.nome, sub: x.sub, n: n(x.n) })),
    condominiosFavoritados: favC.map((x) => ({ nome: x.nome, sub: x.sub, n: n(x.n) })),
    imoveisCompartilhados: comI.map((x) => ({ nome: x.nome, sub: x.sub, n: n(x.n) })),
    condominiosCompartilhados: comC.map((x) => ({ nome: x.nome, sub: x.sub, n: n(x.n) })),
    incorporadoras: incorp.map((x) => ({ nome: x.nome, url: `/empresa/${x.slug}`, n: n(x.n), whatsapp: n(x.empreend) })),
    paginasTempo: tempoPag.map((x) => ({ nome: x.nome, sub: x.pagina, url: x.pagina, n: n(x.media), contatos: n(x.vezes) })),
    porDia: dias.map((d) => ({ dia: d.dia, acessos: n(d.acessos), visitantes: n(d.visitantes), whatsapp: n(d.whatsapp) })),
    paginas: paginas.map((p) => ({ nome: p.nome ?? p.pagina, sub: p.pagina, url: p.pagina, n: n(p.n) })),
    imoveis: imoveis.map((p) => ({ nome: p.nome, sub: p.sub, url: p.url, n: n(p.n), whatsapp: n(p.whatsapp) })),
    condominios: condos.map((p) => ({ nome: p.nome, sub: p.sub, url: p.url, n: n(p.n), whatsapp: n(p.whatsapp), contatos: n(p.contatos) })),
    noticias: noticias.map((p) => ({ nome: p.nome, sub: p.sub, url: p.url, n: n(p.n) })),
    banners: banners.map((p) => ({ nome: p.nome, sub: p.url ? `mais clicado em ${p.url}` : null, url: p.url, n: n(p.n) })),
    origens: origens.map((p) => ({ nome: p.nome, n: n(p.n) }))
  };
}

// ---------------- online agora ----------------
export type Online = { total: number; paginas: { pagina: string; nome: string; n: number }[]; origens: { nome: string; n: number }[]; atualizadoEm: string };

/** Visitantes com a página aberta e visível nos últimos N minutos (5, 10 ou 30) */
export async function onlineAgora(minutos = 5): Promise<Online | null> {
  const eu = await exigirEquipe();
  if (eu.role !== 'admin') return null;
  const m = [5, 10, 30].includes(minutos) ? minutos : 5;
  const JANELA = `visto_em > now() - interval '${m} minutes'`;
  const nome = `coalesce(
      (select d.name from developments d where o.pagina like '/empreendimento/%' and d.slug = regexp_replace(o.pagina, '^.*/', '') limit 1),
      (select coalesce(pp.titulo, pp.condominio) from properties pp where o.pagina like '/imovel/%' and pp.slug = regexp_replace(o.pagina, '^.*/', '') limit 1),
      (select nt.titulo from noticias nt where o.pagina like '/news/%' and nt.slug = regexp_replace(o.pagina, '^.*/', '') limit 1),
      (select coalesce(nullif(em.nome_perfil, ''), em.razao_social) from empresas em where o.pagina like '/empresa/%' and em.slug = regexp_replace(o.pagina, '^.*/', '') limit 1),
      case when o.pagina = '/' then 'Página inicial (feed)' else o.pagina end)`;
  const [tot, pags, ori] = await Promise.all([
    query<{ n: string }>(`select count(*) n from online where ${JANELA}`),
    query<{ pagina: string; nome: string; n: string }>(`select o.pagina, ${nome} nome, count(*) n from online o where ${JANELA} group by o.pagina order by 3 desc limit 30`),
    query<{ nome: string; n: string }>(`select coalesce(origem, 'Direto ou sem origem') nome, count(*) n from online where ${JANELA} group by 1 order by 2 desc limit 6`)
  ]);
  return {
    total: Number(tot[0]?.n ?? 0),
    paginas: pags.map((x) => ({ pagina: x.pagina, nome: x.nome, n: Number(x.n) })),
    origens: ori.map((x) => ({ nome: x.nome, n: Number(x.n) })),
    atualizadoEm: new Date().toISOString()
  };
}
