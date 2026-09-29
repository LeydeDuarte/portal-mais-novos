'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PainelNav from '@/components/PainelNav';
import { TituloPainel } from '@/components/painel/ui';
import { useStaffSession } from '@/lib/use-staff-session';
import { lerCsv } from '@/lib/planilha-condominios';
import { importarProprietariosPlanilha, type ProprietarioPlanilhaLinha } from '@/lib/actions-proprietarios';
import { formatarDocumento, formatarTelefone } from '@/lib/formatos';

// Importar proprietários por planilha (.xlsx ou .csv). Colunas reconhecidas pelo
// cabeçalho: Nome (obrigatória), CPF/CNPJ, Telefone/Celular/WhatsApp, E-mail.
// Não precisa ter tudo: linha só com o nome já cadastra.
const COLS: { campo: keyof ProprietarioPlanilhaLinha; re: RegExp }[] = [
  { campo: 'documento', re: /cpf|cnpj|documento|^doc/ },
  { campo: 'email', re: /e-?mail/ },
  { campo: 'telefone', re: /telefone|celular|whats|fone|contato/ },
  { campo: 'nome', re: /nome|proprietario|cliente|razao/ }
];
const sa = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const LOTE = 200;

export default function ImportarProprietarios() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();
  const [linhas, setLinhas] = useState<ProprietarioPlanilhaLinha[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [rodando, setRodando] = useState(false);
  useEffect(() => {
    if (loaded && !staff) router.replace('/dashboard/login');
  }, [loaded, staff, router]);
  if (!loaded || !staff) return <PainelNav />;

  const ler = async (f?: File) => {
    if (!f) return;
    setMsg(null);
    setLinhas([]);
    let rows: unknown[][];
    if (/\.xlsx?$/i.test(f.name)) {
      const { default: readXlsxFile } = await import('read-excel-file');
      rows = (await readXlsxFile(f)) as unknown[][];
    } else rows = lerCsv((await f.text()).replace(/^\uFEFF/, ''));
    const cab = (rows[0] ?? []).map((c) => sa(String(c ?? '')));
    const idx: Partial<Record<keyof ProprietarioPlanilhaLinha, number>> = {};
    cab.forEach((h, i) => {
      const c = COLS.find((x) => x.re.test(h) && idx[x.campo] == null);
      if (c) idx[c.campo] = i;
    });
    if (idx.nome == null) return setMsg('Não achei a coluna do nome. Use o cabeçalho "Nome" na primeira linha da planilha.');
    const val = (r: unknown[], k: keyof ProprietarioPlanilhaLinha) => (idx[k] != null ? String(r[idx[k]!] ?? '').trim() : '');
    const lidas = rows
      .slice(1)
      .map((r) => ({ nome: val(r, 'nome'), documento: val(r, 'documento'), telefone: val(r, 'telefone'), email: val(r, 'email') }))
      .filter((l) => l.nome);
    setLinhas(lidas);
    setMsg(`${lidas.length} proprietário(s) na planilha. Confira abaixo e clique em "Importar".`);
  };

  const importar = async () => {
    setRodando(true);
    const tot = { criados: 0, completados: 0, iguais: 0, ignorados: 0 };
    try {
      for (let i = 0; i < linhas.length; i += LOTE) {
        const r = await importarProprietariosPlanilha(linhas.slice(i, i + LOTE));
        tot.criados += r.criados;
        tot.completados += r.completados;
        tot.iguais += r.iguais;
        tot.ignorados += r.ignorados;
        setMsg(`Importando… ${Math.min(i + LOTE, linhas.length)} de ${linhas.length}`);
      }
      setMsg(
        `Pronto: ${tot.criados} novo(s), ${tot.completados} já existiam e foram completados, ${tot.iguais} já estavam iguais${tot.ignorados ? `, ${tot.ignorados} sem nome ignorado(s)` : ''}.`
      );
      setLinhas([]);
    } catch {
      setMsg('Parou no meio por um erro. Pode importar a mesma planilha de novo: quem já entrou não é duplicado.');
    } finally {
      setRodando(false);
    }
  };

  const baixarModelo = () => {
    const txt = '\uFEFFNome;CPF;Telefone;E-mail\nMaria da Silva;123.456.789-09;(62) 99999-0000;maria@email.com\nJoão Souza;;62988887777;\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
    a.download = 'modelo-proprietarios.csv';
    a.click();
  };

  return (
    <div className="min-h-screen">
      <PainelNav />
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-8 md:px-6">
        <TituloPainel titulo="Importar proprietários" contagem="Nome, CPF/CNPJ, telefone e e-mail. Só o nome é obrigatório.">
          <Link href="/dashboard/proprietarios" className="flex h-11 items-center rounded-full bg-[var(--pill-bg)] px-4 text-[13px] font-semibold">
            ← Proprietários
          </Link>
        </TituloPainel>
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] p-5">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => ler(e.target.files?.[0])} />
          <button type="button" onClick={baixarModelo} className="text-sm font-semibold text-accent underline">
            Baixar planilha modelo
          </button>
          <p className="w-full text-xs text-[var(--text-muted)]">
            Aceita Excel (.xlsx) ou CSV. A primeira linha deve ter os títulos das colunas (Nome, CPF, Telefone, E-mail; outros nomes parecidos também servem). Não duplica: se
            o CPF já existir, ou o mesmo nome com o mesmo telefone, só completa o que estiver vazio.
          </p>
        </div>
        {msg && <p className="mt-4 rounded-2xl bg-[var(--pill-bg)] p-3 text-sm font-semibold">{msg}</p>}
        {linhas.length > 0 && (
          <>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--pill-bg)] text-left text-[12px]">
                  <tr>
                    <th className="p-2.5">Nome</th>
                    <th className="p-2.5">CPF/CNPJ</th>
                    <th className="p-2.5">Telefone</th>
                    <th className="p-2.5">E-mail</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.slice(0, 50).map((l, i) => (
                    <tr key={i} className="border-t border-[var(--border)]">
                      <td className="p-2.5 font-semibold">{l.nome}</td>
                      <td className="p-2.5">{formatarDocumento(l.documento) || '·'}</td>
                      <td className="p-2.5">{formatarTelefone(l.telefone) || '·'}</td>
                      <td className="p-2.5">{l.email || '·'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {linhas.length > 50 && <p className="mt-2 text-xs text-[var(--text-muted)]">Mostrando 50 de {linhas.length}.</p>}
            <button type="button" onClick={importar} disabled={rodando} className="mt-4 rounded-full bg-ink px-6 py-3 text-sm font-bold text-white disabled:opacity-50">
              {rodando ? 'Importando…' : `Importar ${linhas.length} proprietário(s)`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
