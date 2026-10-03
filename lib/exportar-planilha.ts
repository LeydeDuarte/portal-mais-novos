'use client';

// Baixar dados do painel em planilha, direto no navegador (nada passa por servidor).
// XLSX: uma aba por tabela. CSV: separado por ponto e vírgula, com BOM, para o Excel
// em português abrir com acentos e colunas certas.
export type Aba = { nome: string; linhas: (string | number | null)[][] };

export async function baixarXlsx(arquivo: string, abas: Aba[]) {
  const { default: writeXlsxFile } = await import('write-excel-file');
  const dados = abas.map((a) =>
    a.linhas.map((l, i) =>
      l.map((v) =>
        v == null || v === ''
          ? null
          : typeof v === 'number'
            ? { value: v, type: Number }
            : { value: String(v), type: String, ...(i === 0 ? { fontWeight: 'bold' as const } : {}) }
      )
    )
  );
  // nomes de aba: até 31 letras, sem caracteres proibidos no Excel
  const nomes = abas.map((a) => a.nome.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (writeXlsxFile as any)(dados, { sheets: nomes, fileName: `${arquivo}.xlsx` });
}

export function baixarCsv(arquivo: string, linhas: (string | number | null)[][]) {
  const cel = (v: string | number | null) => {
    if (v == null) return '';
    if (typeof v === 'number') return String(v).replace('.', ',');
    return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const texto = '\uFEFF' + linhas.map((l) => l.map(cel).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${arquivo}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
