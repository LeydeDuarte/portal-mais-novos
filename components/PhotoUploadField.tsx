'use client';

type Props = {
  fileNames: string[];
  onChange: (names: string[]) => void;
  label?: string;
};

// Campo de fotos — ainda sem servidor de armazenamento de imagem conectado,
// então nada é enviado de verdade: só guarda os nomes dos arquivos
// escolhidos, pra já deixar o espaço certo na tela (cadastro manual ou o que
// a IA vier a preencher) pronto pra quando o upload de verdade existir.
export default function PhotoUploadField({ fileNames, onChange, label = 'Fotos do imóvel' }: Props) {
  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files).map((f) => f.name) : [];
    onChange(files);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-[var(--text-muted)]">{label}</label>
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        className="rounded-lg border border-dashed border-[var(--border)] px-3 py-2.5 text-sm outline-none file:mr-3 file:rounded-full file:border-0 file:bg-[var(--pill-bg)] file:px-3 file:py-1.5 file:text-xs file:font-semibold"
      />
      {fileNames.length > 0 && (
        <span className="text-xs text-[var(--text-faint)]">{fileNames.length} arquivo(s) selecionado(s): {fileNames.join(', ')}</span>
      )}
      <span className="text-xs text-[var(--text-faint)]">
        Ainda sem servidor de imagem conectado — os arquivos selecionados não são enviados nem salvos por enquanto.
      </span>
    </div>
  );
}
