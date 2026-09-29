'use client';

import { linhaImovel, linkWhatsapp, mensagemComLink, mensagemProprietario } from '@/lib/compartilhar';
import IconeWhatsapp from '@/components/painel/IconeWhatsapp';
import { urlImovel } from '@/lib/urls';
const SITE_PUBLICO = process.env.NEXT_PUBLIC_SITE_URL || 'https://maisnovosimoveis.com';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import LinkPrivadoModal from '@/components/LinkPrivadoModal';
import { brlPainel, whats } from '@/components/painel/ImovelCardPainel';
import { useStaffSession } from '@/lib/use-staff-session';
import { alternarFotoPublica, lerImovelPainel, linkParaCorretor, mudarVisibilidade, type ImovelPainel } from '@/lib/actions-painel-imoveis';
import { TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';

// Ficha do imóvel dentro do painel (a equipe não precisa sair para o site):
// fotos com "ocultar do anúncio", dados internos, proprietários e ações.
export default function FichaImovel({ params }: { params: { id: string } }) {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [i, setI] = useState<ImovelPainel | null | undefined>(undefined);
  const [aviso, setAviso] = useState<string | null>(null);
  const [linkPrivado, setLinkPrivado] = useState(false);

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  useEffect(() => {
    if (staff) lerImovelPainel(params.id).then(setI).catch(() => setI(null));
  }, [staff, params.id]);
  if (!loaded || !staff) return null;

  const Info = ({ l, v }: { l: string; v: React.ReactNode }) =>
    v ? (
      <div className="rounded-xl bg-[var(--pill-bg)] px-3 py-2">
        <div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{l}</div>
        <div className="text-sm font-semibold">{v}</div>
      </div>
    ) : null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="w-full px-4 pb-28 pt-6 md:px-8">
        <Link href="/dashboard/imoveis" className="text-sm font-semibold text-[var(--text-muted)] hover:underline">
          ← Imóveis
        </Link>
        {i === undefined ? (
          <p className="mt-6 text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : i === null ? (
          <p className="mt-6 text-sm text-[var(--text-muted)]">Imóvel não encontrado ou sem permissão.</p>
        ) : (
          <div className="mt-3 grid gap-6 xl:grid-cols-[1fr_380px]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-serif text-2xl font-semibold">{i.condominio ?? i.titulo ?? 'Imóvel'}</h1>
                {i.visibilidade === 'privado' && <span className="rounded bg-ink px-2 py-0.5 text-[11px] font-bold uppercase text-white">Privado</span>}
                {i.vendidoEm && <span className="rounded bg-[#e62f2f] px-2 py-0.5 text-[11px] font-bold uppercase text-white">Vendido</span>}
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                {TIPO_UNIDADE_LABEL[i.tipo as TipoUnidade] ?? i.tipo} · {[i.bairro, i.cidade, i.uf].filter(Boolean).join(', ')}
                {i.codigo ? ` · cód. ${i.codigo}` : ''}
              </p>

              <h2 className="mt-5 text-sm font-bold">Fotos</h2>
              <p className="text-xs text-[var(--text-muted)]">
                &quot;Ocultar&quot; tira a foto do anúncio público (fica só aqui no painel). A primeira foto pública é a capa.
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {[...i.fotos.map((u) => ({ u, pub: true })), ...i.fotosInternas.map((u) => ({ u, pub: false }))].map(({ u, pub }, k) => (
                  <div key={u} className={`relative overflow-hidden rounded-lg ${pub ? '' : 'opacity-60 ring-2 ring-amber-500'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                    {pub && k === 0 && <span className="absolute left-1 top-1 rounded bg-ink px-1.5 py-0.5 text-[9.5px] font-bold text-white">CAPA</span>}
                    <button
                      type="button"
                      onClick={async () => {
                        const r = await alternarFotoPublica(i.id, u, !pub);
                        setI({ ...i, fotos: r.fotos, fotosInternas: r.fotosInternas });
                      }}
                      className={`absolute bottom-1 right-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${pub ? 'bg-black/60 text-white' : 'bg-amber-500 text-white'}`}
                    >
                      {pub ? 'Ocultar' : 'Mostrar no site'}
                    </button>
                  </div>
                ))}
              </div>

              <h2 className="mt-6 text-sm font-bold">Dados</h2>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                <Info l="Valor anunciado" v={brlPainel(i.preco)} />
                <Info l="Condomínio (mês)" v={brlPainel(i.valorCondominio)} />
                <Info l="IPTU (mês)" v={brlPainel(i.iptuMensal)} />
                <Info l="Área privativa" v={i.area ? `${i.area} m²` : null} />
                <Info l="Área total" v={i.areaTotal ? `${i.areaTotal} m²` : null} />
                <Info l="Área do lote" v={i.areaLote ? `${i.areaLote} m²` : null} />
                <Info l="Quartos" v={i.quartos} />
                <Info l="Banheiros" v={i.banheiros} />
                <Info l="Vagas" v={i.vagas} />
                <Info l="Complemento (só equipe)" v={i.complemento} />
                <Info l="Visualizações" v={String(i.visualizacoes)} />
                <Info l="Salvamentos" v={String(i.salvamentos)} />
                <Info l="Compartilhamentos" v={String(i.compartilhamentos)} />
              </div>
              {i.descricao && (
                <>
                  <h2 className="mt-6 text-sm font-bold">Descrição do anúncio</h2>
                  <div className="mt-2 max-w-3xl whitespace-pre-line rounded-xl border border-[var(--border)] p-4 text-sm leading-relaxed">{i.descricao}</div>
                </>
              )}
              {i.obsInterna && (
                <div className="mt-3 whitespace-pre-line rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  <strong>OBS:</strong> {i.obsInterna}
                </div>
              )}
            </div>

            <aside className="flex h-fit flex-col gap-4 xl:sticky xl:top-4">
              {aviso && <p className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{aviso}</p>}
              <div className="rounded-2xl border border-[var(--border)] p-4">
                <h2 className="text-sm font-bold">Proprietários</h2>
                {i.proprietarios.length === 0 ? (
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Nenhum cadastrado.{' '}
                    <Link href={`/dashboard/imoveis/${i.id}/editar`} className="font-semibold text-accent">
                      Cadastrar
                    </Link>
                  </p>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    {i.proprietarios.map((p) => (
                      <div key={p.id} className="rounded-xl bg-[var(--pill-bg)] p-3 text-sm">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <Link href={`/dashboard/proprietarios/${p.id}`} className="font-bold hover:underline">
                              {p.nome}
                            </Link>{' '}
                            {p.principal && <span className="ml-1 rounded bg-accent px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-white">principal</span>}
                            <div className="text-xs text-[var(--text-muted)]">{[p.documento, p.email].filter(Boolean).join(' · ')}</div>
                          </div>
                          {linkWhatsapp(p.whatsapp, mensagemProprietario(i)) && (
                            <a
                              href={linkWhatsapp(p.whatsapp, mensagemProprietario(i))!}
                              target="_blank"
                              rel="noopener"
                              title={`Perguntar a ${p.nome} se o imóvel está disponível`}
                              aria-label={`WhatsApp de ${p.nome}`}
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#25D366] text-white hover:opacity-90"
                            >
                              <IconeWhatsapp />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </main>
      {i && (
        <BarraAcoesImovel
          i={i}
          onVisibilidade={async () => {
            const vis = i.visibilidade === 'privado' ? 'publico' : 'privado';
            await mudarVisibilidade(i.id, vis);
            setI({ ...i, visibilidade: vis });
          }}
          onCompartilharCorretor={async () => {
            const r = await linkParaCorretor(i.id);
            if (!r.ok) return setAviso(r.erro);
            try {
              await navigator.clipboard.writeText(r.url);
            } catch {
              /* ignora */
            }
            setI({ ...i, compartilhamentos: i.compartilhamentos + 1 });
            setAviso(`Link para corretor copiado: ${r.url}`);
          }}
          onLinkPrivado={() => setLinkPrivado(true)}
        />
      )}
      {linkPrivado && i && <LinkPrivadoModal propertyId={i.id} titulo={i.condominio ?? i.titulo ?? 'Imóvel'} linha={linhaImovel(i)} onClose={() => setLinkPrivado(false)} />}
    </div>
  );
}

// Barra de ações flutuante: fica fixa embaixo da tela, sempre à mão enquanto rola a ficha.
function BarraAcoesImovel({
  i,
  onVisibilidade,
  onCompartilharCorretor,
  onLinkPrivado
}: {
  i: ImovelPainel;
  onVisibilidade: () => void;
  onCompartilharCorretor: () => void;
  onLinkPrivado: () => void;
}) {
  const dono = i.proprietarios.find((p) => p.principal) ?? i.proprietarios[0];
  const zapDono = dono ? linkWhatsapp(dono.whatsapp, mensagemProprietario(i)) : null;
  const pill = 'flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold';
  return (
    <div className="fixed inset-x-0 bottom-3 z-50 flex justify-center px-2 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full border border-[var(--border)] bg-[var(--bg)]/95 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur [scrollbar-width:none]">
        {zapDono && (
          <a
            href={zapDono}
            target="_blank"
            rel="noopener"
            title={`Perguntar a ${dono!.nome} se o imóvel está disponível`}
            aria-label="WhatsApp do proprietário"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#25D366] text-white hover:opacity-90"
          >
            <IconeWhatsapp tamanho={20} />
          </a>
        )}
        <Link href={`/dashboard/imoveis/${i.id}/editar`} className={`${pill} bg-ink text-white`}>
          Editar
        </Link>
        <Link href={`/dashboard/propostas/nova?imovel=${i.id}`} className={`${pill} bg-accent text-white`}>
          Proposta
        </Link>
        {i.visibilidade !== 'privado' && (
          <button
            type="button"
            title="Enviar o anúncio para um cliente pelo WhatsApp"
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(mensagemComLink(linhaImovel(i), `${SITE_PUBLICO}${urlImovel(i)}`))}`, '_blank')}
            className={`${pill} bg-[var(--pill-bg)]`}
          >
            <IconeWhatsapp tamanho={15} /> Cliente
          </button>
        )}
        <button type="button" onClick={onLinkPrivado} className={`${pill} bg-[var(--pill-bg)]`}>
          Link privado
        </button>
        {i.visibilidade !== 'privado' && (
          <button type="button" onClick={onCompartilharCorretor} className={`${pill} bg-[var(--pill-bg)]`}>
            Corretor
          </button>
        )}
        <button type="button" onClick={onVisibilidade} className={`${pill} bg-[var(--pill-bg)]`}>
          {i.visibilidade === 'privado' ? 'Tornar público' : 'Privar'}
        </button>
        <a href={urlImovel(i)} target="_blank" rel="noopener" className={`${pill} hover:bg-[var(--pill-bg)]`}>
          Site ↗
        </a>
      </div>
    </div>
  );
}
