'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import { useStaffSession } from '@/lib/use-staff-session';
import { getPropertiesByCorretor, deleteProperty, marcarComoVendido } from '@/lib/actions';
import LinkPrivadoModal from '@/components/LinkPrivadoModal';
import type { PropertyDetail } from '@/lib/property-details';
import { TIPO_UNIDADE_LABEL } from '@/lib/tipologias';
import { veTudo } from '@/lib/papeis';

const sa = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function MeusImoveisPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [items, setItems] = useState<PropertyDetail[]>([]);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (loaded && !staff) router.replace('/painel/login');
  }, [loaded, staff, router]);

  useEffect(() => {
    if (staff) {
      getPropertiesByCorretor(staff.email, veTudo(staff.role)).then((rows) => {
        setItems(rows);
        setFetched(true);
      });
    }
  }, [staff]);

  const [aviso, setAviso] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'publico' | 'privado'>('todos');
  const [corretor, setCorretor] = useState('');
  const [busca, setBusca] = useState('');
  const corretores = Array.from(new Set(items.map((p) => p.corretorEmail).filter((e): e is string => !!e))).sort();
  const termo = sa(busca.trim());
  const visiveis = items.filter(
    (p) =>
      (filtro === 'todos' || (p.visibilidade ?? 'publico') === filtro) &&
      (!corretor || p.corretorEmail === corretor) &&
      (!termo || sa(`${p.condominio ?? ''} ${p.location} ${p.codigo ?? ''}`).includes(termo))
  );

  const handleVendido = async (id: string) => {
    const valor = window.prompt('Marcar como VENDIDO. Fica 15 dias no feed com a tag VENDIDO e depois sai sozinho (já entra no histórico de mercado).\n\nValor de venda (opcional, só números):', '');
    if (valor === null) return;
    await marcarComoVendido(id, Number(valor.replace(/\D/g, '')) || undefined);
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, vendidoEm: new Date().toISOString() } : p)));
    setAviso('Marcado como vendido: fica 15 dias no feed com a tag VENDIDO (anúncio privado sai na hora) e já conta no histórico de mercado.');
  };

  const [linkDe, setLinkDe] = useState<PropertyDetail | null>(null);

  const handleRemove = async (id: string) => {
    if (!window.confirm('Excluir este imóvel? Ele sai do site, mas os dados ficam guardados no histórico de mercado.')) return;
    await deleteProperty(id);
    setItems((prev) => prev.filter((p) => p.id !== id));
  };

  if (!loaded || !staff) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-2xl font-semibold">{veTudo(staff.role) ? 'Imóveis' : 'Meus imóveis'}</h1>
          <Link href="/painel/imoveis/novo" className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white hover:opacity-90">
            + Cadastrar
          </Link>
        </div>

        {aviso && <p className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{aviso}</p>}
        <div className="mt-4 flex gap-2">
          {(['todos', 'publico', 'privado'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${filtro === f ? 'bg-ink text-white' : 'bg-[var(--pill-bg)]'}`}
            >
              {f === 'todos' ? `Todos (${items.length})` : f === 'publico' ? 'Públicos' : `Privados (${items.filter((p) => p.visibilidade === 'privado').length})`}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por condomínio, bairro ou código (ex.: CA0002)"
            className="min-w-[220px] flex-1 rounded-full border border-[var(--border)] px-4 py-2 text-sm"
          />
          {veTudo(staff.role) && corretores.length > 1 && (
            <select value={corretor} onChange={(e) => setCorretor(e.target.value)} className="rounded-full border border-[var(--border)] px-3 py-2 text-sm">
              <option value="">Todos os corretores</option>
              {corretores.map((c) => (
                <option key={c} value={c}>
                  {c === staff.email ? `${c} (você)` : c}
                </option>
              ))}
            </select>
          )}
        </div>

        {!fetched ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--text-muted)]">Nenhum imóvel cadastrado ainda.</p>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {visiveis.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-accent">
                    {TIPO_UNIDADE_LABEL[p.tipoUnidade]}
                    {p.visibilidade === 'privado' && <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] text-white">Privado</span>}
                    {p.vendidoEm && (
                      <span className="rounded px-1.5 py-0.5 text-[10px] text-white" style={{ background: '#e62f2f' }}>
                        Vendido · sai do feed em {Math.max(0, 15 - Math.floor((Date.now() - new Date(p.vendidoEm).getTime()) / 86400000))} dia(s)
                      </span>
                    )}
                  </span>
                  <span className="font-sans tabular-nums text-base font-bold tracking-tight">{p.price}</span>
                  <span className="text-sm text-[var(--text-muted)]">
                    {p.condominio ? `${p.condominio} · ` : ''}
                    {p.location}
                    {p.codigo ? ` · ${p.codigo}` : ''}
                  </span>
                  <span className="text-xs text-[var(--text-faint)]">{p.photos?.length ? `${p.photos.length} foto(s)` : 'Sem fotos, edite para adicionar'}</span>
                  {veTudo(staff.role) && p.corretorEmail && (
                    <span className="text-xs text-[var(--text-faint)]">Cadastrado por {p.corretorEmail}</span>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-2">
                  {p.visibilidade === 'privado' && (
                    <button type="button" onClick={() => setLinkDe(p)} className="text-sm font-semibold text-accent hover:underline">
                      Enviar link privado
                    </button>
                  )}
                  {p.finalidade === 'venda' && !p.vendidoEm && (
                    <button type="button" onClick={() => handleVendido(p.id)} className="text-sm font-semibold text-emerald-700 hover:underline">
                      Vendido
                    </button>
                  )}
                  <Link href={`/imovel/${p.id}`} className="text-sm font-semibold text-accent hover:underline">
                    Ver
                  </Link>
                  <Link href={`/painel/imoveis/${p.id}/editar`} className="rounded-full bg-ink px-3.5 py-1.5 text-sm font-bold text-white hover:opacity-90">
                    Editar
                  </Link>
                  <button type="button" onClick={() => handleRemove(p.id)} className="text-sm font-semibold text-red-600 hover:underline">
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      {linkDe && (
        <LinkPrivadoModal
          propertyId={linkDe.id}
          titulo={[TIPO_UNIDADE_LABEL[linkDe.tipoUnidade], linkDe.condominio, linkDe.area].filter(Boolean).join(' · ')}
          onClose={() => setLinkDe(null)}
        />
      )}
    </div>
  );
}
