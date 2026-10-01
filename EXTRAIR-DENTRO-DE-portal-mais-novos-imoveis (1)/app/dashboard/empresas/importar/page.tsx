'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import { TituloPainel } from '@/components/painel/ui';
import { useStaffSession } from '@/lib/use-staff-session';
import { veTudo } from '@/lib/papeis';
import { lerCsv } from '@/lib/planilha-condominios';
import { importarEmpresasPlanilha, type EmpresaPlanilhaLinha } from '@/lib/actions-empresas';

// Importar construtoras e incorporadoras por planilha (.xlsx ou .csv).
// Colunas: Nome público; CNPJ; História; Fundação (mês/ano ou só o ano).
const COLS: { campo: keyof EmpresaPlanilhaLinha; re: RegExp }[] = [
  { campo: 'cnpj', re: /cnpj/ },
  { campo: 'fundacao', re: /funda|abertura|^ano|^data/ },
  { campo: 'historia', re: /hist|sobre|descri|apresenta/ },
  { campo: 'nome', re: /nome|empresa|construt|incorp|public/ }
];
const sa = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export default function ImportarEmpresas() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [linhas, setLinhas] = useState<EmpresaPlanilhaLinha[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [rodando, setRodando] = useState(false);
  useEffect(() => {
    if (loaded && (!staff || !veTudo(staff.role))) router.replace('/dashboard');
  }, [loaded, staff, router]);
  if (!loaded || !staff) return <PainelNav />;

  const ler = async (f?: File) => {
    if (!f) return;
    setMsg(null);
    let rows: unknown[][];
    if (/\.xlsx?$/i.test(f.name)) {
      const { default: readXlsxFile } = await import('read-excel-file');
      rows = (await readXlsxFile(f)) as unknown[][];
    } else rows = lerCsv((await f.text()).replace(/^\uFEFF/, ''));
    const cab = (rows[0] ?? []).map((c) => sa(String(c ?? '')));
    const idx: Partial<Record<keyof EmpresaPlanilhaLinha, number>> = {};
    cab.forEach((h, i) => {
      const c = COLS.find((x) => x.re.test(h) && idx[x.campo] == null);
      if (c) idx[c.campo] = i;
    });
    if (idx.nome == null) return setMsg('Não achei a coluna do nome. Use o cabeçalho "Nome público".');
    const val = (r: unknown[], k: keyof EmpresaPlanilhaLinha) => (idx[k] != null ? String(r[idx[k]!] ?? '').trim() : '');
    setLinhas(
      rows
        .slice(1)
        .map((r) => ({ nome: val(r, 'nome'), cnpj: val(r, 'cnpj'), historia: val(r, 'historia'), fundacao: val(r, 'fundacao') }))
        .filter((l) => l.nome)
    );
  };

  const baixarModelo = () => {
    const txt = '\uFEFFNome público;CNPJ;História;Fundação (mês/ano ou ano)\nEBM;03.025.881/0002-74;Fundada em Goiânia, referência em alto padrão.;03/1981\nConsciente;;;1994\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
    a.download = 'modelo-construtoras.csv';
    a.click();
  };

  return (
    <div className="min-h-screen">
      <PainelNav />
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-8 md:px-6">
        <TituloPainel titulo="Importar construtoras" contagem="Nome público, CNPJ, história e fundação (mês/ano ou só o ano)">
          <Link href="/dashboard/empresas" className="flex h-11 items-center rounded-full bg-[var(--pill-bg)] px-4 text-[13px] font-semibold">
            ← Construtoras
          </Link>
        </TituloPainel>
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] p-5">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => ler(e.target.files?.[0])} />
          <button type="button" onClick={baixarModelo} className="text-sm font-semibold text-accent underline">
            Baixar planilha modelo
          </button>
          <p className="w-full text-xs text-[var(--text-muted)]">
            Com CNPJ: a empresa é achada pelo CNPJ (ou cadastrada) e depois é só clicar em &quot;Buscar dados na Receita&quot; em Construtoras. Sem CNPJ: é achada pelo nome ou
            cadastrada só com o nome. O nome público vira o &quot;Nome do perfil&quot;; história e fundação só entram se estiverem preenchidas.
          </p>
        </div>
        {linhas.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{linhas.length} empresa(s) na planilha</span>
              <button
                type="button"
                disabled={rodando}
                onClick={async () => {
                  setRodando(true);
                  const r = await importarEmpresasPlanilha(linhas).catch(() => null);
                  setRodando(false);
                  setMsg(r ? `${r.criadas} nova(s), ${r.atualizadas} já existente(s) atualizada(s).${r.erros.length ? ` Erros: ${r.erros.slice(0, 5).join(' · ')}` : ''}` : 'Não foi possível importar.');
                }}
                className="h-11 rounded-full bg-ink px-6 text-[14px] font-semibold text-white disabled:opacity-60"
              >
                {rodando ? 'Importando…' : 'Importar'}
              </button>
            </div>
            <div className="mt-3 max-h-[420px] overflow-auto rounded-2xl border border-[var(--border)]">
              <table className="w-full text-left text-[13px]">
                <thead className="sticky top-0 bg-[var(--pill-bg)] text-[11px] uppercase">
                  <tr>
                    <th className="p-2">Nome público</th>
                    <th className="p-2">CNPJ</th>
                    <th className="p-2">Fundação</th>
                    <th className="p-2">História</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.slice(0, 200).map((l, i) => (
                    <tr key={i} className="border-t border-[var(--border)]">
                      <td className="p-2 font-semibold">{l.nome}</td>
                      <td className="p-2">{l.cnpj || '—'}</td>
                      <td className="p-2">{l.fundacao || '—'}</td>
                      <td className="max-w-[300px] truncate p-2 text-[var(--text-muted)]">{l.historia || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {msg && <p className="mt-4 rounded-xl bg-[var(--pill-bg)] p-3 text-sm">{msg}</p>}
      </div>
    </div>
  );
}
