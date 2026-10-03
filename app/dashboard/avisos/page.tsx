'use client';

// Para avisar: cada linha é uma pessoa que pediu aviso + um anúncio que combina
// (mesmo condomínio, ou dentro dos 500 m / 2 km que ela escolheu). Enquanto o
// e-mail automático não está configurado, a equipe avisa pelo WhatsApp daqui.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { listAvisos, marcarAviso, procurarAvisosRecentes, type AvisoPendente } from '@/lib/actions-avisos';
import { SITE_URL } from '@/lib/seo';
import { GRUPO_LABEL, textoAlcance, textoArea, type GrupoInteresse } from '@/lib/interesse-regras';
import { CrmNav } from '@/components/crm/comum';

const brl = (n: number | null) => (n ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'Consulte');
const dist = (m: number) => (m < 1000 ? `${Math.max(100, Math.round(m / 100) * 100)} m` : `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`);
const alcance = (a: AvisoPendente) =>
  textoAlcance(a.pessoa.raio, { condominio: a.pessoa.temCondominio ? a.pessoa.condominio : null, bairro: a.pessoa.bairro, cidade: a.pessoa.cidade });

function linkWhats(a: AvisoPendente): string | null {
  let d = (a.pessoa.telefone ?? '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (d.length < 12) return null;
  const onde = a.mesmoCondominio || a.metros == null ? `no ${a.pessoa.condominio}` : `perto do ${a.pessoa.condominio}`;
  const msg = `Olá, ${a.pessoa.nome.split(' ')[0]}! Aqui é da Mais Novos Imóveis. Você pediu para ser avisado(a) de imóveis ${onde}, e acabou de entrar este: ${a.imovel.titulo}, ${brl(a.imovel.preco)}. ${SITE_URL}${a.imovel.url}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(msg)}`;
}

export default function AvisosPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [itens, setItens] = useState<AvisoPendente[] | null>(null);
  const [procurando, setProcurando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  const carregar = () => listAvisos().then(setItens).catch(() => setItens([]));
  useEffect(() => {
    if (staff) carregar();
  }, [staff]);

  const marcar = async (id: string, acao: 'avisado' | 'descartado') => {
    setItens((p) => p?.filter((a) => a.id !== id) ?? p);
    await marcarAviso(id, acao).catch(() => undefined);
  };
  const procurar = async () => {
    setProcurando(true);
    setMsg(null);
    try {
      const r = await procurarAvisosRecentes();
      setMsg(`${r.anuncios} anúncios dos últimos 30 dias conferidos · ${r.novos} combinação(ões) nova(s).`);
      await carregar();
    } catch {
      setMsg('Não foi possível procurar agora.');
    } finally {
      setProcurando(false);
    }
  };

  if (!loaded || !staff) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <PainelNav />
      <CrmNav />
      <main className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8">
        <h1 className="text-2xl font-bold">Para avisar</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Pessoas que pediram aviso (no condomínio, no anúncio ou no mapa) e um anúncio publicado que combina com o pedido: mesmo condomínio, ou dentro dos 500 m ou 2 km
          que elas escolheram. Avise pelo WhatsApp; quando o e-mail automático estiver configurado, o aviso por e-mail sai sozinho.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={procurar}
            disabled={procurando}
            className="h-10 rounded-full border border-[var(--border)] px-4 text-sm font-semibold hover:bg-[var(--pill-bg)] disabled:opacity-50"
          >
            {procurando ? 'Procurando…' : 'Procurar nos anúncios dos últimos 30 dias'}
          </button>
          <Link href="/dashboard/interessados" className="text-sm font-semibold text-accent hover:underline">
            Ver todos os interessados →
          </Link>
        </div>
        {msg && <p className="mt-2 text-sm text-[var(--text-muted)]">{msg}</p>}

        {itens === null ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : itens.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Nada para avisar agora. Quando um anúncio publicado combinar com algum pedido, ele aparece aqui.</p>
        ) : (
          <div className="mt-5 flex flex-col gap-3">
            {itens.map((a) => {
              const wa = linkWhats(a);
              return (
                <div key={a.id} className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 flex-col gap-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold">{a.pessoa.nome}</span>
                      <span className="rounded bg-[#EEF5FF] px-1.5 py-0.5 text-[11px] font-bold text-accent">
                        pediu {a.pessoa.grupo ? `${GRUPO_LABEL[a.pessoa.grupo as GrupoInteresse].toLowerCase()} · ` : ''}
                        {alcance(a)}
                        {a.pessoa.quartos.length ? ` · ${a.pessoa.quartos.map((q) => (q >= 4 ? '4+' : String(q))).join(', ')} quartos` : ''}
                        {textoArea(a.pessoa.grupo, a.pessoa.areaMin, a.pessoa.areaMax) ? ` · ${textoArea(a.pessoa.grupo, a.pessoa.areaMin, a.pessoa.areaMax)}` : ''}
                      </span>
                    </div>
                    <span className="text-[var(--text-muted)]">{[a.pessoa.telefone, a.pessoa.email].filter(Boolean).join(' · ') || 'sem contato'}</span>
                    <a href={`${SITE_URL}${a.imovel.url}`} target="_blank" rel="noopener" className="mt-1 flex flex-col rounded-lg bg-[var(--pill-bg)] px-3 py-2 hover:brightness-95">
                      <span className="font-bold">
                        {brl(a.imovel.preco)} · {a.imovel.detalhes}
                      </span>
                      <span className="text-[13px] text-[var(--text-muted)]">
                        {[a.imovel.condominio, a.imovel.bairro].filter(Boolean).join(', ')}
                        {a.mesmoCondominio ? ' · no condomínio que a pessoa pediu' : a.metros != null ? ` · a ${dist(a.metros)} do ${a.pessoa.condominio}` : ''}
                      </span>
                    </a>
                    <span className="text-xs text-[var(--text-faint)]">combinou em {new Date(a.criadoEm).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener"
                        onClick={() => marcar(a.id, 'avisado')}
                        className="flex h-10 items-center rounded-full bg-[#25D366] px-4 text-sm font-bold text-[#08361A] hover:brightness-95"
                      >
                        Avisar no WhatsApp
                      </a>
                    ) : a.pessoa.email ? (
                      <a
                        href={`mailto:${a.pessoa.email}?subject=${encodeURIComponent('Surgiu um imóvel para você')}&body=${encodeURIComponent(`${SITE_URL}${a.imovel.url}`)}`}
                        onClick={() => marcar(a.id, 'avisado')}
                        className="flex h-10 items-center rounded-full bg-ink px-4 text-sm font-bold text-white"
                      >
                        Avisar por e-mail
                      </a>
                    ) : null}
                    <button type="button" onClick={() => marcar(a.id, 'avisado')} className="h-10 rounded-full border border-[var(--border)] px-3.5 text-sm font-semibold">
                      Já avisei
                    </button>
                    <button type="button" onClick={() => marcar(a.id, 'descartado')} className="h-10 rounded-full px-3 text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--pill-bg)]">
                      Descartar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
