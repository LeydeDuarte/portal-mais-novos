'use client';

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
      <main className="w-full px-4 py-6 md:px-8">
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
                <Info l="Área do lote" v={i.areaLote ? `${i.areaLote} m²` : null} />
                <Info l="Quartos" v={i.quartos} />
                <Info l="Banheiros" v={i.banheiros} />
                <Info l="Vagas" v={i.vagas} />
                <Info l="Complemento (só equipe)" v={i.complemento} />
                <Info l="Visualizações" v={String(i.visualizacoes)} />
                <Info l="Salvamentos" v={String(i.salvamentos)} />
                <Info l="Compartilhamentos" v={String(i.compartilhamentos)} />
              </div>
              {i.obsInterna && (
                <div className="mt-3 whitespace-pre-line rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  <strong>OBS:</strong> {i.obsInterna}
                </div>
              )}
            </div>

            <aside className="flex h-fit flex-col gap-4 xl:sticky xl:top-4">
              {aviso && <p className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{aviso}</p>}
              <div className="flex flex-wrap gap-2">
                <Link href={`/dashboard/imoveis/${i.id}/editar`} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white">
                  Editar
                </Link>
                <Link href={`/dashboard/propostas/nova?imovel=${i.id}`} className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-white">
                  Fazer proposta
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    const vis = i.visibilidade === 'privado' ? 'publico' : 'privado';
                    await mudarVisibilidade(i.id, vis);
                    setI({ ...i, visibilidade: vis });
                  }}
                  className="rounded-full bg-[var(--pill-bg)] px-4 py-2 text-sm font-bold"
                >
                  {i.visibilidade === 'privado' ? 'Tornar público' : 'Privar anúncio'}
                </button>
                {i.visibilidade !== 'privado' && (
                  <button
                    type="button"
                    onClick={async () => {
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
                    className="rounded-full bg-[var(--pill-bg)] px-4 py-2 text-sm font-bold"
                  >
                    Compartilhar com corretor
                  </button>
                )}
                <button type="button" onClick={() => setLinkPrivado(true)} className="rounded-full bg-[var(--pill-bg)] px-4 py-2 text-sm font-bold">
                  Link privado p/ cliente
                </button>
                <a href={`/imovel/${i.slug ?? i.id}`} target="_blank" rel="noopener" className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-[var(--pill-bg)]">
                  Ver no site ↗
                </a>
              </div>

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
                        <div className="font-bold">
                          {p.nome} {p.principal && <span className="ml-1 rounded bg-accent px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-white">principal</span>}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">{[p.documento, p.email].filter(Boolean).join(' · ')}</div>
                        {whats(p.whatsapp) && (
                          <a href={whats(p.whatsapp)!} target="_blank" rel="noopener" className="mt-2 inline-block rounded-full bg-[#16A34A] px-3 py-1 text-xs font-bold text-white">
                            Chamar no WhatsApp
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </main>
      {linkPrivado && i && <LinkPrivadoModal propertyId={i.id} titulo={i.condominio ?? i.titulo ?? 'Imóvel'} onClose={() => setLinkPrivado(false)} />}
    </div>
  );
}
