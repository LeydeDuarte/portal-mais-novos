'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import { BuscaGrande, Chips, MenuAcoes, TituloPainel, Vazio, marcados } from '@/components/painel/ui';
import { useStaffSession } from '@/lib/use-staff-session';
import { excluirProprietario, listarProprietarios } from '@/lib/actions-proprietarios';
import { faltandoNoCadastro, type Proprietario } from '@/lib/proprietarios-tipos';
import { formatarDocumento, formatarTelefone } from '@/lib/formatos';
import { CrmNav } from '@/components/crm/comum';
import { paraBusca } from '@/lib/busca-texto';

// Painel → Proprietários: lista, busca, cadastro completo, exclusão e importação por planilha.
// busca tolerante: acentos, y/i, w/v, ph/f, letras dobradas (lib/busca-texto.ts)
const sa = paraBusca;
const linkWhats = (d?: string | null) => {
  const n = (d ?? '').replace(/\D/g, '');
  return n.length >= 10 ? `https://wa.me/${n.length <= 11 ? `55${n}` : n}` : null;
};

export default function ProprietariosPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [lista, setLista] = useState<Proprietario[] | null>(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  const carregar = () => listarProprietarios().then(setLista).catch(() => setLista([]));
  useEffect(() => {
    if (staff) carregar();
  }, [staff]);

  const itens = useMemo(() => {
    if (!lista) return [];
    const q = sa(busca.trim());
    const d = busca.replace(/\D/g, '');
    const f = marcados(filtro);
    return lista.filter((o) => {
      if (q && !(sa(o.nome).includes(q) || (o.email ?? '').includes(q) || (d.length >= 3 && ((o.documento ?? '').includes(d) || (o.whatsapp ?? '').includes(d)))))
        return false;
      if (!f.length) return true;
      const completo = faltandoNoCadastro(o).length === 0;
      return f.some(
        (x) => (x === 'completo' && completo) || (x === 'incompleto' && !completo) || (x === 'sem_imovel' && !o.imoveis) || (x === 'com_imovel' && !!o.imoveis)
      );
    });
  }, [lista, busca, filtro]);

  if (!loaded || !staff) return <PainelNav />;

  const excluir = async (o: Proprietario) => {
    const txt = o.imoveis
      ? `Excluir ${o.nome}? Os ${o.imoveis} imóvel(is) ligados a ele continuam no ar, só perdem o vínculo com este proprietário.`
      : `Excluir ${o.nome}?`;
    if (!window.confirm(txt)) return;
    const r = await excluirProprietario(o.id).catch(() => ({ ok: false, erro: 'Não foi possível excluir.' }));
    if (!r.ok) return setAviso(r.erro ?? 'Não foi possível excluir.');
    setAviso(`${o.nome} foi excluído.`);
    carregar();
  };

  const contar = (x: string) => (lista ?? []).filter((o) => (x === 'completo' ? faltandoNoCadastro(o).length === 0 : x === 'incompleto' ? faltandoNoCadastro(o).length > 0 : x === 'sem_imovel' ? !o.imoveis : !!o.imoveis)).length;

  return (
    <div className="min-h-screen">
      <PainelNav />
      <CrmNav />
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 md:px-6">
        <TituloPainel titulo="Proprietários" contagem={lista ? `${lista.length} cadastrado(s)` : 'Carregando…'}>
          <Link href="/dashboard/proprietarios/importar" className="flex h-11 items-center rounded-full bg-[var(--pill-bg)] px-4 text-[13px] font-semibold">
            Importar planilha
          </Link>
          <Link href="/dashboard/proprietarios/novo" className="flex h-11 items-center rounded-full bg-ink px-5 text-[14px] font-semibold text-white hover:opacity-90">
            + Novo proprietário
          </Link>
        </TituloPainel>

        <div className="mt-6 flex flex-col gap-3">
          <BuscaGrande value={busca} onChange={setBusca} placeholder="Buscar por nome, CPF/CNPJ, telefone ou e-mail" />
          <Chips
            multi
            opcoes={[
              { v: 'incompleto', l: 'Cadastro incompleto', n: contar('incompleto') },
              { v: 'completo', l: 'Cadastro completo', n: contar('completo') },
              { v: 'com_imovel', l: 'Com imóvel', n: contar('com_imovel') },
              { v: 'sem_imovel', l: 'Sem imóvel', n: contar('sem_imovel') }
            ]}
            valor={filtro}
            onChange={(v) => setFiltro(v)}
          />
          {aviso && (
            <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" onClick={() => setAviso(null)}>
              {aviso}
            </p>
          )}
        </div>

        <div className="mt-6">
          {lista && itens.length === 0 ? (
            <Vazio titulo="Nenhum proprietário encontrado" texto="Cadastre um novo, importe uma planilha ou ajuste a busca." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
              {itens.slice(0, 500).map((o) => {
                const falta = faltandoNoCadastro(o);
                const w = linkWhats(o.whatsapp);
                return (
                  <div key={o.id} className="flex items-center gap-3 border-b border-[var(--border)] p-4 last:border-b-0 hover:bg-[var(--pill-bg)]/40">
                    <Link href={`/dashboard/proprietarios/${o.id}`} className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold">{o.nome}</span>
                        {o.tipo === 'pj' && <span className="rounded-md bg-[var(--pill-bg)] px-1.5 py-0.5 text-[10px] font-bold">EMPRESA</span>}
                        {falta.length === 0 ? (
                          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">CADASTRO COMPLETO</span>
                        ) : (
                          <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700" title={`Falta: ${falta.join(', ')}`}>
                            FALTA {falta.length > 3 ? `${falta.length} ITENS` : falta.join(', ').toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-4 text-[13px] text-[var(--text-muted)]">
                        {o.documento && <span>{formatarDocumento(o.documento)}</span>}
                        {o.whatsapp && <span>{formatarTelefone(o.whatsapp)}</span>}
                        {o.email && <span className="truncate">{o.email}</span>}
                        <span>{o.imoveis ? `${o.imoveis} imóvel(is)` : 'sem imóvel'}</span>
                      </div>
                    </Link>
                    {w && (
                      <a href={w} target="_blank" rel="noopener" className="hidden rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white sm:block">
                        WhatsApp
                      </a>
                    )}
                    <MenuAcoes
                      itens={[
                        { rotulo: 'Editar cadastro', href: `/dashboard/proprietarios/${o.id}` },
                        { rotulo: 'Vincular imóveis', href: `/dashboard/proprietarios/${o.id}#imoveis` },
                        'sep',
                        { rotulo: 'Excluir', onClick: () => excluir(o), perigo: true }
                      ]}
                    />
                  </div>
                );
              })}
            </div>
          )}
          {itens.length > 500 && <p className="mt-3 text-sm text-[var(--text-muted)]">Mostrando 500 de {itens.length}. Use a busca para achar os demais.</p>}
        </div>
      </div>
    </div>
  );
}
